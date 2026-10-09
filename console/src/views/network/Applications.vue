<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'
import Sheet from '../../components/ui/Sheet.vue'
import SessionSurface from '../../components/ui/SessionSurface.vue'

/**
 * Applications — what people actually connect to.
 *
 * The production add form changes shape by type: a web application takes a
 * URL, while RDP, SSH and VNC each take eight fields including the session
 * controls. That conditional form is reproduced here, because it is the part
 * of this screen that carries the product's differentiation.
 *
 * Connect opens the session surface for the three remote types.
 */

const toast = inject('toast', () => {})
const refreshStats = inject('refreshStats', () => {})

const rows = ref([]); const total = ref(0); const loading = ref(true)
const page = ref(1); const perPage = ref(25)
const sort = ref('name'); const dir = ref('asc')
const search = ref(''); const filter = ref('all')
const selectedIds = ref([]); const table = ref(null)
const confirmOpen = ref(false)
const sheetOpen = ref(false)
const saving = ref(false)
const editingId = ref(null)
const form = ref(blank())
const sessionOpen = ref(false)
const sessionApp = ref(null)

/**
 * The seven application types, each with its own fields.
 *
 * This screen had one flat shape — name, host, port — for every type, which
 * is wrong in both directions: it asks a web application for a port it does
 * not need, and never asks a database for its driver or a file share for its
 * share name, without which neither can be reached at all.
 *
 * `fields` is what that type actually needs; `controls` is which of the
 * data-loss controls apply. Session recording means nothing for a file share
 * and blocking downloads means nothing for SSH, so neither is offered there.
 */
const TYPES = [
  { key: 'web', label: 'Web', icon: 'fa-globe', hint: 'Reached in a browser through the gateway.',
    fields: [
      { key: 'host', label: 'URL', required: true, placeholder: 'https://app.internal',
        hint: 'Reached through the gateway — it never needs a public DNS record.' },
      { key: 'landingPage', label: 'Landing page', placeholder: '/login',
        hint: 'Where a session starts. Blank opens the root.' }
    ],
    switches: [
      { key: 'directAccess', label: 'Allow direct access' },
      { key: 'useInternalIp', label: 'Resolve to the internal IP' }
    ],
    controls: ['blockCopyPaste', 'watermark', 'blockDownloads'] },

  { key: 'fqdn', label: 'FQDN', icon: 'fa-at', hint: 'A named host reached by domain name.',
    fields: [
      { key: 'host', label: 'Fully qualified domain name', required: true, placeholder: 'site.instasafe.com' },
      { key: 'ports', label: 'Ports', required: true, placeholder: '80,443,1000-2000',
        hint: 'Comma-separated, and ranges are allowed.' }
    ],
    controls: [] },

  { key: 'rdp', label: 'RDP', icon: 'fa-desktop', hint: 'Windows remote desktop.',
    fields: [
      { key: 'host', label: 'IP address', required: true, placeholder: '10.20.4.17' },
      { key: 'port', label: 'Port', type: 'number' }
    ],
    controls: ['blockCopyPaste', 'watermark', 'sessionRecording'] },

  { key: 'ssh', label: 'SSH', icon: 'fa-terminal', hint: 'Shell access to a host.',
    fields: [
      { key: 'host', label: 'IP address', required: true, placeholder: '10.20.4.17' },
      { key: 'port', label: 'Port', type: 'number' }
    ],
    controls: ['blockCopyPaste', 'watermark', 'sessionRecording'] },

  { key: 'vnc', label: 'VNC', icon: 'fa-display', hint: 'Remote framebuffer.',
    fields: [
      { key: 'host', label: 'IP address', required: true, placeholder: '10.20.4.17' },
      { key: 'port', label: 'Port', type: 'number' }
    ],
    controls: ['blockCopyPaste', 'watermark', 'sessionRecording'] },

  { key: 'db', label: 'Database', icon: 'fa-database', hint: 'A database reached through the gateway.',
    fields: [
      { key: 'driver', label: 'Driver', required: true,
        options: ['PostgreSQL', 'MySQL', 'Microsoft SQL Server', 'Oracle', 'MongoDB'] },
      { key: 'host', label: 'Host', required: true, placeholder: '10.20.4.33' },
      { key: 'port', label: 'Port', type: 'number' }
    ],
    controls: ['sessionRecording'] },

  { key: 'wfs', label: 'File share', icon: 'fa-folder-open', hint: 'A Windows file share.',
    fields: [
      { key: 'host', label: 'Host', required: true, placeholder: '10.20.4.50' },
      { key: 'share', label: 'Share', required: true, placeholder: 'folder name' },
      { key: 'domain', label: 'Domain', placeholder: 'ISA' }
    ],
    controls: ['blockDownloads'] }
]

