<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import api from '../../api'
import { portalSignIn, pendingActivation } from '../../lib/portal-session.js'
import { passwordRules } from '../../lib/password.js'
import { verifyTOTP, secondsRemaining } from '../../lib/totp.js'
import { qrSvg } from '../../lib/qr.js'

/**
 * Activation — what "sign up" means in a product like this one.
 *
 * There is no public registration, and there should not be: a tenant is a
 * company, and anybody who could create their own account could grant
 * themselves access to that company's network. Accounts are created by an
 * administrator. What the employee does is *claim* one.
 *
 * Two doors into this screen, one act behind both:
 *
 *  - the invite link an administrator sends, `?token=…`
 *  - an existing account signing in for the first time, which the sign-in
 *    screen hands over here rather than refusing a password nobody issued
 *
 * Three steps, and the count is shown, because a form that might be the
 * first of five is a form people abandon. Enrolment is folded in where the
 * administrator has required it: asking somebody to come back later for the
 * security step is how the security step does not happen.
 */

const route = useRoute()
const router = useRouter()

const token = computed(() => String(route.query.token || ''))
const step = ref('checking')      // checking · invalid · password · mfa · done
const user = ref(null)
const error = ref('')
const busy = ref(false)

const pw = ref('')
const confirm = ref('')
const show = ref(false)

const rules = computed(() => passwordRules(pw.value, { username: user.value?.username }))
const strength = computed(() => rules.value.filter(r => r.ok).length)
const matches = computed(() => !!confirm.value && confirm.value === pw.value)
const ready = computed(() => rules.value.every(r => r.ok) && matches.value)

