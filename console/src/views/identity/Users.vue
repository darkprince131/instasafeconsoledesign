<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import api from '../../api'
import { hashPassword, passwordOk } from '../../lib/password.js'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import ListTools from '../../components/ui/ListTools.vue'
import GraphView from '../../components/ui/GraphView.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'
import Sheet from '../../components/ui/Sheet.vue'
import PickList from '../../components/ui/PickList.vue'
import { fmtAgo, statusPill } from '../../resources.js'

const toast = inject('toast', () => {})
const refreshStats = inject('refreshStats', () => {})

const rows = ref([]); const total = ref(0); const loading = ref(true)
const page = ref(1); const perPage = ref(25)
const sort = ref(''); const dir = ref('asc')
const search = ref(''); const filter = ref('all')
const selectedIds = ref([]); const table = ref(null)
const confirmOpen = ref(false)

const GRAPH_DIMS = [
  { key: 'department', label: 'Department' },
  { key: 'authProfile', label: 'Authentication profile' },
  { key: 'status', label: 'Status' },
  { key: 'mfaEnrolled', label: 'MFA enrolled' },
  { key: 'location', label: 'Location' }
]

const graphOn = ref(false)

/* Bulk Ops writes through the API directly and then tells us how it went, so
   the table just needs to catch up. */
function onBulkApplied ({ op, count }) {
  toast(`${count} user${count === 1 ? '' : 's'} ${op === 'add' ? 'created' : op + 'd'}`)
  load()
}
const sheetOpen = ref(false)
const saving = ref(false)
const editingId = ref(null)
const resettingMfa = ref(false)

/**
 * Reset somebody else's MFA.
 *
 * The one MFA action an administrator genuinely performs, and the one this
 * console did not have: somebody loses their phone, and without this they are
 * locked out permanently. It discards the enrolled secret; the next time they
 * sign in to the portal they are taken through enrolment again.
 */
async function resetMfaForUser () {
  if (!editingId.value) return
  if (!confirm('Reset multi-factor for this user?\n\nTheir current authenticator stops working immediately and they will have to enrol a new one from the end-user portal.')) return
  resettingMfa.value = true
  try {
    await api.auth.resetMfa(editingId.value)
    form.value.mfaEnrolled = false
    toast('Multi-factor reset — they enrol again from the portal')
    load()
  } finally { resettingMfa.value = false }
}
const form = ref(blank())

/**
 * Velto splits this form across three tabs — Profile, Options, Advanced —
 * and the demo had it as four headed sections with a different field set.
 * The segregation is kept because it is load-bearing: Profile is the person,
 * Options is what is enforced at sign-in, Advanced is the networking.
 */
const TABS = [
  { key: 'profile', label: 'Profile', hint: 'Who they are, and how they authenticate.' },
  { key: 'options', label: 'Options', hint: 'What is checked when they sign in.' },
  { key: 'advanced', label: 'Advanced', hint: 'Policy and networking. Most tenants leave these alone.' }
]
const tab = ref('profile')

/* Velto's select carries 216 countries. A list that long is not a control —
   §16 — so the common codes are offered and the rest typed. */
const COUNTRY_CODES = [
  ['91', 'India'], ['1', 'United States'], ['44', 'United Kingdom'], ['61', 'Australia'],
  ['65', 'Singapore'], ['971', 'United Arab Emirates'], ['966', 'Saudi Arabia'],
  ['49', 'Germany'], ['33', 'France'], ['31', 'Netherlands'], ['353', 'Ireland'],
  ['81', 'Japan'], ['86', 'China'], ['60', 'Malaysia'], ['62', 'Indonesia'],
  ['63', 'Philippines'], ['27', 'South Africa'], ['55', 'Brazil'], ['52', 'Mexico'],
  ['254', 'Kenya'], ['234', 'Nigeria'], ['94', 'Sri Lanka'], ['880', 'Bangladesh']
]

const AUTH_TYPES = ['Certificate', 'Password + Certs']
const ACTIVATION_METHODS = ['Immediately on provisioning', 'Automatically on first login', 'On date time']

/* The SAML IDP profile offered here is a real profile from the SAML screen,
   not a free string: velto lists the tenant's own, with None at the top. */
const samlProfiles = ref(['None'])

