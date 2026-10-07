<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'
import Sheet from '../../components/ui/Sheet.vue'
import SsoTest from '../../components/ui/SsoTest.vue'

/**
 * Authentication profiles — how people prove who they are.
 *
 * Eight types, and the production add form for each is a different set of
 * fields: a SAML profile needs an entity ID and an ACS URL, a RADIUS profile
 * needs a shared secret and a NAS address, LDAP needs a bind DN and a base
 * DN. Flattening those into one generic form is how the current console ends
 * up with a screen nobody can fill in without the vendor's documentation
 * open beside it.
 *
 * Test is the part that matters. For SAML and OIDC it runs a genuine protocol
 * round trip against the bundled IdP and shows what came back.
 */

const route = useRoute()
const toast = inject('toast', () => {})

const rows = ref([]); const total = ref(0); const loading = ref(true)
const page = ref(1); const perPage = ref(25)
const sort = ref('name'); const dir = ref('asc')
const search = ref(''); const selectedIds = ref([]); const table = ref(null)
const confirmOpen = ref(false)
const sheetOpen = ref(false)
const saving = ref(false)
const editingId = ref(null)
const form = ref(blank())
const ssoOpen = ref(false)
const ssoProfile = ref(null)
const testing = ref(null)
const testResult = ref(null)

/* Per-type field sets, taken from the production forms. `secret` marks a
   field that a real console would write-only and never display again. */
const TYPES = {
  local:              { label: 'Local directory', icon: 'fa-database', fields: [] },
  'active-directory': { label: 'Active Directory', icon: 'fa-sitemap', fields: [
    ['host', 'Domain controller', 'dc01.corp.example.com'],
    ['port', 'Port', '389'],
    ['baseDn', 'Base DN', 'DC=corp,DC=example,DC=com'],
    ['bindDn', 'Bind DN', 'CN=svc-instasafe,OU=Service,DC=corp'],
    ['bindPassword', 'Bind password', '', 'secret'],
    ['tls', 'Use StartTLS', '', 'switch']
  ]},
  ldap:               { label: 'LDAP / LDAPS', icon: 'fa-folder-tree', fields: [
    ['host', 'LDAP host', 'ldaps://ldap.example.com'],
    ['port', 'Port', '636'],
    ['baseDn', 'Base DN', 'ou=people,dc=example,dc=com'],
    ['bindDn', 'Bind DN', 'cn=admin,dc=example,dc=com'],
    ['bindPassword', 'Bind password', '', 'secret'],
    ['tls', 'Require LDAPS', '', 'switch']
  ]},
  radius:             { label: 'RADIUS', icon: 'fa-tower-broadcast', fields: [
    ['host', 'RADIUS server', '10.20.0.40'],
    ['port', 'Auth port', '1812'],
    ['sharedSecret', 'Shared secret', '', 'secret'],
    ['nasIdentifier', 'NAS identifier', 'instasafe-gw']
  ]},
  saml:               { label: 'SAML 2.0', icon: 'fa-right-to-bracket', fields: [
    ['entityId', 'IdP entity ID', 'https://idp.example.com/metadata'],
    ['ssoUrl', 'Single sign-on URL', 'https://idp.example.com/sso'],
    ['acsUrl', 'Assertion consumer service (ours)', 'https://instasafe-console-demo.netlify.app/saml/acs'],
    ['audience', 'Audience / SP entity ID', 'i365-console'],
    ['certificate', 'IdP signing certificate', '-----BEGIN CERTIFICATE-----', 'textarea']
  ]},
  oauth:              { label: 'OAuth 2.0', icon: 'fa-key', fields: [
    ['clientId', 'Client ID', ''],
    ['clientSecret', 'Client secret', '', 'secret'],
    ['authUrl', 'Authorization URL', 'https://provider/oauth/authorize'],
    ['tokenUrl', 'Token URL', 'https://provider/oauth/token']
  ]},
  openid:             { label: 'OpenID Connect', icon: 'fa-id-badge', fields: [
    ['issuer', 'Issuer', 'https://idp.example.com'],
    ['clientId', 'Client ID', 'i365-console'],
    ['clientSecret', 'Client secret', '', 'secret'],
    ['scopes', 'Scopes', 'openid profile email']
  ]},
  passwordless:       { label: 'Passwordless', icon: 'fa-envelope-open-text', fields: [
    ['linkTtl', 'Link valid for (minutes)', '15'],
    ['fromAddress', 'Sent from', 'no-reply@instasafe.com']
  ]}
}

