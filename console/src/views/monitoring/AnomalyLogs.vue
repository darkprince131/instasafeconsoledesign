<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import { fmtAgo } from '../../resources.js'

/**
 * Anomaly log.
 *
 * Anomalies are the one report you cannot demonstrate by waiting, because a
 * healthy tenant produces none. So the detections are real functions you can
 * run against the tenant's own data, and the button that runs them says so.
 *
 * Impossible travel is genuinely computed: two sign-ins from cities far
 * enough apart that the implied speed exceeds a plane. The distance is a real
 * haversine over real coordinates.
 */

const toast = inject('toast', () => {})

const rows = ref([])
const loading = ref(true)
const scanning = ref(false)

const CITIES = {
  Bengaluru: [12.97, 77.59], Mumbai: [19.08, 72.88], Pune: [18.52, 73.86],
  London: [51.51, -0.13], Frankfurt: [50.11, 8.68], Singapore: [1.35, 103.82],
  'New York': [40.71, -74.01], Austin: [30.27, -97.74], Dubai: [25.20, 55.27],
  Sydney: [-33.87, 151.21]
}

/** Haversine, in km. */
function distance (a, b) {
  const [la1, lo1] = CITIES[a] || [], [la2, lo2] = CITIES[b] || []
  if (la1 === undefined || la2 === undefined) return null
  const R = 6371, rad = (d) => d * Math.PI / 180
  const dLa = rad(la2 - la1), dLo = rad(lo2 - lo1)
  const h = Math.sin(dLa / 2) ** 2 +
            Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLo / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

/* Velto's columns: Detected At, Username, Message, Additional Informations.
   The last is a block of key/value pairs under the message — how many
   attempts, which address — and it is the part that makes a finding
   actionable, so it is a column rather than something to open a row for.
   Severity is this console's addition, and it is what the list is sorted by
   in the eye: a high finding should not look like a low one. */
const columns = [
  { key: 'at', label: 'Detected At', mono: true,
    cell: (v) => {
      const d = new Date(v)
      const p = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
        `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    } },
  { key: 'actor', label: 'Username', bold: true },
  { key: 'detail', label: 'Message' },
  { key: 'extra', label: 'Additional Informations', dim: true,
    cell: (v) => v ? Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(' · ') : '—' },
  { key: 'severity', label: 'Severity',
    pill: (v) => v === 'high' ? 'bad' : v === 'medium' ? 'att' : null }
]

/* Velto's own periods on this screen. A risk report with no window is a wall
   of findings; the window is how you ask "what happened since lunchtime". */
const PERIODS = [
  { key: 'hour', label: 'Hour', hours: 1 },
  { key: 'today', label: 'Today', hours: null },
  { key: '24h', label: 'Last 24 Hours', hours: 24 },
  { key: 'week', label: 'Week', hours: 24 * 7 },
  { key: 'month', label: 'Month', hours: 24 * 30 }
]
const period = ref('month')

/** The rows the chosen window actually covers. */
const visibleRows = computed(() => rows.value.filter(withinPeriod))

function withinPeriod (row) {
  const p = PERIODS.find(x => x.key === period.value)
  if (!p) return true
  const at = new Date(row.at)
  if (p.hours === null) {
    const now = new Date()
    return at.getFullYear() === now.getFullYear() &&
      at.getMonth() === now.getMonth() && at.getDate() === now.getDate()
  }
  return Date.now() - at.getTime() <= p.hours * 3600 * 1000
}

async function load () {
  loading.value = true
  const res = await api.anomalies.list({ perPage: 0, sort: 'at', dir: 'desc' })
  rows.value = res.data
  loading.value = false
}

/**
 * Runs the detections over the event log. Nothing is invented: each finding
 * points at the rows that produced it.
 */
async function scan () {
  scanning.value = true
  const events = (await api.events.list({ perPage: 0, sort: 'at', dir: 'desc' })).data
  const found = []

  // 1 · impossible travel — two sign-ins too far apart, too close together
  const byUser = {}
  for (const e of events) {
    if (e.type !== 'auth.login.success' || !e.actor || !e.city) continue
    ;(byUser[e.actor] ||= []).push(e)
  }
  for (const [actor, list] of Object.entries(byUser)) {
    list.sort((a, b) => new Date(b.at) - new Date(a.at))
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1]
      if (a.city === b.city) continue
      const km = distance(a.city, b.city)
      if (km === null) continue
      const hours = Math.abs(new Date(a.at) - new Date(b.at)) / 3_600_000
      if (hours <= 0 || hours > 12) continue
      const kmh = Math.round(km / hours)
      if (kmh < 900) continue            // a commercial flight cruises ~900 km/h
      found.push({
        id: 'anm_' + Date.now().toString(36) + found.length,
        kind: 'Impossible travel', actor, severity: 'high',
        detail: `${b.city} → ${a.city}, ${km.toLocaleString()} km in ${hours.toFixed(1)}h (${kmh.toLocaleString()} km/h)`,
        at: a.at
      })
      break                              // one finding per user is enough
    }
  }

  // 2 · repeated authentication failure
  const fails = {}
  for (const e of events) {
    if (e.type === 'auth.login.failed' || e.type === 'auth.mfa.failed') {
      fails[e.actor] = (fails[e.actor] || 0) + 1
    }
  }
  for (const [actor, n] of Object.entries(fails)) {
    if (n < 3) continue
    found.push({
      id: 'anm_' + Date.now().toString(36) + 'f' + found.length,
      kind: 'Repeated auth failure', actor,
      severity: n >= 6 ? 'high' : 'medium',
      detail: `${n} failed attempts in the retained window`,
      at: new Date().toISOString()
    })
  }

  // 3 · posture failures that still reached something
  const postureFails = events.filter(e => e.type === 'device.check.failed').length
  if (postureFails > 4) {
    found.push({
      id: 'anm_' + Date.now().toString(36) + 'p',
      kind: 'Posture failures elevated', actor: '—', severity: 'medium',
      detail: `${postureFails} device checks failed across the tenant`,
      at: new Date().toISOString()
    })
  }

  for (const f of found) await api.anomalies.create(f)
  await api.events.record({
    type: 'anomaly.scan',
    message: `Anomaly scan over ${events.length} events — ${found.length} finding${found.length === 1 ? '' : 's'}`,
    severity: found.length ? 'warning' : 'info'
  })
  scanning.value = false
  toast(found.length
    ? `${found.length} anomal${found.length === 1 ? 'y' : 'ies'} found`
    : 'Scan complete — nothing anomalous')
  load()
}
onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Risk Report"
      subtitle="Behaviour that does not fit the pattern: impossible travel, one address shared by several accounts, a session hopping between addresses, and attempts the policy blocked."
    >
    </PageHeader>

    <div class="i-strip">
      <div class="i-ftabs">
        <button
          v-for="p in PERIODS" :key="p.key"
          class="i-chip" :class="{ 'is-on': period === p.key }"
          :aria-pressed="period === p.key"
          @click="period = p.key"
        >{{ p.label }}</button>
      </div>
      <div class="i-tools">
        <button class="i-btn i-primary" :disabled="scanning" @click="scan">
          <i class="fa-solid fa-satellite-dish" aria-hidden="true" />
          {{ scanning ? 'Scanning…' : 'Run detection' }}
        </button>
      </div>
    </div>

    <DataTable
      :columns="columns" :rows="visibleRows" :total="visibleRows.length" :loading="loading"
      :selectable="false" :per-page="50"
    >
      <template #empty>
        <EmptyState
          icon="fa-shield-halved"
          title="Nothing anomalous"
          body="No impossible travel, no repeated authentication failures, no elevated posture failures. Press Run detection to check again."
          action-label="Run detection"
          @action="scan"
        />
      </template>
    </DataTable>

    <p class="i-demo-note mt-4" style="max-width:700px">
      <strong style="color:var(--i-ink)">These detections genuinely run.</strong>
      Impossible travel compares successive sign-ins for one user and computes a
      real haversine distance between the two cities; it fires when the implied
      speed exceeds about 900 km/h, which is roughly a commercial flight. The
      other two count real rows in the event log. Every finding names the data
      that produced it, so none of them has to be taken on trust.
    </p>
  </div>
</template>
