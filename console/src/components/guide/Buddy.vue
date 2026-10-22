<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Mascot from './Mascot.vue'
import { scriptFor } from '../../guide.js'

/**
 * Pip, docked.
 *
 * A guide that knows which screen you are on and says something true about
 * it, then gets out of the way.
 *
 * **What it deliberately is not.** It is not modal, it does not dim the page,
 * and it never takes the keyboard. Every screen it talks about is a screen
 * you are meant to be using while it talks, so a helper that blocks the thing
 * it is explaining has defeated itself. It is also not a tour: where the
 * console has a guided flow that checks real work, Pip hands over to it
 * rather than narrating a worse version.
 *
 * **Why it remembers.** Introducing itself on every single visit is how these
 * things become the first element people look for the close button on.
 * Dismissal is per route and kept in localStorage; closing it entirely is
 * kept too, and the tab in the corner brings it back.
 */

const props = defineProps({
  /** 'console' or 'portal' — picks which script, and which colour tokens. */
  scope: { type: String, default: 'console' }
})

const emit = defineEmits(['tour'])

const route = useRoute()
const router = useRouter()

const KEY = 'i365:pip'

/* The agent prototype embeds /portal/signin in a 400px frame. A fixed-position
   helper inside that would dock to the frame's corner and cover the form it is
   explaining, so Pip stays out of anything embedded. */
const embedded = (() => {
  try { return window.self !== window.top } catch { return true }
})()

const open = ref(false)
const away = ref(false)      // sent away entirely; the tab brings it back
const seen = ref({})         // route -> true, so it introduces itself once
const line = ref(0)

const script = computed(() => scriptFor(route.path, props.scope))
const lines = computed(() => script.value.lines || [])
const current = computed(() => lines.value[line.value] || lines.value[0] || null)
const last = computed(() => line.value >= lines.value.length - 1)

/* localStorage can throw — private windows, blocked site data — and a guide
   that takes the page down with it when it cannot remember something is a bad
   trade. Every read and write is wrapped and the default is "show it". */
function load () {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    seen.value = raw.seen || {}
    away.value = !!raw.away
  } catch { /* first visit, or no storage: the defaults are right */ }
}
function save () {
  try {
    localStorage.setItem(KEY, JSON.stringify({ seen: seen.value, away: away.value }))
  } catch { /* nothing to do, and nothing worth breaking the page over */ }
}

onMounted(() => { if (embedded) return; load(); arrive() })

/** New screen: start the script again, and open only if this one is new. */
function arrive () {
  line.value = 0
  if (away.value) { open.value = false; return }
  open.value = !seen.value[script.value.path]
}
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

/** Sent away for good — until the tab in the corner is clicked. */
function goAway () {
  away.value = true; open.value = false; save()
}

function comeBack () {
  away.value = false; line.value = 0; open.value = true; save()
}

function act () {
  const l = current.value
  if (!l) return
  if (l.tour) { dismiss(); emit('tour', l.tour); return }
  if (l.to) { dismiss(); router.push(l.to); return }
  next()
}

/** Pip runs when it is sending you somewhere, and points when it is not. */
const pose = computed(() => (current.value?.state) || 'idle')
</script>

<template>
  <!-- The tab: small, quiet, and the only thing left once Pip is sent away. -->
  <button v-if="!embedded && (away || !open)" class="pip-tab" :class="'pip-' + scope"
          type="button" @click="comeBack">
    <Mascot :size="34" :state="away ? 'sleep' : 'idle'" />
    <span class="pip-tabl">{{ away ? 'Wake Pip' : 'Ask Pip' }}</span>
  </button>

  <!-- The dock. `aria-live` polite, never a dialog: it is a companion, and a
       guide that steals focus from the form it is explaining is a trap. -->
  <aside
    v-if="!embedded && open && current" class="pip-dock" :class="'pip-' + scope"
    aria-live="polite"
  >
    <button class="pip-x" type="button" aria-label="Send Pip away" @click="goAway">✕</button>

    <div class="pip-stage">
      <Mascot :size="92" :state="pose" />
    </div>

    <div class="pip-bubble">
      <p class="pip-say">{{ current.text }}</p>

      <div class="pip-row">
        <span class="pip-dots" aria-hidden="true">
          <i v-for="(l, i) in lines" :key="i" :class="{ on: i === line }" />
        </span>

        <button v-if="!last || current.tour || current.to"
                class="pip-go" type="button" @click="act">
          {{ current.tour ? 'Start the flow' : current.to ? 'Take me there' : 'Next' }}
        </button>
        <button v-else class="pip-go" type="button" @click="dismiss">Got it</button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* The two consoles name their tokens differently — `--i-*` and `--p-*` — and
   this component is mounted in both, so each surface gets its own mapping
   rather than one set of hard-coded colours that is wrong on one of them. */
