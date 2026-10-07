<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import { fmtAgo, statusPill } from '../../resources.js'

/**
 * Devices, with the approval queue up front.
 *
 * 775 devices were sitting pending in the production tenant and the console
 * surfaced that nowhere — no count, no queue, no default filter. Here the
 * pending filter is the landing state whenever anything is waiting, because
 * that is the only part of this screen that needs a decision.
 *
 * "Bind this browser" takes a real fingerprint — platform, screen, hardware,
 * timezone — hashes it, and enrols it as a device. Press it twice and the
 * second one is recognised rather than duplicated, which is the whole point
 * of device binding and is normally impossible to show in a demo.
 */

const toast = inject('toast', () => {})
const refreshStats = inject('refreshStats', () => {})

const rows = ref([]); const total = ref(0); const loading = ref(true)
const page = ref(1); const perPage = ref(25)
const sort = ref(''); const dir = ref('asc')
const search = ref(''); const filter = ref('pending')
const selectedIds = ref([]); const table = ref(null)
const counts = ref({ pending: 0, approved: 0, rejected: 0 })
const binding = ref(false)

const columns = [
  { key: 'name', label: 'Device', bold: true },
  { key: 'username', label: 'User', dim: true },
  { key: 'os', label: 'Operating system' },
  { key: 'agentVersion', label: 'Agent', mono: true },
  { key: 'ipAddress', label: 'IP address', mono: true },
  { key: 'city', label: 'Location' },
  { key: 'lastSeenAt', label: 'Last seen', cell: fmtAgo, dim: true },
  { key: 'status', label: 'Status',
    cell: (v) => v.charAt(0).toUpperCase() + v.slice(1), pill: statusPill }
]

const chips = computed(() => [
  { key: 'pending', label: 'Pending approval', n: counts.value.pending },
  { key: 'approved', label: 'Approved', n: counts.value.approved },
  { key: 'rejected', label: 'Rejected', n: counts.value.rejected },
  { key: 'all', label: 'All', n: 0 }
])

async function refreshCounts () {
  const all = (await api.devices.list({ perPage: 0 })).data
  counts.value = {
    pending: all.filter(d => d.status === 'pending').length,
    approved: all.filter(d => d.status === 'approved').length,
    rejected: all.filter(d => d.status === 'rejected').length
  }
}

async function load () {
  loading.value = true
  const filters = filter.value === 'all' ? {} : { status: filter.value }
  const res = await api.devices.list({
    page: page.value, perPage: perPage.value, sort: sort.value, dir: dir.value,
    search: search.value,
    searchFields: ['name', 'username', 'os', 'ipAddress', 'macAddress', 'city'],
    filters
  })
  rows.value = res.data
  total.value = res.total
  loading.value = false
}

let timer
watch(search, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; load() }, 220) })
watch([page, perPage, filter], load)

function onSort (k, d) { sort.value = k; dir.value = d; page.value = 1; load() }

async function approveSelected () {
  const n = selectedIds.value.length
  await api.devices.approveMany(selectedIds.value)
  table.value?.clearSelection()
  toast(n + ' device' + (n === 1 ? '' : 's') + ' approved')
  await refreshCounts(); refreshStats(); load()
}

async function rejectSelected () {
  const n = selectedIds.value.length
  for (const did of selectedIds.value) await api.devices.reject(did)
  table.value?.clearSelection()
  toast(n + ' device' + (n === 1 ? '' : 's') + ' rejected')
  await refreshCounts(); refreshStats(); load()
}

/** Enrols the actual browser this is running in. */
async function bindThisBrowser () {
  binding.value = true
  const res = await api.devices.bind({ userId: 'usr_00000' })
  binding.value = false
  if (res.alreadyBound) {
    toast('This browser is already enrolled — recognised by fingerprint, not duplicated')
  } else {
    toast('This browser enrolled as a device — now pending approval')
    filter.value = 'pending'
  }
  await refreshCounts(); refreshStats(); load()
}

onMounted(async () => {
  await refreshCounts()
  // land on the queue only when something is actually waiting
  if (!counts.value.pending) filter.value = 'approved'
  load()
})
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Devices"
      subtitle="Every endpoint that has tried to connect. Approving a device binds it to its user."
    >
    </PageHeader>

    <section v-if="counts.pending" class="i-band">
      <div>
        <div class="i-bt">
          <span class="i-fdot" aria-hidden="true" />
          {{ counts.pending.toLocaleString() }} devices are waiting for approval
        </div>
        <p class="i-bs">
          Until one is approved its user cannot connect from it. The current console
          shows this number nowhere.
        </p>
      </div>
      <div class="i-bandacts">
        <button class="i-btn i-primary" @click="filter = 'pending'">Review the queue</button>
      </div>
    </section>

    <div class="i-strip">
      <div class="i-ftabs">
        <button
          v-for="c in chips" :key="c.key"
          class="i-chip" :class="{ 'is-on': filter === c.key }"
          :aria-pressed="filter === c.key" @click="filter = c.key"
        >
          {{ c.label }}
          <span v-if="c.n" class="i-n">{{ c.n.toLocaleString() }}</span>
        </button>
      </div>
      <div class="i-right">
        <label class="i-search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input v-model="search" type="search" placeholder="Search device, user, IP or MAC">
        </label>
        <div class="i-tools">
        <button class="i-btn" :disabled="binding" @click="bindThisBrowser">
          <i class="fa-solid fa-fingerprint" aria-hidden="true" />
          {{ binding ? 'Enrolling…' : 'Enrol this browser' }}
        </button>
        <button class="i-btn"><i class="fa-solid fa-download" aria-hidden="true" /> Export</button>
        </div>
      </div>
    </div>

    <DataTable
      ref="table" :columns="columns" :rows="rows" :total="total" :loading="loading"
      v-model:page="page" v-model:perPage="perPage" :sort="sort" :dir="dir"
      @sort="onSort" @selection="selectedIds = $event"
    >
      <template #bulk>
        <button class="i-btn i-sm i-primary" @click="approveSelected">Approve</button>
        <button class="i-btn i-sm i-danger" @click="rejectSelected">Reject</button>
      </template>
      <template #empty>
        <EmptyState
          :icon="filter === 'pending' ? 'fa-circle-check' : 'fa-laptop'"
          :title="filter === 'pending' ? 'Nothing waiting for approval' : 'No devices match this filter'"
          :body="filter === 'pending'
            ? 'Every enrolled device has been dealt with. That is the healthy state.'
            : 'Try another filter, or clear the search.'"
        />
      </template>
    </DataTable>
  </div>
</template>
