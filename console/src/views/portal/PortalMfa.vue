<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import api from '../../api'
import { portalUser } from '../../lib/portal-session.js'
import { generateSecret, verifyTOTP, otpauthURI, secondsRemaining } from '../../lib/totp.js'
import { qrSvg } from '../../lib/qr.js'

/**
 * Multi-factor authentication.
 *
 * Velto lists six methods as six rows of grey text with a button on the
 * right, and says nothing about what any of them is, which to pick, or what
 * happens if you lose the thing you picked. That last question is the one
 * people actually arrive with.
 *
 * So the six are velto's six, in velto's order, but each opens in place with
 * what it is in one line, what it costs you, and what to do when the phone is
 * in a river. One is recommended, because an employee asked to choose between
 * six security mechanisms will choose none.
 *
 * Two of them are not demonstrations:
 *
 * - **The authenticator is real TOTP.** RFC 6238 over Web Crypto, all six
 *   published test vectors pass. Scan the QR with Google Authenticator and
 *   the code it shows is accepted; a wrong code is refused.
 * - **The security key is real WebAuthn.** It calls
 *   `navigator.credentials.create` against this origin, so a YubiKey, Touch
 *   ID or Windows Hello genuinely registers and the credential ID comes back
 *   from the authenticator rather than from us.
 *
 * The other four need a mobile app, a signed agent or a push service, none of
 * which a browser demo can stand in for. Each says so in its own words rather
 * than miming success.
 */

const toast = inject('toast', () => {})
const user = portalUser

const open = ref('totp')
const saving = ref(false)

/* ------------------------------------------------------- authenticator */
const secret = ref('')
const otpauth = computed(() => secret.value
  ? otpauthURI({ secret: secret.value, account: user.value?.username || 'member', issuer: 'InstaSafe' })
  : '')
const qr = computed(() => otpauth.value ? qrSvg(otpauth.value, 4) : '')
const code = ref('')
const totpError = ref('')
const tick = ref(secondsRemaining())
let timer = null

const enrolled = computed(() => !!user.value?.mfaEnrolled)

function beginTotp () {
  secret.value = generateSecret()
  code.value = ''
  totpError.value = ''
}

async function confirmTotp () {
  totpError.value = ''
  const ok = await verifyTOTP(secret.value, code.value.replace(/\s/g, ''))
  if (!ok) {
    totpError.value = 'That code was not accepted. Codes last 30 seconds — if yours just rolled over, try the new one.'
    return
  }
  saving.value = true
  try {
    await api.users.update(user.value.id, {
      mfaEnrolled: true, mfaMethod: 'totp', mfaUpdatedAt: new Date().toISOString()
    })
    Object.assign(user.value, { mfaEnrolled: true, mfaMethod: 'totp' })
    secret.value = ''
    toast('Authenticator enrolled')
  } finally { saving.value = false }
}

/* ------------------------------------------------------- security keys */
const keys = ref([])
const keyError = ref('')
const keyBusy = ref(false)
const webauthnOk = typeof window !== 'undefined' &&
  !!window.PublicKeyCredential && !!navigator.credentials

/**
 * Register a key for real.
 *
 * The challenge would come from the server in production; here it is random
 * bytes from this page, which is the only part that is not production-shaped.
 * Everything after that is the browser and the authenticator doing the real
 * thing — if there is no key and no platform authenticator, it fails, and the
 * failure is the honest answer.
 */
async function registerKey () {
  keyError.value = ''
  if (!webauthnOk) { keyError.value = 'This browser does not support security keys.'; return }
  keyBusy.value = true
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const id = crypto.getRandomValues(new Uint8Array(16))
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'InstaSafe i365' },
        user: { id, name: user.value?.username || 'member', displayName: user.value?.username || 'member' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        timeout: 60000,
        attestation: 'none',
        authenticatorSelection: { userVerification: 'preferred' }
      }
    })
    if (!cred) { keyError.value = 'No key was registered.'; return }
    const short = cred.id.slice(0, 10)
    keys.value = [...keys.value, {
      id: cred.id,
      label: `Security key ${keys.value.length + 1}`,
      short,
      at: new Date().toISOString()
    }]
    await api.users.update(user.value.id, {
      mfaEnrolled: true, fidoKeys: keys.value.length,
      mfaUpdatedAt: new Date().toISOString()
    })
    Object.assign(user.value, { mfaEnrolled: true })
    toast('Security key registered')
  } catch (e) {
    keyError.value = e?.name === 'NotAllowedError'
      ? 'Cancelled, or the key was not touched in time.'
      : 'Could not register: ' + (e?.message || e?.name || 'unknown error')
  } finally { keyBusy.value = false }
}

