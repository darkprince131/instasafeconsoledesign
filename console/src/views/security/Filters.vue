<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'
import Sheet from '../../components/ui/Sheet.vue'

/**
 * Filters — URL, content, file type and domain lists.
 *
 * Four routes, one component, because they are the same object with a
 * different matcher. What makes the screen worth building rather than
 * listing is the tester: type a URL, a filename or a domain and the rules
 * genuinely evaluate against it, in priority order, and the answer names the
 * rule that decided.
 *
 * A filter you cannot test is a filter somebody finds out about from a
 * support ticket.
 */

const route = useRoute()
const toast = inject('toast', () => {})

const KINDS = {
  '/url-filter': {
    resource: 'urlFilters', title: 'URL filter', singular: 'URL rule',
    subtitle: 'Matched against the full address a user requests.',
    placeholder: 'https://facebook.com/feed',
    patternLabel: 'URL pattern', patternHint: 'Wildcards allowed: *.example.com/* matches any path on any subdomain.',
    testLabel: 'Test a URL'
  },
  '/content-filter': {
    resource: 'contentFilters', title: 'Content filter', singular: 'content category',
    subtitle: 'Matched against the category a destination is classified into.',
    placeholder: 'social-media',
    patternLabel: 'Category', patternHint: 'One category per rule.',
    testLabel: 'Test a category'
  },
  '/filetype-filter': {
    resource: 'fileTypeFilters', title: 'File type filter', singular: 'file type rule',
    subtitle: 'Matched against the extension of a file being transferred.',
    placeholder: 'quarterly-report.exe',
    patternLabel: 'Extension', patternHint: 'Without the dot: exe, zip, docm.',
    testLabel: 'Test a filename'
  },
  '/domainlists': {
    resource: 'domainLists', title: 'Domain lists', singular: 'domain list',
    subtitle: 'Named groups of domains that rules and filters can point at.',
    placeholder: 'mail.google.com',
    patternLabel: 'Domains', patternHint: 'Comma separated. A leading dot matches subdomains.',
    testLabel: 'Test a domain'
  }
}

const cfg = computed(() => KINDS[route.path] || KINDS['/url-filter'])

const rows = ref([]); const loading = ref(true)
const selectedIds = ref([]); const table = ref(null)
const confirmOpen = ref(false)
const sheetOpen = ref(false)
const saving = ref(false)
const editingId = ref(null)
const form = ref(blank())

const probe = ref('')
const result = ref(null)

function blank () {
  return { name: '', pattern: '', action: 'block', priority: null, enabled: true, notes: '' }
}

const columns = computed(() => [
  { key: 'priority', label: '#', mono: true, align: 'right' },
  { key: 'name', label: 'Rule', bold: true },
  { key: 'pattern', label: cfg.value.patternLabel, mono: true },
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

/**
 * The matcher. Glob-style wildcards compiled to a regular expression, with
 * every other character escaped so a dot in a hostname cannot act as "any
 * character" — which is the classic way a naive filter lets through exactly
 * what it was meant to stop.
 */
function matches (pattern, subject, kind) {
  const pats = kind === 'domainLists'
    ? String(pattern).split(',').map(p => p.trim()).filter(Boolean)
    : [String(pattern).trim()]

  return pats.some(p => {
    if (!p) return false
    if (kind === 'fileTypeFilters') {
      return subject.toLowerCase().endsWith('.' + p.replace(/^\./, '').toLowerCase())
    }
    if (kind === 'domainLists' && p.startsWith('.')) {
      return subject.toLowerCase().endsWith(p.toLowerCase()) ||
             subject.toLowerCase() === p.slice(1).toLowerCase()
    }
    const rx = new RegExp(
      '^' + p.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$',
      'i'
    )
    return rx.test(subject) || (!p.includes('*') && subject.toLowerCase().includes(p.toLowerCase()))
  })
}

function test () {
  const subject = probe.value.trim()
  if (!subject) { result.value = null; return }
  const considered = []
  let decided = null
  for (const r of [...rows.value].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))) {
    if (!r.enabled) { considered.push({ ...r, matched: false, skipped: 'disabled' }); continue }
    const hit = matches(r.pattern, subject, cfg.value.resource)
    considered.push({ ...r, matched: hit, shadowedBy: hit && decided ? decided.priority : null })
    if (hit && !decided) decided = r
  }
  result.value = {
    subject,
    outcome: decided ? decided.action : 'allow',
    because: decided
      ? `Rule #${decided.priority} "${decided.name}" (${decided.action})`
      : 'No rule matched. Anything not matched is allowed.',
    considered
  }
}

