<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { verifyTOTP, generateTOTP, secondsRemaining } from '../../lib/totp.js'
import { demo } from '../../lib/demo-state.js'

/**
 * The MFA simulator.
 *
 * Ported from the marketing site's `components/v3/MfaSimulator.tsx`, which is
 * the best explanation of multi-factor authentication anybody here has built:
 * it does not describe the six methods, it makes you *do* one. React, Framer
 * Motion and Phosphor there; Vue, CSS and Font Awesome here, because this
 * console carries none of those three and a simulator is not worth 150KB.
 *
 * Four things were worth keeping exactly, and each is a teaching device
 * rather than decoration:
 *
 *  - **The push card shows the request.** Device, IP and location, with
 *    Approve and Reject side by side. The whole point of push is that you
 *    can see what you are approving, and a prompt that only says "allow?"
 *    trains people to tap yes.
 *  - **Reject is a real outcome.** Most demos only model success. Rejecting
 *    here blocks the sign-in and says nothing was logged in, which is the
 *    behaviour that makes push worth having when somebody else has your
 *    password.
 *  - **Two of the three hardware keys fail.** One is FIDO2 and enrolled; the
 *    others are an OTP dongle and a smart card that are not. That is why
 *    "we have tokens already" is not the same as "we have FIDO2".
 *  - **The fingerprint is press-and-hold**, and letting go early fails. A
 *    button that reads your print on a single click teaches nothing.
 *
 * One thing is deliberately different. The marketing simulator *shows* you
 * the authenticator code so you can type it — necessary there, since there is
 * no account. Here the account is real and so is the TOTP, so the code is
 * shown only while the demo-states widget has "Accept any code" switched on,
 * and the screen says which mode it is in.
 */

const props = defineProps({
  /** 'sms' | 'email' | 'totp' | 'push' | 'bio' | 'key' */
  method: { type: String, required: true },
  user: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['verified', 'other'])

/* ------------------------------------------------------------------ data */
const DEVICES = ['iPhone 15 Pro', 'Pixel 8 Pro', 'Galaxy S24', 'iPad Air M2']
const REQUESTERS = ['Chrome · Windows 11', 'Safari · macOS', 'Edge · Windows 11', 'Firefox · Ubuntu']
const LOCATIONS = ['Bengaluru, IN', 'Mumbai, IN', 'Pune, IN', 'Hyderabad, IN', 'Gurugram, IN']
const IPS = ['103.21.58.11', '49.205.142.8', '152.58.19.240', '117.96.203.5', '106.51.74.19']
const pick = (a) => a[Math.floor(Math.random() * a.length)]

const KEYS = [
  { id: 'yubikey', name: 'YubiKey 5 NFC', spec: 'FIDO2 · WebAuthn', ok: true, note: 'Enrolled and ready' },
  { id: 'dongle', name: 'Generic OTP dongle', spec: 'OTP only', ok: false, note: 'Not FIDO2-capable' },
  { id: 'smartcard', name: 'Legacy smart card', spec: 'PIV', ok: false, note: 'Not enrolled for this account' }
]

/** Masked, the way a real prompt masks them: enough to recognise, not to use. */
const maskedPhone = computed(() => {
  const p = String(props.user?.phone || '9876543210').replace(/\D/g, '')
  return `+91 ••••• ${p.slice(-4) || '4821'}`
})
const maskedEmail = computed(() => {
  const e = String(props.user?.email || 'you@example.com')
  const [name, host] = e.split('@')
  return `${name.slice(0, 3)}•••@${host || 'example.com'}`
})

/* ----------------------------------------------------------------- stage */
const stage = ref('idle')     // idle · sending · otp · waiting · denied · scanning · done
const error = ref('')
const status = ref('idle')    // idle · error · ok
const sentCode = ref('')
const entry = ref('')
const boxes = ref([])

const pairedDevice = ref(pick(DEVICES))
const request = ref(null)

/* --------------------------------------------------------- code entry UI */
const DIGITS = 6

function setEntry (v) {
  entry.value = v.replace(/\D/g, '').slice(0, DIGITS)
  if (entry.value.length === DIGITS && status.value === 'idle') submit()
}

function onBox (i, e) {
  const d = e.target.value.replace(/\D/g, '')
  const arr = entry.value.padEnd(DIGITS, ' ').split('')
  if (!d) { arr[i] = ' '; entry.value = arr.join('').trimEnd(); return }
  if (d.length > 1) { setEntry(entry.value.slice(0, i) + d); focusBox(i + d.length); return }
  arr[i] = d
  setEntry(arr.join('').replace(/ /g, ''))
  if (i < DIGITS - 1) focusBox(i + 1)
}
function onKey (i, e) {
  if (e.key === 'Backspace' && !entry.value[i] && i > 0) focusBox(i - 1)
  if (e.key === 'ArrowLeft') focusBox(i - 1)
  if (e.key === 'ArrowRight') focusBox(i + 1)
}
function onPaste (e) {
  e.preventDefault()
  const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, DIGITS)
  if (d) { setEntry(d); focusBox(d.length - 1) }
}
function focusBox (i) { boxes.value[Math.max(0, Math.min(DIGITS - 1, i))]?.focus() }

