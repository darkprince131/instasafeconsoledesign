<script setup>
import { ref, watch, inject, onMounted, onUnmounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'
import { bytes } from '../../resources.js'

const toast = inject('toast', () => {})

const rows = ref([]); const total = ref(0); const loading = ref(true)
const page = ref(1); const perPage = ref(25)
const sort = ref('startedAt'); const dir = ref('desc')
const search = ref(''); const selectedIds = ref([]); const table = ref(null)
const confirmOpen = ref(false)
let tick

function since (v) {
  const s = Math.floor((Date.now() - new Date(v)) / 1000)
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'm'
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'
}

const columns = [
  { key: 'username', label: 'User', bold: true },
  { key: 'application', label: 'Application' },
  { key: 'type', label: 'Type', upper: true },
  { key: 'gateway', label: 'Gateway', mono: true },
  { key: 'city', label: 'Location' },
  { key: 'startedAt', label: 'Duration', cell: since, mono: true, align: 'right' },
  { key: 'bytesIn', label: 'In', cell: bytes, mono: true, align: 'right' },
  { key: 'bytesOut', label: 'Out', cell: bytes, mono: true, align: 'right' }
]

async function load (quiet) {
  if (!quiet) loading.value = true
  const res = await api.sessions.list({
    page: page.value, perPage: perPage.value, sort: sort.value, dir: dir.value,
    search: search.value, searchFields: ['username', 'application', 'gateway', 'city'],
    filters: { status: 'active' }
  })
  rows.value = res.data; total.value = res.total; loading.value = false
}

let timer
watch(search, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; load() }, 220) })
watch([page, perPage], () => load())
function onSort (k, d) { sort.value = k; dir.value = d; page.value = 1; load() }

async function disconnectSelected () {
  const n = selectedIds.value.length
  for (const sid of selectedIds.value) await api.sessions.update(sid, { status: 'ended' })
  confirmOpen.value = false
  table.value?.clearSelection()
  toast(n + ' session' + (n === 1 ? '' : 's') + ' disconnected')
  load()
}

onMounted(() => {
  load()
  // durations advance on their own, so the screen is live rather than a snapshot
  tick = setInterval(() => load(true), 15000)
})
onUnmounted(() => clearInterval(tick))
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Live sessions"
      :subtitle="total.toLocaleString() + ' sessions open right now. Refreshes every 15 seconds.'"
    >
    </PageHeader>

    <div class="i-strip">
      <div class="i-tools">
        <button class="i-btn" @click="load()"><i class="fa-solid fa-rotate" aria-hidden="true" /> Refresh</button>
      </div>
    </div>

    <div class="i-strip">
      <div class="i-right ms-auto">
        <label class="i-search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input v-model="search" type="search" placeholder="Search user, application or gateway">
        </label>
      </div>
    </div>

    <DataTable
      ref="table" :columns="columns" :rows="rows" :total="total" :loading="loading"
      v-model:page="page" v-model:perPage="perPage" :sort="sort" :dir="dir"
      @sort="onSort" @selection="selectedIds = $event"
    >
      <template #bulk>
        <button class="i-btn i-sm i-danger" @click="confirmOpen = true">Disconnect</button>
      </template>
      <template #empty>
        <EmptyState
          icon="fa-plug-circle-xmark"
          title="Nobody is connected"
          body="No sessions are open. Everything is quiet."
        />
      </template>
    </DataTable>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="'Disconnect ' + selectedIds.length + ' session' + (selectedIds.length === 1 ? '' : 's') + '?'"
      :confirm-label="'Disconnect ' + selectedIds.length"
      @confirm="disconnectSelected"
    >
      Those people lose their connection immediately and will have to sign in again.
      Unsaved work in an RDP or SSH session is lost.
    </ConfirmModal>
  </div>
</template>
