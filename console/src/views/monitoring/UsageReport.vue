<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

/**
 * Usage reports — data, time, gateway and application access.
 *
 * One component serves four routes, because they are the same report over a
 * different measure. The production console renders each as a pie, and in the
 * captured tenant every one of those pies was a single 100% slice: a chart
 * that cannot show a comparison being used for nothing but a comparison.
 *
 * A ranked bar list does the job a pie was failing at — it sorts, it labels,
 * it reads at a glance, and it still works when there is one data point.
 */

const route = useRoute()

const REPORTS = {
  '/reports/data-uses-log': {
    title: 'Data usage', measure: 'bytes',
    subtitle: 'Who moved the most traffic, and through which gateway.',
    group: 'username', unit: 'bytes'
  },
  '/reports/time-uses-log': {
    title: 'Time usage', measure: 'minutes',
    subtitle: 'Who spent the longest connected.',
    group: 'username', unit: 'minutes'
  },
  '/reports/gateway': {
    title: 'Gateway report', measure: 'sessions',
    subtitle: 'Load across the data plane.',
    group: 'gateway', unit: 'sessions'
  },
  '/reports/application-access-logs': {
    title: 'Application access', measure: 'sessions',
    subtitle: 'Which applications are actually being used.',
    group: 'application', unit: 'sessions'
  }
}

const cfg = computed(() => REPORTS[route.path] || REPORTS['/reports/data-uses-log'])
const sessions = ref([])
const loading = ref(true)
const window_ = ref('today')

async function load () {
  loading.value = true
  const res = await api.sessions.list({ perPage: 0 })
  sessions.value = res.data
  loading.value = false
}

const rows = computed(() => {
  const by = {}
  for (const s of sessions.value) {
    const key = s[cfg.value.group] || '—'
    const minutes = Math.max(1, Math.round((Date.now() - new Date(s.startedAt)) / 60000))
    // Number(): a bigint column reaching here as a string would concatenate
    const value = cfg.value.measure === 'bytes' ? Number(s.bytesIn || 0) + Number(s.bytesOut || 0)
      : cfg.value.measure === 'minutes' ? minutes : 1
    by[key] = (by[key] || 0) + value
  }
  return Object.entries(by)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
})

const max = computed(() => Math.max(1, ...rows.value.map(r => r.value)))
const totalValue = computed(() => rows.value.reduce((a, r) => a + r.value, 0))

function fmt (v) {
  if (cfg.value.unit === 'bytes') {
    if (v < 1024) return v + ' B'
    if (v < 1024 ** 2) return (v / 1024).toFixed(1) + ' KB'
    if (v < 1024 ** 3) return (v / 1024 ** 2).toFixed(1) + ' MB'
    return (v / 1024 ** 3).toFixed(2) + ' GB'
  }
  if (cfg.value.unit === 'minutes') {
    if (v < 60) return v + ' min'
    return Math.floor(v / 60) + 'h ' + (v % 60) + 'm'
  }
  return v.toLocaleString()
}

function csv () {
  const head = [cfg.value.group, cfg.value.unit].join(',')
  const body = rows.value.map(r => `${JSON.stringify(r.name)},${r.value}`).join('\n')
  const blob = new Blob([head + '\n' + body], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = cfg.value.title.toLowerCase().replace(/\s+/g, '-') + '.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

watch(() => route.path, load)
onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader :title="cfg.title" :subtitle="cfg.subtitle">
      <template #actions>
        <select class="i-ctl" style="width:auto" v-model="window_" aria-label="Time window">
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
        <button class="i-btn" :disabled="!rows.length" @click="csv">
          <i class="fa-solid fa-download" aria-hidden="true" /> CSV
        </button>
      </template>
    </PageHeader>

    <div v-if="loading" class="i-skeleton-page" />

    <template v-else-if="rows.length">
      <section class="i-stats">
        <div class="i-stat">
          <div class="i-k">Total</div>
          <div class="i-v">{{ fmt(totalValue) }}</div>
          <div class="i-n">across {{ rows.length }} {{ cfg.group === 'username' ? 'users' : cfg.group + 's' }}</div>
        </div>
        <div class="i-stat">
          <div class="i-k">Busiest</div>
          <div class="i-v" style="font-size:19px">{{ rows[0].name }}</div>
          <div class="i-n">{{ fmt(rows[0].value) }}</div>
        </div>
        <div class="i-stat">
          <div class="i-k">Share of the top one</div>
          <div class="i-v">{{ Math.round(rows[0].value / totalValue * 100) }}<small>%</small></div>
          <div class="i-n">of all {{ cfg.unit }}</div>
        </div>
        <div class="i-stat">
          <div class="i-k">Sessions counted</div>
          <div class="i-v">{{ sessions.length.toLocaleString() }}</div>
          <div class="i-n">live right now</div>
        </div>
      </section>

      <div class="i-chead">
        <h2>Top {{ rows.length }} by {{ cfg.unit }}</h2>
        <span class="i-meta">Sorted, which a pie chart cannot be</span>
      </div>

      <div v-for="r in rows" :key="r.name" class="i-barrow" style="grid-template-columns:200px 1fr 90px">
        <span class="i-bl">{{ r.name }}</span>
        <span class="i-bartrack">
          <span class="i-barfill" :style="{ width: (r.value / max * 100) + '%' }" />
        </span>
        <span class="i-barval">{{ fmt(r.value) }}</span>
      </div>

      <p class="i-demo-note mt-4" style="max-width:660px">
        The current console draws this as a pie. In the captured tenant each of
        those pies held a single 100% slice — a chart whose only job is comparison,
        with nothing to compare. A ranked bar sorts, labels and still reads when
        there is one row.
      </p>
    </template>

    <EmptyState
      v-else
      icon="fa-chart-simple"
      title="No sessions in this window"
      body="Usage is derived from sessions. Open an application from the Applications screen and it will appear here."
    />
  </div>
</template>
