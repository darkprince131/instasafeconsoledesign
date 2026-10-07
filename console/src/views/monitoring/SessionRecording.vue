<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

/**
 * Session recording, with playback.
 *
 * A recording list that cannot be played is a filing cabinet. The point of
 * recording an RDP or SSH session is that somebody reviews it after an
 * incident, so the review surface is the screen — a timeline, a transcript
 * that advances with it, and the ability to scrub.
 *
 * The transcript is synthesised from the session's own metadata rather than
 * being a real capture, and says so. Everything around it — which sessions
 * were recorded and why, who can open one, and the fact that opening one is
 * itself logged — is the part that has to be right.
 */

const toast = inject('toast', () => {})

const rows = ref([])
const loading = ref(true)
const playing = ref(null)
const at = ref(0)
const running = ref(false)
let tick

const columns = [
  { key: 'username', label: 'User', bold: true },
  { key: 'application', label: 'Application' },
  { key: 'type', label: 'Type', upper: true },
  { key: 'gateway', label: 'Gateway', mono: true },
  { key: 'city', label: 'Location' },
  { key: 'startedAt', label: 'Started', dim: true,
    cell: (v) => new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
  { key: 'duration', label: 'Length', mono: true, align: 'right',
    cell: (_, r) => mmss(lengthOf(r)) }
]

/* Deterministic per session, so a recording is the same length every time it
   is opened rather than changing under the reviewer. */
function lengthOf (s) {
  let h = 0
  for (const c of String(s.id)) h = (h * 31 + c.charCodeAt(0)) | 0
  return 120 + Math.abs(h) % 900          // 2 to 17 minutes
}

function mmss (sec) {
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0')
}

async function load () {
  loading.value = true
  // only applications configured to record produce a recording
  const [s, apps] = await Promise.all([
    api.sessions.list({ perPage: 0 }),
    api.applications.list({ perPage: 0 })
  ])
  const recorded = new Set(apps.data.filter(a => a.sessionRecording).map(a => a.name))
  rows.value = s.data.filter(x => recorded.has(x.application)).slice(0, 60)
  loading.value = false
}

const total = computed(() => playing.value ? lengthOf(playing.value) : 0)

/** A transcript keyed to the clock, built from the session's own facts. */
const transcript = computed(() => {
  const s = playing.value
  if (!s) return []
  const t = lengthOf(s)
  const host = s.application.toLowerCase().replace(/\s+/g, '-')
  return [
    [0, `Session opened — ${s.username} → ${s.application} via ${s.gateway}`],
    [3, `Source ${s.city} · device posture passed`],
    [8, `${s.type === 'ssh' ? 'Shell allocated' : 'Desktop handshake complete'}`],
    [Math.round(t * 0.15), s.type === 'ssh' ? `${s.username}@${host}:~$ ls -la /var/log` : 'Window focus: Explorer'],
    [Math.round(t * 0.28), s.type === 'ssh' ? `${s.username}@${host}:~$ tail -f application.log` : 'Window focus: application'],
    [Math.round(t * 0.45), 'Clipboard request — blocked by policy'],
    [Math.round(t * 0.6), s.type === 'ssh' ? `${s.username}@${host}:~$ grep -c ERROR application.log` : 'File dialog opened'],
    [Math.round(t * 0.78), 'Idle — no input for 40s'],
    [Math.round(t * 0.92), s.type === 'ssh' ? `${s.username}@${host}:~$ exit` : 'Window closed'],
    [t, 'Session closed']
  ]
})

const visible = computed(() => transcript.value.filter(([s]) => s <= at.value))

function open (row) {
  playing.value = row
  at.value = 0
  running.value = true
  api.events.record({
    type: 'session.recording.viewed',
    message: `Recording of ${row.username} → ${row.application} opened for review`,
    severity: 'warning'
  })
  toast('Opening a recording is itself logged — see the event log')
}

function toggle () { running.value = !running.value }
function close () { playing.value = null; running.value = false }

onMounted(() => {
  load()
  tick = setInterval(() => {
    if (running.value && playing.value) {
      at.value = at.value >= total.value ? (running.value = false, total.value) : at.value + 1
    }
  }, 250)   // 4x so a review does not take as long as the session
})
onUnmounted(() => clearInterval(tick))
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Session recording"
      subtitle="Recorded RDP, SSH and VNC sessions. Recording is set per application, so this list is only ever as complete as that configuration."
    />

    <!-- player -->
    <template v-if="playing">
      <div class="i-chead">
        <h2>{{ playing.username }} → {{ playing.application }}</h2>
        <span class="i-meta">
          {{ playing.gateway }} · {{ playing.city }} ·
          {{ new Date(playing.startedAt).toLocaleString('en-GB') }}
        </span>
      </div>

      <div class="i-session">
        <div class="i-session-bar">
          <button class="i-btn i-sm i-quiet" style="color:inherit" @click="toggle">
            <i class="fa-solid" :class="running ? 'fa-pause' : 'fa-play'" aria-hidden="true" />
            {{ running ? 'Pause' : 'Play' }}
          </button>
          <span class="i-tech">{{ mmss(at) }} / {{ mmss(total) }}</span>
          <input
            type="range" class="flex-fill mx-2" :max="total" v-model.number="at"
            aria-label="Scrub" style="accent-color:var(--i-v500)"
          >
          <span class="i-pill i-bad" style="font-size:10.5px">
            <i class="fa-solid fa-circle" style="font-size:7px" aria-hidden="true" /> REC
          </span>
        </div>
        <div class="i-session-body">
          <div v-for="([sec, line], i) in visible" :key="i">
            <span style="color:#747686">{{ mmss(sec) }}</span>  {{ line }}
          </div>
          <span v-if="running">▊</span>
        </div>
        <div class="i-session-wm">{{ playing.username }} · reviewed {{ new Date().toLocaleDateString('en-GB') }}</div>
      </div>

      <div class="d-flex gap-2 mt-3">
        <button class="i-btn" @click="close">Back to list</button>
        <button class="i-btn" @click="at = 0">Restart</button>
      </div>

      <p class="i-demo-note mt-3" style="max-width:680px">
        The transcript is synthesised from this session's own metadata — the user,
        the application, the gateway and the policy that applied — not from a real
        capture. What is real is the surrounding behaviour: only applications with
        recording switched on appear here, and opening a recording writes a
        warning-level row to the event log, because reviewing someone's session is
        itself an action worth auditing.
      </p>
    </template>

    <!-- list -->
    <template v-else>
      <DataTable
        :columns="columns" :rows="rows" :total="rows.length" :loading="loading"
        :selectable="false" :per-page="25"
        :row-action="{ label: 'Play' }"
        @row-action="open" @row-click="open"
      >
        <template #empty>
          <EmptyState
            icon="fa-film"
            title="No recorded sessions"
            body="Recording is set per application. Turn it on for an RDP or SSH application and new sessions will appear here."
          />
        </template>
      </DataTable>
    </template>
  </div>
</template>
