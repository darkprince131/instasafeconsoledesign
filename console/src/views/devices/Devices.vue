<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Sheet from '../../components/ui/Sheet.vue'
import ListTools from '../../components/ui/ListTools.vue'
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

/* The detail panel the Action column opens. The row was already the unit of
   interest and had nowhere to go: approve and reject were only reachable by
   ticking a checkbox, so a single device could not be dealt with without
   using the bulk machinery. */
const detailOpen = ref(false)
const detail = ref(null)
const POSTURE_LABELS = {
  diskEncryption: 'Disk encryption', antivirus: 'Antivirus',
  firewall: 'Firewall', osUpToDate: 'Operating system up to date',
  screenLock: 'Screen lock', jailbroken: 'Jailbroken or rooted'
}
function openDetail (row) { detail.value = row; detailOpen.value = true }

/* Jailbroken is the one check that passes by being false. Reading the raw
   boolean as "good" would have shown a rooted phone as healthy. */
const postureRows = computed(() => {
  const p = detail.value?.posture || {}
  return Object.entries(POSTURE_LABELS)
    .filter(([k]) => k in p)
    .map(([k, label]) => ({ k, label, ok: k === 'jailbroken' ? !p[k] : !!p[k] }))
})

async function setStatus (action) {
  const d = detail.value
  if (!d) return
  await api.devices[action](d.id)
  detailOpen.value = false
  toast(`${d.name} ${action === 'approve' ? 'approved' : 'rejected'}`)
  await refreshCounts(); refreshStats(); load()
}

/**
 * Velto's device columns are Name, Mac Address, OS, Serial Number, UUID,
 * Registered On and Status. Those identity fields were missing here, and they
 * are the ones an admin matches against when somebody rings up about a device
 * they cannot name — so they belong on the table rather than only in the
 * detail panel. The column chooser hides what a given tenant does not use.
 */
const columns = [
  { key: 'name', label: 'Device', bold: true },
  { key: 'username', label: 'User', dim: true },
  { key: 'macAddress', label: 'MAC address', mono: true },
  { key: 'os', label: 'Operating system' },
  { key: 'serialNumber', label: 'Serial number', mono: true, cell: (v) => v || '—' },
  { key: 'uuid', label: 'UUID', mono: true, cell: (v) => v || '—' },
  { key: 'agentVersion', label: 'Agent', mono: true },
  { key: 'ipAddress', label: 'IP address', mono: true },
  { key: 'city', label: 'Location' },
  { key: 'enrolledAt', label: 'Registered on', cell: fmtAgo, dim: true },
  { key: 'lastSeenAt', label: 'Last seen', cell: fmtAgo, dim: true },
  { key: 'status', label: 'Status',
    cell: (v) => v.charAt(0).toUpperCase() + v.slice(1), pill: statusPill }
]

/* Velto ends every device row with an Action column whose only control is
   View. The row is already clickable, so this is not new capability — it is
   the affordance that says so, which a bare row does not. */
const rowAction = { label: 'View' }

const BULK_OPS = [
  { key: 'approve', label: 'Approve', body: 'Let these devices connect. Posture checks still apply at every session.' },
  { key: 'reject', label: 'Reject', body: 'Refuse them. The user can re-enrol, which puts them back in the queue.', tone: 'bad' }
]
const GRAPH_DIMS = [
  { key: 'osFamily', label: 'Operating system family' },
  { key: 'os', label: 'Operating system' },
  { key: 'status', label: 'Status' },
  { key: 'agentVersion', label: 'Agent version' },
  { key: 'city', label: 'Location' },
  { key: 'bound', label: 'Bound to a user' }
]
function runBulk (key) {
  if (key === 'approve') return approveSelected()
  if (key === 'reject') return rejectSelected()
}

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
        <ListTools
          :operations="BULK_OPS" :selected="selectedIds"
          :rows="rows" :dimensions="GRAPH_DIMS" :total="total"
          @run="runBulk"
        />
        </div>
      </div>
    </div>

    <DataTable
      ref="table" :columns="columns" :rows="rows" :total="total" :loading="loading"
      v-model:page="page" v-model:perPage="perPage" :sort="sort" :dir="dir"
      :row-action="rowAction"
      @sort="onSort" @selection="selectedIds = $event"
      @row-action="openDetail" @row-click="openDetail"
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

    <Sheet
      v-model:open="detailOpen"
      :title="detail?.name || 'Device'"
      :subtitle="detail ? `Enrolled by ${detail.username}` : ''"
    >
      <template v-if="detail">
        <div class="i-formsec">
          <h3>Identity</h3>
          <dl class="i-deflist">
            <div><dt>Operating system</dt><dd>{{ detail.os }}</dd></div>
            <div><dt>MAC address</dt><dd class="i-tech">{{ detail.macAddress }}</dd></div>
            <div><dt>Serial number</dt><dd class="i-tech">{{ detail.serialNumber || '—' }}</dd></div>
            <div><dt>UUID</dt><dd class="i-tech">{{ detail.uuid || '—' }}</dd></div>
            <div><dt>IP address</dt><dd class="i-tech">{{ detail.ipAddress }}</dd></div>
            <div><dt>Location</dt><dd>{{ detail.city }}</dd></div>
            <div><dt>Agent</dt><dd class="i-tech">{{ detail.agentVersion }}</dd></div>
            <div><dt>Registered</dt><dd>{{ fmtAgo(detail.enrolledAt) }}</dd></div>
            <div><dt>Last seen</dt><dd>{{ fmtAgo(detail.lastSeenAt) }}</dd></div>
            <div>
              <dt>Bound to user</dt>
              <dd>{{ detail.bound ? 'Yes' : 'No' }}</dd>
            </div>
          </dl>
        </div>

        <div class="i-formsec">
          <h3>Posture</h3>
          <p class="i-secsub">What the agent last reported. Device checks are evaluated against this.</p>
          <div v-for="p in postureRows" :key="p.k" class="i-checkrow">
            <span class="i-checkicon">
              <i class="fa-solid" aria-hidden="true" :class="p.ok ? 'fa-check' : 'fa-xmark'"
                 :style="{ color: p.ok ? 'var(--i-ok)' : 'var(--i-bad)' }" />
            </span>
            <span style="flex:1">{{ p.label }}</span>
          </div>
        </div>
      </template>

      <template #footer>
        <button class="i-btn i-quiet" @click="detailOpen = false">Close</button>
        <div class="i-right">
          <button
            v-if="detail?.status !== 'rejected'"
            class="i-btn i-danger" @click="setStatus('reject')"
          >Reject</button>
          <button
            v-if="detail?.status !== 'approved'"
            class="i-btn i-primary" @click="setStatus('approve')"
          >Approve</button>
        </div>
      </template>
    </Sheet>
  </div>
</template>
