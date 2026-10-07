<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'
import Sheet from '../../components/ui/Sheet.vue'
import { fmtAgo, statusPill } from '../../resources.js'

const toast = inject('toast', () => {})
const refreshStats = inject('refreshStats', () => {})

const rows = ref([]); const total = ref(0); const loading = ref(true)
const page = ref(1); const perPage = ref(25)
const sort = ref(''); const dir = ref('asc')
const search = ref(''); const filter = ref('all')
const selectedIds = ref([]); const table = ref(null)
const confirmOpen = ref(false)
const sheetOpen = ref(false)
const saving = ref(false)
const editingId = ref(null)
const form = ref(blank())

function blank () {
  return {
    firstName: '', lastName: '', email: '', username: '',
    countryCode: '91', mobile: '', location: '',
    authProfile: 'Local', department: 'Engineering',
    status: 'pending', mfaEnrolled: false, groups: [],
    deviceBinding: true, deviceCheckEnabled: true,
    geoFenceEnabled: false, autoSuspend: false
  }
}

const columns = [
  { key: 'name', label: 'Name', bold: true, sortable: false,
    cell: (_, r) => r.firstName + ' ' + r.lastName },
  { key: 'username', label: 'Username', dim: true },
  { key: 'department', label: 'Department' },
  { key: 'authProfile', label: 'Auth profile' },
  { key: 'mfaEnrolled', label: 'MFA',
    cell: (v) => v ? 'Enrolled' : 'Not enrolled',
    pill: (v) => v ? null : 'att' },
  { key: 'lastSeenAt', label: 'Last seen', cell: fmtAgo, dim: true },
  { key: 'status', label: 'Status',
    cell: (v) => v.charAt(0).toUpperCase() + v.slice(1), pill: statusPill }
]

const DEPTS = ['Engineering','Finance','Sales','Support','HR','Operations','Legal','Marketing','IT','Security']
const PROFILES = ['Local','Azure AD','RADIUS','LDAP','SAML','Google']

const chips = computed(() => [
  { key: 'all', label: 'All', n: total.value },
  { key: 'no-mfa', label: 'Without MFA', n: 0 },
  { key: 'suspended', label: 'Suspended', n: 0 },
  { key: 'pending', label: 'Pending activation', n: 0 }
])

async function load () {
  loading.value = true
  const filters = {}
  if (filter.value === 'no-mfa') filters.mfaEnrolled = false
  if (filter.value === 'suspended') filters.status = 'suspended'
  if (filter.value === 'pending') filters.status = 'pending'
  const res = await api.users.list({
    page: page.value, perPage: perPage.value, sort: sort.value, dir: dir.value,
    search: search.value,
    searchFields: ['firstName', 'lastName', 'username', 'email', 'department'],
    filters
  })
  rows.value = res.data
  total.value = res.total
  loading.value = false
}

let timer
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; load() }, 220)
})
watch([page, perPage, filter], load)

function onSort (k, d) { sort.value = k; dir.value = d; page.value = 1; load() }
function openAdd () { form.value = blank(); editingId.value = null; sheetOpen.value = true }

/* Production opens the edit panel when you click the row - there are no
   per-row buttons at all - so the same gesture works here. */
function openEdit (row) {
  form.value = { ...blank(), ...row }
  editingId.value = row.id
  sheetOpen.value = true
}

async function suspendOne () {
  await api.users.suspend(editingId.value)
  form.value.status = 'suspended'
  toast(form.value.firstName + ' suspended')
  refreshStats(); load()
}

/* Username is derived until the admin overrides it. One less thing to type,
   and it removes the commonest cause of a failed save. */
watch(() => [form.value.firstName, form.value.lastName], () => {
  if (editingId.value) return        // never silently rename an existing account
  const f = form.value.firstName.trim().toLowerCase()
  const l = form.value.lastName.trim().toLowerCase()
  if (f || l) {
    form.value.username = [f, l].filter(Boolean).join('.')
    if (!form.value.email) form.value.email = form.value.username + '@instasafe.com'
  }
})

async function save () {
  if (!form.value.firstName || !form.value.email) {
    toast('First name and email are required', 'bad')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await api.users.update(editingId.value, { ...form.value })
      toast(form.value.firstName + ' ' + form.value.lastName + ' updated')
    } else {
      await api.users.create({ ...form.value, lastSeenAt: null })
      toast(form.value.firstName + ' ' + form.value.lastName + ' added')
    }
    sheetOpen.value = false
    refreshStats()
    page.value = 1
    load()
  } catch (err) {
    // never leave the button stuck on "Saving…" — say what went wrong instead
    toast('Could not save: ' + (err?.message || 'unknown error'), 'bad')
  } finally {
    saving.value = false
  }
}

async function removeSelected () {
  const ids = selectedIds.value
  await api.users.removeMany(ids)
  confirmOpen.value = false
  table.value?.clearSelection()
  toast(ids.length + ' user' + (ids.length === 1 ? '' : 's') + ' deleted')
  refreshStats()
  load()
}

async function suspendSelected () {
  const n = selectedIds.value.length
  for (const uid of selectedIds.value) await api.users.suspend(uid)
  table.value?.clearSelection()
  toast(n + ' suspended')
  refreshStats()
  load()
}

