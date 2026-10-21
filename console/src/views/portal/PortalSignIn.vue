<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import api from '../../api'
import { portalSignIn } from '../../lib/portal-session.js'
import { verifyTOTP, secondsRemaining } from '../../lib/totp.js'
import { qrSvg } from '../../lib/qr.js'
import { demo } from '../../lib/demo-state.js'

/**
 * Signing in to the member portal.
 *
 * Three questions, one at a time: who are you, prove it, prove it again.
 * Velto asks for a username and a password on one screen; this asks for the
 * address first and then the password, which is what every product an
 * employee already uses does, and it lets the second screen greet them by
 * name so they can see they typed the right address before committing a
 * password to it.
 *
 * The third question is the one velto does not ask well. An account can have
 * six different second factors and velto picks one; here the person chooses,
 * because the right answer depends on what they are holding — the phone is
 * in a drawer, the laptop has a fingerprint reader, they are on a train with
 * no signal.
 *
 * Two of the six are genuinely verified. The rest cannot be, in a browser,
 * and say so. The "accept any code" switch in the demo-states widget turns
 * the honest verification off for walking somebody through the flow without
 * a phone — and when it is on, the screen says so rather than letting a
 * reviewer believe a wrong code was accepted on purpose.
 */

const router = useRouter()

const step = ref('who')        // who · password · choose · method
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)
const user = ref(null)
const suggestion = ref('')

/* ------------------------------------------------------------- who are you */
async function submitWho () {
  error.value = ''
  const v = email.value.trim()
  if (!v) { error.value = 'Enter your email address or username.'; return }
  busy.value = true
  try {
    /* Velto answers "no such user" here, which tells anybody with a list of
       addresses which ones are real. This moves on regardless and lets the
       password step fail, so an unknown address and a wrong password are
       indistinguishable from outside. */
    const res = await api.users.list({ perPage: 1, search: v })
    const hit = (res.data || []).find(u =>
      u.username?.toLowerCase() === v.toLowerCase() ||
      u.email?.toLowerCase() === v.toLowerCase())
    user.value = hit || { username: v, firstName: '', email: v, unknown: true }
    step.value = 'password'
    await nextTick()
    document.getElementById('pp')?.focus()
  } finally { busy.value = false }
}

/* ---------------------------------------------------------------- password */
async function submitPassword () {
  error.value = ''
  if (!password.value) { error.value = 'Enter your password.'; return }
  busy.value = true
  try {
    const res = await api.auth.login({ username: user.value.username, password: password.value })

    if (!res?.ok) {
      if (res?.needsActivation) {
        router.push({ path: '/portal/activate', state: { activateUser: res.user } })
        return
      }
      error.value = res?.error || 'That email and password do not match.'
      return
    }

    user.value = res.user

    /* The administrator decides whether a second factor is asked for. The
       demo switch stands in for that decision so a reviewer can see both
       paths without editing a user. */
    const needs = demo.mfaRequired && (res.mfaRequired || res.user?.mfaRequired)
    if (!needs) { enter(res.user); return }

    step.value = 'choose'
  } catch (e) {
    error.value = e?.message || 'Sign-in failed.'
  } finally { busy.value = false }
}

/* ------------------------------------------------------- the second factor */
const METHODS = [
  { key: 'totp', label: 'Authenticator app', icon: 'fa-mobile-screen',
    sub: 'A six-digit code from your phone', real: true,
    note: 'Works with no signal and no data.' },
  { key: 'push', label: 'Push notification', icon: 'fa-bell',
    sub: 'Approve a prompt on your phone',
    note: 'Fastest, but needs a data connection.' },
  { key: 'fido', label: 'Security key', icon: 'fa-key', real: true,
    sub: 'A hardware key, Touch ID or Windows Hello',
    note: 'The only one that cannot be phished.' },
  { key: 'cert', label: 'Device certificate', icon: 'fa-certificate',
    sub: 'This machine proves itself',
    note: 'Nothing to type. Needs the agent installed.' },
  { key: 'backup', label: 'Backup code', icon: 'fa-list-ol',
    sub: 'One of the ten you saved',
    note: 'For when the phone is lost, broken or flat.' },
  { key: 'os', label: 'Computer sign-in', icon: 'fa-desktop',
    sub: 'The factor your machine login uses',
    note: 'Set up by your administrator with the agent.' }
]

const method = ref(null)
const code = ref('')
const left = ref(secondsRemaining())
const pushState = ref('idle')     // idle · waiting · approved
const secret = ref('')
const uri = ref('')
let ticker

const qr = computed(() => uri.value ? qrSvg(uri.value, 4) : '')
const chosen = computed(() => METHODS.find(m => m.key === method.value) || null)

async function pick (m) {
  method.value = m.key
  code.value = ''
  error.value = ''
  step.value = 'method'

  clearInterval(ticker)
  ticker = setInterval(() => { left.value = secondsRemaining() }, 1000)

  if (m.key === 'push') await sendPush()
  if (m.key === 'fido') await useKey()
}

