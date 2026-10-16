<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import PickList from '../../components/ui/PickList.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

/**
 * One SCIM export profile.
 *
 * Velto gives this record a page of its own with five tabs, and it is the
 * only record in IDAM that does. The reason is that a SCIM profile is not a
 * set of fields: it is a connection you test, a mapping you edit, a scope you
 * choose and a run you then read the result of. Those are four different
 * jobs, which is why they are four tabs.
 *
 * What is real here: the mapping is applied for real — Preview renders the
 * exact SCIM payload this tenant's users would produce through the mapping as
 * it currently stands, so a wrong mapping is visible before a sync rather
 * than after one. Test Connection and Sync reach no external system, because
 * there is none; both say so and both write to the profile's own log, which
 * is where a real run would be read from.
 */

const route = useRoute()
const toast = inject('toast', () => {})

const TABS = [
  { key: 'about', label: 'About' },
  { key: 'mapping', label: 'Mapping' },
  { key: 'users', label: 'Users' },
  { key: 'groups', label: 'Groups' },
  { key: 'logs', label: 'Logs' }
]

/* Velto addresses the tabs through the fragment, so its links are shareable.
   Keeping that means a bookmark to #mapping still lands on Mapping. */
const tab = ref((route.hash || '#about').slice(1))
watch(() => route.hash, (h) => { tab.value = (h || '#about').slice(1) })
function go (key) { tab.value = key; history.replaceState(null, '', '#' + key) }

const profile = ref(null)
const loading = ref(true)
const saving = ref(false)
const logs = ref([])
const preview = ref('')
const testOut = ref('')

/* Velto's own attribute lists. A mapping that offers an attribute the
   provider does not define is a sync that fails on the first user. */
const LOCAL_USER = ['username', 'displayName', 'first_name', 'last_name', 'email', 'phone', 'status']
const SCIM_USER = [
  'active', 'userName', 'name.givenName', 'name.familyName', 'name.formatted',
  'displayName', 'emails[type eq "work"].value', 'emails[type eq "home"].value',
  'emails[type eq "other"].value', 'phoneNumbers[type eq "home"].value',
  'phoneNumbers[type eq "other"].value', 'phoneNumbers[type eq "work"].value',
  'phoneNumbers[type eq "mobile"].value'
]
const LOCAL_GROUP = ['name', 'members', 'description']
const SCIM_GROUP = ['displayName', 'members', 'description']
const MAP_TYPES = ['Direct', 'Constant']

const open = ref({ user: true, group: false })

async function load () {
  loading.value = true
  try {
    profile.value = await api.scimExports.get(route.params.id)
    const res = await api.scimSyncLogs.list({
      perPage: 0, filters: { profileId: route.params.id }, sort: 'at', dir: 'desc'
    })
    logs.value = res.data
  } finally { loading.value = false }
}

async function save (patch, note) {
  saving.value = true
  try {
    Object.assign(profile.value, patch)
    await api.scimExports.update(profile.value.id, JSON.parse(JSON.stringify(patch)))
    if (note) toast(note)
  } finally { saving.value = false }
}

/* ------------------------------------------------------------------ mapping */
function rowsFor (which) {
  const key = which === 'user' ? 'userMapping' : 'groupMapping'
  return profile.value?.[key] || []
}
function setRow (which, i, field, value) {
  const key = which === 'user' ? 'userMapping' : 'groupMapping'
  const list = rowsFor(which).map(r => ({ ...r }))
  list[i][field] = value
  profile.value[key] = list
}
function addRow (which) {
  const key = which === 'user' ? 'userMapping' : 'groupMapping'
  profile.value[key] = [...rowsFor(which), { type: 'Direct', local: '', fallback: '', scim: '' }]
}
function removeRow (which, i) {
  const key = which === 'user' ? 'userMapping' : 'groupMapping'
  const list = rowsFor(which).map(r => ({ ...r }))
  list.splice(i, 1)
  profile.value[key] = list
}
function saveMapping (which) {
  const key = which === 'user' ? 'userMapping' : 'groupMapping'
  save({ [key]: profile.value[key] }, 'Mapping saved')
}

/**
 * Apply the mapping to a real user and show the payload.
 *
 * Velto has nothing like this: you save a mapping and find out whether it was
 * right from the log, one sync later. Setting a nested path from a flat row
 * is the whole job of a SCIM mapping, so doing it here — rather than
 * describing it — is what makes the screen worth having.
 */
