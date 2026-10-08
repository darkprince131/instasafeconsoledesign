<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../api'
import { portalSignIn } from '../../lib/portal-session.js'

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

const step = ref('credentials')     // credentials · mfa
const username = ref('')
const password = ref('')
const code = ref('')
const error = ref('')
const busy = ref(false)
const pending = ref(null)
const suggestion = ref('')

onMounted(async () => {
  /* Offer a real account from this tenant rather than a made-up one, so the
     name on screen is one that actually signs in — and not the administrator,
     who is the wrong person to be demonstrating an end-user portal with. */
  try {
    /* Not the administrator, and not somebody already enrolled: the seeded
       "enrolled" users carry the flag without a secret anybody holds, so
       signing in as one lands on a code prompt that can never be satisfied.
       An unenrolled account puts the demo on the path worth showing. */
    const res = await api.users.list({ page: 1, perPage: 40, filters: { status: 'active' } })
    const pick = (res.data || []).find(u => !u.isAdmin && !u.mfaEnrolled)
      || (res.data || []).find(u => !u.isAdmin)
    suggestion.value = pick?.username || ''
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
    if (res.mfaRequired) {
      pending.value = res.user
      step.value = 'mfa'
      return
    }
    enter(res.user)
  } catch (e) {
    error.value = e?.message || 'Sign-in failed.'
  } finally { busy.value = false }
}

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
      error.value = /not set up/i.test(res?.error || '')
        ? 'This account has multi-factor turned on but no authenticator registered. Ask your administrator to reset it, then sign in again to enrol.'
        : 'That code is not right. Codes change every 30 seconds — wait for the next one and try again.'
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

      <button class="p-btn" :disabled="busy || code.length < 6">
        {{ busy ? 'Verifying…' : 'Verify' }}
      </button>
      <button type="button" class="p-link" @click="step = 'credentials'; error = ''">
        Use a different account
      </button>
    </form>
  </div>
</template>
