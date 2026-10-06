<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

/**
 * The RDP / SSH / VNC session surface.
 *
 * Clicking Connect on an application in the real console hands you off to a
 * remote desktop or terminal. We cannot run one, and pretending to would be
 * dishonest — so this is framed as a demo surface that shows the controls
 * that genuinely wrap a session in production: the watermark, the copy-paste
 * block, session recording, and the disconnect.
 *
 * Those four are the differentiated part of InstaSafe's RDP/SSH story and
 * they are exactly what the option set on /applications configures, so this
 * is where a visitor sees what those switches actually do.
 */

const props = defineProps({
  open: Boolean,
  app: { type: Object, default: null },
  user: { type: String, default: 'demo.admin' }
})
const emit = defineEmits(['update:open', 'ended'])

const lines = ref([])
const elapsed = ref(0)
const recording = ref(false)
const clipboardTries = ref(0)
let timer = null
let typer = null

const isTerminal = computed(() => props.app?.type === 'ssh')

/** A plausible session transcript, typed out rather than dumped, so it reads
 *  as something happening rather than a screenshot of text. */
function script () {
  const a = props.app
  if (!a) return []
  if (a.type === 'ssh') {
    return [
      `Connecting to ${a.host}:${a.port} through gateway gw-mum-01…`,
      'Verifying device posture… 6/6 checks passed',
      'Access rule #10 "Finance → Reports DB" (allow)',
      '',
      `Last login: ${new Date().toUTCString()} from 10.20.0.5`,
      `${props.user}@${a.name.toLowerCase().replace(/\s+/g, '-')}:~$ uptime`,
      ' 14:22:09 up 73 days,  4:11,  2 users,  load average: 0.08, 0.12, 0.09',
      `${props.user}@${a.name.toLowerCase().replace(/\s+/g, '-')}:~$ whoami`,
      props.user,
      `${props.user}@${a.name.toLowerCase().replace(/\s+/g, '-')}:~$ `
    ]
  }
  return [
    `Connecting to ${a.host}:${a.port} through gateway gw-mum-01…`,
    'Verifying device posture… 6/6 checks passed',
    `Access rule evaluated — allow`,
    '',
    '  [ This is a demo surface, not a live desktop. ]',
    '',
    `  A real session would render ${a.name} here, wrapped in the`,
    '  controls listed on the right. Those controls are the part',
    '  that is InstaSafe rather than RDP.',
    ''
  ]
}

function start () {
  lines.value = []
  elapsed.value = 0
  clipboardTries.value = 0
  recording.value = !!props.app?.sessionRecording
  const all = script()
  let i = 0
  typer = setInterval(() => {
    if (i >= all.length) { clearInterval(typer); typer = null; return }
    lines.value.push(all[i++])
  }, 260)
  timer = setInterval(() => { elapsed.value++ }, 1000)
}

function stop () {
  clearInterval(timer); clearInterval(typer)
  timer = null; typer = null
}

function end () {
  stop()
  emit('ended', { app: props.app, seconds: elapsed.value })
  emit('update:open', false)
}

/** Copy-paste block: intercept the real clipboard event so the restriction is
 *  demonstrable rather than described. */
function onCopy (e) {
  if (!props.app?.blockCopyPaste) return
  e.preventDefault()
  clipboardTries.value++
}

const clock = computed(() => {
  const m = Math.floor(elapsed.value / 60)
  const s = elapsed.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

watch(() => props.open, (o) => o ? start() : stop())
onUnmounted(stop)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="i-scrim" @click="end" />
    <div v-if="open && app" class="i-sheet" style="width:min(880px,100vw)" role="dialog" aria-modal="true">
      <div class="i-sheeth">
        <div>
          <h2>{{ app.name }}</h2>
          <p class="i-sub">
            {{ app.type.toUpperCase() }} · <span class="i-tech">{{ app.host }}:{{ app.port }}</span>
            · gateway gw-mum-01
          </p>
        </div>
        <button class="i-x" @click="end" aria-label="End session">
          <i class="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>

      <div class="i-sheetb">
        <div class="row g-3">
          <div class="col-12 col-lg-8">
            <div class="i-session" @copy="onCopy">
              <div class="i-session-bar">
                <span class="i-dot i-ok" />
                Connected
                <span class="ms-auto i-tech">{{ clock }}</span>
                <span v-if="recording" class="i-pill i-bad ms-2" style="font-size:10.5px">
                  <i class="fa-solid fa-circle" style="font-size:7px" aria-hidden="true" /> REC
                </span>
              </div>
              <div class="i-session-body">
                <div v-for="(l, i) in lines" :key="i">{{ l || ' ' }}</div>
                <span v-if="isTerminal && !typer" class="i-caret-blink">▊</span>
              </div>
              <div v-if="app.watermark" class="i-session-wm">
                {{ user }} · {{ new Date().toLocaleDateString('en-GB') }}
              </div>
            </div>

            <p v-if="clipboardTries" class="i-err mt-2">
              <i class="fa-solid fa-ban me-1" aria-hidden="true" />
              Copy blocked by policy — {{ clipboardTries }}
              attempt{{ clipboardTries === 1 ? '' : 's' }} logged to the event log.
            </p>
          </div>

          <div class="col-12 col-lg-4">
            <div class="i-chead"><h2>Session controls</h2></div>
            <p style="font-size:12.5px;color:var(--i-dim);margin:0 0 14px">
              Set per application. These are what wrap the session.
            </p>

            <div class="i-checkrow">
              <span class="i-checkicon">
                <i class="fa-solid" :class="app.sessionRecording ? 'fa-check' : 'fa-minus'"
                   :style="{ color: app.sessionRecording ? 'var(--i-ok)' : 'var(--i-mute)' }" aria-hidden="true" />
              </span>
              <span style="flex:1;font-size:12.5px">Session recording</span>
            </div>
            <div class="i-checkrow">
              <span class="i-checkicon">
                <i class="fa-solid" :class="app.blockCopyPaste ? 'fa-check' : 'fa-minus'"
                   :style="{ color: app.blockCopyPaste ? 'var(--i-ok)' : 'var(--i-mute)' }" aria-hidden="true" />
              </span>
              <span style="flex:1;font-size:12.5px">Block copy and paste</span>
            </div>
            <div class="i-checkrow">
              <span class="i-checkicon">
                <i class="fa-solid" :class="app.watermark ? 'fa-check' : 'fa-minus'"
                   :style="{ color: app.watermark ? 'var(--i-ok)' : 'var(--i-mute)' }" aria-hidden="true" />
              </span>
              <span style="flex:1;font-size:12.5px">Identity watermark</span>
            </div>

            <div v-if="app.blockCopyPaste" class="i-demo-note mt-3">
              <strong style="color:var(--i-ink)">Try it.</strong>
              Select some text in the session and press Ctrl+C. The copy is
              genuinely intercepted, not just disallowed in a tooltip.
            </div>
            <div v-else class="i-demo-note mt-3">
              Copy and paste is permitted for this application. Turn it off on
              the application's settings and reconnect to see the block.
            </div>
          </div>
        </div>
      </div>

      <div class="i-sheetf">
        <span style="font-size:12px;color:var(--i-mute)">
          Session <span class="i-tech">ses_demo_{{ app.id }}</span>
        </span>
        <div class="i-right">
          <button class="i-btn i-danger-solid" @click="end">
            <i class="fa-solid fa-plug-circle-xmark" aria-hidden="true" /> Disconnect
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.i-caret-blink { animation: blink 1.1s step-end infinite; }
@keyframes blink { 50% { opacity: 0 } }
</style>
