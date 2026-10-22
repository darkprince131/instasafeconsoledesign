<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import api from '../../api'
import { portalSignIn, pendingActivation } from '../../lib/portal-session.js'
import { verifyTOTP, secondsRemaining } from '../../lib/totp.js'
import { qrSvg } from '../../lib/qr.js'
import { demo } from '../../lib/demo-state.js'
import MfaSimulator from '../../components/portal/MfaSimulator.vue'
import MfaArt from '../../components/portal/MfaArt.vue'

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
const needsSetup = ref(false)
/* Set when the address is not in this tenant, so the first step can say so
   rather than letting the password step fail with nothing to do about it. */
const unknown = ref('')

/* ------------------------------------------------------------- who are you */
async function submitWho () {
  error.value = ''
  unknown.value = ''
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
    /* An address that is not in this tenant used to walk on to a password
       box and fail there with no way forward. Say so here, where it can be
       corrected, and offer the account that does exist. */
    if (!hit) { unknown.value = v; return }
    unknown.value = ''
    user.value = hit

    /* An account nobody has ever set a password on should not be handed a
       password box. The note said "continue and you will be taken to set
       one" and then asked for a password anyway, which is a dead end with
       encouraging copy on it — there is nothing to type and no way forward.
       In production the server answers this; here the record is local. */
    needsSetup.value = !!hit && !hit.passwordHash

    step.value = 'password'
    await nextTick()
    if (!needsSetup.value) document.getElementById('pp')?.focus()
  } finally { busy.value = false }
}

/** Fills in the account the demo actually has, so an unknown address is a
 *  wrong turn rather than a wall. */
function useSuggested () {
  email.value = suggestion.value
  unknown.value = ''
  submitWho()
}