function blank () {
  return { name: '', type: 'saml', status: 'configured', users: 0, host: '', port: null, tls: false }
}

const activeFields = computed(() => TYPES[form.value.type]?.fields || [])

const columns = [
  { key: 'name', label: 'Profile', bold: true },
  { key: 'type', label: 'Type', cell: (v) => TYPES[v]?.label || v },
  { key: 'host', label: 'Host', mono: true, cell: (v) => v || '—' },
  { key: 'port', label: 'Port', mono: true, align: 'right', cell: (v) => v || '—' },
  { key: 'users', label: 'Users', align: 'right', num: true },
  { key: 'status', label: 'Status',
    cell: (v) => v === 'configured' ? 'Configured' : 'Not configured',
    pill: (v) => v === 'configured' ? null : 'att' }
]

async function load () {
  loading.value = true
  const res = await api.authProfiles.list({
    page: page.value, perPage: perPage.value, sort: sort.value, dir: dir.value,
    search: search.value, searchFields: ['name', 'type', 'host']
  })
  rows.value = res.data; total.value = res.total; loading.value = false
}

let timer
watch(search, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; load() }, 220) })
watch([page, perPage], load)
function onSort (k, d) { sort.value = k; dir.value = d; page.value = 1; load() }

function openAdd () { form.value = blank(); editingId.value = null; sheetOpen.value = true }

function openEdit (row) {
  form.value = { ...blank(), ...row }
  editingId.value = row.id
  sheetOpen.value = true
}

watch(() => form.value.type, (t) => {
  if (editingId.value) return
  const d = { 'active-directory': 389, ldap: 636, radius: 1812 }[t]
  form.value.port = d ?? null
  if (!form.value.name) form.value.name = TYPES[t]?.label || ''
})

async function save () {
  if (!form.value.name) { toast('Give the profile a name', 'bad'); return }
  saving.value = true
  try {
    if (editingId.value) {
      await api.authProfiles.update(editingId.value, { ...form.value })
      toast(form.value.name + ' updated')
    } else {
      await api.authProfiles.create({ ...form.value })
      toast(form.value.name + ' added')
    }
    sheetOpen.value = false
    load()
  } catch (e) {
    toast('Could not save: ' + (e?.message || 'unknown error'), 'bad')
  } finally { saving.value = false }
}

/**
 * Test. SAML and OIDC open the real protocol round trip; the directory and
 * RADIUS types run a simulated probe that reports what a real bind would.
 */
async function test (row) {
  if (row.type === 'saml' || row.type === 'openid' || row.type === 'oauth') {
    ssoProfile.value = row
    ssoOpen.value = true
    return
  }
  testing.value = row.id
  testResult.value = null
  await new Promise(r => setTimeout(r, 900))
  const ok = row.status === 'configured'
  testResult.value = {
    id: row.id, ok,
    lines: ok
      ? [
          `Resolving ${row.host || 'local'}…  ok`,
          `TCP ${row.host || 'local'}:${row.port || '—'}  connected in 24 ms`,
          row.tls ? 'TLS handshake  ok, certificate valid' : 'TLS  not requested',
          'Bind as service account  ok',
          `Directory search  ${row.users} entries matched the user filter`,
          'Result: profile is reachable and usable'
        ]
      : [
          `Resolving ${row.host || '—'}…  ok`,
          'Bind as service account  failed',
          'Result: credentials are missing. Add a bind password and test again.'
        ]
  }
  testing.value = null
  await api.events.record({
    type: 'authprofile.tested',
    message: `${row.name} connection test — ${ok ? 'passed' : 'failed'}`,
    severity: ok ? 'info' : 'warning'
  })
}

async function removeSelected () {
  const n = selectedIds.value.length
  await api.authProfiles.removeMany(selectedIds.value)
  confirmOpen.value = false
  table.value?.clearSelection()
  toast(n + ' profile' + (n === 1 ? '' : 's') + ' deleted')
  load()
}

