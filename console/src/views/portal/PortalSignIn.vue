<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import api from '../../api'
import { portalSignIn, pendingActivation } from '../../lib/portal-session.js'
import { verifyTOTP, secondsRemaining } from '../../lib/totp.js'
import { qrSvg } from '../../lib/qr.js'
import { demo } from '../../lib/demo-state.js'
import MfaSimulator from '../../components/portal/MfaSimulator.vue'

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

/* ---------------------------------------------------------------- password */
async function submitPassword () {
  error.value = ''
  if (!password.value) { error.value = 'Enter your password.'; return }
  busy.value = true
  try {
    const res = await api.auth.login({ username: user.value.username, password: password.value })

    if (!res?.ok) {
      if (res?.needsActivation) {
        pendingActivation.value = res.user
        router.push('/portal/activate')
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
/**
 * The six the simulator can actually walk somebody through.
 *
 * These are the marketing site's six, not the portal's enrolment list, and
 * the difference is deliberate: that list is what an administrator can turn
 * on, this is what a person picks up at the moment of signing in. SMS and
 * email are here because they are what most people have met before, and a
 * demo that omits the familiar one teaches nobody anything.
 */
const METHODS = [
  { key: 'totp', label: 'Authenticator app', icon: 'fa-mobile-screen', real: true,
    sub: 'A rotating six-digit code',
    note: 'Works with no signal and no data.' },
  { key: 'push', label: 'Push approval', icon: 'fa-bell',
    sub: 'Approve a prompt on your phone',
    note: 'You see what you are approving — and can refuse it.' },
  { key: 'key', label: 'Hardware key', icon: 'fa-key',
    sub: 'Tap a security key',
    note: 'The only method that cannot be phished.' },
  { key: 'bio', label: 'Biometric', icon: 'fa-fingerprint',
    sub: 'Fingerprint on this machine',
    note: 'Nothing to type and nothing to lose.' },
  { key: 'sms', label: 'OTP by SMS', icon: 'fa-comment-dots',
    sub: 'A code to your phone',
    note: 'Familiar, and the weakest of the six — SIMs get swapped.' },
  { key: 'email', label: 'OTP by email', icon: 'fa-envelope',
    sub: 'A code to your inbox',
    note: 'Only as strong as the mailbox it lands in.' }
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

      <!-- Never had a password: there is nothing to type, so do not ask. -->
      <template v-if="needsSetup">
        <p class="p-gs">
          This account has not been set up yet. Choose a password and it is
          yours — this is exactly what a new employee sees on their first day.
        </p>
        <button class="p-btn p-wide-btn" @click="goActivate">
          <i class="fa-solid fa-arrow-right" aria-hidden="true" /> Set up my account
        </button>
      </template>

      <form v-else @submit.prevent="submitPassword">
        <div class="p-field">
          <label for="pp">Password</label>
          <input id="pp" v-model="password" type="password" autocomplete="current-password">
          <p v-if="error" class="p-err">{{ error }}</p>
        </div>
        <button class="p-btn p-wide-btn" :disabled="busy">
          {{ busy ? 'Checking…' : 'Sign in' }}
        </button>
      </form>

      <p v-if="!needsSetup" class="p-gnote">
        The password is checked against a PBKDF2 hash — a wrong one is really
        refused.
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

      <MfaSimulator
        :method="method" :user="user"
        @verified="enter(user)" @other="back"
      />

      <p v-if="demo.mfaSimulator && (method === 'totp')" class="p-simwarn">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true" />
        <span>
          <strong>Teaching mode.</strong>
          The code is shown above so you can try this without a phone. Turn
          “Accept any code” off in the demo-states widget and the authenticator
          is verified against your real enrolled secret instead.
        </span>
      </p>
    </template>

  </div>
</template>
