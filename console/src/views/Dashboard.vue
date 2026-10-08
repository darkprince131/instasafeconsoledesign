<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { TOURS } from '../tours.js'
import api from '../api'
import PageHeader from '../components/ui/PageHeader.vue'
import LineChart from '../components/ui/LineChart.vue'

/**
 * The dashboard answers "what needs me?" before it answers "what exists?".
 *
 * Production opens on four metric tiles and four pie charts, each of which in
 * the captured tenant was a single 100% slice. The 775 devices sitting in the
 * approval queue appeared nowhere. Here the attention band leads, and it
 * renders only when something is genuinely waiting — an empty band is worse
 * than no band.
 */

const router = useRouter()
const startTour = inject('startTour', () => {})

/* First run is per viewer and lives in localStorage, which is the right place
   for it: dismissing the card is a convenience, not state anyone else needs,
   and losing it in a private window costs nothing. */
const introDismissed = ref(true)
function dismissIntro () {
  introDismissed.value = true
  try { localStorage.setItem('i365.intro.dismissed', '1') } catch {}
}
const stats = ref({})
const osBreakdown = ref([])
const allDevices = ref([])
const loading = ref(true)

onMounted(async () => {
  try { introDismissed.value = localStorage.getItem('i365.intro.dismissed') === '1' } catch {}
  stats.value = await api.stats()

  const devices = (await api.devices.list({ perPage: 0 })).data
  allDevices.value = devices
  const byOs = {}
  for (const d of devices) byOs[d.osFamily] = (byOs[d.osFamily] || 0) + 1
  osBreakdown.value = Object.entries(byOs)
    .map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 5)

  const events = (await api.events.list({ perPage: 0 })).data
  allEvents.value = events
  try { anomalyRows.value = (await api.anomalies.list({ perPage: 0 })).data } catch { anomalyRows.value = [] }

  // sessions per hour across the day, from the live session set
  const sessions = (await api.sessions.list({ perPage: 0 })).data
  allSessions.value = sessions

  loading.value = false
})

/** Only things that genuinely need a decision. */
const attention = computed(() => {
  const out = []
  if (stats.value.devicesPending) {
    out.push({
      n: stats.value.devicesPending, label: 'Devices pending approval',
      sub: 'oldest 14 days', to: '/devices'
    })
  }
  if (stats.value.usersWithoutMfa) {
    out.push({
      n: stats.value.usersWithoutMfa, label: 'Users without MFA',
      sub: 'mostly Local profile', to: '/users'
    })
  }
  if (stats.value.gateways - stats.value.gatewaysUp > 0) {
    out.push({
      n: stats.value.gateways - stats.value.gatewaysUp, label: 'Gateways degraded',
      sub: 'traffic still flowing', to: '/gateways'
    })
  }
  return out
})

/* ---- seats and renewal ------------------------------------------------- */
/* Before the first load `stats` is {}, and a ratio over zero users printed
   "NaN% of users connected" on the opening screen of the product. */
const connectedPct = computed(() => {
  const u = stats.value.users || 0
  if (!u) return 'no users yet'
  return `${Math.round((stats.value.sessionsLive / u) * 100)}% of users connected`
})

const seatsLeft = computed(() =>
  Math.max(0, (stats.value.licences?.total || 0) - (stats.value.licences?.used || 0)))
const seatPct = computed(() => {
  const t = stats.value.licences?.total || 0
  return t ? Math.min(100, Math.round((stats.value.licences.used / t) * 100)) : 0
})
const RENEWS_ON = new Date('2027-03-31T00:00:00Z')
const renewal = computed(() => {
  const days = Math.round((RENEWS_ON - Date.now()) / 86400000)
  return {
    label: RENEWS_ON.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    note: days > 0 ? `in ${days.toLocaleString()} days` : 'expired'
  }
})

/* ---- the four analytics panels ----------------------------------------- */
/**
 * One period control for all four panels rather than four of them.
 * Production puts Today/Week/Month on each panel separately, which lets the
 * four drift out of sync and quietly invites you to compare a day against a
 * month. They answer the same question about the same estate, so they move
 * together.
 */
const period = ref('week')
const PERIODS = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 }
]
const periodDays = computed(() => PERIODS.find(p => p.key === period.value).days)
const since = computed(() => Date.now() - periodDays.value * 86400000)

