<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../../api'
import { portalUser } from '../../lib/portal-session.js'
import { secondsRemaining, generateTOTP } from '../../lib/totp.js'
import { qrSvg } from '../../lib/qr.js'
import { browserFingerprint } from '../../lib/policy.js'

/**
 * What an employee actually needs.
 *
 * Three things, in the order they need them: enrol an authenticator, see
 * whether their devices are approved, and see what they are allowed to reach.
 * Nothing else. This is not a small admin console — it is a different product
 * with three jobs.
 *
 * The TOTP here is the real implementation (RFC 6238 over Web Crypto). The QR
 * is a genuine otpauth:// URI; scanning it with Google Authenticator, Authy,
 * 1Password or Microsoft Authenticator produces codes this page verifies, and
 * a wrong code is rejected. The secret stays unconfirmed until a correct code
 * proves the phone really has it, which is what stops somebody locking
 * themselves out of their own account.
 */

const user = portalUser
const toastMsg = ref('')

/* ---- enrolment ---------------------------------------------------------- */
const step = ref('idle')        // idle · scan · verify · done
const secret = ref('')
const uri = ref('')
const code = ref('')
const error = ref('')
const busy = ref(false)
const enrolled = ref(false)
const left = ref(30)
const preview = ref('')
let ticker

const qr = computed(() => uri.value ? qrSvg(uri.value, 180) : '')

async function startEnrolment () {
  busy.value = true
  error.value = ''
  try {
    const res = await api.auth.startMfaEnrolment({ userId: user.value.id })
    secret.value = res.secret
    uri.value = res.uri
    step.value = 'scan'
  } catch (e) {
    error.value = e?.message || 'Could not start enrolment.'
  } finally { busy.value = false }
}

async function confirmEnrolment () {
  error.value = ''
  busy.value = true
  try {
    const res = await api.auth.confirmMfaEnrolment({ userId: user.value.id, code: code.value.trim() })
    if (!res?.ok) {
      error.value = 'That code is not right. Codes change every 30 seconds — wait for the next one and try again.'
      return
    }
    enrolled.value = true
    step.value = 'done'
    toastMsg.value = 'Authenticator enrolled'
  } finally { busy.value = false }
}

/* The live code, shown only while enrolling, so somebody without a phone to
   hand can still see the mechanism working rather than taking it on faith. */
async function tick () {
  left.value = secondsRemaining()
  if (secret.value && step.value !== 'done') {
    try { preview.value = await generateTOTP(secret.value) } catch { preview.value = '' }
  }
}

/* ---- my devices and applications ---------------------------------------- */
const devices = ref([])
const apps = ref([])
const loading = ref(true)
const binding = ref(false)

async function load () {
  loading.value = true
  const u = user.value
  if (!u) { loading.value = false; return }

  /* Enrolment state comes from the record, not from the session snapshot.
     The snapshot was taken at sign-in, so trusting it meant enrolling an
     authenticator and then being told on the next reload that you had not. */
  try {
    const fresh = await api.users.get(u.id)
    if (fresh) enrolled.value = !!fresh.mfaEnrolled
  } catch { enrolled.value = !!u.mfaEnrolled }
  if (enrolled.value) step.value = 'done'

  const [d, a] = await Promise.all([
    api.devices.list({ perPage: 0, filters: { userId: u.id } }).then(r => r.data).catch(() => []),
    api.applications.list({ perPage: 0 }).then(r => r.data).catch(() => [])
  ])
  devices.value = d
  apps.value = a.slice(0, 8)
  loading.value = false
}

/** Enrols the browser you are reading this in, with a real fingerprint. */
async function enrolThisBrowser () {
  binding.value = true
  try {
    const fp = await browserFingerprint()
    const res = await api.devices.bind({ userId: user.value.id, fingerprint: fp })
    toastMsg.value = res?.existing
      ? 'This browser is already registered'
      : 'Registered — an administrator has to approve it'
    load()
  } finally { binding.value = false }
}

const statusWord = (s) => ({
  approved: 'Approved', pending: 'Waiting for approval', rejected: 'Refused'
}[s] || s)

