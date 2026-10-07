<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api'
import PageHeader from '../components/ui/PageHeader.vue'

/* Topology.
   The production console renders this with a 3D force graph. It looks
   impressive and is close to unreadable: you cannot tell which gateway serves
   which applications without dragging nodes apart first. The question people
   actually arrive with is "what is behind this gateway", so the layout
   answers that directly. */
const gateways = ref([])
const sessions = ref([])
const loading = ref(true)

onMounted(async () => {
  const [g, s] = await Promise.all([
    api.gateways.list({ perPage: 0 }),
    api.sessions.list({ perPage: 0 })
  ])
  gateways.value = g.data
  sessions.value = s.data
  loading.value = false
})

const byGateway = computed(() => gateways.value.map(g => {
  const live = sessions.value.filter(s => s.gateway === g.name)
  return { ...g, live: live.length, apps: [...new Set(live.map(s => s.application))] }
}))
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Graph"
      subtitle="Which gateway serves which applications, and how much is flowing through each."
    />
    <div v-if="loading" class="i-skeleton-page" />
    <div v-else class="i-cols">
      <div v-for="g in byGateway" :key="g.id" class="i-col">
        <div class="i-chead">
          <h2>{{ g.name }}</h2>
          <span class="i-meta">
            <span class="i-pill" :class="g.status === 'up' ? '' : 'i-att'">
              <span v-if="g.status === 'up'" class="i-dot i-ok" />{{ g.status }}
            </span>
          </span>
        </div>
        <dl class="i-kv mb-3" style="grid-template-columns:104px 1fr">
          <dt>Region</dt><dd>{{ g.region }}</dd>
          <dt>Address</dt><dd class="i-tech">{{ g.ip }}</dd>
          <dt>Latency</dt><dd class="i-tech">{{ g.latencyMs }} ms</dd>
          <dt>Live sessions</dt><dd>{{ g.live }}</dd>
        </dl>
        <div v-if="g.apps.length">
          <div style="font-size:11.5px;color:var(--i-mute);margin-bottom:6px">Serving</div>
          <div class="d-flex flex-wrap gap-1">
            <span v-for="a in g.apps" :key="a" class="i-chip" style="cursor:default">{{ a }}</span>
          </div>
        </div>
        <p v-else style="font-size:12.5px;color:var(--i-mute)">No live sessions through this gateway.</p>
      </div>
    </div>
  </div>
</template>
