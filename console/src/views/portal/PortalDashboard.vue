<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import api from '../../api'
import { portalUser } from '../../lib/portal-session.js'

/**
 * The member dashboard — velto's, in this console's clothes.
 *
 * Velto's own sections, in its own order: a welcome card carrying the
 * policies in force, the agent's state, this session and the one before it,
 * the devices registered to this person, the applications they can reach,
 * what they opened recently, and a network test.
 *
 * Three things are done differently, and each is a fix rather than a flourish:
 *
 * 1. **The policy chips say whether they are on.** Velto renders MFA, Device
 *    Binding, Shift Schedule and Geo Binding as four identical grey pills
 *    whatever their state, so they read as decoration. Here an enforced
 *    control says so and an unenforced one says that too.
 * 2. **The agent card leads.** "Agent not connected" is the single fact that
 *    decides whether anything else on this page will work, and velto gives it
 *    a third of a row with no way to act on it.
 * 3. **Devices and sessions carry their own meaning.** A session row that
 *    says only "Windows · Desktop · Chrome · India" cannot answer "was that
 *    me?". Saying how long ago, and whether it was this browser, can.
 */

const user = portalUser

/* ---------------------------------------------------------------- agent */
const AGENT_PORT = 7865
const agent = ref('checking')        // checking · running · missing
const agentCheckedAt = ref(null)

/**
 * A real probe, kept from the earlier portal.
 *
 * A desktop agent exposes a loopback endpoint; the browser can reach it and
 * nothing else can. `no-cors` hides the body but not whether the request
 * completed, which is the whole question. A refused connection throws, and
 * that is a genuine answer rather than a canned one.
 */
async function probe () {
  agent.value = 'checking'
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 1800)
  try {
    await fetch(`http://127.0.0.1:${AGENT_PORT}/status`, { mode: 'no-cors', signal: ctl.signal })
    agent.value = 'running'
  } catch {
    agent.value = 'missing'
  } finally {
    clearTimeout(timer)
    agentCheckedAt.value = new Date()
  }
}

/* ------------------------------------------------------------- the data */
const devices = ref([])
const apps = ref([])
const history = ref([])
const sessions = ref([])
const loading = ref(true)

const me = computed(() => user.value?.username || '')

async function load () {
  loading.value = true
  try {
    const [d, a, h, s] = await Promise.all([
      api.devices.list({ perPage: 0, filters: { username: me.value } }),
      api.applications.list({ perPage: 0 }),
      api.appAccessLog.list({ perPage: 5, sort: 'at', dir: 'desc', filters: { username: me.value } }),
      api.sessions.list({ perPage: 5, sort: 'startedAt', dir: 'desc', filters: { username: me.value } })
    ])
    devices.value = d.data
    apps.value = a.data
    history.value = h.data
    sessions.value = s.data
  } finally { loading.value = false }
}

/* Velto splits the launcher in two, and the split is real: a web or
   remote-desktop application opens in the browser, a network one only works
   once the agent is up. Showing them together would promise the same thing
   of both. */
const WEB_TYPES = ['web', 'rdp', 'ssh', 'vnc', 'wfs', 'db']
const webApps = computed(() => apps.value.filter(a => WEB_TYPES.includes(String(a.type).toLowerCase())))
const netApps = computed(() => apps.value.filter(a => !WEB_TYPES.includes(String(a.type).toLowerCase())))

const current = computed(() => sessions.value[0] || null)
const previous = computed(() => sessions.value[1] || null)

/**
 * The four controls velto shows, with their real state.
 *
 * Each reads off something the administrator actually set, so a chip that
 * says "Enforced" is making a claim the console can be held to.
 */
const policies = computed(() => {
  const u = user.value || {}
  return [
    { key: 'mfa', label: 'Multi-factor', icon: 'fa-shield-halved',
      on: !!u.mfaEnrolled,
      onText: 'Enrolled', offText: 'Not enrolled',
      help: u.mfaEnrolled
        ? 'A second factor is asked for when you sign in.'
        : 'Set one up — without it an account is one password away from anybody.',
      to: '/portal/mfa' },
    { key: 'device', label: 'Device binding', icon: 'fa-laptop',
      on: devices.value.length > 0,
      onText: `${devices.value.length} device${devices.value.length === 1 ? '' : 's'}`,
      offText: 'No device registered',
      help: devices.value.length
        ? 'You can only connect from a device registered to you.'
        : 'Nothing is registered yet, so nothing can connect.' },
    { key: 'shift', label: 'Shift schedule', icon: 'fa-clock',
      on: !!u.timeSchedule,
      onText: u.timeSchedule || 'Set', offText: 'Any time',
      help: u.timeSchedule
        ? 'Access is refused outside these hours.'
        : 'No hours restriction applies to your account.' },
    { key: 'geo', label: 'Geo binding', icon: 'fa-location-dot',
      on: !!u.geoFence,
      onText: u.geoFence || 'Set', offText: 'Any location',
      help: u.geoFence
        ? 'Access is refused from outside this area.'
        : 'No location restriction applies to your account.' }
  ]
})