const names = computed(() => rows.value
  .filter(x => selectedIds.value.includes(x.id)).map(x => x.name).join(', '))

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Authentication profiles"
      subtitle="Eight ways people can prove who they are. Each type takes its own fields, and each can be tested before anyone depends on it."
    >
    </PageHeader>

    <div class="i-strip">
      <div class="i-right ms-auto">
        <label class="i-search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input v-model="search" type="search" placeholder="Search profile or host">
        </label>
        <div class="i-tools">
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add profile
        </button>
        </div>
      </div>
    </div>

    <DataTable
      ref="table" :columns="columns" :rows="rows" :total="total" :loading="loading"
      v-model:page="page" v-model:perPage="perPage" :sort="sort" :dir="dir"
      :row-action="{ label: 'Test' }"
      @sort="onSort" @selection="selectedIds = $event"
      @row-action="test" @row-click="openEdit"
    >
      <template #bulk>
        <button class="i-btn i-sm i-danger" @click="confirmOpen = true">Delete</button>
      </template>
      <template #empty>
        <EmptyState
          icon="fa-id-card"
          title="No authentication profiles"
          body="Without one, nobody can sign in. Start with Local."
          action-label="Add profile"
          @action="openAdd"
        />
      </template>
    </DataTable>

    <!-- result of a directory or RADIUS probe -->
    <div v-if="testResult" class="mt-4" style="max-width:640px">
      <div class="i-verdict" :class="testResult.ok ? 'is-pass' : 'is-block'">
        <h3>
          <i class="fa-solid me-2" :class="testResult.ok ? 'fa-circle-check' : 'fa-circle-xmark'" aria-hidden="true" />
          {{ testResult.ok ? 'Connection succeeded' : 'Connection failed' }}
        </h3>
      </div>
      <div class="i-session mt-2">
        <div class="i-session-body" style="min-height:0">
          <div v-for="(l, i) in testResult.lines" :key="i">{{ l }}</div>
        </div>
      </div>
      <p class="i-demo-note mt-2">
        Simulated probe. The SAML and OIDC profiles run a real protocol round trip
        instead — press Test on one of those.
      </p>
    </div>

    <!-- add: the form changes shape per type -->
    <Sheet
      v-model:open="sheetOpen"
      :title="editingId ? 'Edit authentication profile' : 'Add authentication profile'"
      :subtitle="TYPES[form.type]?.label"
      width="620px"
    >
      <div class="i-formsec">
        <h3>Type</h3>
        <p class="i-secsub">Decides which fields this profile needs.</p>
        <div class="d-flex flex-wrap gap-2">
          <button
            v-for="(t, key) in TYPES" :key="key"
            class="i-chip" :class="{ 'is-on': form.type === key }"
            :aria-pressed="form.type === key" @click="form.type = key"
          >
            <i class="fa-solid" :class="t.icon" aria-hidden="true" /> {{ t.label }}
          </button>
        </div>
      </div>

      <div class="i-formsec">
        <h3>Settings</h3>
        <div class="i-frow">
          <div class="i-field">
            <label for="pn">Display name <span class="i-req">*</span></label>
            <input id="pn" class="i-ctl" v-model="form.name">
            <p class="i-hint">What admins see in the Auth profile column.</p>
          </div>
        </div>

        <p v-if="!activeFields.length" class="i-demo-note">
          The local directory has nothing to configure — users and passwords live
          in i365 itself.
        </p>

        <div v-for="f in activeFields" :key="f[0]" class="i-frow" style="grid-template-columns:1fr">
          <div class="i-field">
            <label v-if="f[3] !== 'switch'" :for="'f_' + f[0]">{{ f[1] }}</label>
            <textarea
              v-if="f[3] === 'textarea'" :id="'f_' + f[0]" class="i-ctl"
              v-model="form[f[0]]" :placeholder="f[2]"
            />
            <label v-else-if="f[3] === 'switch'" class="i-sw">
              <input type="checkbox" v-model="form[f[0]]"><span class="i-track" />{{ f[1] }}
            </label>
            <input
              v-else :id="'f_' + f[0]" class="i-ctl"
              :type="f[3] === 'secret' ? 'password' : 'text'"
              v-model="form[f[0]]" :placeholder="f[2]"
            >
            <p v-if="f[3] === 'secret'" class="i-hint">
              Stored write-only. Once saved it is never shown again, only replaced.
            </p>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="i-btn i-quiet" @click="sheetOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Save profile') }}
          </button>
        </div>
      </template>
    </Sheet>

    <SsoTest v-model:open="ssoOpen" :profile="ssoProfile" />

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="'Delete ' + selectedIds.length + ' profile' + (selectedIds.length === 1 ? '' : 's') + '?'"
      :confirm-label="'Delete ' + selectedIds.length"
      @confirm="removeSelected"
    >
      <strong class="i-named">{{ names }}</strong> is removed. Anyone whose account
      uses it will be unable to sign in until they are moved to another profile.
    </ConfirmModal>
  </div>
</template>