const DEFAULT_PORT = { web: 443, fqdn: 443, rdp: 3389, ssh: 22, vnc: 5900, db: 5432, wfs: 445 }

/** The data-loss controls, and what each one actually does. */
const CONTROLS = {
  sessionRecording: ['Record the session', 'Every keystroke and frame, replayable from the session log.'],
  blockCopyPaste: ['Block copy and paste', 'Stops the clipboard crossing between the session and the device.'],
  watermark: ['Watermark with the user identity', 'A photograph of the screen still names who took it.'],
  blockDownloads: ['Block downloads', 'Files can be read in the session but not taken out of it.']
}

const typeDef = computed(() => TYPES.find(t => t.key === form.value.type) || TYPES[0])

function blank () {
  return {
    name: '', type: 'web', host: '', port: 443, ports: '', owner: 'Engineering',
    status: 'active', gateway: '',
    landingPage: '', directAccess: false, useInternalIp: false,
    driver: '', share: '', domain: '',
    sessionRecording: false, blockCopyPaste: false, watermark: false, blockDownloads: false
  }
}

/* Applications are reached through a gateway. An application with none is
   configured but unreachable, which is worth seeing in the list rather than
   discovering when somebody cannot connect. */
const gateways = ref([])

/**
 * Changing the type changes which fields exist, so the values that belonged
 * to the old one have to go with it. Leaving a stale SSH port on a file share
 * is the kind of thing that saves cleanly and fails at connect time.
 */
watch(() => form.value.type, (t) => {
  if (editingId.value) return       // editing: leave the saved values alone
  form.value.port = DEFAULT_PORT[t] || 443

  const keep = new Set(typeDef.value.controls)
  for (const c of Object.keys(CONTROLS)) if (!keep.has(c)) form.value[c] = false

  /* Remote sessions default to recorded and watermarked: that is the reason
     to put them behind a gateway at all. */
  if (['rdp', 'ssh', 'vnc'].includes(t)) {
    form.value.sessionRecording = true
    form.value.watermark = true
  }
})

const columns = [
  { key: 'name', label: 'Application', bold: true },
  { key: 'type', label: 'Type', upper: true },
  { key: 'host', label: 'Host', mono: true },
  { key: 'port', label: 'Port', mono: true, align: 'right' },
  { key: 'owner', label: 'Owner' },
  { key: 'gateway', label: 'Gateway', mono: true,
    cell: (v) => v || 'unassigned',
    pill: (v) => v ? null : 'att' },
  { key: 'sessionRecording', label: 'Recording', bool: true },
  { key: 'status', label: 'Status',
    cell: (v) => v.charAt(0).toUpperCase() + v.slice(1),
    pill: (v) => v === 'active' ? null : 'bad' }
]

const chips = computed(() => [
  { key: 'all', label: 'All', n: total.value },
  ...TYPES.map(t => ({ key: t.key, label: t.label }))
])

async function load () {
  loading.value = true
  const filters = filter.value === 'all' ? {} : { type: filter.value }
  const res = await api.applications.list({
    page: page.value, perPage: perPage.value, sort: sort.value, dir: dir.value,
    search: search.value, searchFields: ['name', 'host', 'owner', 'type'], filters
  })
  rows.value = res.data; total.value = res.total; loading.value = false
}