/* ------------------------------------------------------------ formatting */
function ago (v) {
  if (!v) return '—'
  const mins = Math.round((Date.now() - new Date(v)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
function stamp (v) {
  return v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

/* "Was that me?" is the only question a session card is ever asked, and this
   browser can answer half of it for free. */
const thisBrowser = computed(() => {
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  if (/Firefox\//.test(ua)) return 'Firefox'
  return ''
})

onMounted(() => { probe(); load() })
</script>

<template>
  <div class="p-wide">
    <!-- ------------------------------------------------------- welcome -->
    <section class="p-hero">
      <span class="p-heroav">{{ (user?.firstName || user?.username || '?').slice(0, 1).toUpperCase() }}</span>
      <div class="p-herobody">
        <h1>Welcome, {{ user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.username }}</h1>
        <p class="p-herosub">
          <span class="i-tech">{{ user?.username }}</span>
          <span v-if="user?.email"> · {{ user.email }}</span>
        </p>
      </div>
    </section>

    <!-- Velto's four chips, saying what they are rather than only existing. -->
    <section class="p-pols">
      <component
        :is="p.to ? 'RouterLink' : 'div'" v-for="p in policies" :key="p.key"
        :to="p.to" class="p-pol" :class="{ 'is-on': p.on }"
      >
        <i class="fa-solid p-polic" :class="p.icon" aria-hidden="true" />
        <span class="p-poll">{{ p.label }}</span>
        <strong class="p-polv">{{ p.on ? p.onText : p.offText }}</strong>
        <span class="p-polh">{{ p.help }}</span>
      </component>
    </section>

    <!-- --------------------------------------------------------- agent -->
    <section class="p-card p-agent" :class="'is-' + agent">
      <div class="p-agenti">
        <i
          class="fa-solid"
          :class="agent === 'running' ? 'fa-circle-check'
            : agent === 'checking' ? 'fa-circle-notch fa-spin' : 'fa-circle-exclamation'"
          aria-hidden="true"
        />
      </div>
      <div class="p-agentb">
        <h2>
          {{ agent === 'running' ? 'The agent is running'
            : agent === 'checking' ? 'Checking this device…' : 'The agent is not running' }}
        </h2>
        <p>
          <template v-if="agent === 'running'">
            Everything below is reachable from this machine.
          </template>
          <template v-else-if="agent === 'checking'">
            Looking for the InstaSafe agent on this machine.
          </template>
          <template v-else>
            Network applications will not connect until it is installed and
            started. Web applications still open in the browser.
          </template>
        </p>
        <p v-if="agentCheckedAt" class="p-agentw">
          Checked at {{ agentCheckedAt.toLocaleTimeString() }} — this really probes
          for the agent rather than assuming.
        </p>
      </div>
      <div class="p-agenta">
        <button class="p-btn p-ghost" @click="probe">
          <i class="fa-solid fa-rotate" aria-hidden="true" /> Check again
        </button>
        <RouterLink v-if="agent === 'missing'" class="p-btn" to="/portal/downloads">
          <i class="fa-solid fa-download" aria-hidden="true" /> Get the agent
        </RouterLink>
      </div>
    </section>

    <!-- ------------------------------------------------------ sessions -->
    <div class="p-grid2">
      <section class="p-card">
        <h2 class="p-cardh"><i class="fa-solid fa-right-to-bracket" aria-hidden="true" /> This session</h2>
        <template v-if="current">
          <p class="p-big">{{ stamp(current.startedAt) }}</p>
          <p class="p-sub">{{ ago(current.startedAt) }}</p>
          <dl class="p-kv">
            <dt>Where</dt><dd>{{ current.city || '—' }}</dd>
            <dt>Gateway</dt><dd class="i-tech">{{ current.gateway || '—' }}</dd>
            <dt>Opened</dt><dd>{{ current.application || '—' }}</dd>
            <dt>This browser</dt><dd>{{ thisBrowser || 'Unknown' }}</dd>
          </dl>
        </template>
        <p v-else class="p-sub">No session recorded yet.</p>
      </section>

      <section class="p-card">
        <h2 class="p-cardh"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true" /> Previous session</h2>
        <template v-if="previous">
          <p class="p-big">{{ stamp(previous.startedAt) }}</p>
          <p class="p-sub">{{ ago(previous.startedAt) }}</p>
          <dl class="p-kv">
            <dt>Where</dt><dd>{{ previous.city || '—' }}</dd>
            <dt>Gateway</dt><dd class="i-tech">{{ previous.gateway || '—' }}</dd>
            <dt>Opened</dt><dd>{{ previous.application || '—' }}</dd>
          </dl>
          <p class="p-note">
            Not you? Change your password and tell your administrator.
          </p>
        </template>
        <p v-else class="p-sub">This is your first recorded session.</p>
      </section>
    </div>

    <!-- ------------------------------------------------------- devices -->
    <section class="p-card">
      <h2 class="p-cardh">
        <i class="fa-solid fa-laptop" aria-hidden="true" /> Your devices
        <span class="p-count">{{ devices.length }}</span>
      </h2>
      <div v-if="devices.length" class="p-devs">
        <article v-for="d in devices" :key="d.id" class="p-dev">
          <header>
            <strong>{{ d.name }}</strong>
            <span class="p-tag" :class="d.status === 'approved' ? 'is-ok' : 'is-att'">
              {{ d.status === 'approved' ? 'approved' : d.status }}
            </span>
          </header>
          <p class="p-devos">{{ d.os || 'Unknown operating system' }}</p>
          <!-- Velto labels these Manufacturer, Model and Hostname. This
               console identifies a device by serial, MAC and UUID together,
               which is what it actually stores and what an administrator
               looking for this machine would search on. -->
          <dl class="p-kv p-kvtight">
            <dt>Serial</dt><dd class="i-tech">{{ d.serialNumber || '—' }}</dd>
            <dt>MAC</dt><dd class="i-tech">{{ d.macAddress || '—' }}</dd>
            <dt>Agent</dt><dd class="i-tech">{{ d.agentVersion || '—' }}</dd>
            <dt>Registered</dt><dd>{{ stamp(d.enrolledAt) }}</dd>
          </dl>
          <p v-if="d.posture && d.posture !== 'pass'" class="p-note">
            This device fails a posture check, so it may be refused even
            though it is approved.
          </p>
        </article>
      </div>
      <p v-else class="p-sub">
        No device is registered to you yet. Sign in from the machine you work
        on with the agent running, and it registers itself.
      </p>
    </section>

    <!-- -------------------------------------------------- applications -->
    <section class="p-card">
      <h2 class="p-cardh">
        <i class="fa-solid fa-globe" aria-hidden="true" /> Opens in the browser
        <span class="p-count">{{ webApps.length }}</span>
      </h2>
      <div v-if="webApps.length" class="p-apps">
        <RouterLink v-for="a in webApps.slice(0, 8)" :key="a.id" class="p-appt" to="/portal/applications">
          <span class="p-appi">{{ String(a.type || '?').toUpperCase().slice(0, 3) }}</span>
          <span class="p-appn">{{ a.name }}</span>
          <i class="fa-solid fa-arrow-right" aria-hidden="true" />
        </RouterLink>
      </div>
      <p v-else class="p-sub">Nothing has been assigned to you yet.</p>
      <RouterLink v-if="webApps.length > 8" class="p-link" to="/portal/applications">
        See all {{ webApps.length }}
      </RouterLink>
    </section>

    <section class="p-card">
      <h2 class="p-cardh">
        <i class="fa-solid fa-network-wired" aria-hidden="true" /> Needs the agent
        <span class="p-count">{{ netApps.length }}</span>
      </h2>
      <div v-if="netApps.length" class="p-apps">
        <span v-for="a in netApps.slice(0, 8)" :key="a.id" class="p-appt is-static">
          <span class="p-appi">{{ String(a.type || '?').toUpperCase().slice(0, 3) }}</span>
          <span class="p-appn">{{ a.name }}</span>
        </span>
      </div>
      <p v-else class="p-sub">No network application is assigned to you.</p>
      <p v-if="netApps.length && agent !== 'running'" class="p-note">
        These reach your network through the agent, which is not running, so
        they will not connect right now.
      </p>
    </section>

    <!-- ------------------------------------------------------- history -->
    <section class="p-card">
      <h2 class="p-cardh"><i class="fa-solid fa-list" aria-hidden="true" /> Recently opened</h2>
      <ul v-if="history.length" class="p-hist">
        <li v-for="(h, i) in history" :key="h.id || i">
          <span class="p-histn">{{ h.destination || h.application || h.name }}</span>
          <span class="p-hists">
            <span v-if="h.action && h.action !== 'Allowed'" class="p-tag is-att">{{ h.action }}</span>
            {{ ago(h.at) }}
          </span>
        </li>
      </ul>
      <p v-else class="p-sub">Nothing opened yet.</p>
    </section>

    <!-- --------------------------------------------------- network test -->
    <section class="p-card">
      <h2 class="p-cardh"><i class="fa-solid fa-gauge-high" aria-hidden="true" /> Connection test</h2>
      <p class="p-sub">
        If something feels slow, run this before raising a ticket — it is the
        first thing support will ask for.
      </p>
      <RouterLink class="p-btn p-ghost mt-2" to="/reports/network-test">
        <i class="fa-solid fa-play" aria-hidden="true" /> Run a test
      </RouterLink>
    </section>
  </div>
</template>