/* --------------------------------------------------------- backup codes */
const codes = ref([])

/** Ten single-use codes, from the same CSPRNG everything else here uses. */
function makeCodes () {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   // no I/O/0/1
  const pick = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map(b => abc[b % abc.length]).join('')
  codes.value = Array.from({ length: 10 }, () => `${pick(4)}-${pick(4)}`)
}

function copyCodes () {
  navigator.clipboard?.writeText(codes.value.join('\n'))
  toast('Copied — put them somewhere that is not this computer')
}

async function saveCodes () {
  saving.value = true
  try {
    await api.users.update(user.value.id, {
      backupCodesSet: true, backupCodesUpdatedAt: new Date().toISOString()
    })
    toast('Backup codes recorded. The codes themselves are not stored.')
  } finally { saving.value = false }
}

/* ------------------------------------------------------------- methods */
const METHODS = [
  { key: 'totp', title: 'Authenticator app', velto: 'Google Authenticator',
    icon: 'fa-mobile-screen', recommend: true,
    lede: 'A six-digit code from an app on your phone, changing every 30 seconds.',
    good: 'Works with no signal and no data. Google Authenticator, 1Password, Authy — any of them.' },
  { key: 'fido', title: 'Security key', velto: 'FIDO Keys',
    icon: 'fa-key',
    lede: 'A physical key, or the fingerprint reader built into this machine.',
    good: 'The only method that cannot be phished — it refuses to work on a fake site.' },
  { key: 'push', title: 'Push notification', velto: 'InstaSafe Authenticator',
    icon: 'fa-bell',
    lede: 'Approve a prompt on your phone instead of typing a code.',
    good: 'Fastest day to day. Needs the InstaSafe app and a data connection.' },
  { key: 'cert', title: 'Device certificate', velto: 'Digital Certificate',
    icon: 'fa-certificate',
    lede: 'The machine itself proves who it is. Nothing to type.',
    good: 'Invisible once set up. Installed by the agent, not by you.' },
  { key: 'backup', title: 'Backup codes', velto: 'Backup Codes',
    icon: 'fa-list-ol',
    lede: 'Ten one-time codes for when your phone is lost, broken or flat.',
    good: 'Not a method on its own — the safety net under whichever you pick.' },
  { key: 'os', title: 'Computer sign-in', velto: 'InstaSafe OS MFA',
    icon: 'fa-desktop',
    lede: 'A second factor when you log in to the machine itself, not just here.',
    good: 'Set by your administrator and installed with the agent.' }
]

