<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import { fmtAgo } from '../../resources.js'

/**
 * The event log.
 *
 * This is the screen that proves the demo is wired rather than a set of
 * screenshots: every action taken anywhere in the console writes a row here.
 * Add a user, approve a device, enrol MFA, run the access explorer — then
 * come here and it is recorded, with the real actor and timestamp.
 */

const rows = ref([]); const total = ref(0); const loading = ref(true)
const page = ref(1); const perPage = ref(50)
const sort = ref('at'); const dir = ref('desc')
const search = ref(''); const filter = ref('all')

const columns = [
  { key: 'at', label: 'When', cell: fmtAgo, dim: true },
  { key: 'type', label: 'Event', mono: true },
  { key: 'message', label: 'Description' },
  { key: 'actor', label: 'Actor' },
  { key: 'ip', label: 'Source IP', mono: true },
  { key: 'city', label: 'Location' },
  { key: 'severity', label: 'Severity',
    pill: (v) => v === 'warning' ? 'att' : v === 'error' ? 'bad' : null }
]

const chips = [
  { key: 'all', label: 'Everything' },
  { key: 'warning', label: 'Warnings only' },
  { key: 'auth', label: 'Authentication' },
  { key: 'device', label: 'Devices' },
  { key: 'access', label: 'Access decisions' }
]

async function load () {
  loading.value = true
  const filters = {}
  if (filter.value === 'warning') filters.severity = 'warning'
  else if (filter.value !== 'all') {
    filters.type = (v) => String(v).startsWith(filter.value)
  }
  const res = await api.events.list({
    page: page.value, perPage: perPage.value, sort: sort.value, dir: dir.value,
    search: search.value, searchFields: ['type', 'message', 'actor', 'ip', 'city'],
    filters
  })
  rows.value = res.data; total.value = res.total; loading.value = false
}

let timer
watch(search, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; load() }, 220) })
watch([page, perPage, filter], load)
function onSort (k, d) { sort.value = k; dir.value = d; page.value = 1; load() }

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Event logs"
      subtitle="Everything that happened, including everything you have done in this demo."
    >
      <template #actions>
        <RouterLink class="i-btn" to="/profile/export-log">
          <i class="fa-solid fa-shield-halved" aria-hidden="true" /> SIEM export
        </RouterLink>
        <button class="i-btn"><i class="fa-solid fa-download" aria-hidden="true" /> Export CSV</button>
      </template>
    </PageHeader>

    <div class="i-strip">
      <div class="i-ftabs">
        <button
          v-for="c in chips" :key="c.key"
          class="i-chip" :class="{ 'is-on': filter === c.key }"
          :aria-pressed="filter === c.key" @click="filter = c.key"
        >{{ c.label }}</button>
      </div>
      <div class="i-right">
        <label class="i-search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input v-model="search" type="search" placeholder="Search event, actor or IP">
        </label>
      </div>
    </div>

    <DataTable
      :columns="columns" :rows="rows" :total="total" :loading="loading"
      v-model:page="page" v-model:perPage="perPage" :sort="sort" :dir="dir"
      :selectable="false" @sort="onSort"
    >
      <template #empty>
        <EmptyState
          icon="fa-list"
          :title="search ? 'Nothing matches that search' : 'No events in this view'"
          body="Do something in the console — add a user, approve a device — and it appears here."
        />
      </template>
    </DataTable>
  </div>
</template>