/** A push nobody can send still has a shape, and the shape is the point. */
async function sendPush () {
  pushState.value = 'waiting'
  await api.inbox.list({ perPage: 1 }).catch(() => {})
  setTimeout(() => {
    if (pushState.value === 'waiting') pushState.value = 'approved'
  }, 2600)
}

async function useKey () {
  error.value = ''
  if (!window.PublicKeyCredential) {
    error.value = 'This browser has no WebAuthn support, so there is no key to ask.'
    return
  }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const cred = await navigator.credentials.get({
      publicKey: { challenge, timeout: 60000, userVerification: 'preferred' }
    })
    if (cred) enter(user.value)
  } catch (e) {
    error.value = e?.name === 'NotAllowedError'
      ? 'Cancelled, or the key was not touched in time.'
      : 'No registered key answered. Register one from the portal first, or choose another method.'
  }
}

async function submitCode () {
  error.value = ''
  const entered = code.value.replace(/\s/g, '')
  if (!entered) { error.value = 'Enter the code.'; return }
  busy.value = true
  try {
    /* The authenticator is the one that can be checked honestly, so it is,
       unless the reviewer has asked for the simulator. Everything else has
       no verifier in a browser and the screen says as much. */
    if (method.value === 'totp' && !demo.mfaSimulator) {
      const stored = user.value?.mfaSecret
      const ok = stored
        ? await verifyTOTP(stored, entered)
        : await api.auth.verifyMfa({ userId: user.value.id, code: entered }).then(r => r?.ok)
      if (!ok) {
        error.value = 'That code was not accepted. Codes last 30 seconds — if yours just rolled over, use the new one.'
        return
      }
    }
    enter(user.value)
  } finally { busy.value = false }
}

function enter (u) {
  clearInterval(ticker)
  portalSignIn(u)
  router.push('/portal')
}

function back () {
  error.value = ''
  if (step.value === 'method') { step.value = 'choose'; method.value = null; clearInterval(ticker); return }
  if (step.value === 'choose') { step.value = 'password'; return }
  if (step.value === 'password') { step.value = 'who'; password.value = ''; return }
}

onMounted(async () => {
  try {
    const res = await api.users.list({
      page: 1, perPage: 10, sort: 'id', dir: 'asc',
      filters: { status: 'active', mfaEnrolled: false }
    })
    suggestion.value = (res.data || []).find(u => !u.isAdmin)?.email ||
      (res.data || []).find(u => !u.isAdmin)?.username || ''
  } catch { suggestion.value = '' }
})
onUnmounted(() => clearInterval(ticker))
</script>