async function loadSamlProfiles () {
  const res = await api.authProfiles.list({ perPage: 0, filters: { type: 'saml' } })
  samlProfiles.value = ['None', ...res.data.map(p => p.name)]
}

function blank () {
  return {
    /* Profile */
    firstName: '', lastName: '', email: '', username: '',
    countryCode: '91', mobile: '', location: '',
    authType: 'Certificate',
    activationMethod: 'Immediately on provisioning',
    activationAt: '',
    samlIdpProfile: 'None',
    authProfile: 'Local', department: 'Engineering',
    password: '', confirmPassword: '',
    status: 'pending',
    /* Options */
    groups: [],
    mfaEnrolled: false, mfaRequired: false,
    deviceBinding: true, deviceCheckEnabled: true, deviceUpdatesEnabled: false,
    geoBinding: false, ipRestriction: false,
    /* Advanced */
    deviceDlp: false, shiftSchedule: false, geoFenceEnabled: false,
    blockApps: false, riskProfile: false, devicePolicy: false,
    twinTunnel: false, staticIp: '', autoSuspend: false
  }
}

/* ---- the password, which velto keeps off the edit form ------------------ */

const pwOpen = ref(false)
const pwNew = ref('')
const pwConfirm = ref('')
const pwSaving = ref(false)

function openPassword () { pwNew.value = ''; pwConfirm.value = ''; pwOpen.value = true }

async function savePassword () {
  if (pwNew.value !== pwConfirm.value) { toast('The two passwords do not match', 'bad'); return }
  /* The same rule set the portal enforces, so an administrator cannot set a
     password the person would not have been allowed to choose. */
  if (!passwordOk(pwNew.value, { username: form.value.username })) {
    toast('At least 12 characters, mixed case, a digit, a symbol, and not the username', 'bad')
    return
  }
  pwSaving.value = true
  try {
    await api.users.update(editingId.value, {
      passwordHash: await hashPassword(pwNew.value),
      passwordSetAt: new Date().toISOString(),
      passwordUpdatedAt: new Date().toISOString()
    })
    await api.events.record({
      type: 'user.password.changed',
      message: `Password changed for ${form.value.username}`,
      severity: 'warning'
    })
    pwOpen.value = false
    toast('Password changed')
  } finally { pwSaving.value = false }
}

/* ---- what this account actually has: devices and ACLs -------------------- */

/**
 * Velto's User Details.
 *
 * It opens a modal over the form holding two tables — the devices enrolled
 * to this account and the ACLs that apply to it. The tables are there and the
 * numbers are not: you cannot see from the form that somebody has four
 * devices and no rules until you open it.
 *
 * Here the counts are on the form, so the panel answers a question you
 * already know you have, and the ACL list says where each rule comes from —
 * the group that carries it — because "why can this person reach that" is the
 * question being asked.
 */
const detailsOpen = ref(false)
const detailsTab = ref('devices')
const userDevices = ref([])
const userAcls = ref([])
const detailsLoading = ref(false)