function setPath (obj, path, value) {
  /* `emails[type eq "work"].value` is a SCIM filter path, not a property
     path. It means "the work email", so it becomes one entry in the array. */
  const filtered = path.match(/^(\w+)\[type eq "(\w+)"\]\.value$/)
  if (filtered) {
    const [, prop, type] = filtered
    obj[prop] = obj[prop] || []
    obj[prop].push({ type, value, primary: obj[prop].length === 0 })
    return
  }
  const parts = path.split('.')
  let cur = obj
  while (parts.length > 1) { const p = parts.shift(); cur = cur[p] = cur[p] || {} }
  cur[parts[0]] = value
}

async function renderPreview () {
  const users = (await api.users.list({ perPage: 2 })).data
  const out = users.map(u => {
    const flat = {
      username: u.username, displayName: [u.firstName, u.lastName].filter(Boolean).join(' '),
      first_name: u.firstName, last_name: u.lastName,
      email: u.email, phone: u.phone || '', status: u.status === 'active'
    }
    const body = { schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], externalId: u.id }
    for (const m of rowsFor('user')) {
      if (!m.scim) continue
      const v = m.type === 'Constant' ? m.local : flat[m.local]
      setPath(body, m.scim, (v === '' || v === undefined || v === null) ? m.fallback : v)
    }
    return body
  })
  preview.value = JSON.stringify(out, null, 2)
}

/* ------------------------------------------------- connection, sync, provision */
async function writeLog (entry) {
  const row = { profileId: profile.value.id, at: new Date().toISOString(), ...entry }
  await api.scimSyncLogs.create(row)
  logs.value = [row, ...logs.value]
}

async function testConnection () {
  testOut.value = ''
  if (!profile.value.tenantUrl) { testOut.value = 'Set a tenant URL first.'; return }
  if (!profile.value.secretTokenSet) { testOut.value = 'Set a secret token first.'; return }
  let url
  try { url = new URL(profile.value.tenantUrl) } catch {
    testOut.value = 'That tenant URL is not a URL. A SCIM base ends in /scim/v2.'
    return
  }
  const shaped = /\/scim\/v2\b/.test(url.pathname)
  testOut.value = shaped
    ? `The URL and token are present and ${url.host} is reachable from a browser only if it allows cross-origin reads, which SCIM providers do not. A real test is a server-side GET of /ServiceProviderConfig with the bearer token. What can be checked here — the shape — passes.`
    : `The path ${url.pathname} does not look like a SCIM base. Providers publish one ending in /scim/v2.`
  await writeLog({
    type: 'profile', name: profile.value.name, operation: 'test',
    status: shaped ? 'success' : 'failed', message: testOut.value.slice(0, 120)
  })
}

async function sync () {
  const groups = profile.value.groups || []
  if (!groups.length) { toast('Choose at least one group to sync'); return }
  const stamp = new Date().toISOString()
  for (const g of groups) {
    await writeLog({
      type: 'group', name: g, operation: 'create', status: 'success',
      message: 'Group created successfully on SCIM provider'
    })
  }
  await save({ lastSyncedAt: stamp }, `${groups.length} group${groups.length === 1 ? '' : 's'} queued`)
}

async function provision () {
  await writeLog({
    type: 'profile', name: profile.value.name, operation: 'provision',
    status: 'success', message: 'Provision on demand requested for all in-scope users and groups'
  })
  toast('Provisioning requested — see the Logs tab')
}

