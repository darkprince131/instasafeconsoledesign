<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Sheet from '../../components/ui/Sheet.vue'
import ListTools from '../../components/ui/ListTools.vue'
import GraphView from '../../components/ui/GraphView.vue'
import { fmtAgo, statusPill } from '../../resources.js'

/** velto's own format on this screen: 2026-06-26 15:56:58. */
function fmtStamp (iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

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

const GRAPH_DIMS = [
  { key: 'osFamily', label: 'Operating system family' },
  { key: 'os', label: 'Operating system' },
  { key: 'status', label: 'Status' },
  { key: 'agentVersion', label: 'Agent version' },
  { key: 'city', label: 'Location' },
  { key: 'bound', label: 'Bound to a user' }
]
const graphOn = ref(false)

function onBulkApplied ({ op, count }) {
  toast(`${count} device${count === 1 ? '' : 's'} ${op === 'delete' ? 'deleted' : op + 'd'}`)
  refreshCounts(); refreshStats(); load()
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

/* ---- add a device by hand, as velto does -------------------------------- */

/**
 * Velto's Add Device: Name, OS, Mac Address, Serial Number, UUID. Devices
 * normally enrol themselves, so this is for the ones that cannot — a kiosk, a
 * machine being staged before it is handed over.
 *
 * Its OS select carries 76 entries, from "11" to "AlmaLinux 10.2 (Lavender
 * Lion)", which is the agent's own reported strings collected into a dropdown.
 * The families are offered here and the exact build is what the agent reports
 * when it first checks in.
 */
const OS_OPTIONS = [
  'Microsoft Windows 11 Pro', 'Microsoft Windows 11 Home Single Language',
  'Microsoft Windows 10 Pro', 'macOS Sonoma', 'macOS Sequoia',
  'Ubuntu 22.04', 'Ubuntu 24.04', 'AlmaLinux', 'Amazon Linux 2023',
  'Android', 'iOS', 'iPadOS'
]

const addOpen = ref(false)
const addSaving = ref(false)
const addForm = ref(blankDevice())

function blankDevice () {
  return { name: '', os: '', macAddress: '', serialNumber: '', uuid: '' }
}

const MAC = /^([0-9a-f]{1,2}:){5}[0-9a-f]{1,2}$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function openAdd () { addForm.value = blankDevice(); addOpen.value = true }

async function saveDevice () {
  const f = addForm.value
  if (!f.name.trim()) { toast('The device needs a name', 'bad'); return }
  if (!f.os) { toast('Pick an operating system', 'bad'); return }
  if (f.macAddress && !MAC.test(f.macAddress.trim())) {
    toast('MAC address looks like 0:2b:67:60:f:6e', 'bad'); return
  }
  if (f.uuid && !UUID.test(f.uuid.trim())) {
    toast('UUID looks like e45b7ec4-374f-4e67-9e7e-2004f89e713b', 'bad'); return
  }
  if (!f.macAddress.trim() && !f.serialNumber.trim() && !f.uuid.trim()) {
    toast('Give at least one of MAC address, serial number or UUID — otherwise nothing identifies this device', 'bad')
    return
  }
  addSaving.value = true
  try {
    await api.devices.create({
      ...f,
      name: f.name.trim(),
      osFamily: f.os.split(' ')[0],
      username: 'unassigned',
      status: 'pending',
      bound: false,
      /* Velto stamps the moment it was added, to the second, and shows it in
         the list. A device added by hand has no agent to report anything, so
         this is the only time it has. */
      enrolledAt: new Date().toISOString(),
      lastSeenAt: null
    })
    toast(`${f.name.trim()} added — it is pending approval until it checks in`)
    addOpen.value = false
    filter.value = 'pending'
    await refreshCounts(); refreshStats(); load()
  } finally { addSaving.value = false }
}

/* ---- activate and suspend, which velto has and this did not -------------- */

/**
 * Velto's device actions depend on the state: a device that is not active can
 * be activated, and one that is active can be suspended. Approve and reject
 * were the only two here, so there was no way to take a working device out of
 * service without rejecting it, which reads as a decision about enrolment
 * rather than about the machine.
 */
async function setDeviceStatus (device, status) {
  await api.devices.update(device.id, { status })
  if (detail.value?.id === device.id) detail.value = { ...detail.value, status }
  const verb = { approved: 'activated', suspended: 'suspended', rejected: 'rejected' }[status]
  toast(`${device.name} ${verb}`)
  await refreshCounts(); refreshStats(); load()
}

async function bulkStatus (status) {
  const n = selectedIds.value.length
  for (const did of selectedIds.value) await api.devices.update(did, { status })
  table.value?.clearSelection()
  const verb = { approved: 'activated', suspended: 'suspended' }[status]
  toast(`${n} device${n === 1 ? '' : 's'} ${verb}`)
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
        <button class="i-btn"><i class="fa-solid fa-download" aria-hidden="true" /> Export</button>
        <button class="i-btn" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add device
        </button>
        <ListTools
          v-model:graph="graphOn"
          kind="devices" resource="devices"
          :rows="rows" :dimensions="GRAPH_DIMS" :total="total"
          @apply="onBulkApplied"
        />
        <!-- Devices are enrolled rather than added, so this is the screen's
             create action and it takes the anchor the Add button holds
             everywhere else. -->
        <button class="i-btn i-primary" :disabled="binding" @click="bindThisBrowser">
          <i class="fa-solid fa-fingerprint" aria-hidden="true" />
          {{ binding ? 'Enrolling…' : 'Enrol this browser' }}
        </button>
        </div>
      </div>
    </div>

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


    <GraphView
      v-if="graphOn"
      :rows="rows" :dimensions="GRAPH_DIMS" :total="total"
      :resource="'devices'"
      label-key="name"
    />

    <DataTable
      v-else
      ref="table" :columns="columns" :rows="rows" :total="total" :loading="loading"
      v-model:page="page" v-model:perPage="perPage" :sort="sort" :dir="dir"
      :row-action="rowAction"
      @sort="onSort" @selection="selectedIds = $event"
      @row-action="openDetail" @row-click="openDetail"
    >
      <template #bulk>
        <button class="i-btn i-sm i-primary" @click="approveSelected">Approve</button>
        <button class="i-btn i-sm ms-1" @click="bulkStatus('suspended')">Suspend</button>
        <button class="i-btn i-sm ms-1" @click="bulkStatus('approved')">Activate</button>
        <button class="i-btn i-sm i-danger ms-1" @click="rejectSelected">Reject</button>
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

    <!-- Velto's Add Device. Five fields, and at least one identifier, because
         a device row that names no hardware cannot be matched to a machine. -->
    <Sheet
      v-model:open="addOpen"
      title="Add device"
      subtitle="For a machine that cannot enrol itself. It arrives pending, like any other."
    >
      <div class="i-formsec">
        <div class="i-field">
          <label for="profile_name">Name<span class="i-req">*</span></label>
          <input id="profile_name" name="profile_name" class="i-ctl" v-model="addForm.name" placeholder="Enter Device Name">
        </div>
        <div class="i-field">
          <label for="device_os">OS<span class="i-req">*</span></label>
          <select id="device_os" name="device_os" class="i-ctl" v-model="addForm.os">
            <option value="" disabled>Select Os</option>
            <option v-for="o in OS_OPTIONS" :key="o">{{ o }}</option>
          </select>
          <p class="i-hint">
            Velto lists 76, which is every string an agent has ever reported.
            The families are here; the exact build is what the agent sends when
            it first checks in.
          </p>
        </div>
        <div class="i-frow">
          <div class="i-field">
            <label for="device_mac_address">Mac Address</label>
            <input id="device_mac_address" name="device_mac_address" class="i-ctl i-tech" v-model="addForm.macAddress" placeholder="0:2b:67:60:f:6e">
          </div>
          <div class="i-field">
            <label for="device_serial_no">Serial Number</label>
            <input id="device_serial_no" name="device_serial_no" class="i-ctl i-tech" v-model="addForm.serialNumber" placeholder="Serial Number">
          </div>
        </div>
        <div class="i-field">
          <label for="uuid">UUID</label>
          <input id="uuid" name="uuid" class="i-ctl i-tech" v-model="addForm.uuid" placeholder="e45b7ec4-374f-4e67-9e7e-2004f89e713b">
          <p class="i-hint">
            All three are optional in velto and at least one is needed to
            identify a machine, so one of them is required here. A device is
            matched on MAC, serial and UUID together, because any one of them
            can be spoofed, reused after a board swap, or simply absent.
          </p>
        </div>
      </div>
      <template #footer>
        <button class="i-btn i-quiet" @click="addOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="addSaving" @click="saveDevice">
            {{ addSaving ? 'Saving…' : 'Add device' }}
          </button>
        </div>
      </template>
    </Sheet>

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
            <!-- Velto prints the second it was registered. Relative time is
                 what the list wants; the record wants the timestamp. -->
            <div>
              <dt>Registered on</dt>
              <dd class="i-tech">{{ fmtStamp(detail.enrolledAt) }}</dd>
            </div>
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

      <!-- The verb depends on the state, as velto's does: a device that is
           not active can be activated, one that is active can be suspended. -->
      <template #footer>
        <button class="i-btn i-quiet" @click="detailOpen = false">Close</button>
        <div class="i-right">
          <button
            v-if="detail?.status === 'pending'"
            class="i-btn i-danger" @click="setStatus('reject')"
          >Reject</button>
          <button
            v-if="detail?.status === 'pending'"
            class="i-btn i-primary" @click="setStatus('approve')"
          >Approve</button>
          <button
            v-else-if="detail?.status === 'approved'"
            class="i-btn" @click="setDeviceStatus(detail, 'suspended')"
          >Suspend</button>
          <button
            v-else
            class="i-btn i-primary" @click="setDeviceStatus(detail, 'approved')"
          >Activate</button>
        </div>
      </template>
    </Sheet>
  </div>
</template>
