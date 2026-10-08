<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { TOURS, findTour } from '../../tours.js'
import api from '../../api'

/**
 * The guided-flow runner.
 *
 * This is a checklist, not a slideshow. A step completes when its `check`
 * says the work actually happened — a record that did not exist before now
 * does — so nothing advances on a click alone, and the panel is honest about
 * what the visitor has really done.
 *
 * Three things it deliberately does not do:
 *
 *   - It does not block the page. It docks bottom-right and the spotlight is
 *     a cut-out with no pointer events, because every step here requires the
 *     visitor to use the screen underneath it.
 *   - It does not trap. Every step can be skipped, and skipped steps are
 *     shown as skipped rather than quietly counted as done.
 *   - It does not break when a selector stops resolving. The step still runs,
 *     without a spotlight.
 */

const router = useRouter()
const route = useRoute()

const open = ref(false)
const picking = ref(false)
const minimised = ref(false)
const tour = ref(null)
const index = ref(0)
const rect = ref(null)
const status = ref([])      // 'todo' | 'done' | 'skipped' per step
const baseline = ref({})
const ctx = ref({})
const finished = ref(false)
const checking = ref(false)
const doneTours = ref(new Set())

const step = computed(() => tour.value?.steps[index.value] || null)
const completed = computed(() => status.value.filter(s => s === 'done').length)
const skipped = computed(() => status.value.filter(s => s === 'skipped').length)
const allSettled = computed(() =>
  status.value.length > 0 && status.value.every(s => s !== 'todo'))

