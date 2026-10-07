<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'
import Sheet from '../../components/ui/Sheet.vue'

/**
 * Access rules — create, edit, reorder, delete.
 *
 * Order is the whole semantics: evaluation runs top to bottom and the first
 * rule that matches decides, so priority is the default sort, the first
 * column, and movable. The production table sorts by nothing and shows
 * priority nowhere, which makes a shadowed rule impossible to spot.
 *
 * The form mirrors the production one, which changes shape with the source
 * and destination type — a destination of Custom Application asks for an
 * address and a service that an Application destination does not. The field
 * sets below are the ones captured from the live console.
 */

const toast = inject('toast', () => {})
const refreshStats = inject('refreshStats', () => {})

const rows = ref([]); const total = ref(0); const loading = ref(true)
const page = ref(1); const perPage = ref(25)
const sort = ref('priority'); const dir = ref('asc')
const search = ref(''); const selectedIds = ref([]); const table = ref(null)
const confirmOpen = ref(false)
const sheetOpen = ref(false)
const saving = ref(false)
const editingId = ref(null)
const form = ref(blank())

const SOURCE_TYPES = [
  { key: 'user', label: 'User' },
  { key: 'group', label: 'User group' },
  { key: 'application', label: 'Application' }
]
const DEST_TYPES = [
  { key: 'application', label: 'Application' },
  { key: 'application-group', label: 'Application group' },
  { key: 'custom-application', label: 'Custom application' },
  { key: 'url', label: 'URL filter' },
  { key: 'content', label: 'Content filter' },
  { key: 'filetype', label: 'File type filter' },
  { key: 'domainlist', label: 'Domain list' }
]
const ACTIONS = [
  { key: 'allow', label: 'Allow', hint: 'Traffic matching this rule is permitted.' },
  { key: 'deny', label: 'Deny', hint: 'Traffic is blocked and the attempt is logged.' },
  { key: 'bypass', label: 'Bypass', hint: 'Traffic skips the gateway and goes direct. Nothing is inspected or logged.' }
]

/* Source and destination each need an extra address and service when the type
   is one that does not name an existing object. Captured from the live form. */
const needsAddress = (t) => t === 'application' || t === 'custom-application'

function blank () {
  return {
    name: '', priority: null,
    sourceType: 'group', source: '',
    destType: 'application', dest: '',
    action: 'allow', schedule: 'Always', enabled: true,
    sourceAddress: '', destAddress: '', service: ''
  }
}

const sources = ref([])
const applications = ref([])
const schedules = ref([])

const sourceOptions = computed(() => {
  if (form.value.sourceType === 'group') return sources.value.map(g => g.name)
  if (form.value.sourceType === 'application') return applications.value.map(a => a.name)
  return []
})
const destOptions = computed(() =>
  form.value.destType === 'application' ? applications.value.map(a => a.name) : [])