let timer
watch(search, () => { clearTimeout(timer); timer = setTimeout(() => { page.value = 1; load() }, 220) })
watch([page, perPage, filter], load)
function onSort (k, d) { sort.value = k; dir.value = d; page.value = 1; load() }

function openAdd () { form.value = blank(); editingId.value = null; sheetOpen.value = true }

function openEdit (row) {
  form.value = { ...blank(), ...row }
  editingId.value = row.id
  sheetOpen.value = true
}

async function save () {
  if (!form.value.name || !form.value.host) {
    toast('Name and host are required', 'bad'); return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await api.applications.update(editingId.value, { ...form.value })
      toast(form.value.name + ' updated')
    } else {
      await api.applications.create({ ...form.value })
      toast(form.value.name + ' added')
    }
    sheetOpen.value = false
    refreshStats(); page.value = 1; load()
  } catch (err) {
    toast('Could not save: ' + (err?.message || 'unknown error'), 'bad')
  } finally {
    saving.value = false
  }
}

async function removeSelected () {
  const n = selectedIds.value.length
  await api.applications.removeMany(selectedIds.value)
  confirmOpen.value = false
  table.value?.clearSelection()
  toast(n + ' application' + (n === 1 ? '' : 's') + ' deleted')
  refreshStats(); load()
}

function connect (row) {
  sessionApp.value = row
  sessionOpen.value = true
}

async function onSessionEnded ({ app, seconds }) {
  await api.events.record({
    type: 'session.ended',
    message: 'Session to ' + app.name + ' ended after ' + seconds + 's',
    severity: 'info'
  })
  toast('Session to ' + app.name + ' ended — recorded in the event log')
}

const names = computed(() => {
  const n = rows.value.filter(x => selectedIds.value.includes(x.id)).map(x => x.name)
  if (n.length > 3) return n.slice(0, 3).join(', ') + ' and ' + (n.length - 3) + ' more'
  return n.join(', ')
})

