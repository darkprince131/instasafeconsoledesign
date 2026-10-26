<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Mascot from './Mascot.vue'
import { scriptFor } from '../../guide.js'
import { spotlight, flowDone } from '../../lib/guide-bus.js'

/**
 * Pip, loose on the page.
 *
 * **It is not a docked panel any more.** The first version sat bottom-right,
 * which is exactly where the slide-in sheet arrives, so a guide explaining a
 * form ended up on top of it. Pip has a position of its own now: draggable
 * anywhere, and during a guided flow it travels to whatever the spotlight is
 * on and explains it from beside it. A helper standing next to the thing it
 * is talking about does not need to be moved out of the way.
 *
 * **It stays out of the sheet.** When a sheet or modal opens the runner
 * clears the spotlight — whatever it was pointing at is behind the panel now
 * — and Pip retires to a corner rather than chasing a target it cannot see.
 *
 * **It answers a poke.** Clicking startles it and advances the line, because
 * a character that ignores being clicked is a picture.
 *
 * Never modal, never takes focus, never blocks: every screen it talks about
 * is one you are meant to be using while it talks.
 */

const props = defineProps({
  /** 'console' or 'portal' — picks the script and the colour tokens. */
  scope: { type: String, default: 'console' }
})

const emit = defineEmits(['tour'])

const route = useRoute()
const router = useRouter()

const KEY = 'i365:pip'
const PW = 300            // bubble width, for clamping and for which side it opens
const PH = 88             // the mascot's box

/* The agent prototype embeds /portal/signin in a 400px frame, where a fixed
   helper would cover the form it is explaining. */
const embedded = (() => {
  try { return window.self !== window.top } catch { return true } })()

const open = ref(false)
const away = ref(false)
/* A form is covering the page. Pip stays — it is draggable and small — but
   the bubble closes, because a speech balloon over the field you are typing
   into is the whole complaint this redesign started from. */
const covered = ref(false)
const seen = ref({})
const line = ref(0)
const poking = ref(false)
const celebrating = ref(false)
/* An occasional flicker of expression while nothing is happening. A face
   that holds exactly one shape between interactions is a sticker; one that
   winks at you now and then is a character. Rare and short on purpose —
   often enough to notice, not often enough to pull your eye off the work. */
const idleFace = ref('')
let faceTimer = null

/* Where Pip is, in viewport pixels. */
const at = ref(null)
const dragging = ref(false)
const dragged = ref(false)
const bubbleSide = ref('left')

const script = computed(() => scriptFor(route.path, props.scope))
const lines = computed(() => script.value.lines || [])

/* A flow step outranks the page script: if the runner is pointing at
   something, that is what Pip is here to talk about. */
const following = computed(() => !!spotlight.value)
const showBubble = computed(() => open.value && !!current.value && !covered.value)

const current = computed(() => {
  if (following.value) {
    return { state: 'point', text: spotlight.value.text, title: spotlight.value.title }
  }
  return lines.value[line.value] || lines.value[0] || null
})
const last = computed(() => line.value >= lines.value.length - 1)

const pose = computed(() => {
  if (celebrating.value) return 'cheer'
  if (poking.value) return 'poke'
  if (dragging.value) return 'travel'
  if (away.value) return 'sleep'
  return current.value?.state || 'idle'
})

/* Which way Pip looks: at what it is pointing at, at the bubble otherwise. */
const facing = computed(() => {
  if (dragging.value) return 'front'
  if (following.value && at.value) {
    return spotlight.value.left + spotlight.value.width / 2 > at.value.x + PH / 2
      ? 'right' : 'left'
  }
  return bubbleSide.value === 'left' ? 'left' : 'right'
})

function pickSide () {
  if (!at.value) { bubbleSide.value = 'left'; return }
  bubbleSide.value = at.value.x > window.innerWidth - PW - PH - 40 ? 'left' : 'right'
}

// ------------------------------------------------------------- storage
function load () {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    seen.value = raw.seen || {}
    away.value = !!raw.away
    if (raw.at && typeof raw.at.x === 'number') { at.value = raw.at; dragged.value = true }
  } catch { /* first visit, or no storage: the defaults are right */ }
}
function save () {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      seen: seen.value, away: away.value, at: dragged.value ? at.value : null
    }))
  } catch { /* nothing worth breaking the page over */ }
}