onMounted(() => { load(); tick(); ticker = setInterval(tick, 1000) })
onUnmounted(() => clearInterval(ticker))
</script>

<template>
  <div v-if="user" class="p-stack">
    <div>
      <h1 class="p-h1">Hello, {{ user.firstName || user.username }}</h1>
      <p class="p-lede">Your account, your devices, and what you can reach.</p>
    </div>

    <!-- 1 · multi-factor -->
    <section class="p-card">
      <h2 class="p-h2">Multi-factor authentication</h2>

      <template v-if="step === 'done' || enrolled">
        <p class="p-ok">
          <i class="fa-solid fa-circle-check" aria-hidden="true" />
          Your authenticator is set up.
        </p>
        <p class="p-note">
          You will be asked for a six-digit code when you sign in. Lost your
          phone? Ask your administrator to reset this — they cannot see your
          codes, but they can clear the enrolment so you can start again.
        </p>
      </template>

      <template v-else-if="step === 'idle'">
        <p class="p-note">
          Add a second step to your sign-in using an authenticator app —
          Google Authenticator, Authy, 1Password or Microsoft Authenticator.
        </p>
        <button class="p-btn" :disabled="busy" @click="startEnrolment">
          {{ busy ? 'Preparing…' : 'Set up authenticator' }}
        </button>
      </template>

      <template v-else>
        <ol class="p-steps">
          <li>
            <strong>Scan this with your authenticator app.</strong>
            <div class="p-qr" v-html="qr" />
            <p class="p-note">
              Cannot scan? Enter this key by hand:
              <code class="p-key">{{ secret }}</code>
            </p>
          </li>
          <li>
            <strong>Type the six-digit code it shows.</strong>
            <div class="p-field p-codewrap">
              <input
                v-model="code" inputmode="numeric" maxlength="6"
                class="p-code" aria-label="Verification code"
              >
              <span class="p-ttl">{{ left }}s</span>
            </div>
            <p v-if="preview" class="p-note">
              Nothing to scan with? The current code is
              <code class="p-key">{{ preview }}</code> — this page computes it
              the same way your phone would.
            </p>
            <p v-if="error" class="p-err">{{ error }}</p>
            <button class="p-btn" :disabled="busy || code.length < 6" @click="confirmEnrolment">
              {{ busy ? 'Verifying…' : 'Verify and finish' }}
            </button>
          </li>
        </ol>
      </template>
    </section>

    <!-- 2 · devices -->
    <section class="p-card">
      <h2 class="p-h2">Your devices</h2>
      <p class="p-note">
        Each device has to be approved before it can connect. Approval is done
        by your administrator.
      </p>

      <div v-if="loading" class="p-note">Loading…</div>

      <ul v-else-if="devices.length" class="p-list">
        <li v-for="d in devices" :key="d.id">
          <span class="p-li-t">{{ d.name }}</span>
          <span class="p-li-s">{{ d.os }}</span>
          <span class="p-tag" :class="'is-' + d.status">{{ statusWord(d.status) }}</span>
        </li>
      </ul>

      <p v-else class="p-note">No devices are registered to you yet.</p>

      <button class="p-btn p-ghost" :disabled="binding" @click="enrolThisBrowser">
        {{ binding ? 'Registering…' : 'Register this browser' }}
      </button>
    </section>

    <!-- 3 · applications -->
    <section class="p-card">
      <h2 class="p-h2">What you can reach</h2>
      <p class="p-note">
        Access depends on your group, your device passing its checks, and the
        policy your administrator set. If something is missing here, ask them.
      </p>
      <ul v-if="apps.length" class="p-list">
        <li v-for="a in apps" :key="a.id">
          <span class="p-li-t">{{ a.name }}</span>
          <span class="p-li-s">{{ a.type }}<template v-if="a.host"> · {{ a.host }}</template></span>
        </li>
      </ul>
      <p v-else class="p-note">Nothing is published to you yet.</p>
    </section>

    <p v-if="toastMsg" class="p-toast">{{ toastMsg }}</p>
  </div>
</template>
