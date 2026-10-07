<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { TOURS } from '../tours.js'
import api from '../api'
import PageHeader from '../components/ui/PageHeader.vue'

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
const denied = ref([])
const hourly = ref([])
const loading = ref(true)

onMounted(async () => {
  try { introDismissed.value = localStorage.getItem('i365.intro.dismissed') === '1' } catch {}
  stats.value = await api.stats()

  const devices = (await api.devices.list({ perPage: 0 })).data
  const byOs = {}
  for (const d of devices) byOs[d.osFamily] = (byOs[d.osFamily] || 0) + 1
  osBreakdown.value = Object.entries(byOs)
    .map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 5)

  const events = (await api.events.list({ perPage: 0 })).data
  const byApp = {}
  for (const e of events.filter(x => x.type === 'access.denied')) {
    byApp[e.actor] = (byApp[e.actor] || 0) + 1
  }
  denied.value = Object.entries(byApp)
    .map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 5)

  allEvents.value = events
  try { anomalyRows.value = (await api.anomalies.list({ perPage: 0 })).data } catch { anomalyRows.value = [] }

  // sessions per hour across the day, from the live session set
  const sessions = (await api.sessions.list({ perPage: 0 })).data
  allSessions.value = sessions
  const buckets = Array(24).fill(0)
  for (const s of sessions) buckets[new Date(s.startedAt).getHours()]++
  hourly.value = buckets

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
    fmt: (v) => v.toLocaleString(), empty: 'Nothing was blocked in this window.' }
])

const maxOs = computed(() => Math.max(1, ...osBreakdown.value.map(o => o.n)))
const maxDenied = computed(() => Math.max(1, ...denied.value.map(o => o.n)))
const maxHour = computed(() => Math.max(1, ...hourly.value))
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
          <h2>Sessions today</h2>
          <span class="i-meta">Hourly · peak {{ maxHour }}</span>
        </div>
        <div class="d-flex align-items-end gap-1" style="height:132px">
          <span
            v-for="(n, h) in hourly" :key="h"
            class="flex-fill"
            :title="`${String(h).padStart(2,'0')}:00 — ${n} sessions`"
            :style="{
              height: Math.max(3, (n / maxHour) * 100) + '%',
              background: n === maxHour ? 'var(--i-v600)' : 'var(--i-v500)',
              opacity: n === maxHour ? 1 : .55,
              borderRadius: '3px'
            }"
          />
        </div>
        <div class="d-flex justify-content-between mt-2" style="font-size:11px;color:var(--i-mute)">
          <span>00:00</span><span>12:00</span><span>23:00</span>
        </div>
      </div>
    </section>

    <section class="i-cols">
      <div class="i-col">
        <div class="i-chead">
          <h2>Most denied users</h2>
          <span class="i-meta">Last 30 days</span>
        </div>
        <div v-for="o in denied" :key="o.name" class="i-barrow">
          <span class="i-bl">{{ o.name }}</span>
          <span class="i-bartrack"><span class="i-barfill" :style="{ width: (o.n / maxDenied * 100) + '%' }" /></span>
          <span class="i-barval">{{ o.n }}</span>
        </div>
        <div v-if="!loading && !denied.length" class="i-zero" style="padding:40px 0">
          <h3>Nothing denied</h3>
          <p>No access was refused in this window. That is the healthy state.</p>
        </div>
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
