<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import api from '../../api'
import { secondsRemaining, generateTOTP } from '../../lib/totp.js'
import { qrSvg } from '../../lib/qr.js'
import PageHeader from '../../components/ui/PageHeader.vue'

/**
 * Real MFA enrolment.
 *
 * This is the capability people are most sceptical about in a demo, so it is
 * the one that is genuinely implemented: RFC 6238 TOTP over Web Crypto. The
 * QR below is a real otpauth:// URI. Scan it with Google Authenticator, Authy,
 * 1Password or Microsoft Authenticator and the code on the phone is the code
 * this page verifies. A wrong code is rejected.
 *
 * The secret is held unconfirmed until a correct code proves the phone
 * actually has it — which is what a correct implementation does, and what
 * stops someone locking themselves out.
 */

const toast = inject('toast', () => {})

const USER_ID = 'usr_00000'
const step = ref(1)            // 1 scan · 2 verify · 3 done
const secret = ref('')
const uri = ref('')
const code = ref('')
const error = ref('')
const busy = ref(false)
const enrolled = ref(false)
const showSecret = ref(false)

// live preview of what the phone should be showing, so a visitor without an
// authenticator app can still complete the flow and see it verify
const preview = ref('')
const remaining = ref(30)
let tick

const qr = computed(() => uri.value ? qrSvg(uri.value, 5) : '')
const ring = computed(() => {
  const c = 2 * Math.PI * 9
  return { dasharray: c, dashoffset: c * (1 - remaining.value / 30) }
})

async function start () {
  busy.value = true; error.value = ''
  const res = await api.auth.startMfaEnrolment({ userId: USER_ID })
  secret.value = res.secret
  uri.value = res.uri
  step.value = 1
  busy.value = false
  refreshPreview()
}

async function refreshPreview () {
  if (!secret.value) return
  preview.value = await generateTOTP(secret.value)
  remaining.value = secondsRemaining()
}

async function verify () {
  error.value = ''
  if (code.value.length !== 6) { error.value = 'Enter all six digits.'; return }
  busy.value = true
  const res = await api.auth.confirmMfaEnrolment({ userId: USER_ID, code: code.value })
  busy.value = false
  if (res.ok) {
    step.value = 3
    enrolled.value = true
    toast('MFA enrolled — verified with real TOTP')
  } else {
    error.value = res.error
    code.value = ''
  }
}

async function reset () {
  await api.auth.resetMfa(USER_ID)
  enrolled.value = false
  code.value = ''
  error.value = ''
  // immediately issue a fresh secret, otherwise the next code typed has
  // nothing to verify against and reports "start enrolment first"
  await start()
  toast('MFA reset — scan the new QR')
}

function onCodeInput (e) {
  code.value = e.target.value.replace(/\D/g, '').slice(0, 6)
  if (code.value.length === 6) verify()
}

onMounted(async () => {
  const me = await api.auth.me()
  enrolled.value = !!me?.mfaEnrolled
  if (enrolled.value) step.value = 3
  else await start()
  tick = setInterval(refreshPreview, 1000)
})
onUnmounted(() => clearInterval(tick))
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Multi-factor authentication"
      subtitle="Genuinely real. RFC 6238 TOTP — scan this with any authenticator app and the code it shows is the code this page checks."
    >
      <template #actions>
        <button v-if="enrolled" class="i-btn i-danger" @click="reset">Reset MFA</button>
      </template>
    </PageHeader>

    <!-- enrolled -->
    <div v-if="step === 3" class="i-verdict is-pass" style="max-width:660px">
      <h3><i class="fa-solid fa-circle-check me-2" aria-hidden="true" />Authenticator enrolled</h3>
      <p>
        This account now requires a time-based code at sign-in. The secret was
        verified against a code your app generated, so we know the phone really has it.
      </p>
    </div>

    <div v-else class="row g-4" style="max-width:980px">
      <!-- left: the QR -->
      <div class="col-12 col-lg-6">
        <div class="i-formsec">
          <h3>1 · Scan this</h3>
          <p class="i-secsub">
            Google Authenticator, Authy, 1Password, Microsoft Authenticator — any of them.
          </p>

          <div v-if="qr" class="i-qr" v-html="qr" />
          <div v-else class="i-skel" style="width:190px;height:190px" />

          <div class="mt-3">
            <button class="i-btn i-sm i-quiet" @click="showSecret = !showSecret">
              {{ showSecret ? 'Hide' : 'Cannot scan? Enter the key by hand' }}
            </button>
            <div v-if="showSecret" class="i-secret mt-2">{{ secret }}</div>
          </div>
        </div>
      </div>

      <!-- right: verify -->
      <div class="col-12 col-lg-6">
        <div class="i-formsec">
          <h3>2 · Enter the six-digit code</h3>
          <p class="i-secsub">
            The code changes every 30 seconds. A wrong one is rejected — try it.
          </p>

          <input
            class="i-otp" inputmode="numeric" autocomplete="one-time-code"
            placeholder="000000" aria-label="Six-digit code"
            :value="code" @input="onCodeInput"
          >

          <p v-if="error" class="i-err mt-2">
            <i class="fa-solid fa-circle-exclamation me-1" aria-hidden="true" />{{ error }}
          </p>

          <div class="mt-3">
            <button class="i-btn i-primary" :disabled="busy || code.length !== 6" @click="verify">
              {{ busy ? 'Checking…' : 'Verify and enable' }}
            </button>
          </div>
        </div>

        <!-- the escape hatch for anyone without a phone to hand -->
        <div class="i-demo-note mt-3">
          <div class="d-flex align-items-center gap-2 mb-1">
            <svg class="i-ring" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <circle class="i-ring-bg" cx="11" cy="11" r="9" />
              <circle
                class="i-ring-fg" cx="11" cy="11" r="9"
                :stroke-dasharray="ring.dasharray" :stroke-dashoffset="ring.dashoffset"
              />
            </svg>
            <strong style="color:var(--i-ink)">No authenticator to hand?</strong>
          </div>
          This is the code your phone would be showing right now —
          <code class="i-tech" style="font-size:14px;letter-spacing:.1em">{{ preview }}</code>,
          {{ remaining }}s left. It is computed here with the same algorithm, so typing
          it above proves the verification is real rather than accepting anything.
        </div>
      </div>
    </div>
  </div>
</template>
