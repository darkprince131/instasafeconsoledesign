<script setup>
import { ref, watch, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

/**
 * Access rules, in priority order.
 *
 * Order is the whole semantics of this screen — the first matching rule wins —
 * so priority is the default sort and the column is first. The production
 * table sorts by nothing and shows priority nowhere, which makes a shadowed
 * rule impossible to spot.
 */

const toast = inject('toast', () => {})

const rows = ref([]); const total = ref(0); const loading = ref(true)
const page = ref(1); const perPage = ref(25)
const sort = ref('priority'); const dir = ref('asc')
const search = ref(''); const selectedIds = ref([]); const table = ref(null)

const columns = [
  { key: 'priority', label: '#', mono: true, align: 'right' },
  { key: 'name', label: 'Rule', bold: true },
  { key: 'sourceType', label: 'Source type', upper: true },
  { key: 'source', label: 'Source' },
  { key: 'dest', label: 'Destination' },
  { key: 'schedule', label: 'Schedule', dim: true },
  { key: 'action', label: 'Action',
    cell: (v) => v.charAt(0).toUpperCase() + v.slice(1),
    pill: (v) => v === 'deny' ? 'bad' : null },
  { key: 'enabled', label: 'Enabled', bool: true }
]

async function load () {
  loading.value = true
  const res = await api.accessRules.list({
    page: page.value, perPage: perPage.value, sort: sort.value, dir: dir.value,
    search: search.value, searchFields: ['name', 'source', 'dest', 'action']
  })
  rows.value = res.data; total.value = res.total; loading.value = false
}

let timer
watch(search, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; load() }, 220) })
watch([page, perPage], load)
function onSort (k, d) { sort.value = k; dir.value = d; page.value = 1; load() }

async function removeSelected () {
  const n = selectedIds.value.length
  await api.accessRules.removeMany(selectedIds.value)
  table.value?.clearSelection()
  toast(n + ' rule' + (n === 1 ? '' : 's') + ' deleted')
  load()
}

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Access rules"
      subtitle="Evaluated top to bottom. The first rule that matches decides, and the rest never run."
    >
      <template #actions>
        <RouterLink class="i-btn" to="/access-explorer">
          <i class="fa-solid fa-magnifying-glass-chart" aria-hidden="true" /> Test a rule
        </RouterLink>
        <button class="i-btn i-primary"><i class="fa-solid fa-plus" aria-hidden="true" /> Add rule</button>
      </template>
    </PageHeader>

    <div class="i-strip">
      <div class="i-right ms-auto">
        <label class="i-search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input v-model="search" type="search" placeholder="Search rule, source or destination">
        </label>
      </div>
    </div>

    <DataTable
      ref="table" :columns="columns" :rows="rows" :total="total" :loading="loading"
      v-model:page="page" v-model:perPage="perPage" :sort="sort" :dir="dir"
      @sort="onSort" @selection="selectedIds = $event"
    >
      <template #bulk>
        <button class="i-btn i-sm i-danger" @click="removeSelected">Delete</button>
      </template>
      <template #empty>
        <EmptyState
          icon="fa-shield-halved"
          title="No access rules"
          body="With no rules, the default deny applies and nobody reaches anything."
          action-label="Add rule"
        />
      </template>
    </DataTable>
  </div>
</template>
