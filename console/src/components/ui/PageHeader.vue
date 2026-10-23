<script setup>
import StateToggle from './StateToggle.vue'

/**
 * One header for all 66 screens: title, one line of context, actions right.
 * The heaviest thing on the page is the title, and it is not bold.
 *
 * `collection` names the thing this screen lists, and puts an empty-state
 * toggle beside the actions. Here rather than in each screen because the
 * header is already the one component all 66 share — the alternative is the
 * same four lines pasted into eight views, drifting apart one at a time.
 */
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  /** A key from `lib/console-state.js`'s COLLECTIONS, or empty for none. */
  collection: { type: String, default: '' }
})
</script>

<template>
  <div class="i-phead">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="i-sub">{{ subtitle }}</p>
      <slot name="sub" />
    </div>
    <div v-if="$slots.actions || collection" class="i-acts">
      <StateToggle v-if="collection" :collection="collection" />
      <slot name="actions" />
    </div>
  </div>
</template>
