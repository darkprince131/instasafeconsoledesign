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
    out[f.key] = f.type === 'switch' ? false
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

function openEdit (row) {
  if (!editable.value) return
  form.value = { ...blankForm(), ...row }
  editingId.value = row.id
  sheetOpen.value = true
}

async function saveForm () {
  const required = (cfg.value.form || []).filter(f => f.required && !form.value[f.key])
  if (required.length) { toast(required[0].label + ' is required', 'bad'); return }
  saving.value = true
  try {
    if (editingId.value) {
      await api[cfg.value.resource].update(editingId.value, { ...form.value })
      toast('Saved')
    } else {
      await api[cfg.value.resource].create({ ...form.value })
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
            @action="search ? (search = '') : null"
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
        <div v-for="f in cfg.form" :key="f.key" class="i-frow" style="grid-template-columns:1fr">
          <!-- A field that picks from a collection gets a searchable picker,
               not a select. Membership is edited here, inside the parent's
               form, so a group and the users in it are one object you save
               once. -->
          <LocationPicker
            v-if="f.type === 'location'"
            :lat="form.lat" :lon="form.lon" :radius="form.radiusMetres"
            @pick="onPickLocation"
          />
          <PickList
            v-else-if="f.type === 'pick'"
            v-model="form[f.key]"
            :resource="f.resource" :filters="pickFilters(f)"
            :multiple="f.multiple !== false"
            :label="f.label" :required="f.required"
            :placeholder="f.placeholder || 'Search…'"
            :hint="f.hint || ''"
            :label-key="f.labelKey || 'name'"
            :value-key="f.valueKey || 'id'"
            :hint-key="f.hintKey || ''"
          />
          <div v-else class="i-field">
            <label v-if="f.type !== 'switch'" :for="'rf_' + f.key">
              {{ f.label }}<span v-if="f.required" class="i-req">*</span>
            </label>
            <label v-if="f.type === 'switch'" class="i-sw">
              <input type="checkbox" v-model="form[f.key]"><span class="i-track" />{{ f.label }}
            </label>
            <select v-else-if="f.options" :id="'rf_' + f.key" class="i-ctl" v-model="form[f.key]">
              <option value="">Select…</option>
              <option v-for="o in fieldOptions(f)" :key="o">{{ o }}</option>
            </select>
            <textarea
              v-else-if="f.type === 'textarea'" :id="'rf_' + f.key" class="i-ctl i-tech"
              rows="4" v-model="form[f.key]" :placeholder="f.placeholder || ''"
            />
            <input
              v-else :id="'rf_' + f.key" class="i-ctl"
              :type="f.type || 'text'" v-model="form[f.key]" :placeholder="f.placeholder || ''"
            >
            <p v-if="f.hint" class="i-hint">{{ f.hint }}</p>
          </div>
        </div>
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