const columns = [
  { key: 'priority', label: '#', mono: true, align: 'right' },
  { key: 'name', label: 'Rule', bold: true },
  { key: 'sourceType', label: 'Source type',
    cell: (v) => SOURCE_TYPES.find(s => s.key === v)?.label || v },
  { key: 'source', label: 'Source' },
  { key: 'dest', label: 'Destination' },
  { key: 'schedule', label: 'Schedule', dim: true },
  { key: 'action', label: 'Action',
    cell: (v) => v.charAt(0).toUpperCase() + v.slice(1),
    pill: (v) => v === 'deny' ? 'bad' : v === 'bypass' ? 'att' : null },
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

watch(() => form.value.sourceType, () => { form.value.source = '' })
watch(() => form.value.destType, () => { form.value.dest = '' })

async function openAdd () {
  form.value = blank()
  // a new rule lands at the end, which is the only safe default: inserting it
  // higher would silently change what every rule below it does
  form.value.priority = (total.value || 0) + 1
  editingId.value = null
  sheetOpen.value = true
}

function openEdit (row) {
  form.value = { ...blank(), ...row }
  editingId.value = row.id
  sheetOpen.value = true
}

async function save () {
  if (!form.value.name) { toast('Give the rule a name', 'bad'); return }
  if (!form.value.source || !form.value.dest) { toast('Pick a source and a destination', 'bad'); return }
  saving.value = true
  try {
    if (editingId.value) {
      await api.accessRules.update(editingId.value, { ...form.value })
      toast(form.value.name + ' updated')
    } else {
      await api.accessRules.create({ ...form.value })
      toast(form.value.name + ' created')
    }
    sheetOpen.value = false
    refreshStats(); load()
  } catch (e) {
    toast('Could not save: ' + (e?.message || 'unknown error'), 'bad')
  } finally { saving.value = false }
}

/** Reordering is the edit that changes behaviour most, so it is one click. */
async function move (row, delta) {
  const neighbour = rows.value.find(r => r.priority === row.priority + delta)
  if (!neighbour) return
  await api.accessRules.update(row.id, { priority: neighbour.priority })
  await api.accessRules.update(neighbour.id, { priority: row.priority })
  toast(row.name + ' moved ' + (delta < 0 ? 'up' : 'down'))
  load()
}

async function removeSelected () {
  const n = selectedIds.value.length
  await api.accessRules.removeMany(selectedIds.value)
  confirmOpen.value = false
  table.value?.clearSelection()
  toast(n + ' rule' + (n === 1 ? '' : 's') + ' deleted')
  refreshStats(); load()
}

const names = computed(() => {
  const n = rows.value.filter(x => selectedIds.value.includes(x.id)).map(x => x.name)
  return n.length > 3 ? n.slice(0, 3).join(', ') + ' and ' + (n.length - 3) + ' more' : n.join(', ')
})

onMounted(async () => {
  load()
  const [g, a, s] = await Promise.all([
    api.groups.list({ perPage: 0 }),
    api.applications.list({ perPage: 0 }),
    api.timeSchedules.list({ perPage: 0 })
  ])
  sources.value = g.data; applications.value = a.data; schedules.value = s.data
})
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
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add rule
        </button>
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
      @sort="onSort" @selection="selectedIds = $event" @row-click="openEdit"
    >
      <template #bulk>
        <button class="i-btn i-sm i-danger" @click="confirmOpen = true">Delete</button>
      </template>
      <template #empty>
        <EmptyState
          icon="fa-shield-halved"
          :title="search ? 'Nothing matches that search' : 'No access rules'"
          body="With no rules the default deny applies, and nobody reaches anything."
          :action-label="search ? '' : 'Add rule'"
          @action="openAdd"
        />
      </template>
    </DataTable>

    <p v-if="rows.length" class="i-demo-note mt-3" style="max-width:640px">
      Click any rule to edit it. Order decides the outcome — use the arrows in the
      editor to move a rule, or
      <RouterLink to="/access-explorer">test a user against an application</RouterLink>
      to see which rule actually fires.
    </p>

    <Sheet
      v-model:open="sheetOpen"
      :title="editingId ? 'Edit access rule' : 'Add access rule'"
      :subtitle="editingId ? 'Changing order or action takes effect on the next evaluation.' : 'New rules are added at the end so they cannot change what existing rules do.'"
      width="620px"
    >
      <div class="i-formsec">
        <h3>Identity</h3>
        <div class="i-frow" style="grid-template-columns:2fr 1fr">
          <div class="i-field">
            <label for="rn">Rule name <span class="i-req">*</span></label>
            <input id="rn" class="i-ctl" v-model="form.name" placeholder="Finance → Finance DB">
          </div>
          <div class="i-field">
            <label for="rp">Priority</label>
            <div class="d-flex gap-1 align-items-center">
              <input id="rp" class="i-ctl" type="number" v-model.number="form.priority">
              <button
                v-if="editingId" class="i-pbtn" title="Move up"
                @click="move(form, -1)"
              ><i class="fa-solid fa-arrow-up" style="font-size:10px" aria-hidden="true" /></button>
              <button
                v-if="editingId" class="i-pbtn" title="Move down"
                @click="move(form, 1)"
              ><i class="fa-solid fa-arrow-down" style="font-size:10px" aria-hidden="true" /></button>
            </div>
            <p class="i-hint">Lower runs first.</p>
          </div>
        </div>
      </div>

      <div class="i-formsec">
        <h3>Source</h3>
        <p class="i-secsub">Who the rule applies to.</p>
        <div class="i-frow">
          <div class="i-field">
            <label for="st">Source type</label>
            <select id="st" class="i-ctl" v-model="form.sourceType">
              <option v-for="t in SOURCE_TYPES" :key="t.key" :value="t.key">{{ t.label }}</option>
            </select>
          </div>
          <div class="i-field">
            <label for="sv">Source <span class="i-req">*</span></label>
            <select v-if="sourceOptions.length" id="sv" class="i-ctl" v-model="form.source">
              <option value="">Select…</option>
              <option v-for="o in sourceOptions" :key="o">{{ o }}</option>
            </select>
            <input v-else id="sv" class="i-ctl" v-model="form.source" placeholder="username">
          </div>
        </div>
        <div v-if="needsAddress(form.sourceType)" class="i-frow">
          <div class="i-field">
            <label for="sa">IP address or network</label>
            <input id="sa" class="i-ctl" v-model="form.sourceAddress" placeholder="10.20.0.0/24">
            <p class="i-hint">Only required when the source is an application rather than a person.</p>
          </div>
        </div>
      </div>

      <div class="i-formsec">
        <h3>Destination</h3>
        <p class="i-secsub">What they are trying to reach.</p>
        <div class="i-frow">
          <div class="i-field">
            <label for="dt">Destination type</label>
            <select id="dt" class="i-ctl" v-model="form.destType">
              <option v-for="t in DEST_TYPES" :key="t.key" :value="t.key">{{ t.label }}</option>
            </select>
          </div>
          <div class="i-field">
            <label for="dv">Destination <span class="i-req">*</span></label>
            <select v-if="destOptions.length" id="dv" class="i-ctl" v-model="form.dest">
              <option value="">Select…</option>
              <option v-for="o in destOptions" :key="o">{{ o }}</option>
            </select>
            <input v-else id="dv" class="i-ctl" v-model="form.dest" placeholder="name or pattern">
          </div>
        </div>
        <div v-if="needsAddress(form.destType)" class="i-frow">
          <div class="i-field">
            <label for="da">IP address or network</label>
            <input id="da" class="i-ctl" v-model="form.destAddress" placeholder="10.20.4.17">
          </div>
          <div class="i-field">
            <label for="sr">Service</label>
            <input id="sr" class="i-ctl" v-model="form.service" placeholder="RDP / 3389">
          </div>
        </div>
      </div>

      <div class="i-formsec">
        <h3>Action</h3>
        <div class="d-flex flex-wrap gap-2 mb-2">
          <button
            v-for="a in ACTIONS" :key="a.key"
            class="i-chip" :class="{ 'is-on': form.action === a.key }"
            :aria-pressed="form.action === a.key" @click="form.action = a.key"
          >{{ a.label }}</button>
        </div>
        <p class="i-hint">{{ ACTIONS.find(a => a.key === form.action)?.hint }}</p>

        <div class="i-frow mt-3">
          <div class="i-field">
            <label for="sc">Schedule</label>
            <select id="sc" class="i-ctl" v-model="form.schedule">
              <option>Always</option>
              <option v-for="s in schedules" :key="s.id">{{ s.name }}</option>
            </select>
            <p class="i-hint">Outside the window the rule does not match at all.</p>
          </div>
        </div>

        <label class="i-sw mt-2">
          <input type="checkbox" v-model="form.enabled"><span class="i-track" />
          Rule is enabled
        </label>
      </div>

      <template #footer>
        <button class="i-btn i-quiet" @click="sheetOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Create rule') }}
          </button>
        </div>
      </template>
    </Sheet>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="'Delete ' + selectedIds.length + ' rule' + (selectedIds.length === 1 ? '' : 's') + '?'"
      :confirm-label="'Delete ' + selectedIds.length"
      @confirm="removeSelected"
    >
      <strong class="i-named">{{ names }}</strong> stops being evaluated immediately.
      Anyone who was reaching an application only because of it loses access, and
      anyone who was blocked only by it gains it.
    </ConfirmModal>
  </div>
</template>
