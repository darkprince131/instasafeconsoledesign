<script setup>
import { ref, computed, watch, inject, onMounted, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import PageHeader from '../components/ui/PageHeader.vue'
import DataTable from '../components/ui/DataTable.vue'
import ListTools from '../components/ui/ListTools.vue'
import PickList from '../components/ui/PickList.vue'
/* Leaflet is ~150KB and exactly one screen needs it. Loaded on demand, so
   the chunk that carries the other 53 list screens does not grow by half
   again for a map they never show. */
const LocationPicker = defineAsyncComponent(() => import('../components/ui/LocationPicker.vue'))
import GraphView from '../components/ui/GraphView.vue'
import TimeWindow from '../components/ui/TimeWindow.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ConfirmModal from '../components/ui/ConfirmModal.vue'
import Sheet from '../components/ui/Sheet.vue'

/**
 * The generic list screen, driven by a config object from resources.js.
 * Writing a new list screen is adding a config entry, not a component.
 *
 * Routes with no config yet render an honest "not built" state rather than a
 * blank page or a fake table.
 */

const props = defineProps({
  config: { type: Object, default: null },
  route: { type: String, default: '' }
})

const r = useRoute()
const toast = inject('toast', () => {})
const refreshStats = inject('refreshStats', () => {})

const rows = ref([])
const error = ref('')
const total = ref(0)
const loading = ref(true)
const page = ref(1)
const perPage = ref(25)
const sort = ref('')
const dir = ref('asc')
const search = ref('')
const activeFilter = ref('all')
const selectedIds = ref([])
const confirmOpen = ref(false)
const table = ref(null)
const sheetOpen = ref(false)
const saving = ref(false)
const editingId = ref(null)
const form = ref({})

/* A screen can be edited as soon as resources.js gives it a `form`. Without
   one the rows stay read-only rather than opening an empty panel that saves
   nothing - which is worse than no edit at all. */
const editable = computed(() => Array.isArray(cfg.value?.form) && cfg.value.form.length > 0)

function blankForm () {
  const out = {}
  for (const f of cfg.value?.form || []) {
    /* One control standing for two keys still has to seed both, or a new
       schedule opens with an empty window and saves as one. */
    if (f.type === 'timewindow') {
      out[f.startKey] = f.startDefault || '09:00'
      out[f.endKey] = f.endDefault || '18:00'
      continue
    }
    /* A field the form never lets you fill still has to be saved with its
       value — OpenLDAP's Protocol is fixed at TCP and disabled, so without a
       default a new profile would be created with no protocol at all. Velto
       pre-fills its add form the same way, including RADIUS port 1812. */
    out[f.key] = f.default !== undefined ? f.default
      : f.type === 'switch' ? false
      : f.type === 'days' ? []
      : f.type === 'pick' ? (f.multiple === false ? '' : [])
      : ''
  }
  return out
}

/**
 * A quota that stops you before the form, not after it.
 *
 * Letting somebody fill in a gateway and then refusing it on save wastes the
 * whole form. Velto opens a modal instead of the form, which costs one click
 * and no work.
 */
const limitHit = ref(false)
const atLimit = computed(() => {
  const l = cfg.value?.limit
  return !!l && (total.value || 0) >= l.max
})

function openAdd () {
  if (atLimit.value) { limitHit.value = true; return }
  return reallyOpenAdd()
}

function reallyOpenAdd () {
  form.value = blankForm()
  editingId.value = null
  sheetOpen.value = true
}

/**
 * A field velto disables once the record exists.
 *
 * Every authentication profile does this with `profile_name`: it is disabled
 * on all four captured edit forms. The name is what rules and sessions refer
 * to, so renaming it is a new profile. Production disables it and says
 * nothing; this says why.
 */
function locked (f) {
  /* Some fields are fixed whatever you are doing. OpenLDAP's Protocol is
     disabled on the add form too, carrying TCP — the console does not offer
     the choice at all. */
  if (f.locked) return f.locked
  return editingId.value && f.lockedOnEdit ? f.lockedOnEdit : ''
}

/**
 * A secret the record holds but never shows.
 *
 * Velto puts these behind their own button on the view panel — Change
 * Password on an LDAP profile, Change Client Secret on a RADIUS one — rather
 * than on the form, because a secret that has been set should not be readable
 * afterwards. Nothing stores the value: there is no directory or RADIUS
 * server here to give it to, so what is kept is that one was set, and when.
 */
const secretOpen = ref(false)
const secretNew = ref('')
const secretConfirm = ref('')
const secretSaving = ref(false)
const secretActive = ref(null)

/* A screen can hold more than one. Azure AD carries both a Change Client
   Secret and a Set Password, because the application registration and the
   directory account are two different credentials. */
const secretActions = computed(() => {
  const c = cfg.value
  if (!c) return []
  return c.secretActions || (c.secretAction ? [c.secretAction] : [])
})

function openSecret (action) {
  secretActive.value = action
  secretNew.value = ''
  secretConfirm.value = ''
  secretFile.value = ''
  secretOpen.value = true
}

function secretState (a) {
  if (!form.value[a.key + 'Set']) return `No ${a.noun} set yet.`
  const when = new Date(form.value[a.key + 'UpdatedAt'])
  const on = when.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const file = form.value[a.key + 'Filename']
  if (file) return `${file} uploaded ${on}. Its contents are not shown again.`
  return `${a.noun[0].toUpperCase()}${a.noun.slice(1)} set ${on}. It is not shown again.`
}

/**
 * Some credentials are uploaded rather than typed. Google's Update
 * Credentials takes the service account key as a JSON file, and shows the
 * filename beside it — the same shape as the keytab on Active Directory.
 */
const secretFile = ref('')

function onSecretFile (e) {
  const a = secretActive.value
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const exts = (a.accept || '').split(',').map(x => x.trim()).filter(Boolean)
  if (exts.length && !exts.some(x => file.name.toLowerCase().endsWith(x.toLowerCase()))) {
    toast(`Invalid file type. Allowed types: ${exts.join(', ')}`, 'bad')
    secretFile.value = ''
    return
  }
  secretFile.value = file.name
}

async function saveSecretFile () {
  const a = secretActive.value
  if (!secretFile.value) { toast('Choose a file first', 'bad'); return }
  secretSaving.value = true
  try {
    form.value[a.key + 'Set'] = true
    form.value[a.key + 'Filename'] = secretFile.value
    form.value[a.key + 'UpdatedAt'] = new Date().toISOString()
    if (editingId.value) {
      await api[cfg.value.resource].update(editingId.value, { ...form.value })
      load()
    }
    secretOpen.value = false
    toast(`${a.label} — saved`)
  } finally {
    secretSaving.value = false
  }
}

async function saveSecret () {
  if (secretActive.value?.type === 'file') return saveSecretFile()
  const a = secretActive.value
  if (secretNew.value.length < 8) { toast('Use at least 8 characters', 'bad'); return }
  if (secretNew.value !== secretConfirm.value) { toast(`The two ${a.noun}s do not match`, 'bad'); return }
  secretSaving.value = true
  try {
    form.value[a.key + 'Set'] = true
    form.value[a.key + 'UpdatedAt'] = new Date().toISOString()
    if (editingId.value) {
      await api[cfg.value.resource].update(editingId.value, { ...form.value })
      load()
    }
    secretOpen.value = false
    toast(`${a.label} — saved`)
  } finally {
    secretSaving.value = false
  }
}

/**
 * A field that only exists in some states.
 *
 * `when` is another field being switched on. `editOnly` and `addOnly` are the
 * two sides of the panel: velto asks a user group for its Authentication
 * Profile when editing and not when creating, because the profile is decided
 * by where the members came from.
 */
/**
 * Form rows.
 *
 * A field gets a row to itself unless it is marked `half`, and two
 * consecutive halves share one. Latitude and Longitude are six characters
 * each and were taking a full-width row apiece, which turned adding a
 * geo-fence into scrolling.
 */
const formRows = computed(() => {
  const out = []
  let pending = null
  for (const f of cfg.value?.form || []) {
    if (f.half) {
      if (pending) { out.push([pending, f]); pending = null } else { pending = f }
    } else {
      if (pending) { out.push([pending]); pending = null }
      out.push([f])
    }
  }
  if (pending) out.push([pending])
  return out
})

function visible (f) {
  if (f.editOnly && !editingId.value) return false
  if (f.addOnly && editingId.value) return false
  return !f.when || f.when(form.value)
}

/* ---- the rules that reach this record ---------------------------------- */

/**
 * Velto's View Acls.
 *
 * A user group's panel has a button opening a table of every access rule
 * whose source is that group. It is the answer to "what did putting somebody
 * in this group actually give them", and it is worth having one click away.
 *
 * Velto packs the destination into one cell — "Ip Address: 172.31.13.231
 * Service Name: ANY Protocol: ANY" — which is three facts in a sentence. They
 * are three columns here.
 */
const aclsOpen = ref(false)
const relatedAcls = ref([])
const aclsLoading = ref(false)

async function loadAcls () {
  if (!cfg.value?.aclPanel || !editingId.value) { relatedAcls.value = []; return }
  aclsLoading.value = true
  try {
    const res = await api.accessRules.list({ perPage: 0 })
    const mine = form.value.name
    relatedAcls.value = res.data.filter(a => a.source === mine)
  } finally { aclsLoading.value = false }
}

/**
 * An uploaded file, held the way the real console holds it: the name goes in
 * one field and the bytes go base64 in another. The name field is read-only
 * in velto too — it is filled from the file, never typed, which is why it
 * looks greyed out.
 */
function onFile (f, e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const exts = (f.accept || '').split(',').map(x => x.trim()).filter(Boolean)
  const ok = exts.some(x => file.name.toLowerCase().endsWith(x.toLowerCase()))
  if (!ok) {
    toast(`Invalid file type. Allowed types: ${exts.join(', ')}`, 'bad')
    form.value[f.key] = ''
    if (f.dataKey) form.value[f.dataKey] = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    form.value[f.key] = file.name
    if (f.dataKey) form.value[f.dataKey] = String(reader.result)
  }
  reader.onerror = () => toast('That file could not be read', 'bad')
  reader.readAsDataURL(file)
}

function openEdit (row) {
  if (!editable.value) return
  form.value = { ...blankForm(), ...row }
  editingId.value = row.id
  sheetOpen.value = true
  loadAcls()
}

async function saveForm () {
  const required = (cfg.value.form || [])
    .filter(f => visible(f) && !locked(f))
    .filter(f => f.required && !form.value[f.key])
  if (required.length) { toast(required[0].label + ' is required', 'bad'); return }
  saving.value = true
  try {
    if (editingId.value) {
      await api[cfg.value.resource].update(editingId.value, { ...form.value })
      toast('Saved')
    } else {
      /* A screen that shows one slice of a collection has to stamp the
         record with that slice, or it creates something it cannot then
         display. Every authentication-profile screen is one type out of
         authProfiles, so a profile created without its `type` was saved and
         then vanished from the list it was created on. */
      await api[cfg.value.resource].create({ ...cfg.value.baseFilter, ...form.value })
      toast('Created')
    }
    sheetOpen.value = false
    refreshStats(); load()
  } catch (e) {
    toast('Could not save: ' + (e?.message || 'unknown error'), 'bad')
  } finally { saving.value = false }
}

const cfg = computed(() => props.config)
const title = computed(() => cfg.value?.title || r.meta?.label || 'Screen')

/** Filters become chips, so an applied filter is always visible. */
const chips = computed(() => {
  const f = cfg.value?.filters?.[0]
  if (!f) return []
  return [{ key: 'all', label: 'All' }, ...f.options.map(o => ({ key: o, label: o }))]
})

/**
 * A failed list has to say so.
 *
 * This was unguarded, so a rejected list() left `loading` true and the screen
 * showed its loading skeleton for ever — indistinguishable from a slow query,
 * with the real error only in the console. Adding a store to the local
 * database without bumping its version produced exactly that: a permanent
 * skeleton over a NotFoundError nobody would see. Carrying 54 screens means
 * the quiet version of this failure would have been quiet on all of them.
 */
async function load () {
  if (!cfg.value) { loading.value = false; return }
  loading.value = true
  error.value = ''
  const filters = { ...(cfg.value.baseFilter || {}) }
  const f = cfg.value.filters?.[0]
  if (f && activeFilter.value !== 'all') filters[f.key] = activeFilter.value

  try {
    const res = await api[cfg.value.resource].list({
      page: page.value, perPage: perPage.value,
      sort: sort.value, dir: dir.value,
      search: search.value,
      searchFields: cfg.value.searchFields,
      filters
    })
    rows.value = res.data
    total.value = res.total
  } catch (e) {
    rows.value = []
    total.value = 0
    error.value = e?.message || 'The request failed.'
  } finally {
    loading.value = false
  }
}

function onSort (key, d) { sort.value = key; dir.value = d; page.value = 1; load() }

let searchTimer
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; load() }, 220)
})
watch([page, perPage, activeFilter], load)
watch(() => props.config, () => {
  page.value = 1; search.value = ''; sort.value = ''; activeFilter.value = 'all'; load()
})