const allSessions = ref([])
const anomalyRows = ref([])
const allEvents = ref([])

/** Top N of a grouped total, which is what every one of these panels is. */
function top (items, key, value, n = 5) {
  const by = {}
  for (const it of items) {
    const k = key(it)
    if (!k) continue
    by[k] = (by[k] || 0) + value(it)
  }
  return Object.entries(by)
    .map(([name, v]) => ({ name, v }))
    .sort((a, b) => b.v - a.v).slice(0, n)
}

const inWindow = computed(() =>
  allSessions.value.filter(x => new Date(x.startedAt).getTime() >= since.value))

const topData = computed(() =>
  top(inWindow.value, s => s.username, s => Number(s.bytesIn || 0) + Number(s.bytesOut || 0)))

const topTime = computed(() =>
  top(inWindow.value, s => s.username,
    s => Number(s.durationMin) || Math.max(1, Math.round((Date.now() - new Date(s.startedAt)) / 60000))))

const topAnomalies = computed(() =>
  top(anomalyRows.value.filter(a => new Date(a.at).getTime() >= since.value),
    a => a.kind, () => 1))

const topBlocked = computed(() =>
  top(allEvents.value.filter(e =>
    e.type === 'access.denied' && new Date(e.at).getTime() >= since.value),
  e => e.target, () => 1))

const bytes = (n) => {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}
const mins = (n) => n < 60 ? `${n} min` : `${Math.floor(n / 60)}h ${n % 60}m`

/** The four panels, declared rather than repeated four times in markup. */
/* ---- fleet health ------------------------------------------------------
   Both panels below read `allDevices`, which the dashboard already loads for
   the OS breakdown. Nothing here costs an extra request — the data was on the
   page and was being used for one bar chart.                              */

/**
 * Posture across the estate.
 *
 * The console evaluates these six checks on every connection and shows the
 * result precisely nowhere in aggregate. "Four hundred machines have no disk
 * encryption" is the single most actionable number a ZTNA console holds, and
 * it was computable from data already on the page.
 *
 * Note `jailbroken`: it is the one check that passes by being false, so
 * reading the raw boolean as healthy would report every rooted phone as fine.
 */
const POSTURE_CHECKS = {
  diskEncryption: 'Disk encryption',
  antivirus: 'Antivirus running',
  firewall: 'Firewall enabled',
  osUpToDate: 'Operating system current',
  screenLock: 'Screen lock set',
  jailbroken: 'Not jailbroken or rooted'
}
const posture = computed(() => {
  const devs = allDevices.value
  if (!devs.length) return []
  return Object.entries(POSTURE_CHECKS).map(([k, label]) => {
    const applicable = devs.filter(d => d.posture && k in d.posture)
    const failing = applicable.filter(d =>
      k === 'jailbroken' ? d.posture[k] === true : d.posture[k] !== true).length
    return {
      k, label, failing, n: applicable.length,
      pct: applicable.length ? Math.round((failing / applicable.length) * 100) : 0
    }
  }).sort((a, b) => b.failing - a.failing)
})

/**
 * Agent versions.
 *
 * An out-of-date agent is the commonest cause of a posture failure, which
 * this console says on the downloads screen and then never counts. The
 * newest version present is treated as current; everything behind it is
 * marked, because that is the population that will start failing checks.
 */
const agents = computed(() => {
  const by = {}
  for (const d of allDevices.value) {
    const v = d.agentVersion || 'unknown'
    by[v] = (by[v] || 0) + 1
  }
  const versions = Object.keys(by).filter(v => v !== 'unknown')
  const cmp = (a, b) => {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0)
    return 0
  }
  const current = versions.sort(cmp)[0]
  return Object.entries(by)
    .map(([name, n]) => ({ name, n, current: name === current }))
    .sort((a, b) => b.n - a.n)
})
const behind = computed(() =>
  agents.value.filter(a => !a.current).reduce((t, a) => t + a.n, 0))

/* ---- time series ---------------------------------------------------------
   Lines, because these are the questions where the answer is a direction
   rather than a ranking. Top users and busiest gateway stay as bars: a line
   drawn between unordered categories implies a trend that is not there.

   Buckets follow the period control — Today is twenty-four hours, Week and
   Month are days — so one toggle governs the whole section.               */

