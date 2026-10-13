<script setup>
import { ref, computed, watch, inject, onMounted, onUnmounted } from 'vue'
import api from '../../api'
import { CLOUD_SERVERS, NETMASK_BITS, mgtPortFor } from '../../api/seed.js'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Sheet from '../../components/ui/Sheet.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'

/**
 * Controllers.
 *
 * The screen velto actually has: a row you can click, a read panel behind the
 * click, an edit form behind that, and a toolbar whose Commit and Delete work
 * on a selection. The earlier build had none of it — a hand-rolled table with
 * no selection and no sort, an Add button wired to nothing, and four invented
 * columns (region, IP, version, uptime) that the product does not have.
 *
 * What is kept from velto
 *   · the columns, in order: Controller · Cloud Server · Protocol/Port ·
 *     Network · Status · Actions
 *   · the form, field for field, carrying velto's own `id`/`name` attributes
 *     so an implementer can map them one to one
 *   · the four fields that cannot be changed: name and cloud server are
 *     identity, the management port is derived, and Subnet is the only
 *     topology
 *
 * What is fixed
 *   · Commit and Delete are armed by a selection instead of sitting permanently
 *     live over a list — velto's are clickable with nothing selected
 *   · the delete confirmation names what it is about to delete
 *   · the locked fields say why they are locked, which no production form does
 *   · Stop, Restart and Commit drive a real state machine: Restart genuinely
 *     goes to "restarting" and settles back, so it is something you watch
 */

const toast = inject('toast', () => {})

const rows = ref([])
const total = ref(0)
const loading = ref(true)
const page = ref(1)
const perPage = ref(25)
const sort = ref('')
const dir = ref('asc')
const search = ref('')
const selectedIds = ref([])

const sheetOpen = ref(false)
const mode = ref('view')            // view · edit · add
const current = ref(null)
const form = ref({})
const saving = ref(false)

const stopTarget = ref(null)
const stopOpen = ref(false)
const deleteOpen = ref(false)

let poll

/* ------------------------------------------------------------- the list */

const columns = [
  { key: 'name', label: 'Controller', bold: true },
  { key: 'cloudServer', label: 'Cloud Server' },
  {
    key: 'port',
    label: 'Protocol/Port',
    mono: true,
    cell: (v, row) => `${row.protocol}/${v}`
  },
  { key: 'network', label: 'Network', mono: true },
  {
    key: 'status',
    label: 'Status',
    pill: (v) => ({ running: null, restarting: 'att', stopped: 'bad' })[v] || null
  }
]

async function load () {
  const res = await api.controllers.list({
    page: page.value,
    perPage: perPage.value,
    sort: sort.value,
    dir: dir.value,
    search: search.value,
    searchFields: ['name', 'cloudServer', 'network', 'location', 'protocol']
  })
  rows.value = res.data
  total.value = res.total
  loading.value = false
}

function onSort (s) {
  if (sort.value === s) {
    dir.value = dir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value = s
    dir.value = 'asc'
  }
  load()
}

watch([page, perPage], load)
watch(search, () => { page.value = 1; load() })

const pending = computed(() => rows.value.filter(c => c.pendingCommit))

/* --------------------------------------------------------- row actions */

async function act (c, action) {
  if (action === 'stop') { stopTarget.value = c; stopOpen.value = true; return }
  await api.controllers.action(c.id, action)
  toast(`${c.name} — ${action}`)
  load()
}

async function confirmStop () {
  await api.controllers.action(stopTarget.value.id, 'stop')
  toast(`${stopTarget.value.name} stopped`)
  stopOpen.value = false
  load()
}

/* ------------------------------------------------------------- the bulk */

const selectedRows = computed(() =>
  rows.value.filter(r => selectedIds.value.includes(r.id)))

const one = computed(() => selectedIds.value.length === 1)

const selectedNames = computed(() => {
  const n = selectedRows.value.map(r => r.name)
  return n.length > 3 ? `${n.slice(0, 3).join(', ')} and ${n.length - 3} more` : n.join(', ')
})

async function commitSelected () {
  const res = await api.controllers.commitMany(selectedIds.value)
  toast(res.committed
    ? `Committed ${res.committed} controller${res.committed === 1 ? '' : 's'}`
    : 'Nothing to commit — none of those were holding changes')
  load()
}