/* ---------------------------------------------------------------- password */
async function submitPassword () {
  error.value = ''
  if (!password.value) { error.value = 'Enter your password.'; return }
  busy.value = true
  try {
    const res = await api.auth.login({ username: user.value.username, password: password.value })

    if (!res?.ok) {
      error.value = res?.error || 'Sign-in failed.'
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
/**
 * The six the simulator can actually walk somebody through.
 *
 * These are the marketing site's six, not the portal's enrolment list, and
 * the difference is deliberate: that list is what an administrator can turn
 * on, this is what a person picks up at the moment of signing in. SMS and
 * email are here because they are what most people have met before, and a
 * demo that omits the familiar one teaches nobody anything.
 */
/**
 * Velto's six, named as velto names them.
 *
 * Its Two Factor Authentication screen offers TOTP, Authenticator, SMS,
 * E-mail, Hardware Key and Use Backup Code, as a three-by-two grid of tiles.
 * The set is kept exactly; what changes is the shape and what the screen
 * says while you are choosing.
 *
 * Velto draws six identical tiles with a word under each and no explanation
 * anywhere, so the choice is made on familiarity — which is how everybody
 * ends up on SMS, the weakest of the six. Stacked here, with a drawing of the
 * mechanism beside them and one line on what each costs you, the choice is
 * made on something.
 *
 * TOTP and Authenticator look like duplicates and are not: one is a code you
 * read out of any authenticator app, the other is InstaSafe's own app
 * answering a push. Velto distinguishes them and so does this.
 */
const METHODS = [
  { key: 'totp', label: 'TOTP', icon: 'fa-clock', real: true,
    sub: 'A rotating code from an authenticator app',
    good: 'Works with no signal and no data — nothing is ever sent, so nothing can be intercepted.',
    hint: 'Open your authenticator app and read the six digits for InstaSafe.' },
  { key: 'push', label: 'Authenticator', icon: 'fa-bell',
    sub: 'Approve a prompt in the InstaSafe app',
    good: 'You see the device, address and location before you approve — and you can refuse.',
    hint: 'Check the request matches where you are, then approve or reject it.' },
  { key: 'sms', label: 'SMS', icon: 'fa-comment-dots',
    sub: 'A code sent to your phone number',
    good: 'The most familiar, and the weakest here: a number can be ported away from you.',
    hint: 'Type the code from the text message.' },
  { key: 'email', label: 'E-mail', icon: 'fa-envelope',
    sub: 'A code sent to your inbox',
    good: 'Only as strong as the mailbox it lands in — which is often protected by a password alone.',
    hint: 'Type the code from the email.' },
  { key: 'key', label: 'Hardware Key', icon: 'fa-key',
    sub: 'A security key, or this machine’s fingerprint reader',
    good: 'The only one that cannot be phished: the key checks which site is asking before it answers.',
    hint: 'Pick the key you are holding.' },
  { key: 'backup', label: 'Use Backup Code', icon: 'fa-list-ol',
    sub: 'One of the ten you saved',
    good: 'The way back in when the phone is lost, broken or flat. Each code works once.',
    hint: 'Enter any one of your saved codes.' }
]


const method = ref(null)
/* What the right-hand pane explains while nothing is chosen yet. */
const preview = ref('')
const shown = computed(() => METHODS.find(m => m.key === preview.value) || null)
const code = ref('')
const left = ref(secondsRemaining())
const pushState = ref('idle')     // idle · waiting · approved
const secret = ref('')
const uri = ref('')
let ticker

const qr = computed(() => uri.value ? qrSvg(uri.value, 4) : '')
const chosen = computed(() => METHODS.find(m => m.key === method.value) || null)

function pick (m) {
  method.value = m.key
  error.value = ''
  step.value = 'method'
}

/** A push nobody can send still has a shape, and the shape is the point. */



function enter (u) {
  clearInterval(ticker)
  portalSignIn(u)
  router.push('/portal')
}

function goActivate () {
  pendingActivation.value = user.value
  router.push('/portal/activate')
}

function back () {
  error.value = ''
  if (step.value === 'method') {
    step.value = 'choose'; method.value = null; preview.value = ''
    clearInterval(ticker); return
  }
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

      <!-- An address this tenant has never heard of. Velto answers this with
           "no such user", which tells anybody with a list of addresses which
           ones are real; this demo has one tenant and no such list, and
           walking on to a password box that can only fail is worse. -->
      <p v-if="unknown" class="p-err mt-3">
        <code class="i-tech">{{ unknown }}</code> is not an account in this
        tenant.
        <button v-if="suggestion" class="p-linkish" @click="useSuggested">
          Use {{ suggestion }} instead
        </button>
      </p>

      <p v-if="suggestion" class="p-gnote">
        In this demo, <code class="i-tech">{{ suggestion }}</code> is a real
        account. Any password gets in — there is no way for you to know this
        one's, so checking it could only ever lock you out. Any account created
        in the administrator console works here too.
      </p>

      <p class="p-gnote">
        <strong>Administrators sign in here too.</strong>
        It is one product: what you see depends on what your account is
        allowed to do. An administrator account lands on the console that runs
        the tenant, everybody else lands on their own access.
        <RouterLink to="/signin">Administrator sign-in</RouterLink> —
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

      <p v-if="needsSetup" class="p-gs">
        Nobody has set a password on this account yet. Type anything to carry
        on, or set one properly — that is the screen a new employee gets on
        their first day.
      </p>

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

      <button class="p-ghost-btn" @click="goActivate">
        Set a password instead
      </button>

      <p class="p-gnote">
        Any password gets in. There is no way for you to know a seeded
        account's password, so checking it could only ever lock you out. The
        second factor after this is verified for real, and setting a password
        really does hash it.
      </p>
    </template>

    <!-- ------------------------------------------- the second factor -->
    <template v-else>
      <button class="p-back" @click="back">
        <i class="fa-solid fa-arrow-left" aria-hidden="true" />
        {{ step === 'method' ? 'Other methods' : 'Back' }}
      </button>

      <h1 class="p-gh">Two-factor authentication</h1>
      <p class="p-gs">
        {{ step === 'method'
          ? chosen?.sub
          : 'Your password is one half. Choose how you want to prove the other.' }}
      </p>

      <!-- Two panes: the choice on the left, what it means on the right.
           Velto gives six tiles and no explanation, so people pick the one
           they recognise — which is how everybody ends up on SMS. -->
      <div class="p-2up">
        <ul class="p-mlist">
          <li v-for="m in METHODS" :key="m.key">
            <button
              class="p-mrow" :class="{ 'is-on': method === m.key }"
              @mouseenter="preview = m.key" @mouseleave="preview = ''"
              @focus="preview = m.key" @blur="preview = ''"
              @click="pick(m)"
            >
              <span class="p-micon"><i class="fa-solid" :class="m.icon" aria-hidden="true" /></span>
              <span class="p-mbody">
                <strong>
                  {{ m.label }}
                  <span v-if="m.real" class="p-tag is-ok">verified for real</span>
                </strong>
                <small>{{ m.sub }}</small>
              </span>
              <i class="fa-solid fa-chevron-right p-mchev" aria-hidden="true" />
            </button>
          </li>
        </ul>

        <aside class="p-side" :class="{ 'is-live': step === 'method' }">
          <!-- Before a choice: the drawing explains the mechanism. After
               one: the simulator runs, and the drawing sits above it. -->
          <MfaArt :method="step === 'method' ? method : preview" />

          <template v-if="step === 'method'">
            <MfaSimulator
              :key="method" :method="method" :user="user"
              @verified="enter(user)" @other="back"
            />
            <p class="p-sidehint">
              <i class="fa-solid fa-circle-info" aria-hidden="true" />
              <span>{{ chosen?.hint }}</span>
            </p>
          </template>

          <template v-else>
            <h2 class="p-sideh">{{ shown ? shown.label : 'Why a second factor' }}</h2>
            <p class="p-sidep">
              {{ shown
                ? shown.good
                : 'A password can be guessed, reused or stolen without you knowing. A second factor is something you physically have, so knowing the password is not enough.' }}
            </p>
            <p class="p-sidehint">
              <i class="fa-solid fa-hand-pointer" aria-hidden="true" />
              <span>
                {{ shown
                  ? 'Choose it on the left to try it. Nothing here signs you in to anything real.'
                  : 'Point at any method to see how it works. Choose one to try it.' }}
              </span>
            </p>
          </template>
        </aside>
      </div>

      <p v-if="demo.mfaSimulator && step === 'method' && method === 'totp'" class="p-simwarn">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true" />
        <span>
          <strong>Teaching mode.</strong>
          The code is shown so you can try this without a phone. Turn “Accept
          any code” off in the demo-states widget and the authenticator is
          verified against your real enrolled secret instead.
        </span>
      </p>
    </template>

  </div>
</template>
