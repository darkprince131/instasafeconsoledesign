<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../api'
import { portalSignIn } from '../../lib/portal-session.js'
import { secondsRemaining, generateTOTP } from '../../lib/totp.js'
import { qrSvg } from '../../lib/qr.js'

/**
 * Portal sign-in.
 *
 * Username and password, then a code if the account has multi-factor. The
 * same TOTP verification the admin console uses, because it is the same
 * secret — enrolled here, checked here.
 *
 * The demo hint is explicit rather than coy. A sign-in screen that silently
 * rejects every attempt because nobody can guess the password is a worse demo
 * than one that tells you what to type.
 */

const router = useRouter()

const step = ref('credentials')     // credentials · enrol · mfa
const username = ref('')
const password = ref('')
const code = ref('')
const error = ref('')
const busy = ref(false)
const pending = ref(null)
const suggestion = ref('')
const noSecret = ref(false)

onMounted(async () => {
  /* Offer a real account from this tenant rather than a made-up one, so the
     name on screen is one that actually signs in — and not the administrator,
     who is the wrong person to be demonstrating an end-user portal with. */
  try {
    /* Not the administrator, and not somebody already enrolled: the seeded
       "enrolled" users carry the flag without a secret anybody holds, so
       signing in as one lands on a code prompt that can never be satisfied.
       An unenrolled account puts the demo on the path worth showing. */
    const res = await api.users.list({
      page: 1, perPage: 10, filters: { status: 'active', mfaEnrolled: false }
    })
    suggestion.value = (res.data || []).find(u => !u.isAdmin)?.username || ''
  } catch { suggestion.value = '' }
})

async function submitCredentials () {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = 'Enter your username and password.'
    return
  }
  busy.value = true
  try {
    const res = await api.auth.login({ username: username.value.trim(), password: password.value })
    if (!res?.ok) {
      error.value = res?.error || 'That username and password do not match.'
      return
    }
    /* Three ways out of a correct password:
       enrolled -> prove it; required but not enrolled -> enrol now;
       otherwise -> straight in. */
    if (res.mfaRequired) {
      pending.value = res.user
      step.value = 'mfa'
      return
    }
    if (res.user?.mfaRequired && !res.user?.mfaEnrolled) {
      await beginEnrolment(res.user)
      return
    }
    enter(res.user)
  } catch (e) {
    error.value = e?.message || 'Sign-in failed.'
  } finally { busy.value = false }
}

/* ---- enrolment, as a step of signing in ---------------------------------
   An employee does not go looking for a settings page to turn on MFA. The
   administrator requires it, and the next time they sign in they are asked to
   enrol before they get any further. That is where this belongs, and it is
   why the member portal has no settings screen to put it on.

   The TOTP is the real thing: RFC 6238 over Web Crypto, a genuine otpauth://
   URI, and a secret that stays unconfirmed until a correct code proves the
   phone actually has it. */
const secret = ref('')
const uri = ref('')
const left = ref(30)
const preview = ref('')
let ticker

const qr = computed(() => uri.value ? qrSvg(uri.value, 170) : '')

async function beginEnrolment (user) {
  pending.value = user
  const res = await api.auth.startMfaEnrolment({ userId: user.id })
  secret.value = res.secret
  uri.value = res.uri
  step.value = 'enrol'
  clearInterval(ticker)
  ticker = setInterval(tick, 1000)
  tick()
}

async function tick () {
  left.value = secondsRemaining()
  if (!secret.value) return
  try { preview.value = await generateTOTP(secret.value) } catch { preview.value = '' }
}

async function submitEnrolment () {
  error.value = ''
  busy.value = true
  try {
    const res = await api.auth.confirmMfaEnrolment({ userId: pending.value.id, code: code.value.trim() })
    if (!res?.ok) {
      error.value = 'That code is not right. Codes change every 30 seconds — wait for the next one and try again.'
      return
    }
    clearInterval(ticker)
    enter({ ...pending.value, mfaEnrolled: true })
  } finally { busy.value = false }
}

onUnmounted(() => clearInterval(ticker))