async function deleteSelected () {
  const n = selectedIds.value.length
  await api.controllers.removeMany(selectedIds.value)
  toast(`Deleted ${n} controller${n === 1 ? '' : 's'}`)
  deleteOpen.value = false
  load()
}

/* ------------------------------------------------- view · edit · create */

/**
 * The form, in velto's own order, carrying velto's own `id` and `name`.
 *
 * `locked` is why a field is not editable rather than merely that it is not:
 * production disables four inputs and explains none of them, which reads as a
 * bug until you work out that the management port is arithmetic.
 */
const FIELDS = [
  {
    key: 'name',
    id: 'controller_name',
    label: 'Name',
    required: true,
    placeholder: 'Enter Controller Name',
    lockedOnEdit: 'A controller is identified by its name on the cloud server. Renaming it would orphan the nodes already pointing at it.'
  },
  {
    key: 'cloudServerId',
    id: 'cloud_server',
    label: 'Cloud Server',
    required: true,
    type: 'select',
    options: CLOUD_SERVERS.map(s => ({ value: s.id, label: s.name })),
    placeholder: 'Select Cloud Server',
    lockedOnEdit: 'The cloud server is where this controller runs. Moving it is a new controller, not an edit.'
  },
  {
    key: 'location',
    id: 'location',
    label: 'Location',
    placeholder: 'Enter Controller Location'
  },
  {
    key: 'protocol',
    id: 'protocol',
    label: 'Protocol',
    required: true,
    type: 'select',
    options: [{ value: 'TCP', label: 'TCP' }, { value: 'UDP', label: 'UDP' }]
  },
  {
    key: 'port',
    id: 'port',
    label: 'Port',
    required: true,
    type: 'number',
    min: 0,
    max: 20000,
    placeholder: '1234'
  },
  {
    key: 'mgtPort',
    id: 'mgt_port',
    label: 'Management Port',
    type: 'number',
    locked: 'Always the data port plus 20,000. It follows the port above as you type.'
  },
  {
    key: 'network',
    id: 'internal_network',
    label: 'Internal network',
    required: true,
    placeholder: 'Network'
  },
  {
    key: 'netmaskBits',
    id: 'net_mask',
    label: 'Netmask bits',
    required: true,
    type: 'select',
    options: NETMASK_BITS.map(b => ({ value: b, label: String(b) }))
  },
  {
    key: 'topology',
    id: 'network_topology',
    label: 'Topology',
    locked: 'Subnet is the only topology this build serves.'
  }
]

const MONO_LABELS = ['Port', 'Management Port', 'Internal network', 'Netmask bits']

/** Read rows in the panel's two-column order, the way velto lays them out. */
const viewRows = computed(() => {
  const c = current.value
  if (!c) return []
  return [
    ['Name', c.name], ['Cloud Server', c.cloudServer],
    ['Location', c.location], ['Protocol', c.protocol],
    ['Port', c.port], ['Management Port', c.mgtPort],
    ['Internal network', c.network], ['Netmask bits', c.netmaskBits],
    ['Topology', c.topology]
  ]
})

function isLocked (f) {
  if (f.locked) return f.locked
  if (mode.value === 'edit' && f.lockedOnEdit) return f.lockedOnEdit
  return ''
}

function openView (row) {
  current.value = row
  mode.value = 'view'
  sheetOpen.value = true
}

function openEdit () {
  form.value = { ...current.value }
  mode.value = 'edit'
}

function openAdd () {
  current.value = null
  form.value = {
    name: '',
    cloudServerId: '',
    location: '',
    protocol: 'UDP',
    port: '',
    mgtPort: '',
    network: '',
    netmaskBits: 24,
    topology: 'Subnet'
  }
  mode.value = 'add'
  sheetOpen.value = true
}

// the management port is arithmetic, so it answers the port field as it is typed
watch(() => form.value.port, (p) => {
  if (mode.value === 'view') return
  form.value.mgtPort = p === '' || p === null || p === undefined ? '' : mgtPortFor(p)
})

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function validate () {
  for (const f of FIELDS) {
    if (!f.required || isLocked(f)) continue
    const v = form.value[f.key]
    if (v === '' || v === null || v === undefined) return `${f.label} is required`
  }
  const port = Number(form.value.port)
  if (!Number.isInteger(port) || port < 0 || port > 20000) {
    return 'Port must be a whole number between 0 and 20,000'
  }
  const m = IPV4.exec(String(form.value.network || ''))
  if (!m || m.slice(1).some(o => Number(o) > 255)) {
    return 'Internal network must be an IPv4 address, like 10.130.9.0'
  }
  return ''
}