const bucketing = computed(() => {
  if (period.value === 'today') {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    return {
      n: 24, size: 3600_000, start: start.getTime(),
      label: (i) => `${String(i).padStart(2, '0')}:00`
    }
  }
  const days = periodDays.value
  const start = new Date(); start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  return {
    n: days, size: 86400_000, start: start.getTime(),
    label: (i) => new Date(start.getTime() + i * 86400_000)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
})

const bucketLabels = computed(() =>
  Array.from({ length: bucketing.value.n }, (_, i) => bucketing.value.label(i)))

/** Drop each row into its bucket by a timestamp, adding whatever it is worth. */
function series (rows, when, value = () => 1) {
  const { n, size, start } = bucketing.value
  const out = Array(n).fill(0)
  for (const r of rows) {
    const t = new Date(when(r)).getTime()
    if (!t || t < start) continue
    const i = Math.floor((t - start) / size)
    if (i >= 0 && i < n) out[i] += value(r)
  }
  return out
}

/** Sessions opened against sign-ins refused, on one axis.
    Put together on purpose: a refusal spike that tracks a traffic spike is
    a busy morning, and the same spike on a flat line is somebody trying
    passwords. */
const activitySeries = computed(() => [
  { name: 'Sessions started', points: series(allSessions.value, s => s.startedAt) },
  {
    name: 'Sign-ins refused', tone: 'attention',
    points: series(
      allEvents.value.filter(e => e.type === 'auth.login.failed' || e.type === 'auth.mfa.failed'),
      e => e.at)
  }
])

/** Traffic through the gateways over the same window. */
const trafficSeries = computed(() => [{
  name: 'Transferred',
  points: series(allSessions.value, s => s.startedAt,
    s => Number(s.bytesIn || 0) + Number(s.bytesOut || 0))
}])

/** Enrolment, cumulative, so the shape shows when the fleet actually grew —
    and the approval backlog alongside it, since those two diverging is the
    whole story of 775 pending devices. */
const enrolSeries = computed(() => {
  const opened = series(allDevices.value, d => d.enrolledAt)
  const stillPending = series(
    allDevices.value.filter(d => d.status === 'pending'), d => d.enrolledAt)
  let a = 0, b = 0
  return [
    { name: 'Enrolled', points: opened.map(v => (a += v)) },
    { name: 'Still waiting for approval', tone: 'attention', points: stillPending.map(v => (b += v)) }
  ]
})

const bytesShort = (n) => {
  if (!n) return '0'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i > 1 ? 1 : 0)} ${u[i]}`
}
const plain = (v) => Math.round(v).toLocaleString()

/* ---- two more period panels, from events and sessions already loaded ---- */

/** What happened when people tried to sign in. */
const SIGNIN_TYPES = {
  'auth.login.success': 'Signed in',
  'auth.login.failed': 'Password refused',
  'auth.mfa.success': 'Second factor passed',
  'auth.mfa.failed': 'Second factor refused'
}
const signIns = computed(() =>
  top(allEvents.value.filter(e =>
    SIGNIN_TYPES[e.type] && new Date(e.at).getTime() >= since.value),
  e => SIGNIN_TYPES[e.type], () => 1, 4))

/** Which gateway is carrying the connections. */
const gatewayLoad = computed(() =>
  top(inWindow.value, s => s.gateway, () => 1, 6))

/** The last few things that happened, whatever they were. */
const recent = computed(() => [...allEvents.value]
  .sort((a, b) => new Date(b.at) - new Date(a.at))
  .slice(0, 8)
  .map(e => ({
    id: e.id, type: e.type, actor: e.actor, severity: e.severity,
    when: fmtWhen(e.at),
    what: e.message || e.type
  })))

function fmtWhen (v) {
  const s = (Date.now() - new Date(v)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const panels = computed(() => [
  { title: 'Top data usage', meta: 'by user', rows: topData.value, fmt: bytes,
    empty: 'No traffic recorded in this window.' },
  { title: 'Top time usage', meta: 'by user', rows: topTime.value, fmt: mins,
    empty: 'No sessions in this window.' },
  /* Anomalies only exist once a scan has been run, so an empty panel here is
     not "no news" - it is "nobody has looked". Saying which, and linking to
     the screen that does it, is the difference between an empty state and a
     dead one. */
  { title: 'Anomalies', meta: 'by type', rows: topAnomalies.value, fmt: (v) => v.toLocaleString(),
    empty: anomalyRows.value.length
      ? 'Nothing anomalous in this window. That is the healthy state.'
      : 'No scan has been run yet.',
    to: anomalyRows.value.length ? null : '/reports/anomaly-logs',
    toLabel: 'Run a scan' },
  { title: 'Top blocked services', meta: 'by application', rows: topBlocked.value,
    fmt: (v) => v.toLocaleString(), empty: 'Nothing was blocked in this window.' },
  { title: 'Sign-in outcomes', meta: 'by result', rows: signIns.value,
    fmt: (v) => v.toLocaleString(), empty: 'Nobody signed in during this window.' },
  { title: 'Gateway load', meta: 'sessions carried', rows: gatewayLoad.value,
    fmt: (v) => v.toLocaleString(), empty: 'No sessions in this window.' }
])

const maxOs = computed(() => Math.max(1, ...osBreakdown.value.map(o => o.n)))
const num = (n) => (n ?? 0).toLocaleString()
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Dashboard"
      :subtitle="`Demo tenant · ${num(stats.users)} users · ${num(stats.devices)} devices · ${num(stats.gateways)} gateways`"
    >
      <template #actions>
        <button class="i-btn"><i class="fa-solid fa-download" aria-hidden="true" /> Export</button>
      </template>
    </PageHeader>

    <!-- First run. Shown once, dismissible, and it does not pretend to be an
         alert - it sits above the attention band rather than competing with it. -->
    <section v-if="!introDismissed" class="i-intro">
      <div class="d-flex align-items-start gap-3">
        <div style="flex:1;min-width:0">
          <h2>Start with the job, not the menu</h2>
          <p>
            The guided flows walk you through real administration — add a user,
            put an application behind a gateway, write the policy that joins
            them, then prove the access works. Each step waits until the work is
            actually done, so nothing advances on a click alone. Everything you
            change is saved to a database that is yours alone; press
            <strong>Reset demo</strong> to put it back.
          </p>
          <div class="d-flex flex-wrap gap-2 mt-3">
            <button class="i-btn i-sm i-primary" @click="startTour('onboard')">
              <i class="fa-solid fa-route" aria-hidden="true" />
              Give someone access to an application
            </button>
            <button class="i-btn i-sm" @click="startTour()">All flows</button>
          </div>
        </div>
        <button class="i-x" @click="dismissIntro" aria-label="Dismiss">
          <i class="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
    </section>

    <!-- attention band: only when something is actually waiting -->
    <section v-if="attention.length" class="i-band">
      <div>
        <div class="i-bt">
          <span class="i-fdot" aria-hidden="true" />
          {{ attention.length }} thing{{ attention.length === 1 ? '' : 's' }} need your attention
        </div>
        <p class="i-bs">Everything else is healthy. {{ stats.gatewaysUp }} of {{ stats.gateways }} gateways reachable.</p>
      </div>
      <div class="i-bandacts">
        <RouterLink v-for="a in attention" :key="a.label" :to="a.to" class="i-ba text-decoration-none">
          <span class="i-n">{{ num(a.n) }}</span>
          <span class="i-l">{{ a.label }}<small>{{ a.sub }}</small></span>
        </RouterLink>
        <RouterLink class="i-btn" :to="attention[0].to">Review</RouterLink>
      </div>
    </section>

    <!-- metrics: value first, label above it and quieter -->
    <section class="i-stats">
      <div class="i-stat">
        <div class="i-k">Online gateways</div>
        <div class="i-v">{{ num(stats.gatewaysUp) }}<small> / {{ num(stats.gateways) }}</small></div>
        <div class="i-n">{{ stats.gatewaysUp === stats.gateways ? 'All reachable' : 'One degraded' }}</div>
      </div>
      <div class="i-stat">
        <div class="i-k">Live sessions</div>
        <div class="i-v">{{ num(stats.sessionsLive) }}</div>
        <div class="i-n">{{ connectedPct }}</div>
      </div>
      <!-- Seats. Production gives half its dashboard cards to subscription
           state and this console had none of it: an admin who cannot see how
           many seats are left cannot plan an onboarding. The bar earns its
           place because the number alone does not say how close you are. -->
      <div class="i-stat">
        <div class="i-k">User subscription</div>
        <div class="i-v">{{ num(stats.licences?.used) }}<small> / {{ num(stats.licences?.total) }}</small></div>
        <div class="i-seatbar" :title="`${seatPct}% of seats used`">
          <span :style="{ width: seatPct + '%' }" :class="{ 'is-tight': seatPct >= 90 }" />
        </div>
        <div class="i-n">{{ num(seatsLeft) }} seats left</div>
      </div>
      <div class="i-stat">
        <div class="i-k">Subscription renews</div>
        <div class="i-v i-vdate">{{ renewal.label }}</div>
        <div class="i-n">{{ renewal.note }}</div>
      </div>
    </section>

    <!-- Fleet health.
         Neither panel is period-scoped: both describe the estate as it stands
         right now, and "40% of devices had no antivirus last Tuesday" is not
         a question anybody asks. -->
    <section class="i-analytics">
      <div class="i-ahead">
        <h2>Fleet health</h2>
        <span class="i-meta">{{ num(stats.devices) }} devices, as they stand</span>
      </div>

      <div class="i-agrid">
        <div class="i-apanel">
          <div class="i-chead">
            <h3>Posture across the estate</h3>
            <span class="i-meta">devices failing each check</span>
          </div>
          <div v-if="loading"><div class="i-skel mb-2" v-for="n in 5" :key="n" /></div>
          <template v-else>
            <div v-for="p in posture" :key="p.k" class="i-barrow">
              <span class="i-bl" :title="p.label">{{ p.label }}</span>
              <span class="i-bartrack">
                <span
                  class="i-barfill"
                  :class="{ 'is-bad': p.pct >= 25 }"
                  :style="{ width: Math.max(1.5, p.pct) + '%' }"
                />
              </span>
              <span class="i-barval">{{ num(p.failing) }}<small class="i-pcts">{{ p.pct }}%</small></span>
            </div>
            <p class="i-hint">
              A device failing any check its policy requires is refused at the
              gateway, whatever its user is allowed to reach.
            </p>
          </template>
        </div>

        <div class="i-apanel">
          <div class="i-chead">
            <h3>Agent versions</h3>
            <span class="i-meta">
              <template v-if="behind">{{ num(behind) }} behind</template>
              <template v-else>all current</template>
            </span>
          </div>
          <div v-if="loading"><div class="i-skel mb-2" v-for="n in 4" :key="n" /></div>
          <template v-else>
            <div v-for="a in agents" :key="a.name" class="i-barrow">
              <span class="i-bl i-tech">
                {{ a.name }}
                <span v-if="a.current" class="i-curtag">current</span>
              </span>
              <span class="i-bartrack">
                <span
                  class="i-barfill" :class="{ 'is-bad': !a.current }"
                  :style="{ width: (a.n / (agents[0]?.n || 1) * 100) + '%' }"
                />
              </span>
              <span class="i-barval">{{ num(a.n) }}</span>
            </div>
            <p class="i-hint">
              An out-of-date agent is the commonest cause of a posture failure.
            </p>
          </template>
        </div>
      </div>
    </section>

    <!-- The four reports production leads with, under one period control. -->
    <section class="i-analytics">
      <div class="i-ahead">
        <h2>Usage and exceptions</h2>
        <div class="i-seg" role="tablist" aria-label="Reporting period">
          <button
            v-for="p in PERIODS" :key="p.key"
            role="tab" :aria-selected="period === p.key"
            class="i-segb" :class="{ 'is-on': period === p.key }"
            @click="period = p.key"
          >{{ p.label }}</button>
        </div>
      </div>

      <!-- Trend first, ranking second. "Is this getting worse" is the
           question you ask before "who is worst", and the period control
           above governs both. -->
      <div class="i-trends">
        <div class="i-apanel">
          <div class="i-chead">
            <h3>Activity</h3>
            <span class="i-meta">sessions against refused sign-ins</span>
          </div>
          <LineChart
            :series="activitySeries" :labels="bucketLabels"
            :format="plain" :height="180"
          />
        </div>

        <div class="i-apanel">
          <div class="i-chead">
            <h3>Traffic</h3>
            <span class="i-meta">through the gateways</span>
          </div>
          <LineChart
            :series="trafficSeries" :labels="bucketLabels"
            :format="bytesShort" :height="180" area
          />
        </div>
      </div>

      <div class="i-agrid">
        <div v-for="pn in panels" :key="pn.title" class="i-apanel">
          <div class="i-chead">
            <h3>{{ pn.title }}</h3>
            <span class="i-meta">{{ pn.meta }}</span>
          </div>

          <div v-if="loading">
            <div class="i-skel mb-2" v-for="n in 4" :key="n" />
          </div>

          <div v-else-if="pn.rows.length">
            <div v-for="(row, i) in pn.rows" :key="row.name" class="i-barrow">
              <span class="i-bl" :title="row.name">{{ row.name }}</span>
              <span class="i-bartrack">
                <span
                  class="i-barfill"
                  :style="{ width: (row.v / pn.rows[0].v * 100) + '%', opacity: i ? .5 : 1 }"
                />
              </span>
              <span class="i-barval">{{ pn.fmt(row.v) }}</span>
            </div>
          </div>

          <p v-else class="i-anote">
            {{ pn.empty }}
            <RouterLink v-if="pn.to" :to="pn.to" class="i-alink">{{ pn.toLabel }}</RouterLink>
          </p>
        </div>
      </div>
    </section>

    <section class="i-cols">
      <div class="i-col">
        <div class="i-chead">
          <h2>Devices by operating system</h2>
          <span class="i-meta">All time</span>
        </div>
        <div v-if="loading"><div class="i-skel mb-3" v-for="n in 4" :key="n" /></div>
        <!-- a labelled bar beats a pie: sortable, readable, and it works at
             one data point, which the production pies did not -->
        <div v-for="o in osBreakdown" :key="o.name" class="i-barrow">
          <span class="i-bl">{{ o.name }}</span>
          <span class="i-bartrack"><span class="i-barfill" :style="{ width: (o.n / maxOs * 100) + '%' }" /></span>
          <span class="i-barval">{{ num(o.n) }}</span>
        </div>
      </div>

      <div class="i-col">
        <div class="i-chead">
          <h2>Enrolment and the approval backlog</h2>
          <span class="i-meta">cumulative, over the period</span>
        </div>
        <LineChart
          :series="enrolSeries" :labels="bucketLabels"
          :format="plain" :height="200"
        />
        <p class="i-hint">
          The gap between the two lines is the queue. When they climb together,
          devices are enrolling and nobody is approving them.
        </p>
      </div>
    </section>

    <section class="i-cols">
      <div class="i-col">
        <div class="i-chead">
          <h2>Recent activity</h2>
          <RouterLink to="/reports/event-logs" class="i-meta text-decoration-none">Event log</RouterLink>
        </div>
        <div v-if="loading"><div class="i-skel mb-2" v-for="n in 5" :key="n" /></div>
        <ul v-else-if="recent.length" class="i-feed">
          <li v-for="e in recent" :key="e.id">
            <span class="i-feeddot" :class="'is-' + (e.severity || 'info')" aria-hidden="true" />
            <span class="i-feedtext">
              <span class="i-feedwhat">{{ e.what }}</span>
              <code class="i-tech i-feedtype">{{ e.type }}</code>
            </span>
            <span class="i-feedwhen">{{ e.when }}</span>
          </li>
        </ul>
        <p v-else class="i-anote">Nothing has happened yet.</p>
      </div>

      <div class="i-col">
        <div class="i-chead">
          <h2>Guided flows</h2>
          <span class="i-meta">Each step is checked</span>
        </div>
        <p style="font-size:12.5px;color:var(--i-dim);margin:0 0 14px">
          Real administration tasks, in order. A step ticks when the record it
          asked for genuinely exists, not when you press Next.
        </p>
        <div class="d-flex flex-column gap-2">
          <button
            v-for="t in TOURS.slice(0, 4)" :key="t.id"
            class="i-tourline" @click="startTour(t.id)"
          >
            <span class="i-tour-ico"><i class="fa-solid" :class="t.icon" aria-hidden="true" /></span>
            <span style="flex:1;min-width:0">
              <span class="i-tourline-t">{{ t.title }}</span>
              <span class="i-tourline-b">{{ t.blurb }}</span>
            </span>
            <span class="i-tourline-m">{{ t.minutes }} min</span>
          </button>
        </div>
        <button class="i-btn i-sm i-quiet mt-2" @click="startTour()">
          All {{ TOURS.length }} flows
        </button>
      </div>
    </section>
  </div>
</template>