.pip-console {
  /* `--i-canvas`, not `--i-float`: `--i-float` is the console's elevation
     *shadow*, and a shadow value used as a background resolves to nothing, so
     the dock rendered transparent over the table behind it. Third time a
     token has been used for the wrong property in this codebase, which is
     what the build-time check in the backlog is for. */
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

/* ------------------------------------------------------------------ tab */
.pip-tab {
  /* 46 rather than 18: the deploy carries Netlify's own badge in that corner
     and it sat on Pip's shoulder. */
  position: fixed; right: 18px; bottom: 46px; z-index: 60;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 14px 6px 6px;
  background: var(--pb-card);
  border: 1px solid var(--pb-rule); border-radius: 999px;
  box-shadow: 0 6px 24px rgba(20, 16, 40, .13);
  cursor: pointer; color: var(--pb-ink);
}
.pip-tab:hover { border-color: var(--pb-accent); }
.pip-tabl { font-size: 13px; }

/* ----------------------------------------------------------------- dock */
.pip-dock {
  position: fixed; right: 18px; bottom: 46px; z-index: 60;
  width: min(380px, calc(100vw - 36px));
  display: grid; grid-template-columns: 92px 1fr; gap: 12px;
  align-items: end;
  padding: 14px 14px 14px 10px;
  background: var(--pb-card);
  border: 1px solid var(--pb-rule); border-radius: 16px;
  /* A floating thing is allowed a shadow. Nothing in the page flow is. */
  box-shadow: 0 14px 44px rgba(20, 16, 40, .18);
  animation: pip-in 320ms cubic-bezier(.2, .8, .3, 1);
}
@keyframes pip-in {
  from { opacity: 0; transform: translateY(14px) scale(.97); }
  to   { opacity: 1; transform: none; }
}
.pip-stage { align-self: end; }

.pip-x {
  position: absolute; top: 8px; right: 10px;
  background: none; border: 0; cursor: pointer;
  font-size: 13px; line-height: 1; color: var(--pb-dim);
}
.pip-x:hover { color: var(--pb-ink); }

.pip-bubble { padding-bottom: 2px; }
.pip-say {
  margin: 0 0 10px; font-size: 13.5px; line-height: 1.5; color: var(--pb-ink);
  /* Lines are kept short on purpose: a guide nobody finishes reading is a
     guide that said nothing. */
  max-width: 34ch;
}

.pip-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }

.pip-dots { display: inline-flex; gap: 5px; }
.pip-dots i {
  width: 5px; height: 5px; border-radius: 99px;
  background: var(--pb-rule); display: block;
}
.pip-dots i.on { background: var(--pb-accent); }

.pip-go {
  background: var(--pb-accent); color: #fff;
  border: 0; border-radius: 7px; padding: 7px 13px;
  font-size: 12.5px; cursor: pointer; white-space: nowrap;
}
.pip-go:hover { filter: brightness(1.08); }

/* On a phone the dock would cover the screen it is describing, so it sits
   across the bottom and the character shrinks out of the way. */
@media (max-width: 640px) {
  .pip-dock { left: 12px; right: 12px; width: auto; grid-template-columns: 62px 1fr; }
  .pip-stage :deep(svg) { width: 62px; height: 62px; }
}

@media (prefers-reduced-motion: reduce) {
  .pip-dock { animation: none; }
}
</style>
