<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Sheet from '../../components/ui/Sheet.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'
import { FORMATS, renderBatch } from '../../lib/siem.js'
import { TIMEZONES } from '../../resources.js'

/**
 * Export Log.
 *
 * This was one destination with a live preview of the wire format. The
 * preview is the good part and it stays. What it was not was velto's screen:
 * velto keeps a **list of export profiles** — Profile Name, Server Type,
 * Server Ip, Protocol, Port — because a tenant ships its event log to the
 * SIEM and its session log somewhere else, and one destination cannot say
 * that.
 *
 * Three things were missing rather than renamed:
 *   · several profiles instead of one
 *   · **Log to be Exported** — Event Log, Session Log or App Access Log. The
 *     old screen always exported events, so two thirds of what velto can ship
 *     could not be configured at all.
 *   · three of velto's seven server types: SPLUNK, SCP, SFTP and EMAIL
 *
 * And one thing is honest about its limits: SCP, SFTP and EMAIL are file
 * deliveries. The batch is rendered exactly the same way; what differs is how
 * it leaves, and a browser cannot open an SSH connection. The preview says so
 * rather than implying a transport that is not there.
 */

const toast = inject('toast', () => {})

/** Velto's seven, mapped to the renderer each one actually wants. */
const SERVER_TYPES = {
  QRADAR: { render: 'leef', transport: 'Syslog', note: 'LEEF 2.0 over syslog, which is what QRadar parses natively.' },
  ARCSIGHT: { render: 'cef', transport: 'Syslog', note: 'CEF over syslog.' },
  SPLUNK: { render: 'json', transport: 'HTTPS (HEC)', note: 'JSON lines to the HTTP Event Collector.' },
  SYSLOG: { render: 'syslog', transport: 'UDP 514 / TCP 601 / TLS 6514', note: 'RFC 5424, the default for most collectors.' },
  SCP: { render: 'json', transport: 'SCP', note: 'A file copied on a schedule. The batch is the same; only the delivery differs, and a browser cannot open an SSH connection — this preview shows the file that would be sent.' },
  SFTP: { render: 'json', transport: 'SFTP', note: 'As SCP: the file is identical, the transport is not something a browser can do.' },
  EMAIL: { render: 'json', transport: 'SMTP', note: 'The batch attached to a mail. It lands in the Demo Inbox here.' }
}

const LOG_TYPES = {
  'Event Log': 'events',
  'Session Log': 'sessions',
  'App Access Log': 'appAccess'
}

const rows = ref([])
const loading = ref(true)
const selectedIds = ref([])
const table = ref(null)
const confirmOpen = ref(false)

const sheetOpen = ref(false)
const editingId = ref(null)
const saving = ref(false)
const form = ref(blank())

const sample = ref([])

function blank () {
  return {
    name: '',
    serverType: 'SYSLOG',
    logType: 'Event Log',
    timezone: '(UTC+05:30) Indian Standard Time',
    serverIp: '',
    backupServerIp: '',
    protocol: 'TLS',
    port: 6514,
    batchSize: 100,
    enabled: true
  }
}

const columns = [
  { key: 'name', label: 'Profile Name', bold: true },
  { key: 'serverType', label: 'Server Type' },
  { key: 'serverIp', label: 'Server Ip', mono: true },
  { key: 'protocol', label: 'Protocol' },
  { key: 'port', label: 'Port', mono: true, align: 'right' },
  { key: 'logType', label: 'Log to be Exported', dim: true }
]

async function load () {
  loading.value = true
  const res = await api.exportProfiles.list({ perPage: 0 })
  rows.value = res.data
  loading.value = false
}

