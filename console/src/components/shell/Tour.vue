<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { TOURS, findTour } from '../../tours.js'

/**
 * The tour overlay.
 *
 * Two rules it follows, both learned from tours that are worse than nothing:
 *
 *   1. It never blocks the thing it is pointing at. The spotlight is a
 *      cut-out, and the page stays interactive, so "try a wrong code" means
 *      actually typing one rather than watching a cursor animate.
 *   2. A missing target is not a failure. If the selector does not resolve —
 *      a screen changed, the data is different — the step still runs,
 *      centred. A tour that breaks when the UI moves is a liability.
 *
 * Progress is per-viewer and goes in localStorage, which is the right place:
 * it is a convenience, not state anybody else needs, and losing it costs
 * nothing.
 */

const router = useRouter()
const route = useRoute()

const open = ref(false)
const picking = ref(false)
const tour = ref(null)
const index = ref(0)
const rect = ref(null)
const done = ref(new Set())

const step = computed(() => tour.value?.steps[index.value] || null)
const isLast = computed(() => tour.value && index.value === tour.value.steps.length - 1)

const KEY = 'i365.tours.done'
function loadDone () {
  try { done.value = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch { done.value = new Set() }
}
function saveDone () {
  try { localStorage.setItem(KEY, JSON.stringify([...done.value])) } catch { /* private window */ }
}

async function start (id) {
  const t = findTour(id)
  if (!t) return
  tour.value = t
  index.value = 0
  picking.value = false
  open.value = true
  await go()
}

function stop () {
  open.value = false
  picking.value = false
  tour.value = null
  rect.value = null
}

function finish () {
  if (tour.value) { done.value.add(tour.value.id); saveDone() }
  stop()
  picking.value = true           // back to the menu, so a second tour is one click
  open.value = true
}

/** Navigates if needed, then resolves the spotlight once the screen settles. */
async function go () {
  const s = step.value
  if (!s) return
  rect.value = null
  if (s.to && route.path !== s.to) {
    await router.push(s.to)
  }
  await nextTick()
  // give the screen a beat to load its data before measuring
  await new Promise(r => setTimeout(r, s.to && route.path === s.to ? 450 : 250))
  measure()
}

function measure () {
  const sel = step.value?.target
  if (!sel) { rect.value = null; return }
  const el = document.querySelector(sel)
  if (!el) { rect.value = null; return }          // step still runs, just centred
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  setTimeout(() => {
    const r = el.getBoundingClientRect()
    rect.value = r.width && r.height
      ? { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 }
      : null
  }, 320)
}

function next () { isLast.value ? finish() : (index.value++, go()) }
function prev () { if (index.value > 0) { index.value--; go() } }

/** Card position: beside the spotlight when there is one, centred otherwise. */
const cardStyle = computed(() => {
  const r = rect.value
  if (!r) return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  const below = r.top + r.height + 14
  const room = window.innerHeight - below
  const top = room > 210 ? below : Math.max(14, r.top - 210)
  const left = Math.min(Math.max(14, r.left), window.innerWidth - 384)
  return { top: top + 'px', left: left + 'px' }
})

function onKey (e) {
  if (!open.value) return
  if (e.key === 'Escape') stop()
  if (e.key === 'ArrowRight' && !picking.value) next()
  if (e.key === 'ArrowLeft' && !picking.value) prev()
}

let ro
onMounted(() => {
  loadDone()
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', measure)
  ro = setInterval(() => { if (open.value && step.value?.target) measure() }, 1200)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', measure)
  clearInterval(ro)
})

defineExpose({ start, openMenu: () => { picking.value = true; open.value = true } })
</script>

<template>
  <Teleport to="body">
    <!-- ===== the menu ===== -->
    <template v-if="open && picking">
      <div class="i-scrim" @click="stop" />
      <div class="i-tour-menu" role="dialog" aria-modal="true" aria-label="Guided tours">
        <div class="i-sheeth" style="padding:20px 22px 14px">
          <div>
            <h2>Guided tours</h2>
            <p class="i-sub">
              Each one ends at something that genuinely works, not a screenshot of it.
            </p>
          </div>
          <button class="i-x" @click="stop" aria-label="Close">
            <i class="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div style="padding:6px 14px 16px">
          <button
            v-for="t in TOURS" :key="t.id"
            class="i-tour-card" @click="start(t.id)"
          >
            <span class="i-tour-ico"><i class="fa-solid" :class="t.icon" aria-hidden="true" /></span>
            <span style="flex:1;min-width:0">
              <span class="i-tour-title">
                {{ t.title }}
                <i
                  v-if="done.has(t.id)" class="fa-solid fa-circle-check ms-1"
                  style="color:var(--i-ok);font-size:11px" aria-hidden="true"
                />
              </span>
              <span class="i-tour-blurb">{{ t.blurb }}</span>
            </span>
            <span class="i-tour-mins">{{ t.minutes }} min</span>
          </button>
        </div>
      </div>
    </template>

    <!-- ===== a running step ===== -->
    <template v-else-if="open && step">
      <!-- the cut-out: a huge spread shadow around the target, so the target
           itself stays lit and, crucially, stays clickable -->
      <div
        v-if="rect" class="i-spot"
        :style="{ top: rect.top + 'px', left: rect.left + 'px',
                  width: rect.width + 'px', height: rect.height + 'px' }"
      />
      <div v-else class="i-scrim" style="background:rgba(20,20,24,.5)" @click="stop" />

      <div class="i-tour-card-live" :style="cardStyle" role="dialog" aria-live="polite">
        <div class="d-flex align-items-center gap-2 mb-2">
          <span class="i-tour-step">{{ index + 1 }} / {{ tour.steps.length }}</span>
          <span style="font-size:11.5px;color:var(--i-mute)">{{ tour.title }}</span>
          <button class="i-x ms-auto" @click="stop" aria-label="End tour" style="width:24px;height:24px">
            <i class="fa-solid fa-xmark" style="font-size:12px" aria-hidden="true" />
          </button>
        </div>
        <h3>{{ step.title }}</h3>
        <p>{{ step.body }}</p>
        <div class="d-flex align-items-center gap-2 mt-3">
          <button class="i-btn i-sm i-quiet" :disabled="index === 0" @click="prev">Back</button>
          <span style="font-size:11px;color:var(--i-mute)">
            The page stays usable — try it as you go
          </span>
          <button class="i-btn i-sm i-primary ms-auto" @click="next">
            {{ isLast ? 'Finish' : 'Next' }}
          </button>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<style scoped>