<template>
  <div class="p-gate p-act">
    <!-- ------------------------------------------------------------ who -->
    <template v-if="step === 'who'">
      <h1 class="p-gh">Sign in</h1>
      <p class="p-gs">Use the account your administrator created for you.</p>

      <form @submit.prevent="submitWho">
        <div class="p-field">
          <label for="pu">Email address</label>
          <input
            id="pu" v-model="email" type="text" autocomplete="username"
            placeholder="you@company.com" autofocus
          >
          <p v-if="error" class="p-err">{{ error }}</p>
        </div>
        <button class="p-btn p-wide-btn" :disabled="busy">Continue</button>
      </form>

      <p v-if="suggestion" class="p-gnote">
        In this demo, <code class="i-tech">{{ suggestion }}</code> is a real
        account with no password set yet — continue and you will be taken to
        set one, which is what an employee sees on their first day. Any
        account created in the administrator console works here too.
      </p>

      <p class="p-gnote">
        <strong>Are you the administrator?</strong>
        The console is a separate product with its own sign-in:
        <RouterLink to="/signin">administrator sign-in</RouterLink> —
        <code class="i-tech">admin</code> / <code class="i-tech">demo</code>.
      </p>
    </template>

    <!-- ------------------------------------------------------- password -->
    <template v-else-if="step === 'password'">
      <button class="p-back" @click="back">
        <i class="fa-solid fa-arrow-left" aria-hidden="true" /> Back
      </button>

      <span class="p-heroav p-actav">
        {{ (user?.firstName || user?.username || '?').slice(0, 1).toUpperCase() }}
      </span>
      <h1 class="p-gh">{{ user?.firstName ? `Hello, ${user.firstName}` : 'Enter your password' }}</h1>
      <p class="p-gs i-tech">{{ user?.email || user?.username }}</p>

      <form @submit.prevent="submitPassword">
        <div class="p-field">
          <label for="pp">Password</label>
          <input id="pp" v-model="password" type="password" autocomplete="current-password">
          <p v-if="error" class="p-err">{{ error }}</p>
        </div>
        <button class="p-btn p-wide-btn" :disabled="busy">
          {{ busy ? 'Checking…' : 'Sign in' }}
        </button>
      </form>

      <p class="p-gnote">
        The password is checked against a PBKDF2 hash — a wrong one is really
        refused. An account that has never had one is sent to set it rather
        than rejected.
      </p>
    </template>

    <!-- --------------------------------------------------- choose factor -->
    <template v-else-if="step === 'choose'">
      <button class="p-back" @click="back">
        <i class="fa-solid fa-arrow-left" aria-hidden="true" /> Back
      </button>

      <h1 class="p-gh">Prove it is you</h1>
      <p class="p-gs">
        Your administrator requires a second factor. Choose whichever you have
        to hand.
      </p>

      <ul class="p-methods">
        <li v-for="m in METHODS" :key="m.key">
          <button class="p-method" @click="pick(m)">
            <span class="p-micon"><i class="fa-solid" :class="m.icon" aria-hidden="true" /></span>
            <span class="p-mbody">
              <strong>
                {{ m.label }}
                <span v-if="m.real" class="p-tag is-ok">verified for real</span>
              </strong>
              <small>{{ m.sub }}</small>
              <small class="p-mnote">{{ m.note }}</small>
            </span>
            <i class="fa-solid fa-chevron-right p-mchev" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </template>

    <!-- -------------------------------------------------------- a method -->
    <template v-else>
      <button class="p-back" @click="back">
        <i class="fa-solid fa-arrow-left" aria-hidden="true" /> Other methods
      </button>

      <span class="p-micon is-lg"><i class="fa-solid" :class="chosen?.icon" aria-hidden="true" /></span>
      <h1 class="p-gh">{{ chosen?.label }}</h1>

      <!-- ---------------------------------------------- authenticator -->
      <template v-if="method === 'totp'">
        <p class="p-gs">Open your authenticator app and read the code for InstaSafe.</p>
        <form @submit.prevent="submitCode">
          <div class="p-field">
            <label for="mc">Six digits</label>
            <input
              id="mc" v-model="code" class="p-code" inputmode="numeric"
              maxlength="7" placeholder="000000" autocomplete="one-time-code" autofocus
            >
            <p class="p-hint">Changes in {{ left }}s.</p>
            <p v-if="error" class="p-err">{{ error }}</p>
          </div>
          <button class="p-btn p-wide-btn" :disabled="busy">
            {{ busy ? 'Checking…' : 'Verify' }}
          </button>
        </form>
      </template>

      <!-- ------------------------------------------------------- push -->
      <template v-else-if="method === 'push'">
        <p class="p-gs">We have sent a prompt to the InstaSafe app on your phone.</p>
        <div class="p-push" :class="'is-' + pushState">
          <i
            class="fa-solid"
            :class="pushState === 'approved' ? 'fa-circle-check' : 'fa-circle-notch fa-spin'"
            aria-hidden="true"
          />
          <p>{{ pushState === 'approved' ? 'Approved on your phone' : 'Waiting for you to approve it…' }}</p>
        </div>
        <button class="p-btn p-wide-btn" :disabled="pushState !== 'approved'" @click="enter(user)">
          Continue
        </button>
        <p class="p-gnote">
          Simulated. A real push needs InstaSafe's notification service, which
          a browser cannot stand in for — so this shows the shape of the wait
          rather than pretending a phone answered.
        </p>
      </template>

      <!-- -------------------------------------------------- security key -->
      <template v-else-if="method === 'fido'">
        <p class="p-gs">
          Touch your key, or use the fingerprint reader on this machine.
        </p>
        <p v-if="error" class="p-err">{{ error }}</p>
        <button class="p-btn p-wide-btn" @click="useKey">Try again</button>
        <p class="p-gnote">
          Real WebAuthn: your browser is genuinely asked for a registered
          credential. If none exists on this machine, it fails — which is the
          honest answer, not a bug.
        </p>
      </template>

      <!-- ------------------------------------------------- backup code -->
      <template v-else-if="method === 'backup'">
        <p class="p-gs">Enter one of the codes you saved. Each works once.</p>
        <form @submit.prevent="submitCode">
          <div class="p-field">
            <label for="bc">Backup code</label>
            <input id="bc" v-model="code" class="p-code" placeholder="XXXX-XXXX" autofocus>
            <p v-if="error" class="p-err">{{ error }}</p>
          </div>
          <button class="p-btn p-wide-btn" :disabled="busy">Verify</button>
        </form>
        <p class="p-gnote">
          Simulated. The codes this console generates are real random, but
          nothing here has the list to check yours against.
        </p>
      </template>

      <!-- ------------------------------------------ certificate / OS MFA -->
      <template v-else>
        <p class="p-gs">
          <template v-if="method === 'cert'">
            The agent presents this machine's certificate. Nothing to type.
          </template>
          <template v-else>
            Your computer login already carries the second factor.
          </template>
        </p>
        <button class="p-btn p-wide-btn" @click="enter(user)">Continue</button>
        <p class="p-gnote">
          Simulated. This one needs the signed agent and the company CA, which
          are not part of a browser demo.
        </p>
      </template>

      <p v-if="demo.mfaSimulator && (method === 'totp' || method === 'backup')" class="p-simwarn">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true" />
        <span>
          <strong>Any code is being accepted.</strong>
          The demo-states widget has “Accept any code” switched on. Turn it off
          and the authenticator is verified for real.
        </span>
      </p>
    </template>
  </div>
</template>
