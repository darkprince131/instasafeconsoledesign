<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ListTools from '../../components/ui/ListTools.vue'
import Sheet from '../../components/ui/Sheet.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'

/**
 * Gateways.
 *
 * Read off veno's `/gateways`, because velto's tenant is at its gateway limit
 * and will not open the add form at all.
 *
 * The list is four columns — Gateway Name, Backup Gateway Name, Location,
 * Number of Networks — and the form is four fields, one of which repeats:
 * `gw_name`, `backup_name`, `location` and `pro_net-0..n`. The demo had none
 * of that. It listed region, public IP, agent version, sessions, Mbps,
 * latency and status, which is the Live Gateways report, not this screen, and
 * it had no backup gateway and no protected networks at all — the two things
 * a gateway is actually configured with.
 *
 * `status`, `sessions`, `throughputMbps` and `ip` stay on the record because
 * the dashboard, the graph and the network test read them. They are not
 * columns here because they are not columns there.
 *
 * Kept from veno: the name and the backup name lock once the gateway exists,
 * the protected networks repeat with an Add more, and the toolbar carries
 * Bulk Add beside Add.
 */

const toast = inject('toast', () => {})
const refreshStats = inject('refreshStats', () => {})

/* Velto's tenant is licensed for four and running four, which is why the add
   form could not be opened there. The wall is the velto behaviour: it stops
   you before the form rather than after it. */
const LIMIT = 4

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

const limitHit = ref(false)
const deleteOpen = ref(false)

/* ------------------------------------------------------------- the list */

const columns = [
  { key: 'name', label: 'Gateway Name', bold: true },
  { key: 'backupName', label: 'Backup Gateway Name' },
  { key: 'location', label: 'Location' },
  {
    key: 'protectedNetworks',
    label: 'Number of Networks',
    align: 'right',
    num: true,
    sortable: false,
    cell: (v) => (v || []).length
  }
]

