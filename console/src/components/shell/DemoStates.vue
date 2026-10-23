<script setup>
import { ref, computed, inject } from 'vue'
import {
  consoleDemo, COLLECTIONS, PRESETS, applyPreset, currentPreset,
  resetConsoleState, isModified, emptiedCount
} from '../../lib/console-state.js'

/**
 * Empty or filled, for every list in the console.
 *
 * **Why both a central switch and a per-page one.** They answer different
 * questions. Somebody about to present needs the whole console in one state
 * before they start, and does not want to visit eight screens to get there —
 * that is the panel. Somebody reviewing one screen wants to see *this* list
 * empty without disturbing anything else, and wants the control where they
 * already are — that is the small toggle in the page header. One without the
 * other means either a lot of clicking or a lot of walking, so there are two,
 * and they write to the same place.
 *
 * It is deliberately not hidden behind a developer flag. Empty states are
 * most of what this redesign is about: 54 list screens shipped with one
 * string, "No results found", and 21 of them are genuinely empty in a real
 * tenant. A reviewer has to be able to reach those in one click.
 */

const open = ref(false)
const refreshStats = inject('refreshStats', () => {})

const preset = computed(() => currentPreset())

/* Every screen reads from the store on its next fetch, so a change has to be
   followed by a reload of whatever is on screen. The rail's counters come
   from `stats`, which is cached, so that is refreshed too. */
function touched () {
  refreshStats()
  window.dispatchEvent(new CustomEvent('i365:demo-state'))
}

function pick (key) { applyPreset(key); touched() }
function flip (key) {
  consoleDemo[key] = consoleDemo[key] === 'empty' ? 'seeded' : 'empty'
  touched()
}
function reset () { resetConsoleState(); touched() }
</script>

<template>
  <div class="i-dsw">
    <button
      class="i-dsbtn" :class="{ 'is-on': open, 'is-mod': isModified }"
      type="button" @click="open = !open"
      :aria-expanded="open" aria-controls="i-dspanel"
    >
      <i class="fa-solid fa-sliders" aria-hidden="true" />
      <span>Demo state</span>
      <span v-if="emptiedCount" class="i-dscount">{{ emptiedCount }} empty</span>
    </button>

    <div v-if="open" id="i-dspanel" class="i-dspanel" role="dialog" aria-label="Demo state">
      <header class="i-dsh">
        <div>
          <strong>What the tenant looks like</strong>
          <p>Switch any list between its seeded rows and its real empty state.</p>
        </div>
        <button class="i-x" @click="open = false" aria-label="Close">
          <i class="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </header>

      <div class="i-dspresets">
        <button
          v-for="(p, k) in PRESETS" :key="k"
          class="i-dspreset" :class="{ 'is-on': preset === k }"
          type="button" @click="pick(k)"
        >
          <strong>{{ p.label }}</strong>
          <span>{{ p.hint }}</span>
        </button>
      </div>

      <ul class="i-dslist">
        <li v-for="c in COLLECTIONS" :key="c.key">
          <!-- A real checkbox: it is a two-state setting, and a switch drawn
               out of divs is a switch screen readers cannot operate. -->
          <label class="i-dsrow">
            <input
              type="checkbox" :checked="consoleDemo[c.key] === 'empty'"
              @change="flip(c.key)"
            >
            <span class="i-dsname">
              {{ c.label }}
              <small>{{ c.hint }}</small>
            </span>
            <span class="i-dstag">{{ consoleDemo[c.key] === 'empty' ? 'Empty' : 'Seeded' }}</span>
          </label>
        </li>
      </ul>

      <footer class="i-dsf">
        <p>
          Emptying hides the seeded rows only. Anything you add stays — so you
          can start from nothing, run a flow, and watch the list fill up.
        </p>
        <button v-if="isModified" class="i-btn i-sm" @click="reset">Everything back</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.i-dsw { position: relative; }

.i-dsbtn {
  display: inline-flex; align-items: center; gap: 7px;
  background: none; border: 1px solid var(--i-rule); border-radius: var(--i-r-ctl);
  padding: 5px 10px; font-size: 12.5px; color: var(--i-dim); cursor: pointer;
}
.i-dsbtn:hover, .i-dsbtn.is-on { border-color: var(--i-v600); color: var(--i-ink); }
.i-dsbtn.is-mod { border-color: var(--i-v600); color: var(--i-v600); }
.i-dscount {
  font-size: 11px; background: var(--i-v50); color: var(--i-v600);
  border-radius: 99px; padding: 1px 7px;
}

.i-dspanel {
  position: absolute; right: 0; top: calc(100% + 8px); z-index: 70;
  width: min(420px, calc(100vw - 32px));
  background: var(--i-canvas);
  border: 1px solid var(--i-rule); border-radius: var(--i-r-float);
  /* A popover is allowed a shadow; nothing in the page flow is. */
  box-shadow: var(--i-float-lg);
  overflow: hidden;
}

.i-dsh {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 13px 14px; border-bottom: 1px solid var(--i-rule);
}
.i-dsh strong { font-size: 13px; color: var(--i-ink); }
.i-dsh p { margin: 3px 0 0; font-size: 12px; color: var(--i-mute); }

.i-dspresets { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px 14px; }
.i-dspreset {
  text-align: left; background: var(--i-tint); border: 1px solid transparent;
  border-radius: var(--i-r-ctl); padding: 9px 10px; cursor: pointer;
}
.i-dspreset:hover { border-color: var(--i-rule); }
.i-dspreset.is-on { background: var(--i-v50); border-color: var(--i-v600); }
.i-dspreset strong { display: block; font-size: 12.5px; color: var(--i-ink); }
.i-dspreset span { display: block; margin-top: 2px; font-size: 11.5px; color: var(--i-mute); line-height: 1.45; }

.i-dslist { list-style: none; margin: 0; padding: 0 6px 6px; max-height: 42vh; overflow-y: auto; }
.i-dsrow {
  display: flex; align-items: center; gap: 10px;
  padding: 8px; border-radius: var(--i-r-ctl); cursor: pointer;
}
.i-dsrow:hover { background: var(--i-tint); }
.i-dsname { flex: 1; font-size: 12.5px; color: var(--i-ink); }
.i-dsname small { display: block; font-size: 11.5px; color: var(--i-mute); margin-top: 1px; }
.i-dstag { font-size: 11px; color: var(--i-mute); }

.i-dsf {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px; border-top: 1px solid var(--i-rule); background: var(--i-tint);
}
.i-dsf p { margin: 0; flex: 1; font-size: 11.5px; color: var(--i-mute); line-height: 1.5; }
</style>