// -------------------------------------------------------------- placing
function clamp (p) {
  const m = 12
  return {
    x: Math.min(Math.max(m, p.x), Math.max(m, window.innerWidth - PH - m)),
    y: Math.min(Math.max(m, p.y), Math.max(m, window.innerHeight - PH - m))
  }
}

/**
 * The resting corner.
 *
 * The host pins a deploy badge to the bottom-right at the maximum z-index,
 * so the gap is read from the same custom property the stylesheet uses
 * rather than guessed at — see `lib/badge-gap.js`. It is 0 where there is no
 * badge, which is every environment except the deployed site.
 */
function badgeGap () {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--i-badge-h')
  return parseInt(v, 10) || 0
}

function corner () {
  return clamp({
    x: window.innerWidth - PH - 24,
    y: window.innerHeight - PH - 24 - badgeGap()
  })
}

/**
 * Stand beside the spotlight — never on it.
 *
 * Below if there is room, above if there is not, and off to whichever side
 * leaves space for the bubble. Pointing at a thing from on top of it is the
 * mistake the docked version made at panel scale.
 */
function beside (r) {
  const below = r.top + r.height + 16
  const above = r.top - PH - 16
  const y = below + PH < window.innerHeight - 20 ? below
    : above > 20 ? above
      : r.top + r.height / 2 - PH / 2
  const x = r.left + r.width + 18 + PW < window.innerWidth
    ? r.left + r.width + 18
    : Math.max(12, r.left - PH - 18)
  return clamp({ x, y })
}

watch(spotlight, (s, was) => {
  if (away.value || embedded) return
  if (s) {
    open.value = true
    at.value = beside(s)
    pickSide()
    return
  }
  /* The ring has gone, which during a flow means a form has covered the page.
     Pip was standing beside the thing the step pointed at; that thing is
     behind the form now, so it steps back to a corner rather than hovering
     over whatever is being filled in. */
  if (was && !dragged.value) { at.value = corner(); pickSide() }
}, { deep: true })

/* A finished flow is the one moment a cheer is honest. */
watch(flowDone, () => {
  if (away.value || embedded) return
  celebrating.value = true
  setTimeout(() => { celebrating.value = false }, 2600)
})

