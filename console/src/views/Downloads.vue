<script setup>
import { ref, computed, inject, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import PageHeader from '../components/ui/PageHeader.vue'
import DataTable from '../components/ui/DataTable.vue'
import EmptyState from '../components/ui/EmptyState.vue'

/**
 * Downloads.
 *
 * Two screens that had become one invented list. Velto's User Agents is not a
 * table at all — it is five links, one per platform, two of which go to an app
 * store rather than to a file. Its Gateway Agents is a table of the tenant's
 * own gateways with an installer against each, because a gateway's installer
 * is built for that gateway and is not interchangeable.
 *
 * Both were aliased onto one list of agent *releases*, which is a third thing
 * and lives under Device updates.
 */

const route = useRoute()
const toast = inject('toast', () => {})

const isGateways = computed(() => route.path === '/downloads/gateway-agents')

/* Velto's five, with the destination each one actually goes to. The two
   stores are links out: a mobile agent is installed from the store, and
   pretending to serve a file for it would be a lie. */
const PLATFORMS = [
  { key: 'windows', label: 'Windows', icon: 'fa-brands fa-windows',
    file: 'InstaSafeAgent.msi', note: 'Windows 10 and 11, 64-bit. Installs as a service.' },
  { key: 'macos', label: 'macOS', icon: 'fa-brands fa-apple',
    file: 'InstaSafe.dmg', note: 'Signed and notarised. Ventura or later.' },
  { key: 'linux', label: 'Linux', icon: 'fa-brands fa-linux',
    file: 'instasafe-agent.deb', note: 'Debian and RPM builds. systemd unit included.' },
  { key: 'ios', label: 'iOS', icon: 'fa-brands fa-app-store-ios',
    store: 'App Store', note: 'Installed from the App Store, not served from here.' },
  { key: 'android', label: 'Android', icon: 'fa-brands fa-android',
    store: 'Google Play', note: 'Installed from Google Play, not served from here.' }
]

const rows = ref([])
const loading = ref(true)

/**
 * A gateway's installer row.
 *
 * Velto lists the primary and its backup as separate rows, because they are
 * separate machines and each takes its own build.
 */
const gatewayRows = computed(() => {
  const out = []
  for (const g of rows.value) {
    out.push({ id: g.id + '-p', name: g.name, type: 'primary', location: g.location })
    if (g.backupName) {
      out.push({ id: g.id + '-b', name: g.backupName, type: 'backup', location: g.location })
    }
  }
  return out
})

/**
 * Three builds per gateway, not two.
 *
 * Velto's links are /downloads/gateway-agents/<id>/{windows,linux,osx}, and
 * the backup's are /downloads/backup-gateway-agents/<id>/<os> — a separate
 * path, because the backup's build carries the backup's identity. The osx
 * one is easy to miss on velto: its Apple icon fails to load and renders as
 * a red cross, which reads as "unavailable" rather than "macOS".
 */
const GATEWAY_OS = [
  { key: 'windows', label: 'Windows', icon: 'fa-windows' },
  { key: 'linux', label: 'Linux', icon: 'fa-linux' },
  { key: 'osx', label: 'macOS', icon: 'fa-apple' }
]

const columns = [
  { key: 'name', label: 'Gateway Name', bold: true },
  /* Plain. Primary and backup are two kinds of gateway, not a good state
     and a bad one, and marking one of them put a pill on every row. */
  { key: 'type', label: 'Type', dim: true },
  { key: 'location', label: 'Location' }
]

async function load () {
  if (!isGateways.value) { loading.value = false; return }
  loading.value = true
  const res = await api.gateways.list({ perPage: 0 })
  rows.value = res.data
  loading.value = false
}

/**
 * There is no file to serve from a demo, and offering a download that gives
 * nothing is worse than saying so. The record of the request is real: it goes
 * to the event log, which is where a real one would be audited from.
 */
async function download (what) {
  await api.events.record({
    type: 'download.requested',
    message: `${what} requested from Downloads`
  })
  toast(`${what} — recorded in the event log. This demo serves no binaries.`)
}

watch(() => route.path, load)
onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      :title="isGateways ? 'Gateway Agents' : 'User Agents'"
      :subtitle="isGateways
        ? 'The installer for each gateway. A gateway\'s build carries its own identity, so the primary and its backup are not interchangeable.'
        : 'The client people install. An out-of-date agent is the commonest cause of a posture failure.'"
    />

    <!-- ------------------------------------------------ user agents -->
    <template v-if="!isGateways">
      <div class="i-dlgrid">
        <div v-for="p in PLATFORMS" :key="p.key" class="i-dltile">
          <i class="i-dlicon" :class="p.icon" aria-hidden="true" />
          <div class="i-dlbody">
            <h3>{{ p.label }}</h3>
            <p class="i-dlnote">{{ p.note }}</p>
            <p v-if="p.file" class="i-tech i-dlfile">{{ p.file }}</p>
          </div>
          <button
            class="i-btn" :class="{ 'i-primary': !p.store }"
            @click="download(p.store ? `${p.label} agent (${p.store})` : p.file)"
          >
            <i class="fa-solid" :class="p.store ? 'fa-arrow-up-right-from-square' : 'fa-download'" aria-hidden="true" />
            {{ p.store ? p.store : 'Download' }}
          </button>
        </div>
      </div>

      <p class="i-demo-note mt-3" style="max-width:760px">
        The two mobile agents are links to a store rather than files, which is
        how the product ships them. Nothing here serves a binary: a request is
        written to the event log instead, so the audit trail is real even
        though the file is not.
      </p>
    </template>

    <!-- --------------------------------------------- gateway agents -->
    <template v-else>
      <DataTable
        :columns="columns" :rows="gatewayRows" :total="gatewayRows.length"
        :loading="loading" :selectable="false" :per-page="25"
      >
        <template #actions="{ row }">
          <button
            v-for="os in GATEWAY_OS" :key="os.key"
            class="i-btn i-sm me-1" @click="download(`${row.name} installer (${os.label})`)"
          >
            <i class="fa-brands me-1" :class="os.icon" aria-hidden="true" />{{ os.label }}
          </button>
        </template>
        <template #empty>
          <EmptyState
            icon="fa-server"
            title="No gateways yet"
            body="A gateway's installer appears here once the gateway exists."
          />
        </template>
      </DataTable>
    </template>
  </div>
</template>