/**
 * The bulk action is not always Delete.
 *
 * Blocked Users is the case that proved it: production's only action there is
 * **Unblock**, which removes a lockout rather than destroying a record, and
 * calling that "Delete" misdescribes it badly enough to stop an admin using
 * it. A screen can therefore name its own bulk action; everything else keeps
 * Delete and reads the same as before.
 */
/* Bulk Ops and Graph for the 50-odd screens on this template.
   The operation list is whatever the screen's own bulk action is, so a screen
   that unblocks offers Unblock and not Delete. The graph dimensions are
   derived from the columns: anything that is a status, a boolean or a plain
   short label is worth counting; names, ids and timestamps are not, because
   counting 2,000 distinct values tells you nothing. */
const graphOn = ref(false)

const graphDims = computed(() => (cfg.value?.columns || [])
  .filter(c => c.pill || c.bool || /status|type|profile|category|department|protocol|platform|severity|action|os|kind/i.test(c.key))
  .map(c => ({ key: c.key, label: c.label })))

const bulk = computed(() => ({
  label: 'Delete', past: 'deleted', noun: 'record',
  tone: 'bad', body: 'will be removed. This cannot be undone.',
  ...(cfg.value?.bulkAction || {})
}))

async function removeSelected () {
  const ids = selectedIds.value
  await api[cfg.value.resource].removeMany(ids)
  confirmOpen.value = false
  table.value?.clearSelection()
  toast(`${ids.length} ${ids.length === 1 ? bulk.value.noun : bulk.value.noun + 's'} ${bulk.value.past}`)
  refreshStats()
  load()
}