onMounted(async () => {
  load()
  gateways.value = (await api.gateways.list({ perPage: 0 })).data
})
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Applications"
      subtitle="What people connect to. RDP, SSH and VNC applications can be launched from here."
    >
    </PageHeader>

    <div class="i-strip">
      <div class="i-ftabs">
        <button
          v-for="c in chips" :key="c.key"
          class="i-chip" :class="{ 'is-on': filter === c.key }"
          :aria-pressed="filter === c.key" @click="filter = c.key"
        >
          {{ c.label }}<span v-if="c.n" class="i-n">{{ c.n }}</span>
        </button>
      </div>
      <div class="i-right">
        <label class="i-search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input v-model="search" type="search" placeholder="Search application, host or owner">
        </label>
        <div class="i-tools">
        <button class="i-btn"><i class="fa-solid fa-download" aria-hidden="true" /> Export</button>
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add application
        </button>
        </div>
      </div>
    </div>

    <DataTable
      ref="table" :columns="columns" :rows="rows" :total="total" :loading="loading"
      v-model:page="page" v-model:perPage="perPage" :sort="sort" :dir="dir"
      :row-action="{ label: 'Connect', when: (r) => ['rdp','ssh','vnc'].includes(r.type) }"
      @sort="onSort" @selection="selectedIds = $event"
      @row-action="connect" @row-click="openEdit"
    >
      <template #bulk>
        <button class="i-btn i-sm i-danger" @click="confirmOpen = true">Delete</button>
      </template>
      <template #empty>
        <EmptyState
          icon="fa-grip"
          :title="search ? 'Nothing matches that search' : 'No applications of this type'"
          body="An application is a host and a port that an access rule can point at."
          :action-label="search ? '' : 'Add application'"
          @action="openAdd"
        />
      </template>
    </DataTable>

    <!-- add: the form changes shape by type, as production does -->
    <Sheet
      v-model:open="sheetOpen"
      :title="editingId ? 'Edit application' : 'Add application'"
      subtitle="Access rules point at this once it exists."
    >
      <div class="i-formsec">
        <h3>Type</h3>
        <p class="i-secsub">Decides which fields matter and which session controls apply.</p>
        <div class="d-flex flex-wrap gap-2">
          <button
            v-for="t in TYPES" :key="t.key"
            class="i-chip" :class="{ 'is-on': form.type === t.key }"
            :aria-pressed="form.type === t.key"
            @click="form.type = t.key"
          >
            <i class="fa-solid" :class="t.icon" aria-hidden="true" /> {{ t.label }}
          </button>
        </div>
        <p class="i-hint">{{ TYPES.find(t => t.key === form.type)?.hint }}</p>
      </div>

      <div class="i-formsec">
        <h3>Where it lives</h3>
        <div class="i-frow">
          <div class="i-field">
            <label for="an">Name <span class="i-req">*</span></label>
            <input id="an" class="i-ctl" v-model="form.name" placeholder="Finance DB">
          </div>
          <div class="i-field">
            <label for="ao">Owner</label>
            <select id="ao" class="i-ctl" v-model="form.owner">
              <option v-for="d in ['Engineering','Finance','Sales','Support','HR','Operations','IT','Security','Marketing']" :key="d">{{ d }}</option>
            </select>
          </div>
        </div>
        <!-- What this type needs, and only what it needs. A web application
             has no port and a file share has no landing page. -->
        <div class="i-frow">
          <div v-for="f in typeDef.fields" :key="f.key" class="i-field">
            <label :for="'af_' + f.key">
              {{ f.label }}<span v-if="f.required" class="i-req">*</span>
            </label>
            <select v-if="f.options" :id="'af_' + f.key" class="i-ctl" v-model="form[f.key]">
              <option value="">Select…</option>
              <option v-for="o in f.options" :key="o">{{ o }}</option>
            </select>
            <input
              v-else :id="'af_' + f.key" class="i-ctl"
              :type="f.type || 'text'" v-model="form[f.key]" :placeholder="f.placeholder || ''"
            >
            <p v-if="f.hint" class="i-hint">{{ f.hint }}</p>
          </div>

          <div class="i-field">
            <label for="agw">Gateway</label>
            <select id="agw" class="i-ctl" v-model="form.gateway">
              <option value="">Unassigned</option>
              <option v-for="g in gateways" :key="g.id" :value="g.name">
                {{ g.name }} — {{ g.region }}
              </option>
            </select>
            <p class="i-hint">Traffic reaches this application through the gateway. Without one it is unreachable.</p>
          </div>
        </div>

        <div v-if="typeDef.switches" class="d-flex flex-column gap-2 mt-2">
          <label v-for="sw in typeDef.switches" :key="sw.key" class="i-sw">
            <input type="checkbox" v-model="form[sw.key]"><span class="i-track" />{{ sw.label }}
          </label>
        </div>
      </div>

      <div v-if="typeDef.controls.length" class="i-formsec">
        <h3>Data controls</h3>
        <p class="i-secsub">
          The part that is InstaSafe rather than {{ typeDef.label }}. Only the
          controls that mean something for this type are offered.
        </p>
        <div class="d-flex flex-column gap-3">
          <label v-for="c in typeDef.controls" :key="c" class="i-sw">
            <input type="checkbox" v-model="form[c]"><span class="i-track" />
            <span>
              {{ CONTROLS[c][0] }}
              <small class="d-block" style="color:var(--i-mute);font-size:var(--i-t-micro)">{{ CONTROLS[c][1] }}</small>
            </span>
          </label>
        </div>
      </div>

      <template #footer>
        <button class="i-btn i-quiet" @click="sheetOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Save application') }}
          </button>
        </div>
      </template>
    </Sheet>

    <SessionSurface v-model:open="sessionOpen" :app="sessionApp" @ended="onSessionEnded" />

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="'Delete ' + selectedIds.length + ' application' + (selectedIds.length === 1 ? '' : 's') + '?'"
      :confirm-label="'Delete ' + selectedIds.length"
      @confirm="removeSelected"
    >
      <strong class="i-named">{{ names }}</strong> becomes unreachable immediately, and any
      access rule pointing at it stops matching. This cannot be undone.
    </ConfirmModal>
  </div>
</template>
