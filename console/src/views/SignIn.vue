<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import api from '../api'
import Mark from '../components/ui/Mark.vue'

/**
 * Sign-in, including the real MFA step.
 *
 * Any password is accepted for the seeded demo accounts — password hashing is
 * the backend's job and faking it would prove nothing. The MFA step, by
 * contrast, is genuinely verified, so if the demo admin has enrolled an
 * authenticator the only way past this screen is a correct TOTP code.
 */

const router = useRouter()
const step = ref('credentials')
const username = ref('admin')
const password = ref('demo')
const code = ref('')
const error = ref('')
const busy = ref(false)
const userId = ref('')
const otpSent = ref(false)

/* `busy` is cleared in a `finally`, not after the await.
 *
 * It was cleared after, so anything that threw left the button saying
 * "Checking…" for ever with no error and no way back. That is exactly what
 * the hosted site did: `auth.login` had no HTTP implementation, the adapter
 * threw `No HTTP implementation for "auth.login"`, and the sign-in hung.
 * The missing route is implemented now, but a route that throws must still
 * surface as a message rather than a spinner that never stops. */
async function submit () {
  error.value = ''; busy.value = true
  try {
    const res = await api.auth.login({ username: username.value, password: password.value })
    if (!res?.ok) { error.value = res?.error || 'Sign-in failed.'; return }
    userId.value = res.user.id
    if (res.mfaRequired) { step.value = 'mfa'; return }
    router.push('/dashboard')
  } catch (e) {
    error.value = e?.message || 'Sign-in failed. Try again.'
  } finally { busy.value = false }
}

async function verify () {
  error.value = ''; busy.value = true
  try {
    const res = await api.auth.verifyMfa({ userId: userId.value, code: code.value })
    if (!res?.ok) { error.value = res?.error || 'That code is not valid.'; code.value = ''; return }
    router.push('/dashboard')
  } catch (e) {
    error.value = e?.message || 'Could not check that code.'; code.value = ''
  } finally { busy.value = false }
}

/** The fallback for anyone without an authenticator: a real code, delivered
 *  to the Demo Inbox instead of to a phone. */
async function sendOtp () {
  const res = await api.auth.sendOtp({ userId: userId.value, channel: 'sms' })
  otpSent.value = true
  error.value = ''
  alert('Code sent to ' + res.sentTo + '.\n\nOpen the Demo Inbox after signing in, or use the authenticator code.')
}

function onCode (e) {
  code.value = e.target.value.replace(/\D/g, '').slice(0, 6)
  if (code.value.length === 6) verify()
}
</script>

<template>
  <div class="i-app" style="grid-template-columns:minmax(0,1fr);height:100dvh">
    <main class="i-main">
      <div class="signin-wrap">
        <div class="signin-card">
          <div class="d-flex align-items-center gap-2 mb-4">
            <Mark :size="30" />
            <strong style="font-size:16px;letter-spacing:-.016em">InstaSafe</strong>
          </div>

          <template v-if="step === 'credentials'">
            <h1>Sign in</h1>
            <p class="i-sub mb-4">i365 demo tenant</p>

            <form @submit.prevent="submit">
              <div class="i-field mb-3">
                <label for="u">Username or email</label>
                <input id="u" class="i-ctl" v-model="username" autocomplete="username">
              </div>
              <div class="i-field mb-3">
                <label for="p">Password</label>
                <input id="p" class="i-ctl" type="password" v-model="password" autocomplete="current-password">
              </div>
              <p v-if="error" class="i-err mb-3">
                <i class="fa-solid fa-circle-exclamation me-1" aria-hidden="true" />{{ error }}
              </p>
              <button class="i-btn i-primary w-100" style="min-height:38px" :disabled="busy">
                {{ busy ? 'Checking…' : 'Sign in' }}
              </button>
            </form>

            <div class="i-demo-note mt-4">
              <strong style="color:var(--i-ink)">Administrator console.</strong>
              Sign in as <code class="i-tech">admin</code> with the password
              <code class="i-tech">demo</code>, which is filled in above —
              though any password gets in. There is no way for a visitor to
              know a seeded account's password, so checking it could only ever
              lock them out. Setting a password still hashes it with PBKDF2,
              and the MFA step after this is genuinely verified.
            </div>

            <div class="i-demo-note mt-2">
              <strong style="color:var(--i-ink)">Same product, a different seat.</strong>
              An administrator account lands here, on the console that runs the
              tenant. Everybody else lands on
              <RouterLink to="/portal/signin">their own access</RouterLink> —
              the same product showing what that person is allowed to do.
            </div>
          </template>

          <template v-else>
            <h1>Two-factor</h1>
            <p class="i-sub mb-4">Enter the six-digit code from your authenticator.</p>

            <input
              class="i-otp mb-3" inputmode="numeric" autocomplete="one-time-code"
              placeholder="000000" aria-label="Six-digit code"
              :value="code" @input="onCode"
            >
            <p v-if="error" class="i-err mb-3">
              <i class="fa-solid fa-circle-exclamation me-1" aria-hidden="true" />{{ error }}
            </p>

            <button class="i-btn i-primary w-100 mb-2" style="min-height:38px"
                    :disabled="busy || code.length !== 6" @click="verify">
              {{ busy ? 'Verifying…' : 'Verify' }}
            </button>
            <button class="i-btn i-quiet w-100" @click="sendOtp">
              Send a code by SMS instead
            </button>

            <div class="i-demo-note mt-4">
              This is real RFC 6238 verification. A wrong code is rejected.
            </div>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.signin-wrap {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: 40px 20px;
  background: var(--i-canvas);
}
.signin-card { width: 100%; max-width: 348px; }
.signin-card h1 {
  margin: 0 0 4px;
  font-size: 25px;
  font-weight: 450;
  letter-spacing: -.024em;
  color: var(--i-ink);
}
</style>
