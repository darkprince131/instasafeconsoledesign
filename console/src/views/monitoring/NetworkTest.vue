<script setup>
import { ref, inject } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'

/* Network test.
   Reachability to a gateway cannot be measured from a browser - there is no
   ICMP and no raw socket. But the round trip to this console API is real, and
   so are the DNS and TLS timings the browser already recorded for this page.
   So the measurable parts are measured and the rest is labelled, rather than
   presenting a number that was invented. */
const toast = inject('toast', () => {})
const running = ref(false)
const results = ref([])

async function run () {
  running.value = true
  results.value = []

  const times = []
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now()
    await fetch('/api/health').catch(() => {})
    times.push(performance.now() - t0)
  }
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
  const jitter = Math.round(Math.max(...times) - Math.min(...times))
  results.value.push({
    label: 'Console API round trip', value: avg + ' ms', real: true,
    note: `3 requests, jitter ${jitter} ms`
  })

  const nav = performance.getEntriesByType('navigation')[0]
  if (nav) {
    results.value.push({ label: 'DNS lookup', real: true,
      value: Math.round(nav.domainLookupEnd - nav.domainLookupStart) + ' ms' })
    if (nav.secureConnectionStart) {
      results.value.push({ label: 'TLS handshake', real: true,
        value: Math.round(nav.connectEnd - nav.secureConnectionStart) + ' ms' })
    }
  }

  const gws = (await api.gateways.list({ perPage: 0 })).data
  for (const g of gws) {
    results.value.push({
      label: `Gateway ${g.name}`, real: false,
      value: g.status === 'up' ? g.latencyMs + ' ms' : 'unreachable',
      note: `${g.region} \u00b7 ${g.ip}`
    })
  }

  await api.events.record({ type: 'network.test', message: 'Network test run from the console' })
  running.value = false
  toast('Network test complete')
}
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Network test"
      subtitle="Reachability and latency from where you are sitting."
    >
    </PageHeader>

    <div class="i-strip">
      <div class="i-tools">
        <button class="i-btn i-primary" :disabled="running" @click="run">
          {{ running ? 'Running…' : 'Run test' }}
        </button>
      </div>
    </div>

    <div style="max-width:640px">
      <div v-for="r in results" :key="r.label" class="i-checkrow">
        <span class="i-checkicon">
          <i
            class="fa-solid fa-circle-check" aria-hidden="true"
            :style="{ color: r.value === 'unreachable' ? 'var(--i-bad)' : 'var(--i-ok)' }"
          />
        </span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px">{{ r.label }}</div>
          <div v-if="r.note" style="font-size:11.5px;color:var(--i-mute)">{{ r.note }}</div>
        </div>
        <span class="i-tech">{{ r.value }}</span>
        <span v-if="!r.real" class="i-pill i-att ms-2" style="font-size:10.5px">simulated</span>
      </div>

      <p v-if="!results.length" class="i-demo-note">
        The API round trip, the DNS lookup and the TLS handshake are genuinely
        measured — the browser already recorded the last two for this page.
        Gateway reachability is marked simulated because a browser has no ICMP
        and no raw socket, so it cannot be measured from here however
        convincingly a number is presented.
      </p>
    </div>
  </div>
</template>