const names = computed(() => {
  const n = rows.value
    .filter(x => selectedIds.value.includes(x.id))
    .map(x => x.firstName + ' ' + x.lastName)
  if (n.length > 3) return n.slice(0, 3).join(', ') + ' and ' + (n.length - 3) + ' more'
  return n.join(', ')
})

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Users"
      :subtitle="total.toLocaleString() + ' users · policy is inherited from the groups they belong to'"
    >
      <template #actions>
        <button class="i-btn"><i class="fa-solid fa-download" aria-hidden="true" /> Export</button>
        <button class="i-btn">Import CSV</button>
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add user
        </button>
      </template>
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
          <input v-model="search" type="search" placeholder="Search name, username or email">
        </label>
      </div>
    </div>

    <DataTable
      ref="table" :columns="columns" :rows="rows" :total="total" :loading="loading"
      v-model:page="page" v-model:perPage="perPage" :sort="sort" :dir="dir"
      @sort="onSort" @selection="selectedIds = $event" @row-click="openEdit"
    >
      <template #bulk>
        <button class="i-btn i-sm" @click="suspendSelected">Suspend</button>
        <button class="i-btn i-sm i-danger" @click="confirmOpen = true">Delete</button>
      </template>
      <template #empty>
        <EmptyState
          :icon="search ? 'fa-magnifying-glass' : 'fa-users'"
          :title="search ? 'Nothing matches that search' : 'No users match this filter'"
          :body="search ? 'Try a shorter term, or clear the search.' : 'Switch back to All to see everyone.'"
        />
      </template>
    </DataTable>

    <Sheet
      v-model:open="sheetOpen"
      :title="editingId ? 'Edit user' : 'Add user'"
      :subtitle="editingId ? 'Changes apply at their next sign-in.' : 'They receive an activation mail once saved.'"
    >
      <div class="i-formsec">
        <h3>Identity</h3>
        <p class="i-secsub">How this person signs in.</p>
        <div class="i-frow">
          <div class="i-field">
            <label for="fn">First name <span class="i-req">*</span></label>
            <input id="fn" class="i-ctl" v-model="form.firstName">
          </div>
          <div class="i-field">
            <label for="ln">Last name</label>
            <input id="ln" class="i-ctl" v-model="form.lastName">
          </div>
        </div>
        <div class="i-frow">
          <div class="i-field">
            <label for="un">Username</label>
            <input id="un" class="i-ctl" v-model="form.username">
            <p class="i-hint">Filled in from the name. Change it if your directory uses something else.</p>
          </div>
          <div class="i-field">
            <label for="em">Email <span class="i-req">*</span></label>
            <input id="em" class="i-ctl" type="email" v-model="form.email">
            <p class="i-hint">The activation link goes here.</p>
          </div>
        </div>
        <div class="i-frow">
          <div class="i-field">
            <label for="mob">Mobile number</label>
            <div class="i-duo">
              <select class="i-ctl" v-model="form.countryCode" aria-label="Country code">
                <option value="91">India +91</option>
                <option value="1">US +1</option>
                <option value="44">UK +44</option>
              </select>
              <input id="mob" class="i-ctl" v-model="form.mobile" placeholder="Mobile number">
            </div>
            <p class="i-hint">Used for OTP when the auth profile requires it.</p>
          </div>
          <div class="i-field">
            <label for="dept">Department</label>
            <select id="dept" class="i-ctl" v-model="form.department">
              <option v-for="d in DEPTS" :key="d">{{ d }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="i-formsec">
        <h3>Access</h3>
        <p class="i-secsub">Groups decide which applications they reach.</p>
        <div class="i-frow">
          <div class="i-field">
            <label for="ap">Authentication profile</label>
            <select id="ap" class="i-ctl" v-model="form.authProfile">
              <option v-for="p in PROFILES" :key="p">{{ p }}</option>
            </select>
          </div>
          <div class="i-field">
            <label for="st">Activation</label>
            <select id="st" class="i-ctl" v-model="form.status">
              <option value="pending">Pending activation</option>
              <option value="active">Active immediately</option>
            </select>
          </div>
        </div>
      </div>

      <div class="i-formsec">
        <h3>Device policy</h3>
        <p class="i-secsub">Four switches that read as four identical checkboxes in the current console.</p>
        <div class="d-flex flex-column gap-2">
          <label class="i-sw"><input type="checkbox" v-model="form.deviceBinding"><span class="i-track" />Bind to first device used</label>
          <label class="i-sw"><input type="checkbox" v-model="form.deviceCheckEnabled"><span class="i-track" />Run device posture checks</label>
          <label class="i-sw"><input type="checkbox" v-model="form.geoFenceEnabled"><span class="i-track" />Restrict to geo-fence</label>
          <label class="i-sw"><input type="checkbox" v-model="form.autoSuspend"><span class="i-track" />Auto-suspend after 30 days idle</label>
        </div>
      </div>

      <template #footer>
        <button class="i-btn i-quiet" @click="sheetOpen = false">Cancel</button>
        <button
          v-if="editingId && form.status !== 'suspended'"
          class="i-btn i-danger" @click="suspendOne"
        >Suspend</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Save user') }}
          </button>
        </div>
      </template>
    </Sheet>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="'Delete ' + selectedIds.length + ' user' + (selectedIds.length === 1 ? '' : 's') + '?'"
      :confirm-label="'Delete ' + selectedIds.length"
      @confirm="removeSelected"
    >
      <strong class="i-named">{{ names }}</strong> lose access immediately and their active
      sessions end. Audit history is kept. This cannot be undone.
    </ConfirmModal>
  </div>
</template>