async function load () {
  const res = await api.gateways.list({
    page: page.value,
    perPage: perPage.value,
    sort: sort.value,
    dir: dir.value,
    search: search.value,
    searchFields: ['name', 'backupName', 'location']
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

const atLimit = computed(() => total.value >= LIMIT)

/* ------------------------------------------------------------- the bulk */

const selectedNames = computed(() => {
  const n = rows.value.filter(r => selectedIds.value.includes(r.id)).map(r => r.name)
  return n.length > 3 ? `${n.slice(0, 3).join(', ')} and ${n.length - 3} more` : n.join(', ')
})

const one = computed(() => selectedIds.value.length === 1)

async function deleteSelected () {
  const n = selectedIds.value.length
  await api.gateways.removeMany(selectedIds.value)
  toast(`Deleted ${n} gateway${n === 1 ? '' : 's'}`)
  deleteOpen.value = false
  refreshStats(); load()
}

function onBulkApplied ({ count }) {
  toast(`Bulk upload created ${count} gateway${count === 1 ? '' : 's'}`)
  refreshStats(); load()
}

/* ------------------------------------------------- view · edit · create */

/**
 * `lockedOnEdit` is why the field cannot be changed, not merely that it
 * cannot. Veno disables both names on edit and says nothing about it.
 */
const FIELDS = [
  {
    key: 'name',
    id: 'gw_name',
    label: 'Gateway name',
    required: true,
    placeholder: 'Enter Gateway Name',
    lockedOnEdit: 'The agent on the gateway is enrolled under this name, and access rules point at it. Renaming it would strand both.'
  },
  {
    key: 'backupName',
    id: 'backup_name',
    label: 'Backup gateway name',
    required: true,
    placeholder: 'Backup Gateway',
    lockedOnEdit: 'The pair is fixed when the gateway is created. Changing which gateway stands in for this one is a new gateway.'
  },
  {
    key: 'location',
    id: 'location',
    label: 'Location',
    required: true,
    placeholder: 'Enter Gateway Location'
  }
]

function isLocked (f) {
  return mode.value === 'edit' && f.lockedOnEdit ? f.lockedOnEdit : ''
}

const viewRows = computed(() => {
  const g = current.value
  if (!g) return []
  return [
    ['Gateway name', g.name],
    ['Backup gateway name', g.backupName],
    ['Location', g.location],
    ['Public IP', g.ip],
    ['Agent version', g.version]
  ]
})

function openView (row) {
  current.value = row
  mode.value = 'view'
  sheetOpen.value = true
}

function openEdit () {
  form.value = {
    ...current.value,
    protectedNetworks: [...(current.value.protectedNetworks || [])]
  }
  mode.value = 'edit'
}

function openAdd () {
  if (atLimit.value) { limitHit.value = true; return }
  current.value = null
  form.value = { name: '', backupName: '', location: '', protectedNetworks: [''] }
  mode.value = 'add'
  sheetOpen.value = true
}

/* ---- protected networks: a repeating field, as the real form has ------- */

function addNetwork () {
  form.value.protectedNetworks.push('')
}

function removeNetwork (i) {
  form.value.protectedNetworks.splice(i, 1)
  if (!form.value.protectedNetworks.length) form.value.protectedNetworks.push('')
}

/** IPv4 CIDR. The captured gateway protects 192.168.0.0/24 and 0.0.0.0/0. */
const CIDR = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/

function badNetwork (value) {
  const m = CIDR.exec(String(value || '').trim())
  if (!m) return 'Use CIDR, like 10.130.0.0/16'
  if (m.slice(1, 5).some(o => Number(o) > 255)) return 'Each octet must be 0–255'
  if (Number(m[5]) > 32) return 'The prefix must be /0 to /32'
  return ''
}

function validate () {
  for (const f of FIELDS) {
    if (f.required && !isLocked(f) && !String(form.value[f.key] || '').trim()) {
      return `${f.label} is required`
    }
  }
  if (mode.value === 'add' && form.value.name.trim() === form.value.backupName.trim()) {
    return 'A gateway cannot be its own backup'
  }
  const nets = form.value.protectedNetworks.map(n => String(n || '').trim()).filter(Boolean)
  if (!nets.length) return 'A gateway needs at least one protected network'
  for (const n of nets) {
    const problem = badNetwork(n)
    if (problem) return `${n} — ${problem.toLowerCase()}`
  }
  if (new Set(nets).size !== nets.length) return 'The same network is listed twice'
  return ''
}

async function save () {
  const problem = validate()
  if (problem) { toast(problem, 'bad'); return }
  saving.value = true
  try {
    const body = {
      ...form.value,
      name: form.value.name.trim(),
      backupName: form.value.backupName.trim(),
      location: form.value.location.trim(),
      protectedNetworks: form.value.protectedNetworks
        .map(n => String(n).trim()).filter(Boolean)
    }
    if (mode.value === 'edit') {
      await api.gateways.update(current.value.id, body)
      toast(`${body.name} saved`)
    } else {
      /* A gateway is not carrying traffic until its agent checks in. */
      await api.gateways.create({ ...body, status: 'down', sessions: 0, version: '3.4.1' })
      toast(`${body.name} added — it reports as down until its agent checks in`)
    }
    sheetOpen.value = false
    refreshStats(); load()
  } catch (e) {
    toast('Could not save: ' + (e?.message || 'unknown error'), 'bad')
  } finally {
    saving.value = false
  }
}

function exportCsv () {
  const head = ['Gateway Name', 'Backup Gateway Name', 'Location', 'Protected Networks']
  const body = rows.value.map(g => [
    g.name, g.backupName, g.location, (g.protectedNetworks || []).join(' ')
  ].map(v => JSON.stringify(v ?? '')).join(','))
  const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'gateways.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Gateways"
      subtitle="The data plane. Traffic reaches the networks behind a gateway through it."
    />

    <div class="i-strip">
      <label class="i-search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <input
          v-model="search"
          type="search"
          placeholder="Search gateway, backup or location"
          aria-label="Search gateways"
        >
      </label>

      <div class="i-tools">
        <button class="i-btn" title="Download this list as CSV" @click="exportCsv">
          <i class="fa-solid fa-download" aria-hidden="true" />
          <span class="d-none d-sm-inline">CSV</span>
        </button>
        <ListTools kind="gateways" resource="gateways" :rows="rows" :total="total" @apply="onBulkApplied" />
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add gateway
        </button>
      </div>
    </div>

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
      <template #bulk>
        <button class="i-btn i-sm i-danger" @click="deleteOpen = true">Delete</button>
      </template>

      <template #empty>
        <EmptyState
          :icon="search ? 'fa-magnifying-glass' : 'fa-inbox'"
          :title="search ? `Nothing matches “${search}”` : 'No gateways yet'"
          :body="search
            ? 'Try a shorter term, or clear the search to see everything.'
            : 'A gateway is where traffic enters, and it protects one or more networks. Add one before writing a rule that uses it.'"
          :action-label="search ? 'Clear search' : 'Add gateway'"
          @action="search ? (search = '') : openAdd()"
        />
      </template>
    </DataTable>

    <Sheet
      v-model:open="sheetOpen"
      :title="mode === 'add' ? 'Add gateway' : (mode === 'edit' ? `Edit ${current?.name}` : current?.name || '')"
      :subtitle="mode === 'view' ? 'Gateway detail' : ''"
      width="620px"
    >
      <template v-if="mode === 'view'">
        <dl class="i-kv">
          <template v-for="[label, val] in viewRows" :key="label">
            <dt>{{ label }}</dt>
            <dd :class="{ 'i-tech': label === 'Public IP' || label === 'Agent version' }">
              {{ val === '' || val === null || val === undefined ? '—' : val }}
            </dd>
          </template>
          <dt>Protected networks</dt>
          <dd>
            <div v-for="n in (current?.protectedNetworks || [])" :key="n" class="i-tech">{{ n }}</div>
            <span v-if="!(current?.protectedNetworks || []).length">—</span>
          </dd>
        </dl>
      </template>

      <div v-else class="i-formsec">
        <div v-for="f in FIELDS" :key="f.key" class="i-frow" style="grid-template-columns:1fr">
          <div class="i-field">
            <label :for="f.id">
              {{ f.label }}<span v-if="f.required" class="i-req">*</span>
            </label>
            <input
              :id="f.id"
              :name="f.id"
              class="i-ctl"
              type="text"
              :placeholder="f.placeholder"
              :disabled="!!isLocked(f)"
              v-model="form[f.key]"
            >
            <p v-if="isLocked(f)" class="i-hint">{{ isLocked(f) }}</p>
          </div>
        </div>

        <!-- The repeating field. One gateway commonly fronts several subnets:
             the captured one protects 192.168.0.0/24, 10.0.0.0/24 and
             0.0.0.0/0, so a single box was never going to hold it. -->
        <div class="i-field">
          <label for="pro_net-0">Protected network<span class="i-req">*</span></label>
          <div
            v-for="(net, i) in form.protectedNetworks" :key="i"
            class="d-flex align-items-center gap-2 mb-2"
          >
            <input
              :id="'pro_net-' + i"
              :name="'pro_net-' + i"
              class="i-ctl i-tech"
              type="text"
              placeholder="Enter Protected Network"
              v-model="form.protectedNetworks[i]"
            >
            <button
              class="i-btn i-sm i-quiet"
              type="button"
              :disabled="form.protectedNetworks.length === 1 && !form.protectedNetworks[0]"
              :aria-label="`Remove ${net || 'this network'}`"
              @click="removeNetwork(i)"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
          <button class="i-btn i-sm" type="button" @click="addNetwork">
            <i class="fa-solid fa-plus" aria-hidden="true" /> Add more
          </button>
          <p class="i-hint">
            In CIDR, one per row — <span class="i-tech">10.130.0.0/16</span>.
            Everything inside these ranges is reachable through this gateway;
            <span class="i-tech">0.0.0.0/0</span> sends all traffic through it.
          </p>
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

    <!-- the licence wall, before the form rather than after it -->
    <ConfirmModal
      v-model:open="limitHit"
      title="Maximum gateway limit reached"
      confirm-label="Contact InstaSafe"
      @confirm="limitHit = false"
    >
      This tenant is licensed for {{ LIMIT }} gateways and is running
      {{ total }}. Gateways are licensed separately from user seats, so adding
      another is a licence change rather than a setting. Delete one you no
      longer route through, or talk to InstaSafe about the limit.
    </ConfirmModal>

    <ConfirmModal
      v-model:open="deleteOpen"
      :title="`Delete ${selectedIds.length} gateway${selectedIds.length === 1 ? '' : 's'}?`"
      confirm-label="Delete"
      @confirm="deleteSelected"
    >
      <strong class="i-named">{{ selectedNames }}</strong> will be removed, with
      the protected networks {{ one ? 'it fronts' : 'they front' }}. Any access
      rule routing through {{ one ? 'it' : 'them' }} stops working, and sessions
      on {{ one ? 'it' : 'them' }} drop.
    </ConfirmModal>
  </div>
</template>
