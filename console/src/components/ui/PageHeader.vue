<script setup>
/**
 * One header for all 66 screens: title, one line of context, actions right.
 * The heaviest thing on the page is the title, and it is not bold.
 */
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
})
</script>

<template>
  <div class="i-phead">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="i-sub">{{ subtitle }}</p>
      <slot name="sub" />
    </div>
    <div v-if="$slots.actions" class="i-acts"><slot name="actions" /></div>
  </div>
</template>