const KEY = 'i365.tours.done'
function loadDone () {
  try { doneTours.value = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch {}
}
function saveDone () {
  try { localStorage.setItem(KEY, JSON.stringify([...doneTours.value])) } catch {}
}

async function start (id) {
  const t = findTour(id)
  if (!t) return
  tour.value = t
  index.value = 0
  finished.value = false
  minimised.value = false
  picking.value = false
  ctx.value = {}
  status.value = t.steps.map(() => 'todo')

  // what the tenant looked like before any of this, so a check can tell the
  // difference between "they made one" and "one was already there"
  baseline.value = t.baseline ? await t.baseline(api) : {}
  const { data } = await api.events.list({ perPage: 30, sort: 'at', dir: 'desc' })
  baseline.value.events = new Set(data.map(e => e.id))

  open.value = true
  await goto()
}

function stop () {
  open.value = false; picking.value = false
  tour.value = null; rect.value = null
}

function openMenu () { loadDone(); picking.value = true; open.value = true; minimised.value = false }

/** Move to a step: navigate if it names a route, then place the spotlight. */
async function goto () {
  const s = step.value
  if (!s) return
  rect.value = null
  if (s.to && route.path !== s.to) await router.push(s.to)
  await nextTick()
  await new Promise(r => setTimeout(r, 420))
  measure()
}

/**
 * Where to put the ring, or whether to put one at all.
 *
 * The second half matters more than the first. A spotlight that keeps
 * pointing at a button after a slide-in panel has covered it does not read as
 * "this is the thing" — it reads as stuck, because the thing it is circling
 * is no longer on screen. So when a sheet or a modal is open, the ring stands
 * down: whatever the step was pointing at has been superseded by the panel
 * the step asked you to open.
 *
 * It also stands down for an element that is present but not rendered — a
 * zero-size box, or one scrolled out of view — rather than drawing a ring
 * around nothing at the top-left corner.
 */
function measure () {
  const sel = step.value?.target
  if (!sel) { rect.value = null; return }

  /* Something is layered over the page. The target, if it is still there at
     all, is behind it. Pointing at it would be pointing through a scrim. */
  if (sel !== '.i-sheet' && document.querySelector('.i-sheet, .i-modal, .i-scrim')) {
    rect.value = null
    return
  }

  const el = document.querySelector(sel)
  if (!el || !el.offsetParent) { rect.value = null; return }

  const r = el.getBoundingClientRect()
  const onScreen = r.width > 0 && r.height > 0 &&
    r.top < window.innerHeight && r.bottom > 0 &&
    r.left < window.innerWidth && r.right > 0
  rect.value = onScreen
    ? { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 }
    : null
}

/** Polls the current step's check. This is what makes it a flow. */
async function poll () {
  if (!open.value || picking.value || finished.value) return
  const s = step.value
  if (!s || status.value[index.value] !== 'todo') return
  if (checking.value) return
  checking.value = true
  try {
    const ok = await s.check?.(api, baseline.value, ctx.value)
    if (ok) {
      status.value[index.value] = 'done'
      await advance()
    }
  } catch { /* a check that throws is a check that is not satisfied yet */ }
  finally { checking.value = false }
}

async function advance () {
  const nextTodo = status.value.findIndex((v, i) => v === 'todo' && i > index.value)
  if (nextTodo === -1) {
    if (allSettled.value) { finish(); return }
    const anyTodo = status.value.findIndex(v => v === 'todo')
    if (anyTodo === -1) { finish(); return }
    index.value = anyTodo
  } else {
    index.value = nextTodo
  }
  await goto()
}

function skip () {
  status.value[index.value] = 'skipped'
  advance()
}

function jumpTo (i) { index.value = i; goto() }

function finish () {
  finished.value = true
  rect.value = null
  if (tour.value) { doneTours.value.add(tour.value.id); saveDone() }
}

const cardStyle = computed(() => {
  if (!rect.value || minimised.value) return {}
  return {}
})

function onKey (e) {
  if (!open.value) return
  if (e.key === 'Escape') stop()
}

let timer, measurer
onMounted(() => {
  loadDone()
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
  timer = setInterval(poll, 1400)
  measurer = setInterval(() => { if (open.value && !picking.value) measure() }, 900)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', measure)
  window.removeEventListener('scroll', measure, true)
  clearInterval(timer); clearInterval(measurer)
})

defineExpose({ start, openMenu })
</script>

<template>
  <Teleport to="body">
    <!-- ================= the menu ================= -->
    <template v-if="open && picking">
      <div class="i-scrim" @click="stop" />
      <div class="i-tour-menu" role="dialog" aria-modal="true" aria-label="Guided flows">
        <div class="i-sheeth" style="padding:20px 22px 14px">
          <div>
            <h2>Guided flows</h2>
            <p class="i-sub">
              Each one is a job, not a tour of the screens. A step only ticks when
              the work has really been done.
            </p>
          </div>
          <button class="i-x" @click="stop" aria-label="Close">
            <i class="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div style="padding:6px 14px 16px">
          <button
            v-for="t in TOURS" :key="t.id"
            class="i-tour-card" :class="{ 'is-primary': t.primary }" @click="start(t.id)"
          >
            <span class="i-tour-ico"><i class="fa-solid" :class="t.icon" aria-hidden="true" /></span>
            <span style="flex:1;min-width:0">
              <span class="i-tour-title">
                {{ t.title }}
                <span v-if="t.primary" class="i-new ms-1">Start here</span>
                <i
                  v-if="doneTours.has(t.id)" class="fa-solid fa-circle-check ms-1"
                  style="color:var(--i-ok);font-size:11px" aria-hidden="true"
                />
              </span>
              <span class="i-tour-blurb">{{ t.blurb }}</span>
            </span>
            <span class="i-tour-mins">{{ t.steps.length }} steps</span>
          </button>
        </div>
      </div>
    </template>

    <!-- ================= a running flow ================= -->
    <template v-else-if="open && tour">
      <div
        v-if="rect && !minimised && !finished" class="i-spot"
        :style="{ top: rect.top + 'px', left: rect.left + 'px',
                  width: rect.width + 'px', height: rect.height + 'px' }"
      />

      <aside class="i-flow" :class="{ 'is-min': minimised }" aria-live="polite">
        <!-- header -->
        <header class="i-flow-head">
          <i class="fa-solid" :class="tour.icon" aria-hidden="true" />
          <div style="flex:1;min-width:0">
            <div class="i-flow-title">{{ tour.title }}</div>
            <div class="i-flow-prog">
              {{ completed }} of {{ tour.steps.length }} done<template v-if="skipped"> · {{ skipped }} skipped</template>
            </div>
          </div>
          <button class="i-x" style="width:24px;height:24px" @click="minimised = !minimised"
                  :aria-label="minimised ? 'Expand' : 'Minimise'">
            <i class="fa-solid" :class="minimised ? 'fa-chevron-up' : 'fa-chevron-down'"
               style="font-size:11px" aria-hidden="true" />
          </button>
          <button class="i-x" style="width:24px;height:24px" @click="stop" aria-label="End flow">
            <i class="fa-solid fa-xmark" style="font-size:12px" aria-hidden="true" />
          </button>
        </header>

        <div v-if="!minimised" class="i-flow-body">
          <!-- finished -->
          <template v-if="finished">
            <div class="i-verdict is-pass" style="padding:14px 15px">
              <h3 style="font-size:14px">
                <i class="fa-solid fa-circle-check me-2" aria-hidden="true" />
                {{ completed }} of {{ tour.steps.length }} completed
              </h3>
              <p v-if="skipped">{{ skipped }} skipped — the summary stays honest about that.</p>
            </div>
            <p class="i-flow-outro">{{ tour.outro }}</p>
            <ul class="i-flow-recap">
              <li v-for="(s, i) in tour.steps" :key="i">
                <i
                  class="fa-solid" aria-hidden="true"
                  :class="status[i] === 'done' ? 'fa-circle-check' : 'fa-circle-minus'"
                  :style="{ color: status[i] === 'done' ? 'var(--i-ok)' : 'var(--i-mute)' }"
                />
                <span>{{ s.title }}</span>
                <span v-if="status[i] === 'done' && s.recap?.(ctx)" class="i-flow-made">
                  {{ s.recap(ctx) }}
                </span>
              </li>
            </ul>
            <div class="d-flex gap-2 mt-3">
              <button class="i-btn i-sm" @click="openMenu">Another flow</button>
              <button class="i-btn i-sm i-primary ms-auto" @click="stop">Done</button>
            </div>
          </template>

          <!-- running -->
          <template v-else>
            <p v-if="index === 0 && tour.intro" class="i-flow-intro">{{ tour.intro }}</p>

            <ol class="i-flow-steps">
              <li
                v-for="(s, i) in tour.steps" :key="i"
                :class="{ 'is-now': i === index, 'is-done': status[i] === 'done', 'is-skip': status[i] === 'skipped' }"
                @click="status[i] !== 'todo' || i !== index ? jumpTo(i) : null"
              >
                <span class="i-flow-mark">
                  <i v-if="status[i] === 'done'" class="fa-solid fa-check" aria-hidden="true" />
                  <i v-else-if="status[i] === 'skipped'" class="fa-solid fa-minus" aria-hidden="true" />
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <span class="i-flow-label">
                  {{ status[i] === 'done' && s.done ? s.done : s.title }}
                </span>
              </li>
            </ol>

            <div v-if="step" class="i-flow-now">
              <h3>{{ step.title }}</h3>
              <p>{{ step.body }}</p>
              <p v-if="step.hint" class="i-flow-hint">
                <i class="fa-regular fa-lightbulb me-1" aria-hidden="true" />{{ step.hint }}
              </p>

              <div class="i-flow-wait">
                <span class="i-flow-pulse" />
                Watching for: {{ step.done || 'this step to be finished' }}
              </div>

              <div class="d-flex align-items-center gap-2 mt-2">
                <button class="i-btn i-sm i-quiet" @click="skip">
                  {{ step.optional ? 'Next' : 'Skip this step' }}
                </button>
                <RouterLink v-if="step.to && route.path !== step.to" class="i-btn i-sm ms-auto" :to="step.to">
                  Take me there
                </RouterLink>
              </div>
            </div>
          </template>
        </div>
      </aside>
    </template>
  </Teleport>