/* ------------------------------------------------------------ the checks */
async function submit () {
  error.value = ''
  const v = entry.value

  /* The authenticator is the one that can be checked honestly. */
  if (props.method === 'totp' && !demo.mfaSimulator) {
    const ok = props.user?.mfaSecret ? await verifyTOTP(props.user.mfaSecret, v) : false
    return settle(ok, 'That code was not accepted. Codes last 30 seconds — if yours just rolled over, use the new one.')
  }
  if (props.method === 'totp') return settle(v === liveCode.value, 'Not the code showing above.')
  /* SMS and email: the code was generated here and shown in the panel, so
     checking it is honest about what it is — a typing exercise, not proof. */
  return settle(v === sentCode.value, 'That is not the code we sent.')
}

function settle (ok, message) {
  if (ok) {
    status.value = 'ok'
    setTimeout(() => { stage.value = 'done'; emit('verified') }, 420)
    return
  }
  status.value = 'error'
  error.value = message
  setTimeout(() => { entry.value = ''; status.value = 'idle'; focusBox(0) }, 700)
}

/* ------------------------------------------------------------- live TOTP */
const liveCode = ref('------')
const left = ref(secondsRemaining())
let ticker

async function refreshCode () {
  left.value = secondsRemaining()
  if (props.method !== 'totp') return
  if (demo.mfaSimulator) {
    /* No account secret needed: this is the shown-code teaching mode. */
    if (liveCode.value === '------' || left.value === 30) {
      liveCode.value = String(Math.floor(100000 + Math.random() * 900000))
    }
  } else if (props.user?.mfaSecret) {
    liveCode.value = await generateTOTP(props.user.mfaSecret)
  }
}

/* --------------------------------------------------------------- sending */
function send () {
  stage.value = 'sending'
  sentCode.value = String(Math.floor(100000 + Math.random() * 900000))
  setTimeout(() => { stage.value = 'otp'; nextTick(() => focusBox(0)) }, 1100)
}

function firePush () {
  request.value = { dev: pick(REQUESTERS), ip: pick(IPS), loc: pick(LOCATIONS) }
  stage.value = 'waiting'
}

function approve () { stage.value = 'done'; emit('verified') }
function reject () { stage.value = 'denied' }

/* ----------------------------------------------------------- fingerprint */
const scan = ref(0)
const bioFail = ref(false)
let holding = null

function holdStart () {
  if (stage.value === 'done') return
  bioFail.value = false
  holding = setInterval(() => {
    scan.value = Math.min(100, scan.value + 4)
    if (scan.value >= 100) {
      holdEnd(true)
      setTimeout(() => { stage.value = 'done'; emit('verified') }, 450)
    }
  }, 28)
}
function holdEnd (complete = false) {
  clearInterval(holding); holding = null
  if (complete) return
  /* Letting go early is the whole lesson: a reader that accepts a tap is
     reading nothing. */
  if (scan.value > 0 && scan.value < 100) { bioFail.value = true; scan.value = 0 }
}