// ------------------------------------------------------------- dragging
let from = null
function onDown (e) {
  if (e.button !== 0) return
  if (!at.value) at.value = corner()
  from = {
    dx: e.clientX - at.value.x, dy: e.clientY - at.value.y,
    moved: false, x0: e.clientX, y0: e.clientY
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
  e.preventDefault()
}
function onMove (e) {
  if (!from) return
  /* A few pixels of slop, so a click stays a click and does not register as
     a one-pixel drag that then swallows the poke. */
  if (!from.moved && Math.hypot(e.clientX - from.x0, e.clientY - from.y0) < 4) return
  from.moved = true
  dragging.value = true
  at.value = clamp({ x: e.clientX - from.dx, y: e.clientY - from.dy })
}
function onUp () {
  window.removeEventListener('pointermove', onMove)
  const wasDrag = from?.moved
  from = null
  dragging.value = false
  if (wasDrag) { dragged.value = true; pickSide(); save() }
  else poke()
}

/** Clicked rather than dragged. */
function poke () {
  if (away.value) { comeBack(); return }
  poking.value = true
  setTimeout(() => { poking.value = false }, 640)
  if (!open.value) { open.value = true; return }
  if (!following.value) next()
}

// ---------------------------------------------------------------- script
function onResize () {
  if (at.value) { at.value = clamp(at.value); pickSide() }
}

/** Only move Pip if the visitor has not put it somewhere themselves. */
function onBadge () {
  if (dragged.value || following.value) return
  at.value = corner(); pickSide()
}

/* Watch for anything laid over the page. A MutationObserver rather than a
   poll, because a sheet is a `v-if` and arrives as a DOM change. */
let mo = null
function watchCover () {
  const was = covered.value
  covered.value = !!document.querySelector('.i-sheet, .i-modal, .p-sheet, .p-modal')
  if (covered.value && !was && !dragged.value) { at.value = corner(); pickSide() }
}

function arrive () {
  line.value = 0
  if (away.value) { open.value = false; return }
  if (!dragged.value) at.value = corner()
  pickSide()
  open.value = !seen.value[script.value.path]
}

onMounted(() => {
  if (embedded) return
  load()
  if (!at.value) at.value = corner()
  pickSide()
  arrive()
  window.addEventListener('resize', onResize)
  /* The host's deploy badge arrives after mount, so the corner chosen a
     moment ago may now be underneath it. */
  window.addEventListener('i365:badge', onBadge)
  mo = new MutationObserver(watchCover)
  mo.observe(document.body, { childList: true, subtree: true })
  watchCover()
  scheduleFace()
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('i365:badge', onBadge)
  window.removeEventListener('pointermove', onMove)
  mo?.disconnect()
  clearTimeout(faceTimer)
})

watch(() => route.path, arrive)

function next () {
  if (!last.value) { line.value++; return }
  dismiss()
}
function dismiss () {
  seen.value[script.value.path] = true
  save()
  open.value = false
}
function goAway () { away.value = true; open.value = false; save() }
function comeBack () { away.value = false; line.value = 0; open.value = true; save() }

function act () {
  const l = current.value
  if (!l) return
  if (l.tour) { dismiss(); emit('tour', l.tour); return }
  if (l.to) { dismiss(); router.push(l.to); return }
  next()
}

/** What the face does when the pose does not already decide. */
const expression = computed(() => {
  if (poking.value || celebrating.value || away.value) return ''
  if (following.value || dragging.value) return ''
  return idleFace.value
})

function scheduleFace () {
  clearTimeout(faceTimer)
  faceTimer = setTimeout(() => {
    if (!away.value && !following.value && !dragging.value) {
      idleFace.value = ['wink', 'happy', 'squint'][Math.floor(Math.random() * 3)]
      setTimeout(() => { idleFace.value = '' }, 1300)
    }
    scheduleFace()
  }, 9000 + Math.random() * 9000)
}

const style = computed(() => at.value
  ? { left: at.value.x + 'px', top: at.value.y + 'px' }
  : { right: '24px', bottom: 'calc(24px + var(--i-badge-h, 0px))' })
</script>

<template>
  <div
    v-if="!embedded"
    class="pip-wrap" :class="['pip-' + scope, { 'is-dragging': dragging }]"
    :style="style"
  >
    <!-- The character is the handle: drag it, or click it to poke it. -->
    <button
      class="pip-grab" type="button"
      :aria-label="away ? 'Wake Pip' : 'Pip, the guide'"
      @pointerdown="onDown"
    >
      <Mascot :size="88" :state="pose" :facing="facing" :expression="expression" />
    </button>

    <!-- `aria-live` polite, never a dialog: a guide that takes the keyboard
         from the form it is explaining is a trap. -->
    <aside
      v-if="showBubble" class="pip-bubble" :class="'on-' + bubbleSide"
      aria-live="polite"
    >
      <button class="pip-x" type="button" aria-label="Send Pip away" @click="goAway">✕</button>

      <p v-if="current.title" class="pip-title">{{ current.title }}</p>
      <p class="pip-say">{{ current.text }}</p>

      <div v-if="!following" class="pip-row">
        <span class="pip-dots" aria-hidden="true">
          <i v-for="(l, i) in lines" :key="i" :class="{ on: i === line }" />
        </span>
        <button v-if="!last || current.tour || current.to"
                class="pip-go" type="button" @click="act">
          {{ current.tour ? 'Start the flow' : current.to ? 'Take me there' : 'Next' }}
        </button>
        <button v-else class="pip-go" type="button" @click="dismiss">Got it</button>
      </div>

      <p v-else class="pip-foot">
        Step {{ (spotlight?.index ?? 0) + 1 }} — the ring shows where.
      </p>
    </aside>
  </div>
</template>

<style scoped>
/* The two surfaces name their tokens differently, so each gets its own
   mapping rather than one set of hard-coded colours that is wrong on one.
   `--i-canvas`, not `--i-float`: the latter is the console's elevation
   *shadow*, and a shadow used as a background resolves to nothing. */
.pip-console {
  --pb-card: var(--i-canvas, #fff);
  --pb-rule: var(--i-rule, #e4e4ea);
  --pb-ink: var(--i-ink, #1b1c20);
  --pb-dim: var(--i-dim, #5a5c66);
  --pb-accent: var(--i-v600, #5b4fd1);
}
.pip-portal {
  --pb-card: var(--p-card, #fff);
  --pb-rule: var(--p-rule, #e4e4ea);
  --pb-ink: var(--p-ink, #1b1c20);
  --pb-dim: var(--p-dim, #5a5c66);
  --pb-accent: var(--p-violet, #5b4fd1);
}

.pip-wrap {
  position: fixed; z-index: 95;
  width: 88px; height: 88px;
  /* Travelling between places is eased; being dragged is not, because a
     character that lags behind the cursor feels broken. */
  transition: left .55s cubic-bezier(.22, .9, .25, 1),
              top  .55s cubic-bezier(.22, .9, .25, 1);
}
.pip-wrap.is-dragging { transition: none; }

.pip-grab {
  display: block; width: 88px; height: 88px;
  padding: 0; margin: 0; border: 0; background: none;
  cursor: grab; touch-action: none;
}
.pip-wrap.is-dragging .pip-grab { cursor: grabbing; }
.pip-grab:focus-visible { outline: 2px solid var(--pb-accent); outline-offset: 4px; border-radius: 50%; }

/* ----------------------------------------------------------- the bubble */
.pip-bubble {
  position: absolute; bottom: 6px;
  width: 300px;
  padding: 13px 15px;
  background: var(--pb-card);
  border: 1px solid var(--pb-rule); border-radius: 14px;
  /* A floating thing is allowed a shadow. Nothing in the page flow is. */
  box-shadow: 0 12px 38px rgba(20, 16, 40, .17);
  animation: pip-in 300ms cubic-bezier(.2, .8, .3, 1);
}
.pip-bubble.on-left  { right: 84px; }
.pip-bubble.on-right { left: 84px; }

/* The tail, a rotated square so it picks up the border on two sides. */
.pip-bubble::after {
  content: ''; position: absolute; bottom: 26px;
  width: 11px; height: 11px; background: var(--pb-card);
  border: 1px solid var(--pb-rule); transform: rotate(45deg);
}
.pip-bubble.on-left::after  { right: -6.5px; border-left: 0; border-bottom: 0; }
.pip-bubble.on-right::after { left: -6.5px;  border-right: 0; border-top: 0; }

@keyframes pip-in {
  from { opacity: 0; transform: translateY(8px) scale(.97); }
  to   { opacity: 1; transform: none; }
}

.pip-x {
  position: absolute; top: 7px; right: 9px;
  background: none; border: 0; cursor: pointer;
  font-size: 12px; line-height: 1; color: var(--pb-dim);
}
.pip-x:hover { color: var(--pb-ink); }

.pip-say {
  margin: 0 14px 10px 0;
  font-size: 13.5px; line-height: 1.5; color: var(--pb-ink);
  /* Short on purpose: a guide nobody finishes reading said nothing. */
  max-width: 34ch;
}
.pip-title {
  margin: 0 14px 4px 0; font-size: 12px; font-weight: 500;
  color: var(--pb-accent);
}
.pip-foot { margin: 0; font-size: 11.5px; color: var(--pb-dim); }

.pip-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pip-dots { display: inline-flex; gap: 5px; }
.pip-dots i { width: 5px; height: 5px; border-radius: 99px; background: var(--pb-rule); display: block; }
.pip-dots i.on { background: var(--pb-accent); }

.pip-go {
  background: var(--pb-accent); color: #fff;
  border: 0; border-radius: 7px; padding: 7px 13px;
  font-size: 12.5px; cursor: pointer; white-space: nowrap;
}
.pip-go:hover { filter: brightness(1.08); }

/* On a phone there is no room beside anything, so the bubble sits above. */
@media (max-width: 640px) {
  .pip-bubble, .pip-bubble.on-left, .pip-bubble.on-right {
    left: auto; right: 0; bottom: 92px;
    width: min(300px, calc(100vw - 40px));
  }
  .pip-bubble::after { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .pip-wrap { transition: none; }
  .pip-bubble { animation: none; }
}
</style>