async function loadDetails (row) {
  detailsLoading.value = true
  try {
    const [dev, acl, grp] = await Promise.all([
      api.devices.list({ perPage: 0, filters: { username: row.username } }),
      api.accessRules.list({ perPage: 0 }),
      api.groups.list({ perPage: 0 })
    ])
    userDevices.value = dev.data
    /* Membership is held as group ids and a rule names its source group, so
       the two do not compare until the ids are resolved. Matching them raw
       silently found nothing, which reads on screen as "no rule reaches this
       account" — the one answer that must never be wrong by accident. */
    const byId = new Map(grp.data.map(g => [g.id, g.name]))
    const myGroups = (row.groups || []).map(g => byId.get(g) || g)
    const mine = new Set([row.username, ...myGroups])
    userAcls.value = acl.data
      .filter(a => mine.has(a.source))
      .map(a => ({ ...a, via: a.sourceType === 'group' ? a.source : 'this account' }))
  } finally { detailsLoading.value = false }
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
function openAdd () {
  form.value = blank()
  editingId.value = null
  tab.value = 'profile'
  userDevices.value = []
  userAcls.value = []
  sheetOpen.value = true
}

/* Production opens the edit panel when you click the row - there are no
   per-row buttons at all - so the same gesture works here. */
function openEdit (row) {
  form.value = { ...blank(), ...row }
  editingId.value = row.id
  tab.value = 'profile'
  sheetOpen.value = true
  loadDetails(row)
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
    toast('First name and email are required', 'bad'); tab.value = 'profile'; return
  }
  if (!form.value.username) {
    toast('Username is required', 'bad'); tab.value = 'profile'; return
  }
  if (!editingId.value) {
    if (form.value.password.length < 8) {
      toast('The password needs at least 8 characters', 'bad'); tab.value = 'profile'; return
    }
    if (form.value.password !== form.value.confirmPassword) {
      toast('The two passwords do not match', 'bad'); tab.value = 'profile'; return
    }
  }
  if (form.value.activationMethod === 'On date time' && !form.value.activationAt) {
    toast('Pick the date and time the account activates', 'bad'); tab.value = 'profile'; return
  }
  if (form.value.staticIp && !/^(\d{1,3}\.){3}\d{1,3}$/.test(form.value.staticIp.trim())) {
    toast('The static IP must be an IPv4 address', 'bad'); tab.value = 'advanced'; return
  }
  saving.value = true
  try {
    if (editingId.value) {
      const { password, confirmPassword, ...rest } = form.value
      await api.users.update(editingId.value, rest)
      toast(form.value.firstName + ' ' + form.value.lastName + ' updated')
    } else {
      /* The typed password used to be dropped on the floor, with a comment
         explaining that there was nothing to authenticate against. There is
         now: it is hashed with PBKDF2 and stored as a hash, so the account
         this creates can be signed into from the member portal immediately.
         The password itself is still never written down — a browser database
         is no place for it, and neither is a server. */
      const { password, confirmPassword, ...rest } = form.value
      await api.users.create({
        ...rest,
        passwordHash: await hashPassword(password),
        passwordSetAt: new Date().toISOString(),
        passwordUpdatedAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
        lastSeenAt: null
      })
      toast(`${form.value.firstName} ${form.value.lastName} added — they can sign in to the portal now`)
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

/**
 * Send an invitation instead of handing a password over.
 *
 * Telling somebody their password — in a chat, in a ticket, out loud across
 * a desk — is how the password stops being theirs. An invitation lets them
 * set one nobody else has ever seen. The link is one-time and lasts a week,
 * and it lands in the Demo Inbox because there is no mail server here.
 */
const inviting = ref(false)
async function sendInvite () {
  if (!editingId.value) return
  inviting.value = true
  try {
    const res = await api.auth.invite({ userId: editingId.value, origin: location.origin })
    if (!res?.ok) { toast(res?.error || 'Could not send it', 'bad'); return }
    toast('Invitation sent — open the Demo Inbox to see it')
  } finally { inviting.value = false }
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

onMounted(loadSamlProfiles)
onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      collection="users"
      title="Users"
      :subtitle="total.toLocaleString() + ' users · policy is inherited from the groups they belong to'"
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
          <input v-model="search" type="search" placeholder="Search name, username or email">
        </label>
        <div class="i-tools">
        <button class="i-btn"><i class="fa-solid fa-download" aria-hidden="true" /> Export</button>
        <button class="i-btn">Import CSV</button>
        <ListTools
          v-model:graph="graphOn"
          kind="users" resource="users"
          :rows="rows" :dimensions="GRAPH_DIMS" :total="total"
          @apply="onBulkApplied"
        />
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add user
        </button>
        </div>
      </div>
    </div>

    <GraphView
      v-if="graphOn"
      :rows="rows" :dimensions="GRAPH_DIMS" :total="total"
      :resource="'users'"
      label-key="username"
    />

    <DataTable
      v-else
      ref="table" :columns="columns" :rows="rows" :total="total" :loading="loading"
      v-model:page="page" v-model:perPage="perPage" :sort="sort" :dir="dir"
      @sort="onSort" @selection="selectedIds = $event" @row-click="openEdit"
    >
      <template #bulk>
        <button class="i-btn i-sm" @click="suspendSelected">Suspend</button>
        <button class="i-btn i-sm i-danger" @click="confirmOpen = true">Delete</button>
      </template>
      <template #empty>
        <!-- Three different situations, which the production console tells
             apart not at all: it ships "No results found" on every one of
             its 54 lists. A search that found nothing, a filter that hides
             everything, and a tenant with no users in it are not the same
             problem and do not have the same way out. -->
        <EmptyState
          v-if="search"
          icon="fa-magnifying-glass"
          title="Nothing matches that search"
          body="Try a shorter term, or clear the search."
        />
        <EmptyState
          v-else-if="filter !== 'all'"
          icon="fa-filter"
          :title="`No ${filter} users`"
          body="Switch back to All to see everyone."
        />
        <EmptyState
          v-else
          icon="fa-users"
          title="No users yet"
          body="Add the first one, or connect a directory and let it fill this in."
          actionLabel="Add a user"
          @action="openAdd"
        />
      </template>
    </DataTable>

    <Sheet
      v-model:open="sheetOpen"
      :title="editingId ? 'Edit user' : 'Add user'"
      :subtitle="editingId ? 'Changes apply at their next sign-in.' : 'They receive an activation mail once saved.'"
    >
      <!-- Velto's own three tabs. A person, what is enforced on them, and
           the networking — in that order, because that is the order anybody
           fills them in. -->
      <div class="i-ftabs">
        <button
          v-for="t in TABS" :key="t.key"
          class="i-chip" :class="{ 'is-on': tab === t.key }"
          :aria-pressed="tab === t.key"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </div>
      <p class="i-secsub">{{ TABS.find(t => t.key === tab).hint }}</p>

      <!-- ------------------------------------------------ Profile -->
      <template v-if="tab === 'profile'">
        <div class="i-formsec">
          <div class="i-frow">
            <div class="i-field">
              <label for="first_name">First Name<span class="i-req">*</span></label>
              <input id="first_name" name="first_name" class="i-ctl" v-model="form.firstName" placeholder="Enter First Name">
            </div>
            <div class="i-field">
              <label for="last_name">Last Name</label>
              <input id="last_name" name="last_name" class="i-ctl" v-model="form.lastName" placeholder="Enter Last Name">
            </div>
          </div>
          <div class="i-frow">
            <div class="i-field">
              <label for="username">Username<span class="i-req">*</span></label>
              <input
                id="username" name="username" class="i-ctl" v-model="form.username"
                placeholder="Enter User Name" :disabled="!!editingId"
              >
              <p class="i-hint">
                {{ editingId
                  ? 'Sessions, devices and the audit trail all refer to this account by its username, so it cannot be changed.'
                  : 'Filled in from the name. Change it if your directory uses something else.' }}
              </p>
            </div>
            <div class="i-field">
              <label for="email">Email<span class="i-req">*</span></label>
              <input id="email" name="email" class="i-ctl" type="email" v-model="form.email" placeholder="Enter email">
            </div>
          </div>
          <div class="i-frow">
            <div class="i-field">
              <label for="phone">Mobile Number<span class="i-req">*</span></label>
              <div class="i-duo">
                <select id="country_code" name="country_code" class="i-ctl" v-model="form.countryCode" aria-label="Country code">
                  <option v-for="[code, country] in COUNTRY_CODES" :key="code" :value="code">
                    {{ country }} (+{{ code }})
                  </option>
                </select>
                <input id="phone" name="phone" class="i-ctl" v-model="form.mobile" placeholder="Enter mobile number">
              </div>
            </div>
            <div class="i-field">
              <label for="location">Location</label>
              <input id="location" name="location" class="i-ctl" v-model="form.location" placeholder="Enter Location">
            </div>
          </div>
          <div class="i-frow">
            <div class="i-field">
              <label for="auth_type">Authentication Type<span class="i-req">*</span></label>
              <select id="auth_type" name="auth_type" class="i-ctl" v-model="form.authType">
                <option v-for="a in AUTH_TYPES" :key="a">{{ a }}</option>
              </select>
            </div>
            <div class="i-field">
              <label for="activation_method">Activation Method<span class="i-req">*</span></label>
              <select id="activation_method" name="activation_method" class="i-ctl" v-model="form.activationMethod">
                <option v-for="a in ACTIVATION_METHODS" :key="a">{{ a }}</option>
              </select>
            </div>
          </div>
          <div v-if="form.activationMethod === 'On date time'" class="i-frow">
            <div class="i-field">
              <label for="activation_at">Activates at<span class="i-req">*</span></label>
              <input id="activation_at" class="i-ctl" type="datetime-local" v-model="form.activationAt">
              <p class="i-hint">Until then the account exists and cannot sign in.</p>
            </div>
          </div>
          <div class="i-frow">
            <div class="i-field">
              <label for="saml_idp_profile_id">SAML IDP Profile</label>
              <select id="saml_idp_profile_id" name="saml_idp_profile_id" class="i-ctl" v-model="form.samlIdpProfile">
                <option v-for="p in samlProfiles" :key="p">{{ p }}</option>
              </select>
              <p class="i-hint">Only for accounts that sign in through an identity provider. None means they use this console's own sign-in.</p>
            </div>
            <div class="i-field">
              <label for="auth_profile">Authentication Profile</label>
              <select id="auth_profile" name="auth_profile" class="i-ctl" v-model="form.authProfile">
                <option v-for="p in PROFILES" :key="p">{{ p }}</option>
              </select>
            </div>
          </div>

          <!-- Add asks for a password; edit does not, and offers to change
               it instead. That is velto's split and it is the right one. -->
          <div v-if="!editingId" class="i-frow">
            <div class="i-field">
              <label for="new_password">Password<span class="i-req">*</span></label>
              <input id="new_password" name="new_password" class="i-ctl" type="password" autocomplete="new-password" v-model="form.password" placeholder="Password">
              <p class="i-hint">At least 8 characters. They are asked to change it at first sign-in.</p>
            </div>
            <div class="i-field">
              <label for="confirm_password">Confirm Password<span class="i-req">*</span></label>
              <input id="confirm_password" name="confirm_password" class="i-ctl" type="password" autocomplete="new-password" v-model="form.confirmPassword" placeholder="Confirm password">
            </div>
          </div>
          <div v-else class="i-field">
            <label>Password</label>
            <div>
              <button class="i-btn i-sm me-1" @click="openPassword">
                <i class="fa-solid fa-key me-1" aria-hidden="true" />Change Password
              </button>
              <!-- The better of the two, which is why it is offered beside
                   the one velto has: a password an administrator chooses is a
                   password somebody has to be told. -->
              <button class="i-btn i-sm" :disabled="inviting" @click="sendInvite">
                <i class="fa-solid fa-envelope me-1" aria-hidden="true" />
                {{ inviting ? 'Sending…' : 'Send invitation' }}
              </button>
            </div>
            <p class="i-hint">
              The current password is not readable from here, so it is replaced
              rather than shown. An invitation is better than setting one for
              them: it is a one-time link, good for seven days, that lets them
              choose a password nobody else has ever seen.
            </p>
          </div>
        </div>
      </template>

      <!-- ------------------------------------------------ Options -->
      <template v-else-if="tab === 'options'">
        <div class="i-formsec">
          <div class="i-field">
            <label for="groups">Member of Groups</label>
            <PickList
              v-model="form.groups"
              resource="groups"
              label=""
              placeholder="Select user groups…"
              hint="Groups carry the access rules. A user with no group reaches nothing, which is the commonest reason a new account appears broken."
            />
          </div>
        </div>

        <!-- Multi-factor, from the administrator's side. An admin cannot
             enrol somebody else's authenticator; what they do is require it,
             see whether it happened, and reset it when the phone is lost. -->
        <div class="i-formsec">
          <h3>Two Factor Authentication</h3>
          <div v-if="editingId" class="i-mfastate" :class="form.mfaEnrolled ? 'is-on' : 'is-off'">
            <i class="fa-solid" aria-hidden="true"
               :class="form.mfaEnrolled ? 'fa-shield-halved' : 'fa-shield'" />
            <span>
              <strong>{{ form.mfaEnrolled ? 'Enrolled' : 'Not enrolled' }}</strong>
              <small>
                {{ form.mfaEnrolled
                  ? 'An authenticator app is registered to this account.'
                  : 'They will be asked to enrol the next time they sign in to the portal.' }}
              </small>
            </span>
            <button
              v-if="form.mfaEnrolled" class="i-btn i-sm i-danger ms-auto"
              :disabled="resettingMfa" @click="resetMfaForUser"
            >{{ resettingMfa ? 'Resetting…' : 'Reset' }}</button>
          </div>
          <label class="i-sw mt-3">
            <input id="googleotp" name="googleotp" type="checkbox" v-model="form.mfaRequired">
            <span class="i-track" />Require multi-factor at every sign-in
          </label>
        </div>

        <div class="i-formsec">
          <h3>Checks at sign-in</h3>
          <div class="d-flex flex-column gap-2">
            <label class="i-sw"><input id="enable_device_binding" name="enable_device_binding" type="checkbox" v-model="form.deviceBinding"><span class="i-track" />Device Binding</label>
            <label class="i-sw"><input id="device_check_enable" name="device_check_enable" type="checkbox" v-model="form.deviceCheckEnabled"><span class="i-track" />Device checks</label>
            <label class="i-sw"><input id="device_update_enable" name="device_update_enable" type="checkbox" v-model="form.deviceUpdatesEnabled"><span class="i-track" />Device updates</label>
            <label class="i-sw"><input id="geo_binding" name="geo_binding" type="checkbox" v-model="form.geoBinding"><span class="i-track" />Geo Binding</label>
            <label class="i-sw"><input id="enable_ip_restriction" name="enable_ip_restriction" type="checkbox" v-model="form.ipRestriction"><span class="i-track" />IP Restriction</label>
          </div>
          <p class="i-hint">
            Each switch turns on a check the tenant has already configured
            elsewhere. Turning one on here without the policy behind it does
            nothing, which production never says.
          </p>
        </div>
      </template>

      <!-- ------------------------------------------------ Advanced -->
      <template v-else>
        <div class="i-formsec">
          <h3>Policy</h3>
          <div class="d-flex flex-column gap-2">
            <label class="i-sw"><input id="device_dlp_enable" name="device_dlp_enable" type="checkbox" v-model="form.deviceDlp"><span class="i-track" />Device DLP</label>
            <label class="i-sw"><input id="time_schedule_enable" name="time_schedule_enable" type="checkbox" v-model="form.shiftSchedule"><span class="i-track" />Shift Schedule</label>
            <label class="i-sw"><input id="enable_geo_fence" name="enable_geo_fence" type="checkbox" v-model="form.geoFenceEnabled"><span class="i-track" />Geofencing</label>
            <label class="i-sw"><input id="enable_app_blocker" name="enable_app_blocker" type="checkbox" v-model="form.blockApps"><span class="i-track" />Block Apps</label>
            <label class="i-sw"><input id="enable_risk_profile" name="enable_risk_profile" type="checkbox" v-model="form.riskProfile"><span class="i-track" />Risk Profile</label>
            <label class="i-sw"><input id="enable_device_policy" name="enable_device_policy" type="checkbox" v-model="form.devicePolicy"><span class="i-track" />Device Policy</label>
            <label class="i-sw"><input id="auto_suspend" name="auto_suspend" type="checkbox" v-model="form.autoSuspend"><span class="i-track" />Auto Suspend</label>
          </div>
        </div>

        <div class="i-formsec">
          <h3>Networking</h3>
          <label class="i-sw"><input id="enable_twin_tunnel" name="enable_twin_tunnel" type="checkbox" v-model="form.twinTunnel"><span class="i-track" />Twin Tunnel Support</label>
          <div class="i-field mt-3">
            <label for="static_vpn_ip">Static IP</label>
            <input id="static_vpn_ip" name="static_vpn_ip" class="i-ctl i-tech" v-model="form.staticIp" placeholder="Enter Static IP">
            <p class="i-hint">
              The address this account is always given on the tunnel. Leave it
              empty and one is assigned from the pool — which is what nearly
              every account wants. Set it only where something downstream
              matches on the address.
            </p>
          </div>
        </div>
      </template>

      <!-- What this account actually has. Velto hides both behind a modal
           and shows no counts; the counts belong on the form. -->
      <div v-if="editingId" class="i-formsec">
        <h3>This account</h3>
        <p class="i-secsub">
          {{ detailsLoading ? 'Loading…' : `${userDevices.length} device${userDevices.length === 1 ? '' : 's'} enrolled · ${userAcls.length} access rule${userAcls.length === 1 ? ' applies' : 's apply'}` }}
        </p>
        <button class="i-btn i-sm" @click="detailsOpen = true">
          <i class="fa-solid fa-list me-1" aria-hidden="true" />View all
        </button>
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

    <!-- Velto's User Details, which is a modal holding two tables and no
         indication of what is in them until you open it. The counts are on
         the form now; this answers the question they raise. -->
    <Sheet
      v-model:open="detailsOpen"
      nested
      width="760px"
      :title="(form.firstName + ' ' + form.lastName).trim() || 'User details'"
      subtitle="The devices enrolled to this account, and the rules that decide what it reaches."
    >
      <div class="i-ftabs">
        <button
          class="i-chip" :class="{ 'is-on': detailsTab === 'devices' }"
          :aria-pressed="detailsTab === 'devices'"
          @click="detailsTab = 'devices'"
        >Devices · {{ userDevices.length }}</button>
        <button
          class="i-chip" :class="{ 'is-on': detailsTab === 'acls' }"
          :aria-pressed="detailsTab === 'acls'"
          @click="detailsTab = 'acls'"
        >Access rules · {{ userAcls.length }}</button>
      </div>

      <template v-if="detailsTab === 'devices'">
        <p class="i-secsub">
          A device is bound to this account the first time it is used. Removing
          one here makes the person enrol again from that machine.
        </p>
        <p v-if="!detailsLoading && !userDevices.length" class="i-hint">
          Nothing enrolled yet. The first device they sign in from becomes
          their bound device.
        </p>
        <div v-else class="table-responsive">
          <table class="i-table">
            <thead>
              <tr>
                <th>Device Name</th><th>Device OS</th>
                <th>Serial No</th><th>Mac Address</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in userDevices" :key="d.id">
                <td class="fw-medium">{{ d.name }}</td>
                <td>{{ d.os }}</td>
                <td class="i-tech">{{ d.serialNumber }}</td>
                <td class="i-tech">{{ d.macAddress }}</td>
                <td>
                  <span class="i-pill" :class="d.status === 'approved' ? '' : (d.status === 'pending' ? 'i-att' : 'i-bad')">
                    <span v-if="d.status === 'approved'" class="i-dot i-ok" />{{ d.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="i-hint mt-2">
            Velto also prints the UUID in this table. It is on the device
            record rather than here, because three identifiers in one row is
            not something anybody reads across.
          </p>
        </div>
      </template>

      <template v-else>
        <p class="i-secsub">
          Every rule that applies to this account, and where it comes from.
          Rules are carried by groups, so this is what membership actually
          bought them.
        </p>
        <p v-if="!detailsLoading && !userAcls.length" class="i-hint">
          No rule reaches this account. They can sign in and will find nothing
          — which is almost always a missing group rather than a missing rule.
        </p>
        <div v-else class="table-responsive">
          <table class="i-table">
            <thead>
              <tr>
                <th>Acl Name</th><th>Source Type</th><th>Source</th>
                <th>Destination Type</th><th>Destination</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in userAcls" :key="a.id">
                <td class="fw-medium">{{ a.name }}</td>
                <td>{{ a.sourceType }}</td>
                <td>{{ a.source }}</td>
                <td>{{ a.destType }}</td>
                <td>{{ a.dest }}</td>
                <td>
                  <span class="i-pill" :class="a.action === 'allow' ? '' : 'i-bad'">
                    <span v-if="a.action === 'allow'" class="i-dot i-ok" />{{ a.action }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template #footer>
        <button class="i-btn i-quiet" @click="detailsOpen = false">Close</button>
        <div class="i-right">
          <RouterLink class="i-btn" :to="'/access-explorer'">
            Explain an access decision
          </RouterLink>
        </div>
      </template>
    </Sheet>

    <Sheet
      v-model:open="pwOpen"
      nested
      title="Change password"
      subtitle="The current password cannot be read, so it is replaced rather than shown."
    >
      <div class="i-formsec">
        <div class="i-field">
          <label for="user_new_password">New password<span class="i-req">*</span></label>
          <input id="user_new_password" class="i-ctl" type="password" autocomplete="new-password" v-model="pwNew">
          <p class="i-hint">At least 8 characters.</p>
        </div>
        <div class="i-field">
          <label for="user_confirm_password">Confirm password<span class="i-req">*</span></label>
          <input id="user_confirm_password" class="i-ctl" type="password" autocomplete="new-password" v-model="pwConfirm">
          <p v-if="pwConfirm && pwNew !== pwConfirm" class="i-hint">These two do not match yet.</p>
        </div>
        <p class="i-demo-note">
          Nothing here authenticates against a password, so the value is not
          stored — only that it was changed, and when. The change is written to
          the event log either way.
        </p>
      </div>
      <template #footer>
        <button class="i-btn i-quiet" @click="pwOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="pwSaving" @click="savePassword">
            {{ pwSaving ? 'Saving…' : 'Change password' }}
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