watch(probe, test)
watch(() => route.path, () => {
  probe.value = ''; result.value = null; load()
})

function openAdd () {
  form.value = blank()
  form.value.priority = (rows.value.length || 0) + 1
  editingId.value = null
  sheetOpen.value = true
}
function openEdit (row) {
  form.value = { ...blank(), ...row }
  editingId.value = row.id
  sheetOpen.value = true
}

async function save () {
  if (!form.value.name || !form.value.pattern) {
    toast('Name and ' + cfg.value.patternLabel.toLowerCase() + ' are required', 'bad'); return
  }
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
      <template #actions>
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add rule
        </button>
      </template>
    </PageHeader>

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
              action-label="Add rule"
              @action="openAdd"
            />
          </template>
        </DataTable>
      </div>

      <!-- the tester -->
      <div class="col-12 col-xl-5">
        <div class="i-chead">
          <h2>{{ cfg.testLabel }}</h2>
          <span class="i-meta">Really evaluates</span>
        </div>
        <p style="font-size:12.5px;color:var(--i-dim);margin:0 0 12px">
          Rules run in priority order and the first match decides.
        </p>

        <label class="i-search mb-3" style="min-width:0">
          <i class="fa-solid fa-flask" aria-hidden="true" />
          <input v-model="probe" type="text" :placeholder="cfg.placeholder">
        </label>

        <template v-if="result">
          <div class="i-verdict" :class="result.outcome === 'block' ? 'is-block' : 'is-pass'">
            <h3>
              <i
                class="fa-solid me-2" aria-hidden="true"
                :class="result.outcome === 'block' ? 'fa-ban' : 'fa-circle-check'"
              />
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
                <code class="i-tech" style="font-size:11px">{{ r.pattern }}</code>
                <span v-if="r.shadowedBy" class="ms-auto" style="font-size:11px;color:var(--i-mute)">
                  shadowed by #{{ r.shadowedBy }}
                </span>
              </div>
            </div>
            <p
              v-if="!result.considered.some(c => c.matched)"
              style="font-size:12.5px;color:var(--i-mute)"
            >
              Nothing matched, so the default applies.
            </p>
          </div>
        </template>

        <div v-else class="i-demo-note">
          Type something above. Wildcards in a pattern are compiled to a regular
          expression with every other character escaped, so a dot in a hostname
          matches a dot and not any character — which is the usual way a filter
          lets through the thing it was written to stop.
        </div>
      </div>
    </div>

    <Sheet
      v-model:open="sheetOpen"
      :title="(editingId ? 'Edit ' : 'Add ') + cfg.singular"
      :subtitle="cfg.subtitle"
    >
      <div class="i-formsec">
        <div class="i-frow" style="grid-template-columns:2fr 1fr">
          <div class="i-field">
            <label for="fn">Rule name <span class="i-req">*</span></label>
            <input id="fn" class="i-ctl" v-model="form.name" placeholder="Block social media">
          </div>
          <div class="i-field">
            <label for="fp">Priority</label>
            <input id="fp" class="i-ctl" type="number" v-model.number="form.priority">
            <p class="i-hint">Lower runs first.</p>
          </div>
        </div>
        <div class="i-frow" style="grid-template-columns:1fr">
          <div class="i-field">
            <label for="fpat">{{ cfg.patternLabel }} <span class="i-req">*</span></label>
            <input id="fpat" class="i-ctl" v-model="form.pattern" :placeholder="cfg.placeholder">
            <p class="i-hint">{{ cfg.patternHint }}</p>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2 mb-2">
          <button
            class="i-chip" :class="{ 'is-on': form.action === 'block' }"
            :aria-pressed="form.action === 'block'" @click="form.action = 'block'"
          >Block</button>
          <button
            class="i-chip" :class="{ 'is-on': form.action === 'allow' }"
            :aria-pressed="form.action === 'allow'" @click="form.action = 'allow'"
          >Allow</button>
        </div>
        <p class="i-hint">
          An Allow rule placed above a Block rule is how you carve out an exception.
        </p>
        <label class="i-sw mt-3">
          <input type="checkbox" v-model="form.enabled"><span class="i-track" />Rule is enabled
        </label>
      </div>

      <template #footer>
        <button class="i-btn i-quiet" @click="sheetOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="saving" @click="save">
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