.i-tour-menu {
  position: fixed; z-index: 90; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: min(520px, calc(100vw - 28px));
  max-height: calc(100vh - 56px); overflow-y: auto;
  background: var(--i-canvas); border-radius: var(--i-r-float);
  box-shadow: var(--i-float-lg);
}
.i-tour-card {
  display: flex; align-items: flex-start; gap: 12px; width: 100%;
  padding: 12px; border: 0; border-radius: var(--i-r-ctl);
  background: transparent; text-align: left; cursor: pointer; font: inherit;
}
.i-tour-card:hover { background: var(--i-tint); }
.i-tour-ico {
  width: 30px; height: 30px; flex: none; border-radius: var(--i-r-ctl);
  display: grid; place-items: center;
  background: var(--i-v50); color: var(--i-v700); font-size: 13px;
}
.i-tour-title { display: block; font-size: 13px; font-weight: 500; color: var(--i-ink); }
.i-tour-blurb { display: block; font-size: 12px; color: var(--i-mute); margin-top: 2px; }
.i-tour-mins {
  flex: none; font-size: 11px; color: var(--i-mute);
  border: 1px solid var(--i-rule-strong); border-radius: 99px; padding: 2px 8px;
}

/* The spotlight. A spread box-shadow dims everything outside the rectangle
   while leaving the rectangle itself untouched and — because the element has
   no pointer events — still clickable. */
.i-spot {
  position: fixed; z-index: 88; pointer-events: none;
  border-radius: var(--i-r-ctl);
  box-shadow: 0 0 0 9999px rgba(20, 20, 24, .5), 0 0 0 2px var(--i-v500);
  transition: top .2s, left .2s, width .2s, height .2s;
}

.i-tour-card-live {
  position: fixed; z-index: 91; width: min(370px, calc(100vw - 28px));
  background: var(--i-canvas); border-radius: var(--i-r-float);
  box-shadow: var(--i-float-lg); padding: 15px 17px 16px;
  transition: top .2s, left .2s;
}
.i-tour-card-live h3 {
  margin: 0 0 5px; font-size: 15px; font-weight: 500; letter-spacing: -.012em;
  color: var(--i-ink);
}
.i-tour-card-live p { margin: 0; font-size: 12.5px; color: var(--i-dim); line-height: 1.55; }
.i-tour-step {
  font-size: 10.5px; font-weight: 600; letter-spacing: .04em;
  color: var(--i-v700); background: var(--i-v50);
  border-radius: 99px; padding: 2px 7px;
}
</style>