async function submitCode () {
  error.value = ''
  busy.value = true
  try {
    const res = await api.auth.verifyMfa({ userId: pending.value.id, code: code.value.trim() })
    if (!res?.ok) {
      /* Distinguish "wrong code" from "there is no secret to check against".
         The second is the lost-phone case, and the only way out of it is an
         administrator reset — saying so beats letting someone retype six
         digits at a prompt that cannot ever accept them. */
      /* "No secret to check against" is the lost-phone case and cannot be
         solved by typing more digits. Offer the way out instead of a wall. */
      if (/not set up/i.test(res?.error || '')) {
        noSecret.value = true
        error.value = 'This account requires a code but has no authenticator registered.'
      } else {
        error.value = 'That code is not right. Codes change every 30 seconds — wait for the next one and try again.'
      }
      return
    }
    enter(pending.value)
  } finally { busy.value = false }
}

function enter (user) {
  portalSignIn(user)
  router.push('/portal')
}
</script>

<template>
  <div class="p-card p-narrow">
    <h1 class="p-h1">Sign in</h1>
    <p class="p-lede">Use the account your administrator created for you.</p>

    <form v-if="step === 'credentials'" @submit.prevent="submitCredentials">
      <div class="p-field">
        <label for="pu">Username</label>
        <input id="pu" v-model="username" autocomplete="username" autofocus>
      </div>
      <div class="p-field">
        <label for="pp">Password</label>
        <input id="pp" v-model="password" type="password" autocomplete="current-password">
      </div>

      <p v-if="error" class="p-err">{{ error }}</p>

      <button class="p-btn" :disabled="busy">{{ busy ? 'Checking…' : 'Sign in' }}</button>

      <p class="p-hint">
        This is a demo tenant. Any password is accepted<template v-if="suggestion">,
        and <code>{{ suggestion }}</code> is a real account in it</template>.
      </p>
    </form>

    <!-- enrolment, before they are let in -->
    <form v-else-if="step === 'enrol'" @submit.prevent="submitEnrolment">
      <p class="p-lede">
        Your administrator requires a second step at sign-in. Set it up once,
        now, and you will not be asked again.
      </p>

      <ol class="p-steps">
        <li>
          <strong>Scan this with an authenticator app.</strong>
          <div class="p-qr" v-html="qr" />
          <p class="p-note">
            Google Authenticator, Authy, 1Password, Microsoft Authenticator.
            Cannot scan? Enter this key instead:
            <code class="p-key">{{ secret }}</code>
          </p>
        </li>
        <li>
          <strong>Type the six-digit code it shows.</strong>
          <div class="p-field p-codewrap">
            <input
              v-model="code" inputmode="numeric" maxlength="6"
              class="p-code" aria-label="Verification code" autofocus
            >
            <span class="p-ttl">{{ left }}s</span>
          </div>
          <p v-if="preview" class="p-note">
            Nothing to scan with? The current code is
            <code class="p-key">{{ preview }}</code> — computed here the same
            way your phone would.
          </p>
        </li>
      </ol>

      <p v-if="error" class="p-err">{{ error }}</p>

      <button class="p-btn" :disabled="busy || code.length < 6">
        {{ busy ? 'Verifying…' : 'Finish and sign in' }}
      </button>
    </form>

    <form v-else @submit.prevent="submitCode">
      <p class="p-lede">
        Enter the six-digit code from your authenticator app.
      </p>
      <div class="p-field">
        <label for="pc">Verification code</label>
        <input
          id="pc" v-model="code" inputmode="numeric" autocomplete="one-time-code"
          maxlength="6" class="p-code" autofocus
        >
      </div>

      <p v-if="error" class="p-err">{{ error }}</p>

      <template v-if="noSecret">
        <p class="p-note">
          Nothing to type a code from. Enrol an authenticator now, or ask your
          administrator to reset multi-factor on your account.
        </p>
        <button type="button" class="p-btn" @click="noSecret = false; error = ''; beginEnrolment(pending)">
          Enrol an authenticator
        </button>
      </template>
      <button v-else class="p-btn" :disabled="busy || code.length < 6">
        {{ busy ? 'Verifying…' : 'Verify' }}
      </button>
      <button type="button" class="p-link" @click="step = 'credentials'; error = ''; noSecret = false">
        Use a different account
      </button>
    </form>
  </div>
</template>
