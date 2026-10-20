<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import api from '../../api'
import { portalUser } from '../../lib/portal-session.js'

/**
 * The launcher.
 *
 * Velto's page is a search box, a type filter and a grid of tiles grouped
 * under "Other Applications". The grid is right — this is the one screen an
 * employee uses daily and it should be one click deep.
 *
 * What it does not say is the part people actually need: a tile for a
 * network application looks exactly like a tile for a web one, and clicking
 * it when the agent is down does nothing anybody can interpret. So each tile
 * says how it opens, and a tile that cannot open right now says why instead
 * of failing silently.
 */

const toast = inject('toast', () => {})
const user = portalUser

/* How each kind of application actually reaches the user. The browser-based
   ones go through a remote-desktop gateway; the rest need the agent. */
const KINDS = {
  web: { label: 'Web', how: 'Opens in a new browser tab.', browser: true },
  rdp: { label: 'RDP', how: 'A Windows desktop, drawn in the browser.', browser: true },
  ssh: { label: 'SSH', how: 'A terminal, in the browser.', browser: true },
  vnc: { label: 'VNC', how: 'A remote screen, in the browser.', browser: true },
  wfs: { label: 'WFS', how: 'File shares, in the browser.', browser: true },
  db: { label: 'DB', how: 'A database client session.', browser: true },
  fqdn: { label: 'FQDN', how: 'A host inside the network, reached through the agent.', browser: false },
  tcp: { label: 'TCP', how: 'Reached through the agent on this machine.', browser: false },
  udp: { label: 'UDP', how: 'Reached through the agent on this machine.', browser: false },
  net: { label: 'NET', how: 'Reached through the agent on this machine.', browser: false }
}

const rows = ref([])
const loading = ref(true)
const q = ref('')
const type = ref('')
const agentUp = ref(false)

const types = computed(() => {
  const seen = new Set(rows.value.map(a => String(a.type || '').toLowerCase()).filter(Boolean))
  return [...seen].sort()
})

const shown = computed(() => {
  const term = q.value.trim().toLowerCase()
  return rows.value.filter(a => {
    if (type.value && String(a.type).toLowerCase() !== type.value) return false
    if (!term) return true
    return `${a.name} ${a.host || ''} ${a.type || ''}`.toLowerCase().includes(term)
  })
})

function kind (a) {
  return KINDS[String(a.type || '').toLowerCase()] || { label: String(a.type || '?').toUpperCase(), how: '', browser: false }
}

async function load () {
  loading.value = true
  try {
    rows.value = (await api.applications.list({ perPage: 0 })).data
  } finally { loading.value = false }

  /* Same loopback probe the dashboard runs; the answer changes what a tile
     is allowed to promise. */
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 1500)
  try {
    await fetch('http://127.0.0.1:7865/status', { mode: 'no-cors', signal: ctl.signal })
    agentUp.value = true
  } catch { agentUp.value = false } finally { clearTimeout(t) }
}

async function open (a) {
  const k = kind(a)
  if (!k.browser && !agentUp.value) {
    toast(`${a.name} needs the agent, which is not running on this machine.`, 'bad')
    return
  }
  await api.events.record({
    type: 'access.granted',
    message: `${user.value?.username || 'member'} opened ${a.name} from the portal`
  })
  toast(`${a.name} — opened. In production this is a gateway session.`)
}

onMounted(load)
</script>

<template>
  <div class="p-wide">
    <header class="p-ph">
      <h1>Applications</h1>
      <p>Everything your administrator has given you. Click one to open it.</p>
    </header>

    <div class="p-filters">
      <label class="p-search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <input v-model="q" type="search" placeholder="Search applications…" aria-label="Search applications">
      </label>
      <div class="p-chips" role="group" aria-label="Filter by type">
        <button class="p-chip" :class="{ 'is-on': !type }" @click="type = ''">All</button>
        <button
          v-for="t in types" :key="t"
          class="p-chip" :class="{ 'is-on': type === t }" @click="type = t"
        >{{ (KINDS[t]?.label || t).toUpperCase() }}</button>
      </div>
    </div>

    <p v-if="loading" class="p-sub">Loading…</p>

    <div v-else-if="shown.length" class="p-appgrid">
      <button
        v-for="a in shown" :key="a.id" class="p-card p-appcard"
        :class="{ 'is-blocked': !kind(a).browser && !agentUp }"
        @click="open(a)"
      >
        <span class="p-appbadge">{{ kind(a).label }}</span>
        <span class="p-appicon"><i class="fa-solid fa-cube" aria-hidden="true" /></span>
        <strong class="p-appname">{{ a.name }}</strong>
        <span v-if="a.host" class="i-tech p-apphost">{{ a.host }}</span>
        <span class="p-apphow">
          <template v-if="!kind(a).browser && !agentUp">
            Needs the agent, which is not running
          </template>
          <template v-else>{{ kind(a).how }}</template>
        </span>
      </button>
    </div>

    <p v-else class="p-sub">
      <template v-if="q || type">Nothing matches that filter.</template>
      <template v-else>
        Nothing has been assigned to you yet. Your administrator decides what
        appears here.
      </template>
    </p>
  </div>
</template>
