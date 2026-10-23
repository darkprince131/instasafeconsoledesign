<script setup>
import { computed } from 'vue'
import { consoleDemo, COLLECTIONS } from '../../lib/console-state.js'

/**
 * The same switch as the Demo state panel, for one list, where that list is.
 *
 * The panel is for setting the whole console before you present. This is for
 * the other case: you are already on Users, you want to see what it looks
 * like with nobody in it, and walking to a panel in the topbar to find the
 * Users row is three actions for a thing that should be one.
 *
 * Both write to the same store, so they can never disagree — and the panel's
 * count updates the moment this is used.
 */

const props = defineProps({
  /** A key from COLLECTIONS. Anything else renders nothing. */
  collection: { type: String, required: true }
})

const emit = defineEmits(['change'])

const meta = computed(() => COLLECTIONS.find(c => c.key === props.collection))
const emptied = computed(() => consoleDemo[props.collection] === 'empty')

function flip () {
  consoleDemo[props.collection] = emptied.value ? 'seeded' : 'empty'
  emit('change')
  /* Screens that are not this one are listening; the panel's counter too. */
  window.dispatchEvent(new CustomEvent('i365:demo-state'))
}
</script>

<template>
  <button
    v-if="meta" class="i-stog" :class="{ 'is-on': emptied }" type="button"
    :aria-pressed="emptied" @click="flip"
    :title="emptied
      ? `Showing the empty state. Press to bring the seeded ${meta.label.toLowerCase()} back.`
      : `Show this list the way it looks on day one, with no seeded ${meta.label.toLowerCase()}.`"
  >
    <i class="fa-solid" :class="emptied ? 'fa-eye-slash' : 'fa-ghost'" aria-hidden="true" />
    {{ emptied ? 'Empty state on' : 'Empty state' }}
  </button>
</template>

<style scoped>
.i-stog {
  display: inline-flex; align-items: center; gap: 6px;
  background: none; border: 1px solid var(--i-rule); border-radius: var(--i-r-ctl);
  padding: 5px 10px; font-size: 12.5px; color: var(--i-dim); cursor: pointer;
  white-space: nowrap;
}
.i-stog:hover { border-color: var(--i-v600); color: var(--i-ink); }
.i-stog.is-on {
  border-color: var(--i-v600); background: var(--i-v50); color: var(--i-v600);
}
</style>