/**
 * A screen's own toolbar action.
 *
 * Sync and metadata exchange are backend work with no offline equivalent, so
 * rather than miming success these say what they would do and what they
 * depend on. A fake "Synced 412 users" would be the one thing on this screen
 * that is not true.
 */
/**
 * A picker can narrow on what has already been filled in.
 *
 * An application group of type WEB should offer web applications and nothing
 * else — offering all of them and failing on save is the version that wastes
 * somebody's afternoon. `filters` may therefore be a function of the form.
 */
/**
 * A field's choices can depend on another field.
 *
 * Device policy is the case: a Registry check is a Windows idea, so offering
 * it beside macOS is offering something that cannot work. `options` may
 * therefore be a function of the form, the same way `filters` already is.
 */
function fieldOptions (f) {
  const o = typeof f.options === 'function' ? f.options(form.value) : f.options
  return Array.isArray(o) ? o : []
}

/* Clear a dependent choice that the new parent value no longer offers,
   rather than saving a Registry policy against macOS. */
watch(() => JSON.stringify(form.value), () => {
  for (const f of cfg.value?.form || []) {
    if (typeof f.options !== 'function') continue
    const allowed = fieldOptions(f)
    if (form.value[f.key] && !allowed.includes(form.value[f.key])) form.value[f.key] = ''
  }
})

