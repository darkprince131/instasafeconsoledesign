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

  // sessions per hour across the day, from the live session set
  const sessions = (await api.sessions.list({ perPage: 0 })).data
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

const maxOs = computed(() => Math.max(1, ...osBreakdown.value.map(o => o.n)))
const maxDenied = computed(() => Math.max(1, ...denied.value.map(o => o.n)))
const maxHour = computed(() => Math.max(1, ...hourly.value))
const num = (n) => (n ?? 0).toLocaleString()
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Dashboard"
      :subtitle="`veno.instasafe.com · ${num(stats.users)} users · ${num(stats.devices)} devices · ${num(stats.gateways)} gateways`"
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
        <div class="i-v">{{ stats.gatewaysUp }}<small> / {{ stats.gateways }}</small></div>
        <div class="i-n">{{ stats.gatewaysUp === stats.gateways ? 'All reachable' : 'One degraded' }}</div>
      </div>
      <div class="i-stat">
        <div class="i-k">Live sessions</div>
        <div class="i-v">{{ num(stats.sessionsLive) }}</div>
        <div class="i-n">{{ Math.round((stats.sessionsLive / stats.users) * 100) }}% of users connected</div>
      </div>
      <div class="i-stat">
        <div class="i-k">Licences used</div>
        <div class="i-v">{{ num(stats.licences?.used) }}<small> / {{ num(stats.licences?.total) }}</small></div>
        <div class="i-n">{{ num((stats.licences?.total || 0) - (stats.licences?.used || 0)) }} remaining</div>
      </div>
      <div class="i-stat">
        <div class="i-k">Access rules</div>
        <div class="i-v">{{ num(stats.rules) }}</div>
        <div class="i-n">across {{ num(stats.applications) }} applications</div>
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