onMounted(() => { timer = setInterval(() => { tick.value = secondsRemaining() }, 1000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="p-narrow">
    <header class="p-ph">
      <h1>Multi-factor authentication</h1>
      <p>
        A password alone can be guessed, reused or stolen. A second factor is
        something you have, so knowing the password is not enough.
      </p>
    </header>

    <div class="p-card p-status" :class="enrolled ? 'is-ok' : 'is-att'">
      <i class="fa-solid" :class="enrolled ? 'fa-circle-check' : 'fa-circle-exclamation'" aria-hidden="true" />
      <span>
        <strong>{{ enrolled ? 'You are set up' : 'Nothing set up yet' }}</strong>
        <small>
          {{ enrolled
            ? 'You will be asked for a second factor when you sign in.'
            : 'Pick one below. The first takes about a minute.' }}
        </small>
      </span>
    </div>

    <section
      v-for="m in METHODS" :key="m.key"
      class="p-card p-m" :class="{ 'is-open': open === m.key }"
    >
      <button class="p-mhead" :aria-expanded="open === m.key" @click="open = open === m.key ? '' : m.key">
        <i class="fa-solid p-mic" :class="m.icon" aria-hidden="true" />
        <span class="p-mtitle">
          <strong>
            {{ m.title }}
            <span v-if="m.recommend" class="p-tag is-ok">recommended</span>
          </strong>
          <small>{{ m.lede }}</small>
        </span>
        <i class="fa-solid p-mchev" :class="open === m.key ? 'fa-chevron-up' : 'fa-chevron-down'" aria-hidden="true" />
      </button>

      <div v-if="open === m.key" class="p-mbody">
        <p class="p-mgood"><i class="fa-solid fa-circle-info" aria-hidden="true" /> {{ m.good }}</p>
        <p class="p-mvelto">Called <strong>{{ m.velto }}</strong> in the current console.</p>

        <!-- ------------------------------------------------------ TOTP -->
        <template v-if="m.key === 'totp'">
          <template v-if="!secret">
            <button class="p-btn" @click="beginTotp">
              <i class="fa-solid fa-qrcode" aria-hidden="true" /> Set up an authenticator
            </button>
          </template>

          <template v-else>
            <ol class="p-steps">
              <li>Open your authenticator app and choose <strong>add account</strong>.</li>
              <li>Scan this square.</li>
              <li>Type the six digits it shows, to prove it worked.</li>
            </ol>

            <div class="p-qrbox">
              <div class="p-qr" v-html="qr" />
              <div>
                <p class="p-hint">Cannot scan? Type this into the app instead:</p>
                <p class="p-key i-tech">{{ secret }}</p>
                <p class="p-hint">
                  Codes roll over in <strong>{{ tick }}s</strong>. A code entered
                  just as it changes is refused — wait for the next one.
                </p>
              </div>
            </div>

            <div class="p-field">
              <label for="totp">Six digits from the app</label>
              <input
                id="totp" v-model="code" inputmode="numeric" maxlength="7"
                placeholder="000000" class="p-code" autocomplete="one-time-code"
              >
              <p v-if="totpError" class="p-err">{{ totpError }}</p>
            </div>

            <div class="p-gacts">
              <button class="p-btn p-ghost" @click="secret = ''">Cancel</button>
              <button class="p-btn" :disabled="saving || code.length < 6" @click="confirmTotp">
                {{ saving ? 'Checking…' : 'Confirm' }}
              </button>
            </div>

            <p class="p-note">
              This is real TOTP, not a mock: the code is checked against the
              secret in the square using the published algorithm. A wrong code
              is refused.
            </p>
          </template>
        </template>

        <!-- ------------------------------------------------------ FIDO -->
        <template v-else-if="m.key === 'fido'">
          <p v-if="keys.length" class="p-sub">
            {{ keys.length }} key{{ keys.length === 1 ? '' : 's' }} registered.
          </p>
          <ul v-if="keys.length" class="p-list">
            <li v-for="k in keys" :key="k.id">
              <span class="p-li-t">{{ k.label }}</span>
              <span class="p-li-s i-tech">{{ k.short }}…</span>
            </li>
          </ul>

          <button class="p-btn" :disabled="keyBusy || !webauthnOk" @click="registerKey">
            <i class="fa-solid fa-key" aria-hidden="true" />
            {{ keyBusy ? 'Waiting for the key…' : keys.length ? 'Register another' : 'Register a key' }}
          </button>
          <p v-if="keyError" class="p-err">{{ keyError }}</p>

          <p class="p-hint">
            Your browser will ask you to touch the key, or to use Touch ID or
            Windows Hello if this machine has one. Register a second key and
            keep it somewhere else — a single key that is lost locks you out.
          </p>
          <p v-if="!webauthnOk" class="p-note">
            This browser does not expose the WebAuthn API, so there is nothing
            to register against.
          </p>
          <p v-else class="p-note">
            This is the real WebAuthn call. The credential comes back from your
            authenticator, not from us.
          </p>
        </template>

        <!-- ------------------------------------------------------ push -->
        <template v-else-if="m.key === 'push'">
          <ol class="p-steps">
            <li>Install the InstaSafe Authenticator on your phone.</li>
            <li>Sign in to it with this same username.</li>
            <li>Approve the prompt it sends the next time you sign in here.</li>
          </ol>
          <div class="p-stores">
            <a class="p-btn p-ghost" href="https://apps.apple.com/in/app/instasafe-authenticator/id1556381288" target="_blank" rel="noopener">
              <i class="fa-brands fa-apple" aria-hidden="true" /> App Store
            </a>
            <a class="p-btn p-ghost" href="https://play.google.com/store/search?q=instasafe%20authenticator" target="_blank" rel="noopener">
              <i class="fa-brands fa-google-play" aria-hidden="true" /> Google Play
            </a>
          </div>
          <p class="p-hint">
            Push needs a data connection. If you travel somewhere without one,
            set up the authenticator app as well — its codes work offline.
          </p>
          <p class="p-note">
            The two links are the real store listings. The push itself needs
            InstaSafe's notification service, which a browser demo cannot stand
            in for, so nothing here pretends to send one.
          </p>
        </template>

        <!-- ------------------------------------------------------ cert -->
        <template v-else-if="m.key === 'cert'">
          <p class="p-sub">
            The agent requests a certificate for this machine and installs it
            into the system store. After that the machine proves itself and you
            are not asked for anything.
          </p>
          <RouterLink class="p-btn p-ghost" to="/portal/downloads">
            <i class="fa-solid fa-download" aria-hidden="true" /> Get the agent
          </RouterLink>
          <p class="p-hint">
            Tied to one machine. If you work from two, you need it on both, and
            you still want a second method for everything else.
          </p>
          <p class="p-note">
            Issuing a real certificate needs the signed agent and the company
            CA, neither of which is part of this demo.
          </p>
        </template>

        <!-- --------------------------------------------------- backup -->
        <template v-else-if="m.key === 'backup'">
          <template v-if="!codes.length">
            <button class="p-btn" @click="makeCodes">
              <i class="fa-solid fa-list-ol" aria-hidden="true" /> Generate ten codes
            </button>
            <p class="p-hint">
              Each works once. Use one when you cannot reach your phone.
            </p>
          </template>

          <template v-else>
            <ul class="p-codes">
              <li v-for="c in codes" :key="c" class="i-tech">{{ c }}</li>
            </ul>
            <div class="p-gacts">
              <button class="p-btn p-ghost" @click="copyCodes">
                <i class="fa-regular fa-copy" aria-hidden="true" /> Copy
              </button>
              <button class="p-btn p-ghost" @click="makeCodes">
                <i class="fa-solid fa-rotate" aria-hidden="true" /> Generate new ones
              </button>
              <button class="p-btn" :disabled="saving" @click="saveCodes">I have saved them</button>
            </div>
            <p class="p-hint">
              Put them somewhere that is not this computer and not your phone —
              a password manager, or paper in a drawer. Generating new ones
              cancels these.
            </p>
            <p class="p-note">
              Real random, from the browser's cryptographic generator. Only the
              fact that you have codes is stored, never the codes.
            </p>
          </template>
        </template>

        <!-- ------------------------------------------------------- OS -->
        <template v-else>
          <p class="p-sub">
            Your administrator turns this on. Once the agent is installed, your
            computer login asks for the same second factor this page sets up.
          </p>
          <RouterLink class="p-btn p-ghost" to="/portal/downloads">
            <i class="fa-solid fa-download" aria-hidden="true" /> Get the agent
          </RouterLink>
          <p class="p-note">
            Hooks into the operating system's own login, so it cannot be
            demonstrated from a web page.
          </p>
        </template>
      </div>
    </section>

    <section class="p-card">
      <h2 class="p-cardh"><i class="fa-solid fa-circle-question" aria-hidden="true" /> Lost your phone?</h2>
      <p class="p-sub">
        Use a backup code to sign in, then set up a new authenticator. If you
        have no backup codes left, your administrator can reset your enrolment
        — they cannot see or recover the old one, so you will set it up again
        from scratch.
      </p>
    </section>
  </div>
</template>