</template>

<style scoped>
.i-tour-menu {
  position: fixed; z-index: 90; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: min(540px, calc(100vw - 28px)); max-height: calc(100vh - 56px); overflow-y: auto;
  background: var(--i-canvas); border-radius: var(--i-r-float); box-shadow: var(--i-float-lg);
}
.i-tour-card {
  display: flex; align-items: flex-start; gap: 12px; width: 100%;
  padding: 12px; border: 0; border-radius: var(--i-r-ctl);
  background: transparent; text-align: left; cursor: pointer; font: inherit;
}
.i-tour-card:hover { background: var(--i-tint); }
.i-tour-card.is-primary { background: var(--i-v50); margin-bottom: 4px; }
.i-tour-title { display: block; font-size: 13px; font-weight: 500; color: var(--i-ink); }
.i-tour-blurb { display: block; font-size: 12px; color: var(--i-mute); margin-top: 2px; }
.i-tour-mins {
  flex: none; font-size: 10.5px; color: var(--i-mute);
  border: 1px solid var(--i-rule-strong); border-radius: 99px; padding: 2px 8px;
}

/* The spotlight dims around the target without covering it, and takes no
   pointer events, because every step here needs the page underneath. */
.i-spot {
  position: fixed; z-index: 88; pointer-events: none; border-radius: var(--i-r-ctl);
  box-shadow: 0 0 0 9999px rgba(20, 20, 24, .42), 0 0 0 2px var(--i-v500);
  transition: top .18s, left .18s, width .18s, height .18s;
}

