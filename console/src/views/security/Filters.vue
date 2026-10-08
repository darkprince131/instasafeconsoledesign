<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'
import Sheet from '../../components/ui/Sheet.vue'
import {
  URL_TYPES, CONTENT_CATEGORIES, FILETYPE_CATEGORIES,
  EXTENSIONS_BY_CATEGORY, SUBCATEGORIES_BY_CATEGORY, CATEGORY_NOTES
} from '../../lib/filter-catalog.js'

/**
 * Filters — URL, content, file type and domain lists.
 *
 * Four routes, one component, but NOT one form. Each type has its own field
 * set, taken from the captured production pages:
 *
 *   URL         name, url type (Exact | Wildcard | Regex), url
 *   Content     name, category
 *   File type   name, category, then the extensions that category reveals
 *   Domain list name, and a textarea of domains
 *
 * The file-type cascade is the behaviour worth getting right: choosing Media
 * Files offers mp3, mp4 and so on, Executables offers exe and msi. Extensions
 * are chosen, not typed, except under Custom.
 *
 * The tester underneath evaluates for real, in priority order, and names the
 * rule that decided.
 */

const route = useRoute()
const toast = inject('toast', () => {})

const KINDS = {
  '/url-filter': {
    resource: 'urlFilters', title: 'URL filter', singular: 'URL rule',
    subtitle: 'Matched against the address a user requests.',
    probe: 'https://facebook.com/feed', testLabel: 'Test a URL',
    cols: [
      { key: 'urlType', label: 'Match type',
        cell: (v) => URL_TYPES.find(t => t.value === v)?.label || v },
      { key: 'url', label: 'URL', mono: true }
    ]
  },
  '/content-filter': {
    resource: 'contentFilters', title: 'Content filter', singular: 'content rule',
    subtitle: 'Matched against the sub-category a destination is classified into. The category only narrows which sub-categories a rule can name.',
    probe: 'Social Networking', testLabel: 'Test a sub-category',
    cols: [
      { key: 'category', label: 'Category' },
      { key: 'subCategories', label: 'Sub categories',
        cell: (v) => Array.isArray(v) ? v.join(', ') : (v || '—') }
    ]
  },
  '/filetype-filter': {
    resource: 'fileTypeFilters', title: 'File type filter', singular: 'file type rule',
    subtitle: 'Matched against the extension of a file being transferred.',
    probe: 'quarterly-report.exe', testLabel: 'Test a filename',
    cols: [
      { key: 'category', label: 'Category' },
      { key: 'extensions', label: 'Extensions', mono: true,
        cell: (v) => Array.isArray(v) ? v.join(', ') : (v || '—') }
    ]
  },
  '/domainlists': {
    resource: 'domainLists', title: 'Domain lists', singular: 'domain list',
    subtitle: 'Named groups of domains that rules and filters can point at.',
    probe: 'mail.google.com', testLabel: 'Test a domain',
    cols: [
      { key: 'list', label: 'Domains', mono: true,
        cell: (v) => { const a = String(v || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
          return a.length > 3 ? a.slice(0, 3).join(', ') + ` +${a.length - 3}` : a.join(', ') } }
    ]
  }
}

const cfg = computed(() => KINDS[route.path] || KINDS['/url-filter'])
const isFileType = computed(() => route.path === '/filetype-filter')
const isContent = computed(() => route.path === '/content-filter')
const isDomain = computed(() => route.path === '/domainlists')
const isUrl = computed(() => route.path === '/url-filter')

const rows = ref([]); const loading = ref(true)
const selectedIds = ref([]); const table = ref(null)
const confirmOpen = ref(false); const sheetOpen = ref(false)
const saving = ref(false); const editingId = ref(null)
const form = ref(blank())
const probe = ref(''); const result = ref(null)
const customExt = ref('')

function blank () {
  return {
    name: '', action: 'block', priority: null, enabled: true,
    urlType: 'wildcard', url: '',
    category: '', subCategories: [], extensions: [], list: ''
  }
}

/** Extensions offered for the chosen file-type category. Custom offers none. */
const offered = computed(() => EXTENSIONS_BY_CATEGORY[form.value.category] || [])
/** Sub-categories offered for the chosen content category. */
const offeredSubs = computed(() => SUBCATEGORIES_BY_CATEGORY[form.value.category] || [])
const categoryNote = computed(() => CATEGORY_NOTES[form.value.category] || '')

// changing category clears a selection that no longer belongs to it
watch(() => form.value.category, (c, old) => {
  if (old !== undefined && c !== old) {
    form.value.extensions = []
    form.value.subCategories = []
  }
})

function toggleSub (v) {
  const set = new Set(form.value.subCategories || [])
  set.has(v) ? set.delete(v) : set.add(v)
  form.value.subCategories = [...set]
}

function toggleExt (e) {
  const set = new Set(form.value.extensions || [])
  set.has(e) ? set.delete(e) : set.add(e)
  form.value.extensions = [...set]
}
function selectAllExt () { form.value.extensions = [...offered.value] }
function addCustomExt () {
  // normalise to the leading-dot form production stores
  const parts = customExt.value.split(/[\s,]+/)
    .map(s => s.trim().toLowerCase().replace(/^\.*/, ''))
    .filter(Boolean).map(s => '.' + s)
  form.value.extensions = [...new Set([...(form.value.extensions || []), ...parts])]
  customExt.value = ''
}

const columns = computed(() => [
  { key: 'priority', label: '#', mono: true, align: 'right' },
  { key: 'name', label: 'Name', bold: true },
  ...cfg.value.cols,
  { key: 'action', label: 'Action',
    cell: (v) => v === 'block' ? 'Block' : 'Allow',
    pill: (v) => v === 'block' ? 'bad' : null },
  { key: 'enabled', label: 'Enabled', bool: true }
])

async function load () {
  loading.value = true
  const res = await api[cfg.value.resource].list({ perPage: 0, sort: 'priority', dir: 'asc' })
  rows.value = res.data
  loading.value = false
  if (probe.value) test()
}

/** The matcher, per filter type. */
function matches (rule, subject) {
  /* Content matches on the sub-category, not the category. The category only
     decides which sub-categories a rule may name. */
  if (isContent.value) {
    return (rule.subCategories || []).includes(subject)
  }
  if (isFileType.value) {
    // extensions are stored with their dot, so compare in that form
    const ext = '.' + String(subject).split('.').pop().toLowerCase()
    return (rule.extensions || []).map(e => e.toLowerCase()).includes(ext)
  }
  if (isDomain.value) {
    return String(rule.list || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
      .some(d => d.startsWith('.')
        ? subject.toLowerCase().endsWith(d.toLowerCase()) || subject.toLowerCase() === d.slice(1).toLowerCase()
        : subject.toLowerCase() === d.toLowerCase())
  }
  // URL: the match type decides how, and every other character is escaped so
  // a dot in a hostname matches a dot rather than any character
  const p = String(rule.url || '').trim()
  if (!p) return false
  if (rule.urlType === 'exact') return subject === p
  if (rule.urlType === 'regex') { try { return new RegExp(p, 'i').test(subject) } catch { return false } }
  const rx = new RegExp('^' + p.split('*')
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i')
  return rx.test(subject)
}

function test () {
  const subject = probe.value.trim()
  if (!subject) { result.value = null; return }
  const considered = []
  let decided = null
  for (const r of [...rows.value].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))) {
    if (!r.enabled) { considered.push({ ...r, matched: false }); continue }
    const hit = matches(r, subject)
    considered.push({ ...r, matched: hit, shadowedBy: hit && decided ? decided.priority : null })
    if (hit && !decided) decided = r
  }
  result.value = {
    outcome: decided ? decided.action : 'allow',
    because: decided
      ? `Rule #${decided.priority} "${decided.name}" (${decided.action})`
      : 'No rule matched. Anything not matched is allowed.',
    considered
  }
}

watch(probe, test)
watch(() => route.path, () => { probe.value = ''; result.value = null; form.value = blank(); load() })

function openAdd () {
  form.value = blank()
  form.value.priority = (rows.value.length || 0) + 1
  editingId.value = null
  sheetOpen.value = true
}
function openEdit (row) {
  form.value = { ...blank(), ...row, extensions: row.extensions || [], subCategories: row.subCategories || [] }
  editingId.value = row.id
  sheetOpen.value = true
}

const valid = computed(() => {
  if (!form.value.name) return false
  if (isUrl.value) return !!form.value.url
  if (isContent.value) return !!form.value.category && form.value.subCategories.length > 0
  if (isFileType.value) return !!form.value.category && form.value.extensions.length > 0
  if (isDomain.value) return !!String(form.value.list).trim()
  return true
})

async function save () {
  if (!valid.value) { toast('Fill in the required fields', 'bad'); return }
  saving.value = true
  try {
    const body = { ...form.value }
    if (editingId.value) { await api[cfg.value.resource].update(editingId.value, body); toast('Saved') }
    else { await api[cfg.value.resource].create(body); toast('Created') }
    sheetOpen.value = false
    load()
  } catch (e) {
    toast('Could not save: ' + (e?.message || 'unknown error'), 'bad')
  } finally { saving.value = false }
}

async function removeSelected () {
  const n = selectedIds.value.length
  await api[cfg.value.resource].removeMany(selectedIds.value)
  confirmOpen.value = false
  table.value?.clearSelection()
  toast(n + ' deleted')
  load()
}

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader :title="cfg.title" :subtitle="cfg.subtitle">
    </PageHeader>

    <div class="i-strip">
      <div class="i-tools">
        <button class="i-btn"><i class="fa-solid fa-download" aria-hidden="true" /> Export</button>
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add filter
        </button>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-12 col-xl-7">
        <DataTable
          ref="table" :columns="columns" :rows="rows" :total="rows.length"
          :loading="loading" :per-page="50"
          @selection="selectedIds = $event" @row-click="openEdit"
        >
          <template #bulk>
            <button class="i-btn i-sm i-danger" @click="confirmOpen = true">Delete</button>
          </template>
          <template #empty>
            <EmptyState
              icon="fa-filter"
              :title="'No ' + cfg.singular + 's yet'"
              body="With no rules nothing is filtered, and everything is allowed through."
              action-label="Add"
              @action="openAdd"
            />
          </template>
        </DataTable>
      </div>

      <div class="col-12 col-xl-5">
        <div class="i-chead">
          <h2>{{ cfg.testLabel }}</h2>
          <span class="i-meta">Really evaluates</span>
        </div>
        <p style="font-size:12.5px;color:var(--i-dim);margin:0 0 12px">
          Rules run in priority order and the first match decides.
        </p>

        <label v-if="!isContent" class="i-search mb-3" style="min-width:0">
          <i class="fa-solid fa-flask" aria-hidden="true" />
          <input v-model="probe" type="text" :placeholder="cfg.probe">
        </label>
        <select v-else v-model="probe" class="i-ctl mb-3">
          <option value="">Pick a sub-category to test…</option>
          <optgroup v-for="(subs, cat) in SUBCATEGORIES_BY_CATEGORY" :key="cat" :label="cat">
            <option v-for="sc in subs" :key="sc">{{ sc }}</option>
          </optgroup>
        </select>

        <template v-if="result">
          <div class="i-verdict" :class="result.outcome === 'block' ? 'is-block' : 'is-pass'">
            <h3>
              <i class="fa-solid me-2" aria-hidden="true"
                 :class="result.outcome === 'block' ? 'fa-ban' : 'fa-circle-check'" />
              {{ result.outcome === 'block' ? 'Blocked' : 'Allowed' }}
            </h3>
            <p>{{ result.because }}</p>
          </div>
          <div class="mt-3">
            <div
              v-for="r in result.considered.filter(c => c.matched)" :key="r.id"
              class="i-trace" :class="{ 'is-hit': !r.shadowedBy, 'is-shadowed': r.shadowedBy }"
            >
              <div class="d-flex align-items-center gap-2">
                <span class="i-tech" style="font-size:11px">#{{ r.priority }}</span>
                <span class="i-trace-name">{{ r.name }}</span>
                <span v-if="r.shadowedBy" class="ms-auto" style="font-size:11px;color:var(--i-mute)">
                  shadowed by #{{ r.shadowedBy }}
                </span>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="i-demo-note">
          <template v-if="isFileType">
            Try <code class="i-tech">report.exe</code> against an Executables rule, then
            <code class="i-tech">report.pdf</code>. Only the extensions you selected match.
          </template>
          <template v-else-if="isUrl">
            Wildcards compile to a regular expression with every other character escaped,
            so a dot in a hostname matches a dot and not any character.
          </template>
          <template v-else>Pick something above to evaluate it against the rules.</template>
        </div>
      </div>
    </div>

    <!-- ============ the add form, which differs per filter type ============ -->
    <Sheet
      v-model:open="sheetOpen"
      :title="(editingId ? 'Edit ' : 'Add ') + cfg.singular"
      :subtitle="cfg.subtitle"
      width="580px"
    >
      <div class="i-formsec">
        <div class="i-frow" style="grid-template-columns:2fr 1fr">
          <div class="i-field">
            <label for="fn">Name <span class="i-req">*</span></label>
            <input id="fn" class="i-ctl" v-model="form.name" placeholder="Block social media">
          </div>
          <div class="i-field">
            <label for="fp">Priority</label>
            <input id="fp" class="i-ctl" type="number" v-model.number="form.priority">
            <p class="i-hint">Lower runs first.</p>
          </div>
        </div>
      </div>

      <!-- URL -->
      <div v-if="isUrl" class="i-formsec">
        <h3>What to match</h3>
        <div class="i-frow" style="grid-template-columns:1fr">
          <div class="i-field">
            <label for="ut">URL type</label>
            <select id="ut" class="i-ctl" v-model="form.urlType">
              <option v-for="t in URL_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
            <p class="i-hint">{{ URL_TYPES.find(t => t.value === form.urlType)?.hint }}</p>
          </div>
          <div class="i-field">
            <label for="fu">URL <span class="i-req">*</span></label>
            <input id="fu" class="i-ctl" v-model="form.url"
                   :placeholder="form.urlType === 'regex' ? '^https://.*\\.example\\.com/' : '*.facebook.com/*'">
          </div>
        </div>
      </div>

      <!-- content: category only narrows the list; the sub-category filters -->
      <div v-if="isContent" class="i-formsec">
        <h3>Category and sub-categories</h3>
        <p class="i-secsub">
          The category is not what filters. It chooses which of the 49
          sub-categories you can pick from, and those are what a destination is
          matched against.
        </p>
        <div class="i-frow" style="grid-template-columns:1fr">
          <div class="i-field">
            <label for="cc">Content category <span class="i-req">*</span></label>
            <select id="cc" class="i-ctl" v-model="form.category">
              <option value="">Select Category</option>
              <option v-for="c in CONTENT_CATEGORIES" :key="c">{{ c }}</option>
            </select>
          </div>
        </div>

        <template v-if="offeredSubs.length">
          <div class="d-flex align-items-center gap-2 mb-2 mt-3">
            <span style="font-size:12.5px;font-weight:450;color:var(--i-dim)">
              Sub categories <span class="i-req">*</span>
            </span>
            <span style="font-size:11.5px;color:var(--i-mute)">
              {{ form.subCategories.length }} of {{ offeredSubs.length }} selected
            </span>
            <button
              class="i-btn i-sm i-quiet ms-auto"
              @click="form.subCategories = [...offeredSubs]"
            >Select all</button>
            <button class="i-btn i-sm i-quiet" @click="form.subCategories = []">Clear</button>
          </div>
          <div class="d-flex flex-wrap gap-1">
            <button
              v-for="sc in offeredSubs" :key="sc"
              class="i-chip" :class="{ 'is-on': form.subCategories.includes(sc) }"
              :aria-pressed="form.subCategories.includes(sc)"
              @click="toggleSub(sc)"
            >{{ sc }}</button>
          </div>
          <p class="i-hint mt-2">
            Production renders this as a multi-select that tells you to hold Ctrl.
          </p>
        </template>
      </div>

      <!-- file type: the cascade -->
      <div v-if="isFileType" class="i-formsec">
        <h3>Category and extensions</h3>
        <p class="i-secsub">Picking a category offers the extensions it covers.</p>
        <div class="i-frow" style="grid-template-columns:1fr">
          <div class="i-field">
            <label for="fc">Category <span class="i-req">*</span></label>
            <select id="fc" class="i-ctl" v-model="form.category">
              <option value="">Select Category</option>
              <option v-for="c in FILETYPE_CATEGORIES" :key="c">{{ c }}</option>
            </select>
            <p v-if="categoryNote" class="i-hint">{{ categoryNote }}</p>
          </div>
        </div>

        <template v-if="form.category && offered.length">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span style="font-size:12.5px;font-weight:450;color:var(--i-dim)">
              Extensions <span class="i-req">*</span>
            </span>
            <span style="font-size:11.5px;color:var(--i-mute)">
              {{ form.extensions.length }} of {{ offered.length }} selected
            </span>
            <button class="i-btn i-sm i-quiet ms-auto" @click="selectAllExt">Select all</button>
            <button class="i-btn i-sm i-quiet" @click="form.extensions = []">Clear</button>
          </div>
          <div class="d-flex flex-wrap gap-1">
            <button
              v-for="e in offered" :key="e"
              class="i-chip" :class="{ 'is-on': form.extensions.includes(e) }"
              :aria-pressed="form.extensions.includes(e)"
              @click="toggleExt(e)"
            >{{ e }}</button>
          </div>
        </template>

        <div v-if="form.category === 'Custom' || form.category" class="i-field mt-3">
          <label for="ce">{{ form.category === 'Custom' ? 'Extensions' : 'Add another extension' }}</label>
          <div class="d-flex gap-2">
            <input
              id="ce" class="i-ctl" v-model="customExt" placeholder="docm, iso"
              @keyup.enter="addCustomExt"
            >
            <button class="i-btn" @click="addCustomExt">Add</button>
          </div>
          <p class="i-hint">Without the dot. Comma separated.</p>
          <div v-if="form.category === 'Custom' && form.extensions.length" class="d-flex flex-wrap gap-1 mt-2">
            <button
              v-for="e in form.extensions" :key="e"
              class="i-chip is-on" @click="toggleExt(e)"
            >.{{ e }} <i class="fa-solid fa-xmark" style="font-size:9px" aria-hidden="true" /></button>
          </div>
        </div>
      </div>

      <!-- domain list -->
      <div v-if="isDomain" class="i-formsec">
        <h3>Domains</h3>
        <div class="i-frow" style="grid-template-columns:1fr">
          <div class="i-field">
            <label for="dl">Domain list <span class="i-req">*</span></label>
            <textarea id="dl" class="i-ctl" rows="7" v-model="form.list"
                      placeholder="example.com&#10;.internal.example.com&#10;mail.google.com" />
            <p class="i-hint">One per line. A leading dot matches every subdomain.</p>
          </div>
        </div>
      </div>

      <div class="i-formsec">
        <h3>Action</h3>
        <div class="d-flex flex-wrap gap-2 mb-2">
          <button class="i-chip" :class="{ 'is-on': form.action === 'block' }"
                  :aria-pressed="form.action === 'block'" @click="form.action = 'block'">Block</button>
          <button class="i-chip" :class="{ 'is-on': form.action === 'allow' }"
                  :aria-pressed="form.action === 'allow'" @click="form.action = 'allow'">Allow</button>
        </div>
        <p class="i-hint">An Allow above a Block is how an exception is written.</p>
        <label class="i-sw mt-3">
          <input type="checkbox" v-model="form.enabled"><span class="i-track" />Rule is enabled
        </label>
      </div>

      <template #footer>
        <button class="i-btn i-quiet" @click="sheetOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="saving || !valid" @click="save">
            {{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Create') }}
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
      Traffic that was being blocked by {{ selectedIds.length === 1 ? 'this rule' : 'these rules' }}
      will be allowed through from the next evaluation.
    </ConfirmModal>
  </div>
</template>