/** The search and the plot both write straight into the form's own fields. */
function onPickLocation (p) {
  form.value.lat = p.lat
  form.value.lon = p.lon
  if (p.city) form.value.city = p.city
  if (p.countryCode) form.value.countryCode = p.countryCode
  if (!form.value.radiusMetres) form.value.radiusMetres = 500
}

/* Sunday first, matching Date#getDay, so the stored numbers mean what the
   engine thinks they mean. */
const DAYS = [
  { n: 1, label: 'Monday' }, { n: 2, label: 'Tuesday' }, { n: 3, label: 'Wednesday' },
  { n: 4, label: 'Thursday' }, { n: 5, label: 'Friday' },
  { n: 6, label: 'Saturday' }, { n: 0, label: 'Sunday' }
]

function toggleDay (key, n) {
  const have = Array.isArray(form.value[key]) ? form.value[key] : []
  form.value[key] = have.includes(n) ? have.filter(x => x !== n) : [...have, n].sort()
}

function pickFilters (f) {
  if (typeof f.filters === 'function') return f.filters(form.value) || {}
  return f.filters || {}
}

function runTool (t) {
  const says = {
    sync: 'Sync would bind to the directory with the stored credentials and pull accounts and group membership. It needs a reachable domain controller, so it does nothing here.',
    'import-idp': 'Import would read an IdP metadata XML file and fill the entity ID, sign-in URL and certificate from it. Upload is a backend route and is not wired in this demo.',
    'download-sp': 'Download would hand you the SP metadata for this tenant to give to the identity provider. It is generated server-side.'
  }[t.key]
  toast(says || `${t.label} is wired in a later phase.`)
}