async function save () {
  const problem = validate()
  if (problem) { toast(problem, 'bad'); return }
  saving.value = true
  try {
    const server = CLOUD_SERVERS.find(s => s.id === Number(form.value.cloudServerId))
    const body = {
      ...form.value,
      cloudServerId: Number(form.value.cloudServerId),
      cloudServer: server?.name || '',
      port: Number(form.value.port),
      mgtPort: mgtPortFor(form.value.port),
      netmaskBits: Number(form.value.netmaskBits),
      topology: 'Subnet'
    }
    if (mode.value === 'edit') {
      await api.controllers.update(current.value.id, { ...body, pendingCommit: true })
      toast(`${body.name} saved — commit it to put the change live`)
    } else {
      /* A controller that has never been committed is not serving anything,
         so it starts stopped and holding its configuration. */
      await api.controllers.create({ ...body, status: 'stopped', pendingCommit: true })
      toast(`${body.name} added — commit it to put it live`)
    }
    sheetOpen.value = false
    load()
  } catch (e) {
    toast('Could not save: ' + (e?.message || 'unknown error'), 'bad')
  } finally {
    saving.value = false
  }
}

function exportCsv () {
  const head = ['Controller', 'Cloud Server', 'Protocol', 'Port', 'Management Port', 'Network', 'Netmask bits', 'Location', 'Status']
  const body = rows.value.map(c => [
    c.name, c.cloudServer, c.protocol, c.port, c.mgtPort,
    c.network, c.netmaskBits, c.location, c.status
  ].map(v => JSON.stringify(v ?? '')).join(','))
  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'controllers.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * Poll only while there is something to watch.
 *
 * A restart settles on its own, so the view has to refresh to stay honest.
 * Refreshing unconditionally every two seconds replaces the rows array, and a
 * new array drops the table's selection — which made Commit on a selection
 * impossible to click: the tick landed between the checkbox and the button.
 * So the timer runs only while a controller is actually in transition, and
 * never while a selection or the panel is open.
 */
onMounted(() => {
  load()
  poll = setInterval(() => {
    if (sheetOpen.value || selectedIds.value.length) return
    if (!rows.value.some(c => c.status === 'restarting')) return
    load()
  }, 2000)
})
onUnmounted(() => clearInterval(poll))
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Controllers"
      subtitle="The control plane. Policy changes take effect when they are committed here."
    />

    <div class="i-strip">
      <label class="i-search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <input
          v-model="search"
          type="search"
          placeholder="Search controllers, cloud server, network"
          aria-label="Search controllers"
        >
      </label>

      <div class="i-tools">
        <button class="i-btn" title="Download this list as CSV" @click="exportCsv">
          <i class="fa-solid fa-download" aria-hidden="true" />
          <span class="d-none d-sm-inline">CSV</span>
        </button>
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add controller
        </button>
      </div>
    </div>

    <section v-if="pending.length" class="i-band">
      <div>
        <div class="i-bt">
          <span class="i-fdot" aria-hidden="true" />
          Uncommitted policy changes
        </div>
        <p class="i-bs">
          {{ pending.length === 1
            ? `${pending[0].name} is holding changes that are not live yet.`
            : `${pending.length} controllers are holding changes that are not live yet.` }}
          Until they are committed, the rules you edited are not enforcing.
        </p>
      </div>
    </section>

    <DataTable
      :columns="columns"
      :rows="rows"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:perPage="perPage"
      :sort="sort"
      :dir="dir"
      @sort="onSort"
      @selection="selectedIds = $event"
      @row-click="openView"
    >
      <template #bulk="{ ids }">
        <button class="i-btn i-sm i-primary" @click="commitSelected">
          Commit {{ ids.length }}
        </button>
        <button class="i-btn i-sm i-danger ms-1" @click="deleteOpen = true">
          Delete
        </button>
      </template>

      <template #actions="{ row }">
        <button
          class="i-btn i-sm me-1"
          :disabled="!row.pendingCommit"
          :title="row.pendingCommit ? '' : 'Nothing to commit'"
          @click="act(row, 'commit')"
        >Commit</button>
        <button
          class="i-btn i-sm me-1"
          :disabled="row.status !== 'running'"
          @click="act(row, 'restart')"
        >Restart</button>
        <button
          class="i-btn i-sm i-danger"
          :disabled="row.status === 'stopped'"
          @click="act(row, 'stop')"
        >Stop</button>
      </template>

      <template #empty>
        <EmptyState
          :icon="search ? 'fa-magnifying-glass' : 'fa-inbox'"
          :title="search ? `Nothing matches “${search}”` : 'No controllers yet'"
          :body="search
            ? 'Try a shorter term, or clear the search to see everything.'
            : 'A controller is the control plane for a cloud server. Add one to start enforcing policy.'"
          :action-label="search ? 'Clear search' : 'Add controller'"
          @action="search ? (search = '') : openAdd()"
        />
      </template>
    </DataTable>

    <!-- read first, edit second: the panel opens on the row you clicked and
         only becomes a form when you ask it to -->
    <Sheet
      v-model:open="sheetOpen"
      :title="mode === 'add' ? 'Add controller' : (mode === 'edit' ? `Edit ${current?.name}` : current?.name || '')"
      :subtitle="mode === 'view' ? 'Controller detail' : ''"
      width="620px"
    >
      <dl v-if="mode === 'view'" class="i-kv">
        <template v-for="[label, val] in viewRows" :key="label">
          <dt>{{ label }}</dt>
          <dd :class="{ 'i-tech': MONO_LABELS.includes(label) }">
            {{ val === '' || val === null || val === undefined ? '—' : val }}
          </dd>
        </template>
      </dl>

      <div v-else class="i-formsec">
        <div v-for="f in FIELDS" :key="f.key" class="i-frow" style="grid-template-columns:1fr">
          <div class="i-field">
            <label :for="f.id">
              {{ f.label }}<span v-if="f.required" class="i-req">*</span>
            </label>

            <select
              v-if="f.type === 'select'"
              :id="f.id"
              :name="f.id"
              class="i-ctl"
              :disabled="!!isLocked(f)"
              v-model="form[f.key]"
            >
              <option v-if="f.placeholder" value="" disabled>{{ f.placeholder }}</option>
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>

            <input
              v-else
              :id="f.id"
              :name="f.id"
              class="i-ctl"
              :class="{ 'i-tech': f.type === 'number' }"
              :type="f.type || 'text'"
              :min="f.min"
              :max="f.max"
              :placeholder="f.placeholder || ''"
              :disabled="!!isLocked(f)"
              v-model="form[f.key]"
            >

            <p v-if="isLocked(f)" class="i-hint">{{ isLocked(f) }}</p>
          </div>
        </div>
      </div>

      <template #footer>
        <template v-if="mode === 'view'">
          <button class="i-btn i-quiet" @click="sheetOpen = false">Close</button>
          <div class="i-right">
            <button class="i-btn i-primary" @click="openEdit">Edit</button>
          </div>
        </template>
        <template v-else>
          <button
            class="i-btn i-quiet"
            @click="current ? (mode = 'view') : (sheetOpen = false)"
          >Cancel</button>
          <div class="i-right">
            <button class="i-btn i-primary" :disabled="saving" @click="save">
              {{ saving ? 'Saving…' : (mode === 'edit' ? 'Save changes' : 'Create') }}
            </button>
          </div>
        </template>
      </template>
    </Sheet>

    <ConfirmModal
      v-model:open="stopOpen"
      :title="'Stop ' + (stopTarget?.name || '') + '?'"
      confirm-label="Stop controller"
      @confirm="confirmStop"
    >
      Every session routed through <strong class="i-named">{{ stopTarget?.name }}</strong>
      on {{ stopTarget?.cloudServer }} drops immediately, and policy changes cannot be
      committed until it is running again.
    </ConfirmModal>

    <ConfirmModal
      v-model:open="deleteOpen"
      :title="`Delete ${selectedIds.length} controller${selectedIds.length === 1 ? '' : 's'}?`"
      confirm-label="Delete"
      @confirm="deleteSelected"
    >
      <strong class="i-named">{{ selectedNames }}</strong> will be removed, with the
      policy {{ one ? 'it enforces' : 'they enforce' }}. Nodes pointing at
      {{ one ? 'it' : 'them' }} lose their control plane until another controller
      is configured.
    </ConfirmModal>
  </div>
</template>