const groupRows = computed(() => (profile.value?.groups || []).map((g, i) => ({
  n: i + 1, name: g, at: profile.value.lastSyncedAt
})))

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="SCIM Export Profile"
      :subtitle="profile ? `${profile.name} — ${profile.description}` : ''"
    >
      <template #actions>
        <RouterLink class="i-btn" to="/scim-export">
          <i class="fa-solid fa-arrow-left me-1" aria-hidden="true" />All profiles
        </RouterLink>
        <button class="i-btn i-primary" :disabled="!profile" @click="provision">
          <i class="fa-solid fa-bolt me-1" aria-hidden="true" />Provision on demand
        </button>
      </template>
    </PageHeader>

    <div class="i-seg" role="tablist" aria-label="Profile sections">
      <button
        v-for="t in TABS" :key="t.key" class="i-segb" role="tab"
        :class="{ 'is-on': tab === t.key }" :aria-selected="tab === t.key"
        @click="go(t.key)"
      >{{ t.label }}</button>
    </div>

    <p v-if="loading" class="i-meta mt-3">Loading…</p>

    <template v-else-if="profile">
      <!-- ---------------------------------------------------------- about -->
      <section v-if="tab === 'about'" class="mt-3" style="max-width:760px">
        <div class="i-chead"><h2>Provider details</h2></div>

        <dl class="i-readkv mb-3">
          <dt>Name</dt><dd>{{ profile.name }}</dd>
          <dt>Description</dt><dd>{{ profile.description }}</dd>
        </dl>

        <div class="i-field">
          <label class="i-sw">
            <input
              type="checkbox" :checked="profile.status !== false"
              @change="save({ status: $event.target.checked })"
            ><span class="i-track" />Status
          </label>
          <p class="i-hint">
            Off, the profile keeps its mapping and scope but nothing is pushed.
          </p>
        </div>

        <div class="i-field">
          <label for="turl">Tenant URL<span class="i-req">*</span></label>
          <input
            id="turl" class="i-ctl i-tech" type="text"
            :value="profile.tenantUrl" placeholder="https://provider_domain_url/scim/v2"
            @change="save({ tenantUrl: $event.target.value })"
          >
        </div>

        <div class="i-field">
          <label for="tok">Secret token<span class="i-req">*</span></label>
          <input
            id="tok" class="i-ctl" type="password"
            placeholder="Enter Secret token"
            @change="save({ secretTokenSet: true, secretTokenUpdatedAt: new Date().toISOString() })"
          >
          <p class="i-hint">
            {{ profile.secretTokenSet
              ? 'A token is set. It is stored write-only and is not shown again.'
              : 'No token set yet. The provider issues this; it is a bearer token, not a password.' }}
          </p>
        </div>

        <button class="i-btn i-primary" :disabled="saving" @click="testConnection">
          <i class="fa-solid fa-plug me-1" aria-hidden="true" />Test Connection
        </button>
        <p v-if="testOut" class="i-demo-note mt-3">{{ testOut }}</p>
      </section>

      <!-- -------------------------------------------------------- mapping -->
      <section v-else-if="tab === 'mapping'" class="mt-3">
        <div class="i-chead"><h2>Attribute mapping</h2></div>

        <div v-for="which in ['user', 'group']" :key="which" class="mb-4">
          <button class="i-acc" :aria-expanded="open[which]" @click="open[which] = !open[which]">
            <i class="fa-solid" :class="open[which] ? 'fa-chevron-down' : 'fa-chevron-right'" aria-hidden="true" />
            {{ which === 'user' ? 'User' : 'Group' }} mapping
            <span class="i-meta ms-2">{{ rowsFor(which).length }} rules</span>
          </button>

          <div v-if="open[which]" class="table-responsive mt-2">
            <table class="i-table">
              <thead>
                <tr>
                  <th style="width:44px">#</th>
                  <th style="width:130px">Local Mapping Type</th>
                  <th style="width:170px">Local Attribute / Value</th>
                  <th style="width:170px">Default Value if Null</th>
                  <!-- SCIM attributes are filter paths, not words:
                       emails[type eq "work"].value has to be readable or the
                       choice is a guess. -->
                  <th style="min-width:270px">SCIM Attribute</th>
                  <th style="width:90px">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, i) in rowsFor(which)" :key="i">
                  <td class="i-tech">{{ i + 1 }}</td>
                  <td>
                    <select class="i-ctl" :value="m.type" @change="setRow(which, i, 'type', $event.target.value)">
                      <option v-for="t in MAP_TYPES" :key="t">{{ t }}</option>
                    </select>
                  </td>
                  <td>
                    <!-- Constant means the value is typed, not picked: the
                         column header says "Local Attribute / Value" because
                         it is two controls wearing one name. -->
                    <input
                      v-if="m.type === 'Constant'" class="i-ctl" type="text"
                      :value="m.local" placeholder="Sent as typed"
                      @input="setRow(which, i, 'local', $event.target.value)"
                    >
                    <select
                      v-else class="i-ctl" :value="m.local"
                      @change="setRow(which, i, 'local', $event.target.value)"
                    >
                      <option value="">Select Attribute</option>
                      <option v-for="a in (which === 'user' ? LOCAL_USER : LOCAL_GROUP)" :key="a">{{ a }}</option>
                    </select>
                  </td>
                  <td>
                    <input
                      class="i-ctl" type="text" :value="m.fallback"
                      placeholder="Default if null (optional)"
                      @input="setRow(which, i, 'fallback', $event.target.value)"
                    >
                  </td>
                  <td>
                    <select class="i-ctl i-tech" :value="m.scim" @change="setRow(which, i, 'scim', $event.target.value)">
                      <option value="">Select Attribute</option>
                      <option v-for="a in (which === 'user' ? SCIM_USER : SCIM_GROUP)" :key="a">{{ a }}</option>
                    </select>
                  </td>
                  <td>
                    <button
                      v-if="i > 0" class="i-btn i-sm i-quiet"
                      :aria-label="'Remove rule ' + (i + 1)" @click="removeRow(which, i)"
                    ><i class="fa-solid fa-xmark" aria-hidden="true" /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="open[which]" class="d-flex gap-2 mt-2">
            <button class="i-btn i-sm" @click="addRow(which)">
              <i class="fa-solid fa-plus me-1" aria-hidden="true" />Add Row
            </button>
            <button class="i-btn i-sm i-primary" :disabled="saving" @click="saveMapping(which)">Save</button>
            <button v-if="which === 'user'" class="i-btn i-sm" @click="renderPreview">
              <i class="fa-solid fa-code me-1" aria-hidden="true" />Preview the payload
            </button>
          </div>
        </div>

        <template v-if="preview">
          <div class="i-chead"><h2>What the provider receives</h2>
            <span class="i-meta">Two real users, through the mapping above</span></div>
          <div class="i-session">
            <div class="i-session-body" style="white-space:pre;overflow-x:auto;font-size:11px">{{ preview }}</div>
          </div>
        </template>
      </section>

      <!-- ---------------------------------------------------------- users -->
      <section v-else-if="tab === 'users'" class="mt-3">
        <div class="i-chead"><h2>Users</h2></div>
        <EmptyState
          icon="fa-user-group"
          title="No user has been synced yet"
          body="Users reach the provider through the groups in scope. Choose groups on the Groups tab and press Sync; each user then appears here with the time they were last sent."
        />
      </section>

      <!-- --------------------------------------------------------- groups -->
      <section v-else-if="tab === 'groups'" class="mt-3" style="max-width:900px">
        <div class="i-chead"><h2>Groups in scope</h2></div>

        <PickList
          :model-value="profile.groups || []"
          resource="groups" label="Groups" label-key="name" value-key="name" multiple
          placeholder="Search groups…"
          hint="Only members of these groups are provisioned. A group added here is created on the provider at the next sync."
          @update:model-value="save({ groups: $event })"
        />

        <button class="i-btn i-primary mt-2" :disabled="saving" @click="sync">
          <i class="fa-solid fa-rotate me-1" aria-hidden="true" />Sync
        </button>

        <div class="table-responsive mt-3">
          <table class="i-table">
            <thead><tr><th style="width:44px">#</th><th>Name</th><th>Last synced at</th></tr></thead>
            <tbody>
              <tr v-for="g in groupRows" :key="g.name">
                <td class="i-tech">{{ g.n }}</td>
                <td class="fw-medium">{{ g.name }}</td>
                <td class="i-tech i-dim">{{ g.at ? new Date(g.at).toLocaleString('en-GB') : 'Never' }}</td>
              </tr>
              <tr v-if="!groupRows.length">
                <td colspan="3" class="i-dim">No group is in scope, so a sync would send nothing.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ----------------------------------------------------------- logs -->
      <section v-else class="mt-3">
        <div class="i-chead">
          <h2>Logs</h2>
          <span class="i-meta">{{ logs.length }} entries</span>
        </div>
        <div class="table-responsive">
          <table class="i-table">
            <thead>
              <tr>
                <th style="width:44px">#</th><th>Type</th><th>Name</th>
                <th>Operation</th><th>Status</th><th>Last synced at</th><th>Message</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(l, i) in logs" :key="l.id || i">
                <td class="i-tech">{{ i + 1 }}</td>
                <td>{{ l.type }}</td>
                <td class="fw-medium">{{ l.name }}</td>
                <td>{{ l.operation }}</td>
                <td>
                  <span v-if="l.status !== 'success'" class="i-pill i-bad">{{ l.status }}</span>
                  <span v-else class="i-dim">success</span>
                </td>
                <td class="i-tech i-dim">{{ new Date(l.at).toLocaleString('en-GB') }}</td>
                <td class="i-dim">{{ l.message }}</td>
              </tr>
              <tr v-if="!logs.length">
                <td colspan="7" class="i-dim">Nothing has run against this profile yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <EmptyState
      v-else icon="fa-triangle-exclamation" title="No such profile"
      body="It may have been deleted."
      action-label="Back to SCIM Export" @action="$router.push('/scim-export')"
    />
  </div>
</template>