function onRowAction (row) {
  toast(`${cfg.value.rowAction.label} — ${row.name || row.id}. Wired in a later phase.`)
}

/** Names the objects in the confirm, which production never does. */
const confirmBody = computed(() => {
  const names = rows.value
    .filter(x => selectedIds.value.includes(x.id))
    .map(x => x.name || x.username || x.id)
  const shown = names.slice(0, 3).join(', ')
  const rest = names.length - 3
  return rest > 0 ? `${shown} and ${rest} more` : shown
})

onMounted(load)
</script>

<template>
  <div class="i-page">
    <!-- a route with no config yet: say so plainly -->
    <template v-if="!cfg">
      <PageHeader :title="title" />
      <EmptyState
        icon="fa-screwdriver-wrench"
        title="Not built yet"
        :body="`${r.path} is a real route in the console and is in the plan — see SCOPE.md for which phase it lands in. Nothing here is faked in the meantime.`"
      />
    </template>

    <template v-else>
      <PageHeader :title="cfg.title" :subtitle="cfg.subtitle">
      </PageHeader>

      <!-- Search leads, the actions sit against it, the filters follow.
           The page header above carries the title and one line of context and
           nothing else: a title competing with two buttons is a title that
           stops being read. -->
      <div class="i-strip">
        <label class="i-search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input v-model="search" type="search" :placeholder="`Search ${cfg.title.toLowerCase()}`">
          <button
            v-if="search" type="button" class="i-sclear"
            aria-label="Clear search" @click.prevent="search = ''"
          ><i class="fa-solid fa-xmark" aria-hidden="true" /></button>
        </label>

        <div class="i-tools">
          <button class="i-btn" title="Download this list as CSV">
            <i class="fa-solid fa-download" aria-hidden="true" />
            <span class="d-none d-sm-inline">Export</span>
          </button>
          <!-- Actions that belong to one screen rather than to every screen.
               Sync Now on a directory profile, Import IDP Metadata on SAML:
               velto puts these in the toolbar and they are the reason each
               protocol needs its own screen rather than a filter chip. -->
          <button
            v-for="t in (cfg.tools || [])" :key="t.key"
            class="i-btn" @click="runTool(t)"
          >
            <i v-if="t.icon" class="fa-solid" :class="t.icon" aria-hidden="true" />
            <span class="d-none d-lg-inline">{{ t.label }}</span>
          </button>
          <!-- Bulk Ops is users and devices only: those are the two velto
               offers it on, and a CSV of access-rule names is not a thing
               anybody has. Graph is offered wherever there is a field worth
               grouping by. -->
          <ListTools
            v-model:graph="graphOn"
            :rows="rows" :dimensions="graphDims" :total="total"
          />
          <button v-if="cfg.primaryAction && editable" class="i-btn i-primary" @click="openAdd">
            <i class="fa-solid fa-plus" aria-hidden="true" /> {{ cfg.primaryAction }}
          </button>
        </div>

        <div v-if="chips.length" class="i-ftabs">
          <button
            v-for="c in chips" :key="c.key"
            class="i-chip" :class="{ 'is-on': activeFilter === c.key }"
            :aria-pressed="activeFilter === c.key"
            @click="activeFilter = c.key"
          >{{ c.label }}</button>
        </div>
      </div>

      <GraphView
        v-if="graphOn"
        :rows="rows" :dimensions="graphDims" :total="total"
        label-key="name"
      />

      <DataTable
        v-else
      ref="table"
        :columns="cfg.columns"
        :rows="rows"
        :total="total"
        :loading="loading"
        v-model:page="page"
        v-model:perPage="perPage"
        :sort="sort" :dir="dir"
        :row-action="cfg.rowAction"
        @sort="onSort"
        @selection="selectedIds = $event"
        @row-action="onRowAction"
        @row-click="openEdit"
      >
        <template #bulk>
          <button
            class="i-btn i-sm" :class="bulk.tone === 'bad' ? 'i-danger' : 'i-primary'"
            @click="confirmOpen = true"
          >{{ bulk.label }}</button>
        </template>

        <template #empty>
          <EmptyState
            v-if="error"
            icon="fa-triangle-exclamation"
            title="This list could not be loaded"
            :body="error"
            action-label="Try again"
            @action="load"
          />
          <EmptyState
            v-else
            :icon="search ? 'fa-magnifying-glass' : 'fa-inbox'"
            :title="search ? `Nothing matches “${search}”` : (cfg.emptyTitle || `No ${cfg.title.toLowerCase()} yet`)"
            :body="search
              ? 'Try a shorter term, or clear the search to see everything.'
              : (cfg.emptyBody || 'Nothing has been added here yet.')"
            :action-label="search ? 'Clear search' : (cfg.primaryAction || '')"
            @action="search ? (search = '') : openAdd()"
          />
        </template>
      </DataTable>
    </template>

    <Sheet
      v-if="editable"
      v-model:open="sheetOpen"
      :title="(editingId ? 'Edit ' : 'Add ') + (cfg.singular || 'record')"
      :subtitle="cfg.formSubtitle || ''"
    >
      <div class="i-formsec">
        <div
          v-for="(fieldRow, ri) in formRows" :key="'row' + ri"
          class="i-frow"
          :style="{ gridTemplateColumns: fieldRow.length > 1 ? '1fr 1fr' : '1fr' }"
        >
        <div v-for="f in fieldRow" :key="f.key" v-show="visible(f)" style="min-width:0">
          <!-- A field that picks from a collection gets a searchable picker,
               not a select. Membership is edited here, inside the parent's
               form, so a group and the users in it are one object you save
               once. -->
          <!-- A toggle per day. The `days` array was in the model and in the
               table and had no control anywhere, so a schedule could be
               created without days and would then match nothing, for ever. -->
          <div v-if="f.type === 'days'" class="i-field">
            <label>{{ f.label }}<span v-if="f.required" class="i-req">*</span></label>
            <div class="i-days">
              <label v-for="d in DAYS" :key="d.n" class="i-sw">
                <input
                  type="checkbox"
                  :checked="(form[f.key] || []).includes(d.n)"
                  @change="toggleDay(f.key, d.n)"
                ><span class="i-track" />{{ d.label }}
              </label>
            </div>
            <p v-if="f.hint" class="i-hint">{{ f.hint }}</p>
          </div>

          <TimeWindow
            v-else-if="f.type === 'timewindow'"
            :start="form[f.startKey]"
            :end="form[f.endKey]"
            @update:start="form[f.startKey] = $event"
            @update:end="form[f.endKey] = $event"
          />
          <LocationPicker
            v-else-if="f.type === 'location'"
            :lat="form.lat" :lon="form.lon" :radius="form.radiusMetres"
            @pick="onPickLocation"
          />
          <PickList
            v-else-if="f.type === 'pick'"
            v-model="form[f.key]"
            :resource="f.resource" :filters="pickFilters(f)"
            :options="f.choices || null"
            :multiple="f.multiple !== false"
            :label="f.label" :required="f.required"
            :placeholder="f.placeholder || 'Search…'"
            :hint="f.hint || ''"
            :label-key="f.labelKey || 'name'"
            :value-key="f.valueKey || 'id'"
            :hint-key="f.hintKey || ''"
          />
          <!-- A field that is only an explanation. Device Inventory asks for
               nothing, and saying so is better than an empty space where
               every other template has a control. -->
          <p v-else-if="f.type === 'note'" class="i-hint">{{ f.hint }}</p>

          <div v-else class="i-field">
            <label v-if="f.type !== 'switch'" :for="'rf_' + f.key">
              {{ f.label }}<span v-if="f.required" class="i-req">*</span>
            </label>
            <label v-if="f.type === 'switch'" class="i-sw">
              <input type="checkbox" :name="f.name || f.key" v-model="form[f.key]" :disabled="!!locked(f)">
              <span class="i-track" />{{ f.label }}
            </label>
            <select
              v-else-if="f.options" :id="'rf_' + f.key" :name="f.name || f.key" class="i-ctl"
              v-model="form[f.key]" :disabled="!!locked(f)"
            >
              <!-- A select that carries a default is never empty in velto,
                   so it does not offer an empty choice either. -->
              <option v-if="f.default === undefined" value="">Select…</option>
              <option v-for="o in fieldOptions(f)" :key="o">{{ o }}</option>
            </select>
            <textarea
              v-else-if="f.type === 'textarea'" :id="'rf_' + f.key" :name="f.name || f.key" class="i-ctl i-tech"
              rows="4" v-model="form[f.key]" :placeholder="f.placeholder || ''"
              :disabled="!!locked(f)"
            />
            <!-- An upload: a button over a hidden input, and the filename
                 beside it read-only because it comes from the file. -->
            <template v-else-if="f.type === 'file'">
              <div class="d-flex align-items-center gap-2">
                <label class="i-filepick mb-0">
                  <input type="file" :accept="f.accept" @change="onFile(f, $event)">
                  <i class="fa-solid fa-upload" aria-hidden="true" />
                  <span>{{ form[f.key] ? 'Replace file' : (f.uploadLabel || 'Upload file') }}</span>
                </label>
                <input
                  :id="'rf_' + f.key" class="i-ctl i-tech" type="text" readonly
                  :value="form[f.key] || ''" :placeholder="f.placeholder || 'No file chosen'"
                  :aria-label="f.label + ' filename'"
                >
              </div>
            </template>
            <input
              v-else :id="'rf_' + f.key" :name="f.name || f.key" class="i-ctl"
              :type="f.type || 'text'" v-model="form[f.key]" :placeholder="f.placeholder || ''"
              :disabled="!!locked(f)"
            >
            <p v-if="locked(f)" class="i-hint">{{ locked(f) }}</p>
            <p v-else-if="f.hint" class="i-hint">{{ f.hint }}</p>
          </div>
        </div>
        </div>
      </div>
      <!-- Velto's Change Password / Change Client Secret: its own button,
           never a field on the form. -->
      <div v-if="secretActions.length" class="i-formsec">
        <div v-for="a in secretActions" :key="a.key" class="i-field">
          <label>{{ a.label }}</label>
          <div>
            <button class="i-btn i-sm" @click="openSecret(a)">
              <i class="fa-solid fa-key me-1" aria-hidden="true" />{{ a.label }}
            </button>
          </div>
          <p class="i-hint">{{ secretState(a) }}</p>
        </div>
      </div>

      <div v-if="cfg.aclPanel && editingId" class="i-formsec">
        <h3>Access rules</h3>
        <p class="i-secsub">
          {{ aclsLoading
            ? 'Loading…'
            : (relatedAcls.length
              ? `${relatedAcls.length} rule${relatedAcls.length === 1 ? '' : 's'} name this group as their source.`
              : 'No rule names this group as its source, so membership on its own reaches nothing.') }}
        </p>
        <button v-if="relatedAcls.length" class="i-btn i-sm" @click="aclsOpen = true">
          <i class="fa-solid fa-list me-1" aria-hidden="true" />View Acls
        </button>
        <RouterLink v-else class="i-btn i-sm" to="/access-rules">Write a rule for it</RouterLink>
      </div>

      <template #footer>
        <button class="i-btn i-quiet" @click="sheetOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="saving" @click="saveForm">
            {{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Create') }}
          </button>
        </div>
      </template>
    </Sheet>

    <Sheet
      v-model:open="aclsOpen"
      nested
      width="820px"
      :title="`Access rules for ${form.name}`"
      subtitle="Every rule whose source is this group. This is what membership buys."
    >
      <div class="table-responsive">
        <table class="i-table">
          <thead>
            <tr>
              <th>Acl Name</th><th>Source Type</th><th>Source</th>
              <th>Destination</th><th>Service</th><th>Protocol</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in relatedAcls" :key="a.id">
              <td class="fw-medium">{{ a.name }}</td>
              <td>{{ a.sourceType }}</td>
              <td>{{ a.source }}</td>
              <td class="i-tech">{{ a.dest }}</td>
              <td>{{ a.service || 'ANY' }}</td>
              <td>{{ a.protocol || 'ANY' }}</td>
              <td>
                <span class="i-pill" :class="a.action === 'allow' ? '' : 'i-bad'">
                  <span v-if="a.action === 'allow'" class="i-dot i-ok" />{{ a.action }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="i-hint mt-2">
        Velto prints the destination, the service and the protocol into a
        single cell as a sentence. They are three facts, so they are three
        columns.
      </p>
      <template #footer>
        <button class="i-btn i-quiet" @click="aclsOpen = false">Close</button>
        <div class="i-right">
          <RouterLink class="i-btn" to="/access-explorer">Explain an access decision</RouterLink>
        </div>
      </template>
    </Sheet>

    <Sheet
      v-if="secretActive"
      v-model:open="secretOpen"
      nested
      :title="secretActive.label"
      :subtitle="`The ${secretActive.noun} is not shown again once saved.`"
    >
      <div v-if="secretActive.type === 'file'" class="i-formsec">
        <div class="i-field">
          <label for="secret_file">{{ secretActive.fileLabel || 'Key file' }}<span class="i-req">*</span></label>
          <div class="d-flex align-items-center gap-2">
            <label class="i-filepick mb-0">
              <input id="secret_file" type="file" :accept="secretActive.accept" @change="onSecretFile">
              <i class="fa-solid fa-upload" aria-hidden="true" />
              <span>{{ secretFile ? 'Replace file' : 'Upload file' }}</span>
            </label>
            <input
              class="i-ctl i-tech" type="text" readonly
              :value="secretFile" placeholder="No file chosen"
              aria-label="Chosen filename"
            >
          </div>
          <p class="i-hint">
            {{ secretActive.accept }} only. The filename is taken from the file;
            its contents are stored and never shown again.
          </p>
        </div>
        <p class="i-demo-note">
          There is nothing here to hand this to, so the file is not kept —
          only its name, and when it was uploaded.
        </p>
      </div>

      <div v-else class="i-formsec">
        <div class="i-field">
          <label for="secret_new">New {{ secretActive.noun }}<span class="i-req">*</span></label>
          <input
            id="secret_new" class="i-ctl" type="password" autocomplete="new-password"
            v-model="secretNew"
          >
          <p class="i-hint">At least 8 characters.</p>
        </div>
        <div class="i-field">
          <label for="secret_confirm">Confirm {{ secretActive.noun }}<span class="i-req">*</span></label>
          <input
            id="secret_confirm" class="i-ctl" type="password" autocomplete="new-password"
            v-model="secretConfirm"
          >
          <p v-if="secretConfirm && secretNew !== secretConfirm" class="i-hint">
            These two do not match yet.
          </p>
        </div>
        <p class="i-demo-note">
          There is nothing here to hand this to, so the value is not stored —
          only the fact that one was set, and when.
        </p>
      </div>
      <template #footer>
        <button class="i-btn i-quiet" @click="secretOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="secretSaving" @click="saveSecret">
            {{ secretSaving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </template>
    </Sheet>

    <!-- the licence wall -->
    <ConfirmModal
      v-if="cfg?.limit"
      v-model:open="limitHit"
      :title="cfg.limit.title"
      :confirm-label="cfg.limit.action"
      @confirm="limitHit = false"
    >
      {{ cfg.limit.body }}
      Raising it is a commercial change rather than a setting, so there is
      nothing on this screen that would let you past it.
    </ConfirmModal>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="`${bulk.label} ${selectedIds.length} ${selectedIds.length === 1 ? bulk.noun : bulk.noun + 's'}?`"
      :confirm-label="`${bulk.label} ${selectedIds.length}`"
      @confirm="removeSelected"
    >
      <strong class="i-named">{{ confirmBody }}</strong> {{ bulk.body }}
    </ConfirmModal>
  </div>
</template>