/* ------------------------------------------------------------- hardware */
const keyTried = ref('')
const keyError = ref('')
function tryKey (k) {
  keyTried.value = k.id
  keyError.value = ''
  if (!k.ok) {
    keyError.value = k.spec === 'OTP only'
      ? 'This dongle generates one-time codes. It cannot do the origin-bound challenge WebAuthn needs, so it cannot prove which site it is talking to — which is the whole reason FIDO2 resists phishing.'
      : 'This card is not enrolled against your account. A key has to be registered before it can answer for you.'
    return
  }
  setTimeout(() => { stage.value = 'done'; emit('verified') }, 700)
}

/* ---------------------------------------------------------------- start */
onMounted(() => {
  if (props.method === 'sms' || props.method === 'email') send()
  else if (props.method === 'push') firePush()
  else if (props.method === 'bio' || props.method === 'key') stage.value = 'scanning'
  else { stage.value = 'otp'; nextTick(() => focusBox(0)) }

  refreshCode()
  ticker = setInterval(refreshCode, 1000)
})
onUnmounted(() => { clearInterval(ticker); clearInterval(holding) })
</script>

<template>
  <div class="m-sim">
    <!-- ------------------------------------------------------- sending -->
    <div v-if="stage === 'sending'" class="m-center">
      <span class="m-spin"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /></span>
      <p class="m-lead">
        Sending a code to
        <strong class="i-tech">{{ method === 'sms' ? maskedPhone : maskedEmail }}</strong>
      </p>
    </div>

    <!-- ------------------------------------------------- code entry -->
    <div v-else-if="stage === 'otp'" class="m-center">
      <p class="m-lead">
        <template v-if="method === 'totp'">Read the code from your authenticator.</template>
        <template v-else>
          Code sent to <strong class="i-tech">{{ method === 'sms' ? maskedPhone : maskedEmail }}</strong>
        </template>
      </p>

      <!-- The teaching panel: the marketing simulator shows the code because
           there is no real account behind it. Here that only happens in
           simulator mode, and it says so. -->
      <div v-if="method === 'totp' && demo.mfaSimulator" class="m-totp">
        <span class="m-totpl">InstaSafe Authenticator</span>
        <strong class="m-totpc i-tech">{{ liveCode }}</strong>
        <span class="m-ring" :style="{ '--f': left / 30 }" aria-hidden="true" />
        <span class="m-totps">{{ left }}s</span>
      </div>
      <div v-else-if="method !== 'totp'" class="m-sent">
        <i class="fa-solid fa-comment-dots" aria-hidden="true" />
        <span>This demo sends nothing. Your code is <strong class="i-tech">{{ sentCode }}</strong>.</span>
      </div>

      <div class="m-otp" :class="{ 'is-shake': status === 'error' }" role="group" aria-label="Six digit code">
        <input
          v-for="i in DIGITS" :key="i" ref="boxes"
          class="m-cell" :class="{ 'is-bad': status === 'error', 'is-ok': status === 'ok' }"
          :value="entry[i - 1] || ''" inputmode="numeric" maxlength="1"
          autocomplete="one-time-code" :aria-label="`Digit ${i} of 6`"
          @input="onBox(i - 1, $event)" @keydown="onKey(i - 1, $event)"
          @paste="onPaste" @focus="$event.target.select()"
        >
      </div>

      <p v-if="error" class="p-err">{{ error }}</p>
      <button class="p-btn p-ghost m-alt" @click="emit('other')">Try another method</button>
    </div>

    <!-- -------------------------------------------------- push waiting -->
    <div v-else-if="stage === 'waiting'" class="m-center">
      <p class="m-lead">
        <i class="fa-solid fa-bell m-bell" aria-hidden="true" />
        Push sent to <strong>{{ pairedDevice }}</strong>
      </p>

      <!-- What you are approving. A prompt that only says "allow?" trains
           people to tap yes; this is the whole value of push. -->
      <div class="m-phone">
        <div class="m-phoneh">
          <strong>Approve sign-in?</strong>
          <small>Only approve if this is you</small>
        </div>
        <dl class="m-req">
          <div><dt><i class="fa-solid fa-display" aria-hidden="true" /> Device</dt><dd>{{ request.dev }}</dd></div>
          <div><dt><i class="fa-solid fa-globe" aria-hidden="true" /> IP address</dt><dd class="i-tech">{{ request.ip }}</dd></div>
          <div><dt><i class="fa-solid fa-location-dot" aria-hidden="true" /> Location</dt><dd>{{ request.loc }}</dd></div>
        </dl>
        <div class="m-acts">
          <button class="m-reject" @click="reject"><i class="fa-solid fa-xmark" aria-hidden="true" /> Reject</button>
          <button class="m-approve" @click="approve"><i class="fa-solid fa-check" aria-hidden="true" /> Approve</button>
        </div>
      </div>
      <p class="m-hint">Press one as if you were holding the phone.</p>
    </div>

    <!-- --------------------------------------------------------- denied -->
    <div v-else-if="stage === 'denied'" class="m-center">
      <span class="m-mark is-bad"><i class="fa-solid fa-xmark" aria-hidden="true" /></span>
      <h3 class="m-h">Sign-in blocked</h3>
      <p class="m-lead">
        You rejected the request, so nothing was signed in. This is what
        happens when somebody else has your password and you do not approve.
      </p>
      <div class="m-row">
        <button class="p-btn" @click="firePush"><i class="fa-solid fa-rotate" aria-hidden="true" /> Send again</button>
        <button class="p-btn p-ghost" @click="emit('other')">Another method</button>
      </div>
    </div>

    <!-- ---------------------------------------------------- fingerprint -->
    <div v-else-if="stage === 'scanning' && method === 'bio'" class="m-center">
      <p class="m-lead">
        {{ bioFail ? 'Let go too early — hold it this time.'
          : scan >= 100 ? 'Fingerprint matched'
          : scan > 0 ? 'Reading your print…' : 'Press and hold the sensor' }}
      </p>

      <button
        class="m-bio" :class="{ 'is-bad': bioFail }"
        :style="{ '--p': scan + '%' }"
        aria-label="Press and hold to scan your fingerprint"
        @pointerdown.prevent="holdStart" @pointerup="holdEnd()"
        @pointerleave="holdEnd()" @pointercancel="holdEnd()"
        @keydown.space.prevent="holdStart" @keyup.space="holdEnd()"
      >
        <i class="fa-solid fa-fingerprint" aria-hidden="true" />
        <span class="m-biofill" aria-hidden="true" />
      </button>

      <p class="m-hint">
        Holding is the point. A reader that accepts a tap has read nothing.
      </p>
      <button class="p-btn p-ghost m-alt" @click="emit('other')">Try another method</button>
    </div>

    <!-- ------------------------------------------------------ hardware -->
    <div v-else-if="stage === 'scanning' && method === 'key'" class="m-center m-keys">
      <p class="m-lead">Which key are you holding?</p>
      <button
        v-for="k in KEYS" :key="k.id" class="m-key"
        :class="{ 'is-bad': keyTried === k.id && !k.ok, 'is-ok': keyTried === k.id && k.ok }"
        @click="tryKey(k)"
      >
        <i class="fa-solid fa-key" aria-hidden="true" />
        <span>
          <strong>{{ k.name }}</strong>
          <small class="i-tech">{{ k.spec }}</small>
        </span>
        <small class="m-keynote">{{ k.note }}</small>
      </button>

      <p v-if="keyError" class="m-keyerr">
        <i class="fa-solid fa-circle-exclamation" aria-hidden="true" /> {{ keyError }}
      </p>
      <button class="p-btn p-ghost m-alt" @click="emit('other')">Try another method</button>
    </div>

    <!-- ----------------------------------------------------------- done -->
    <div v-else-if="stage === 'done'" class="m-center">
      <span class="m-mark is-ok"><i class="fa-solid fa-check" aria-hidden="true" /></span>
      <h3 class="m-h">Verified</h3>
      <p class="m-lead">Signing you in…</p>
    </div>
  </div>
</template>