/** The rows a profile would actually ship, for the preview. */
async function loadSample () {
  const kind = LOG_TYPES[form.value.logType]
  if (kind === 'sessions') {
    const r = await api.sessions.list({ perPage: 8 })
    sample.value = r.data.map(s => ({
      at: s.startedAt, type: 'session.open', actor: s.username,
      message: `${s.username} → ${s.application}`, severity: 'info', ip: s.ip
    }))
  } else if (kind === 'appAccess') {
    const r = await api.appAccessLog.list({ perPage: 8 })
    sample.value = r.data.map(a => ({
      at: a.at, type: 'app.access', actor: a.username,
      message: `${a.destination}:${a.port} ${a.action}`,
      severity: a.action === 'Blocked' ? 'warning' : 'info', ip: a.publicIp
    }))
  } else {
    const r = await api.events.list({ perPage: 8 })
    sample.value = r.data
  }
}

const renderKey = computed(() => SERVER_TYPES[form.value.serverType]?.render || 'syslog')

const rendered = computed(() => {
  if (!sample.value.length) return ''
  return renderBatch(sample.value, renderKey.value, form.value.serverIp || 'siem.example.com')
})

function openAdd () {
  form.value = blank(); editingId.value = null; sheetOpen.value = true; loadSample()
}

function openEdit (row) {
  form.value = { ...blank(), ...row }; editingId.value = row.id
  sheetOpen.value = true; loadSample()
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/

async function save () {
  const f = form.value
  if (!f.name.trim()) { toast('The profile needs a name', 'bad'); return }
  if (!f.serverIp.trim()) { toast('A server address is required', 'bad'); return }
  if (!IPV4.test(f.serverIp.trim()) && !/^[a-z0-9.-]+$/i.test(f.serverIp.trim())) {
    toast('Server address must be an IPv4 address or a hostname', 'bad'); return
  }
  if (!(f.port > 0 && f.port <= 65535)) { toast('Port must be between 1 and 65535', 'bad'); return }
  saving.value = true
  try {
    if (editingId.value) await api.exportProfiles.update(editingId.value, { ...f })
    else await api.exportProfiles.create({ ...f })
    toast(`${f.name.trim()} saved`)
    sheetOpen.value = false
    load()
  } finally { saving.value = false }
}

async function removeSelected () {
  const n = selectedIds.value.length
  await api.exportProfiles.removeMany(selectedIds.value)
  table.value?.clearSelection()
  confirmOpen.value = false
  toast(`${n} profile${n === 1 ? '' : 's'} deleted`)
  load()
}

/** Ship one batch now, so the format can be seen end to end. */
async function sendNow () {
  await api.inbox.create({
    id: 'msg_' + Date.now().toString(36),
    kind: 'email',
    subject: `${form.value.serverType} batch → ${form.value.serverIp}:${form.value.port}`,
    body: rendered.value.slice(0, 4000),
    meta: { to: `${form.value.protocol.toLowerCase()}://${form.value.serverIp}:${form.value.port}` },
    read: false,
    at: new Date().toISOString()
  })
  await api.events.record({
    type: 'siem.export',
    message: `${sample.value.length} rows exported as ${form.value.serverType} to ${form.value.serverIp}`
  })
  toast('Batch written to the Demo Inbox — open it to see exactly what would have left')
}

const names = computed(() => rows.value
  .filter(r => selectedIds.value.includes(r.id)).map(r => r.name).join(', '))

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Export Log"
      subtitle="Where this tenant ships its logs. A profile is one destination and one log."
    />

    <div class="i-strip">
      <div class="i-tools">
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add profile
        </button>
      </div>
    </div>

    <DataTable
      ref="table"
      :columns="columns" :rows="rows" :total="rows.length" :loading="loading"
      :per-page="25"
      @selection="selectedIds = $event"
      @row-click="openEdit"
    >
      <template #bulk>
        <button class="i-btn i-sm i-danger" @click="confirmOpen = true">Delete</button>
      </template>
      <template #empty>
        <EmptyState
          icon="fa-file-export"
          title="No export profiles"
          body="Add one to ship the event log, the session log or the application access log to a collector."
          action-label="Add profile"
          @action="openAdd"
        />
      </template>
    </DataTable>

    <Sheet
      v-model:open="sheetOpen"
      :title="editingId ? `Edit ${form.name}` : 'Add Log Profile'"
      subtitle="One destination, one log, and the wire format it leaves in."
      width="720px"
    >
      <div class="i-formsec">
        <div class="i-frow">
          <div class="i-field">
            <label for="profile_name">Profile Name<span class="i-req">*</span></label>
            <input id="profile_name" name="profile_name" class="i-ctl" v-model="form.name" placeholder="Enter Profile Name">
          </div>
          <div class="i-field">
            <label for="log_format">Log Server Format<span class="i-req">*</span></label>
            <select id="log_format" name="log_format" class="i-ctl" v-model="form.serverType" @change="loadSample">
              <option v-for="(v, k) in SERVER_TYPES" :key="k">{{ k }}</option>
            </select>
            <p class="i-hint">{{ SERVER_TYPES[form.serverType].note }}</p>
          </div>
        </div>

        <div class="i-frow">
          <div class="i-field">
            <label for="log_type">Log to be Exported<span class="i-req">*</span></label>
            <select id="log_type" name="log_type" class="i-ctl" v-model="form.logType" @change="loadSample">
              <option v-for="(v, k) in LOG_TYPES" :key="k">{{ k }}</option>
            </select>
          </div>
          <div class="i-field">
            <label for="timezone">Time Zone<span class="i-req">*</span></label>
            <select id="timezone" name="timezone" class="i-ctl" v-model="form.timezone">
              <option v-for="t in TIMEZONES" :key="t">{{ t }}</option>
            </select>
            <p class="i-hint">Timestamps leave in this zone. A collector that assumes UTC will be out by the offset.</p>
          </div>
        </div>

        <div class="i-frow">
          <div class="i-field">
            <label for="log_server_ip">Server Ip<span class="i-req">*</span></label>
            <input id="log_server_ip" name="log_server_ip" class="i-ctl i-tech" v-model="form.serverIp" placeholder="10.20.4.60">
          </div>
          <div class="i-field">
            <label for="service_backup_ip">Backup Server Ip</label>
            <input id="service_backup_ip" name="service_backup_ip" class="i-ctl i-tech" v-model="form.backupServerIp" placeholder="10.20.4.61">
            <p class="i-hint">Used when the first does not answer. Empty means a collector outage loses the batch.</p>
          </div>
        </div>

        <div class="i-frow">
          <div class="i-field">
            <label for="log_protocol">Protocol</label>
            <select id="log_protocol" name="log_protocol" class="i-ctl" v-model="form.protocol">
              <option>TLS</option><option>TCP</option><option>UDP</option>
            </select>
            <p class="i-hint">
              {{ form.protocol === 'UDP'
                ? 'UDP does not retry: a dropped batch is gone and nothing reports it.'
                : 'Transport for this profile. ' + SERVER_TYPES[form.serverType].transport }}
            </p>
          </div>
          <div class="i-field">
            <label for="log_port">Port</label>
            <input id="log_port" name="log_port" class="i-ctl i-tech" type="number" v-model.number="form.port" min="1" max="65535">
          </div>
        </div>
      </div>

      <!-- The part worth keeping: what actually goes on the wire. -->
      <div class="i-formsec">
        <h3>What leaves</h3>
        <p class="i-secsub">
          {{ sample.length }} rows of the {{ form.logType.toLowerCase() }}, rendered as
          {{ FORMATS[renderKey].label }}. This is the real renderer, not a mock-up of one.
        </p>
        <pre class="i-ctl i-tech" style="white-space:pre-wrap;max-height:230px;overflow:auto;font-size:11.5px">{{ rendered || 'Nothing to preview yet.' }}</pre>
        <button class="i-btn i-sm mt-2" :disabled="!rendered" @click="sendNow">
          <i class="fa-solid fa-paper-plane me-1" aria-hidden="true" />Send one batch now
        </button>
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
      :title="`Delete ${selectedIds.length} export profile${selectedIds.length === 1 ? '' : 's'}?`"
      confirm-label="Delete"
      @confirm="removeSelected"
    >
      <strong class="i-named">{{ names }}</strong> stops shipping immediately. Logs already
      delivered stay where they were sent; nothing further leaves until another profile covers it.
    </ConfirmModal>
  </div>
</template>