const STRENGTH = ['', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong']

/* ------------------------------------------------------------ enrolment */
const secret = ref('')
const uri = ref('')
const code = ref('')
const left = ref(secondsRemaining())
let ticker

const qr = computed(() => uri.value ? qrSvg(uri.value, 4) : '')

async function load () {
  /* Arrived by link: the token names the account, so the page can greet the
     person by name instead of asking who they are. */
  if (token.value) {
    const res = await api.auth.checkInvite({ token: token.value })
    if (!res.ok) { error.value = res.error; step.value = 'invalid'; return }
    user.value = res.user
    step.value = 'password'
    return
  }
  /* Arrived from the sign-in screen, which hands the account over in a
     module ref rather than the URL — an account name in a URL ends up in
     logs, bookmarks and shoulder-shots. */
  const handed = pendingActivation.value || history.state?.activateUser
  if (handed) { user.value = handed; step.value = 'password'; return }

  step.value = 'invalid'
  error.value = 'This page needs an invitation link. Start from the sign-in screen.'
}

async function setPassword () {
  error.value = ''
  if (!ready.value) { error.value = 'The password does not meet every rule yet.'; return }
  busy.value = true
  try {
    const res = await api.auth.setPassword({
      userId: user.value?.id, token: token.value || undefined, password: pw.value
    })
    if (!res.ok) { error.value = res.error; return }
    user.value = res.user
    pw.value = ''; confirm.value = ''

    if (res.mfaRequired) {
      const enrol = await api.auth.startMfaEnrolment({ userId: res.user.id })
      secret.value = enrol.secret
      uri.value = enrol.uri
      step.value = 'mfa'
      clearInterval(ticker)
      ticker = setInterval(() => { left.value = secondsRemaining() }, 1000)
      return
    }
    finish()
  } catch (e) {
    error.value = e?.message || 'Could not set the password.'
  } finally { busy.value = false }
}

async function confirmMfa () {
  error.value = ''
  busy.value = true
  try {
    const ok = await verifyTOTP(secret.value, code.value.replace(/\s/g, ''))
    if (!ok) {
      error.value = 'That code was not accepted. Codes last 30 seconds — if yours just rolled over, use the new one.'
      return
    }
    await api.auth.confirmMfaEnrolment({ userId: user.value.id, code: code.value.replace(/\s/g, '') })
    user.value = { ...user.value, mfaEnrolled: true }
    finish(true)
  } finally { busy.value = false }
}

/* Whether the authenticator step actually happened. A tick against a step
   that was skipped is a small lie, and this is the screen where somebody
   decides whether their account is secure. */
const mfaDone = ref(false)

function finish (enrolled = false) {
  mfaDone.value = enrolled
  clearInterval(ticker)
  step.value = 'done'
}

function enter () {
  portalSignIn(user.value)
  router.push('/portal')
}

onMounted(load)
onUnmounted(() => clearInterval(ticker))
</script>

<template>
  <div class="p-gate p-act">
    <!-- ------------------------------------------------------ checking -->
    <template v-if="step === 'checking'">
      <span class="p-mark is-wait"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /></span>
      <h1 class="p-gh">Checking your link</h1>
    </template>

    <!-- ------------------------------------------------------- invalid -->
    <template v-else-if="step === 'invalid'">
      <span class="p-mark is-bad"><i class="fa-solid fa-link-slash" aria-hidden="true" /></span>
      <h1 class="p-gh">This link cannot be used</h1>
      <p class="p-gs">{{ error }}</p>
      <RouterLink class="p-btn" to="/portal/signin">Go to sign in</RouterLink>
      <p class="p-gnote">
        Invitations are single-use and last seven days. Your administrator can
        send another from the user's record.
      </p>
    </template>

    <!-- ------------------------------------------------------ password -->
    <template v-else-if="step === 'password'">
      <ol class="p-stepper" aria-label="Progress">
        <li class="is-on">Password</li>
        <li :class="{ 'is-on': false }">Authenticator</li>
        <li>Done</li>
      </ol>

      <span class="p-heroav p-actav">
        {{ (user?.firstName || user?.username || '?').slice(0, 1).toUpperCase() }}
      </span>
      <h1 class="p-gh">Welcome, {{ user?.firstName || user?.username }}</h1>
      <p class="p-gs">
        Your administrator created this account. Choose a password and it is
        yours — nobody at InstaSafe can see it, including them.
      </p>

      <dl class="p-actwho">
        <dt>Username</dt><dd class="i-tech">{{ user?.username }}</dd>
        <dt v-if="user?.email">Email</dt><dd v-if="user?.email">{{ user.email }}</dd>
      </dl>

      <div class="p-field">
        <label for="np">Choose a password</label>
        <div class="p-pwwrap">
          <input
            id="np" v-model="pw" :type="show ? 'text' : 'password'"
            autocomplete="new-password" placeholder="At least 12 characters"
          >
          <button type="button" class="p-eye" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show">
            <i class="fa-solid" :class="show ? 'fa-eye-slash' : 'fa-eye'" aria-hidden="true" />
          </button>
        </div>

        <!-- The meter counts rules met, so it cannot disagree with the list
             underneath it the way a guessed entropy score does. -->
        <div class="p-meter" :data-level="strength" aria-hidden="true">
          <span v-for="n in 5" :key="n" :class="{ 'is-on': strength >= n }" />
        </div>
        <p class="p-meterl">{{ pw ? STRENGTH[strength] : 'Nothing typed yet' }}</p>

        <ul class="p-rules">
          <li v-for="r in rules" :key="r.key" :class="{ 'is-ok': r.ok }">
            <i class="fa-solid" :class="r.ok ? 'fa-circle-check' : 'fa-circle'" aria-hidden="true" />
            {{ r.text }}
          </li>
        </ul>
      </div>

      <div class="p-field">
        <label for="cp">Type it again</label>
        <input id="cp" v-model="confirm" :type="show ? 'text' : 'password'" autocomplete="new-password">
        <p v-if="confirm && !matches" class="p-err">These do not match.</p>
      </div>

      <p v-if="error" class="p-err">{{ error }}</p>

      <button class="p-btn p-wide-btn" :disabled="busy || !ready" @click="setPassword">
        {{ busy ? 'Setting it…' : 'Set password and continue' }}
      </button>

      <p class="p-gnote">
        Stored as a PBKDF2-SHA256 hash with a per-password salt. The hash is
        what this console keeps; the password itself is never written down
        anywhere, which is why nobody can tell it to you if you forget it.
      </p>
    </template>

    <!-- ----------------------------------------------------------- mfa -->
    <template v-else-if="step === 'mfa'">
      <ol class="p-stepper" aria-label="Progress">
        <li class="is-done">Password</li>
        <li class="is-on">Authenticator</li>
        <li>Done</li>
      </ol>

      <h1 class="p-gh">One more thing</h1>
      <p class="p-gs">
        Your administrator requires a second factor on this account. It takes
        about a minute and you will not be asked to do it again.
      </p>

      <div class="p-qrbox p-actqr">
        <div class="p-qr" v-html="qr" />
        <div>
          <ol class="p-steps">
            <li>Open an authenticator app — Google Authenticator, 1Password, Authy.</li>
            <li>Choose <strong>add account</strong> and scan this square.</li>
            <li>Type the six digits it shows.</li>
          </ol>
          <p class="p-hint">Cannot scan? Enter this key instead:</p>
          <p class="p-key i-tech">{{ secret }}</p>
        </div>
      </div>

      <div class="p-field">
        <label for="otp">Six digits from the app</label>
        <input
          id="otp" v-model="code" class="p-code" inputmode="numeric"
          maxlength="7" placeholder="000000" autocomplete="one-time-code"
        >
        <p class="p-hint">The code changes in {{ left }}s. One entered as it rolls over is refused.</p>
        <p v-if="error" class="p-err">{{ error }}</p>
      </div>

      <button class="p-btn p-wide-btn" :disabled="busy || code.replace(/\s/g, '').length < 6" @click="confirmMfa">
        {{ busy ? 'Checking…' : 'Confirm and finish' }}
      </button>

      <p class="p-gnote">
        Real TOTP, not a mock: the code is checked against the secret in that
        square with the published algorithm. A wrong one is refused.
      </p>
    </template>

    <!-- ---------------------------------------------------------- done -->
    <template v-else>
      <ol class="p-stepper" aria-label="Progress">
        <li class="is-done">Password</li>
        <li :class="mfaDone ? 'is-done' : 'is-skipped'">
          Authenticator<template v-if="!mfaDone"> — not required</template>
        </li>
        <li class="is-on">Done</li>
      </ol>

      <span class="p-mark is-ok"><i class="fa-solid fa-check" aria-hidden="true" /></span>
      <h1 class="p-gh">Your account is ready</h1>
      <p class="p-gs">
        You can sign in from now on with your username and the password you
        just chose.
      </p>

      <button class="p-btn p-wide-btn" @click="enter">Go to my access</button>

      <!-- The marketing simulator ends with "log in again, try another
           method", and it is right: the six factors are the demo, and
           somebody who has just set one up has met exactly one of them. -->
      <RouterLink class="p-btn p-ghost p-wide-btn mt-2" to="/portal/signin">
        <i class="fa-solid fa-rotate" aria-hidden="true" />
        Sign in again and try the other factors
      </RouterLink>

      <div class="p-actnext">
        <h2>Worth doing next</h2>
        <ul>
          <li v-if="!mfaDone">
            <strong>Set up a second factor.</strong> Your administrator has not
            required one, which means a password is currently the only thing
            between your account and anybody who learns it.
          </li>
          <li><strong>Install the agent</strong> on the machine you work on — network applications need it.</li>
          <li><strong>Save backup codes</strong>, so a lost phone does not lock you out.</li>
        </ul>
      </div>
    </template>
  </div>
</template>