/* Docked rather than modal: the visitor has to be able to work. */
.i-flow {
  position: fixed; z-index: 91; right: 18px; bottom: 18px;
  width: min(372px, calc(100vw - 28px));
  max-height: calc(100vh - 36px); display: flex; flex-direction: column;
  background: var(--i-canvas); border-radius: var(--i-r-float);
  box-shadow: var(--i-float-lg); overflow: hidden;
}
.i-flow-head {
  display: flex; align-items: center; gap: 10px; flex: none;
  padding: 11px 10px 11px 15px; border-bottom: 1px solid var(--i-rule);
}
.i-flow-head > i.fa-solid { color: var(--i-v600); font-size: 14px; }
.i-flow-title { font-size: 13px; font-weight: 500; color: var(--i-ink); }
.i-flow-prog { font-size: 11px; color: var(--i-mute); }
.i-flow.is-min .i-flow-head { border-bottom: 0; }
.i-flow-body { overflow-y: auto; padding: 13px 15px 15px; }

.i-flow-intro { font-size: 12px; color: var(--i-mute); margin: 0 0 12px; line-height: 1.55; }

.i-flow-steps { list-style: none; margin: 0 0 14px; padding: 0; }
.i-flow-steps li {
  display: flex; align-items: center; gap: 9px; padding: 4px 0;
  font-size: 12px; color: var(--i-mute); cursor: pointer;
}
.i-flow-mark {
  width: 18px; height: 18px; flex: none; border-radius: 99px;
  display: grid; place-items: center; font-size: 10px; font-weight: 600;
  background: var(--i-tint); color: var(--i-mute);
  border: 1px solid var(--i-rule-strong);
}
.i-flow-steps li.is-now { color: var(--i-ink); font-weight: 500; }
.i-flow-steps li.is-now .i-flow-mark {
  background: var(--i-v600); color: #fff; border-color: var(--i-v600);
}
.i-flow-steps li.is-done .i-flow-mark {
  background: var(--i-ok-bg); color: var(--i-ok); border-color: var(--i-ok-line);
}
.i-flow-steps li.is-done .i-flow-label { text-decoration: none; color: var(--i-dim); }
.i-flow-steps li.is-skip .i-flow-label { opacity: .6; }

.i-flow-now { border-top: 1px solid var(--i-rule); padding-top: 12px; }
.i-flow-now h3 {
  margin: 0 0 5px; font-size: 14px; font-weight: 500;
  letter-spacing: -.01em; color: var(--i-ink);
}
.i-flow-now p { margin: 0; font-size: 12.5px; color: var(--i-dim); line-height: 1.55; }
.i-flow-hint { margin-top: 8px !important; font-size: 11.5px !important; color: var(--i-mute) !important; }

.i-flow-wait {
  display: flex; align-items: center; gap: 8px; margin-top: 11px;
  font-size: 11.5px; color: var(--i-v700);
  background: var(--i-v50); border-radius: var(--i-r-ctl); padding: 7px 10px;
}
.i-flow-pulse {
  width: 7px; height: 7px; border-radius: 99px; background: var(--i-v600); flex: none;
  animation: i-flow-pulse 1.4s ease-in-out infinite;
}
@keyframes i-flow-pulse { 0%,100% { opacity: 1 } 50% { opacity: .25 } }

.i-flow-outro { font-size: 12.5px; color: var(--i-dim); margin: 12px 0 0; line-height: 1.55; }
.i-flow-recap { list-style: none; margin: 12px 0 0; padding: 0; }
.i-flow-recap li {
  display: flex; align-items: baseline; gap: 8px; padding: 4px 0; font-size: 12px; color: var(--i-dim);
}
.i-flow-made {
  margin-left: auto; font-family: var(--i-mono); font-size: 11px;
  color: var(--i-mute); max-width: 48%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
html[data-i-theme="dark"] .i-tour-card.is-primary { background: rgba(114,101,224,.14); }
</style>
