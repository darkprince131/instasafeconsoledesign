<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { portalUser, portalSignOut } from '../../lib/portal-session.js'

/**
 * The member portal: one page, and it is a gate rather than an account area.
 *
 * This was built as a three-card self-service page — enrol MFA, see my
 * devices, see my applications — which is what a ZTNA end-user portal sounds
 * like it should be. Velto's actual /member area is one screen that asks a
 * single question: is the InstaSafe agent installed and running on the
 * machine you are sitting at? If it is not, nothing else matters, because
 * nothing will connect. So it offers the download and gets out of the way.
 *
 * Enrolment moved into the sign-in flow, which is where it belongs: an
 * employee is prompted to enrol when the administrator has required it and
 * they have not done it yet, not by finding a settings page.
 *
 * The agent probe below is real. It tries the loopback port a desktop agent
 * would listen on and reports what actually happened; it does not pretend to
 * check and then show a canned failure. In this demo nothing is listening, so
 * it reports not detected — which is the state velto shows on any machine
 * without the agent, and the state worth designing for.
 */

const router = useRouter()
const user = portalUser

const AGENT_PORT = 7865
const state = ref('checking')     // checking · missing · running
const checkedAt = ref(null)
const explain = ref('')

/** What to offer first. A download button for the wrong OS is noise. */
const PLATFORMS = [
  { key: 'windows', label: 'Windows', icon: 'fa-brands fa-windows', file: 'insta-check.exe' },
  { key: 'deb', label: 'Linux (.deb)', icon: 'fa-brands fa-linux', file: 'insta-check.deb' },
  { key: 'rpm', label: 'Linux (.rpm)', icon: 'fa-brands fa-linux', file: 'insta-check.rpm' },
  { key: 'macos', label: 'macOS', icon: 'fa-brands fa-apple', file: 'insta-check.pkg' },
  { key: 'ios', label: 'iOS', icon: 'fa-brands fa-app-store-ios', store: true },
  { key: 'android', label: 'Android', icon: 'fa-brands fa-android', store: true }
]

const detected = computed(() => {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Mac OS X/i.test(ua)) return 'macos'
  if (/Linux/i.test(ua)) return 'deb'
  return 'windows'
})
const primary = computed(() => PLATFORMS.find(p => p.key === detected.value))
const others = computed(() => PLATFORMS.filter(p => p.key !== detected.value))

/**
 * Ask the agent whether it is there.
 *
 * A desktop agent exposes a loopback endpoint; the browser can reach it and
 * nothing else can. `no-cors` means we never see the body, only whether the
 * request completed at all — which is the entire question. A refused
 * connection throws, and that is a genuine answer, not a simulated one.
 */
async function probe () {
  state.value = 'checking'
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 1800)
  try {
    await fetch(`http://127.0.0.1:${AGENT_PORT}/status`, { mode: 'no-cors', signal: ctl.signal })
    state.value = 'running'
  } catch {
    state.value = 'missing'
  } finally {
    clearTimeout(timer)
    checkedAt.value = new Date()
  }
}

function signOut () {
  portalSignOut()
  router.push('/portal/signin')
}

onMounted(() => {
  if (!user.value) { router.replace('/portal/signin'); return }
  probe()
})
</script>

<template>
  <div class="p-gate">
    <template v-if="state === 'checking'">
      <span class="p-mark is-wait"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /></span>
      <h1 class="p-gh">Checking this device</h1>
      <p class="p-gs">Looking for the InstaSafe agent.</p>
    </template>

    <template v-else-if="state === 'running'">
      <span class="p-mark is-ok"><i class="fa-solid fa-check" aria-hidden="true" /></span>
      <h1 class="p-gh">You are protected</h1>
      <p class="p-gs">
        The agent is running on this device. Your applications are reachable
        through it — there is nothing else to do here.
      </p>
      <div class="p-gacts">
        <button class="p-btn p-ghost" @click="signOut">
          <i class="fa-solid fa-right-from-bracket" aria-hidden="true" /> Sign out
        </button>
        <button class="p-btn p-ghost" @click="probe">
          <i class="fa-solid fa-rotate" aria-hidden="true" /> Check again
        </button>
      </div>
    </template>

    <template v-else>
      <span class="p-mark is-bad"><i class="fa-solid fa-xmark" aria-hidden="true" /></span>
      <h1 class="p-gh">InstaSafe agent not detected</h1>
      <p class="p-gs">It may not be installed, or it may not be running.</p>

      <div class="p-gacts">
        <button class="p-btn p-ghost" @click="signOut">
          <i class="fa-solid fa-right-from-bracket" aria-hidden="true" /> Sign out
        </button>
        <button class="p-btn p-ghost" @click="probe">
          <i class="fa-solid fa-rotate" aria-hidden="true" /> Retry
        </button>
      </div>

      <!-- The buttons are velto's, the binaries are not ours to ship.
           A download that 404s is a worse fake than one that says what it is,
           so these explain themselves rather than failing. -->
      <button v-if="primary" class="p-btn p-dl" @click="explain = primary.label">
        <i :class="primary.icon" aria-hidden="true" /> Download for {{ primary.label }}
      </button>

      <p class="p-ghint">Other platforms</p>
      <div class="p-plats">
        <button
          v-for="p in others" :key="p.key"
          class="p-plat" @click="explain = p.label"
        >
          <i :class="p.icon" aria-hidden="true" /> {{ p.label }}
        </button>
      </div>

      <p v-if="explain" class="p-gexplain">
        In production this downloads the InstaSafe agent for {{ explain }} —
        velto serves it from <code>/storage/insta-check.*</code>, with iOS and
        Android going to the App Store and Play Store. This demo does not ship
        a signed binary, so the button stops here rather than handing you a
        404.
      </p>

      <p class="p-gnote">
        Already installed it? Start the InstaSafe agent, then press Retry. If it
        still says this, your administrator can see whether your device has been
        approved.
      </p>
    </template>

    <p v-if="checkedAt" class="p-gstamp">
      Checked at {{ checkedAt.toLocaleTimeString() }} ·
      this page really does probe for the agent, it does not assume
    </p>

    <RouterLink to="/dashboard" class="p-adminlink">
      <i class="fa-solid fa-gauge" aria-hidden="true" /> Administrator console
    </RouterLink>
  </div>
</template>
