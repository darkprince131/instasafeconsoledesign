<script setup>
/**
 * An empty list and a filtered-empty list are different situations, so they
 * say different things. The production console ships one string, "No results
 * found", on all 54 list screens including the 21 that are genuinely empty.
 */
defineProps({
  icon: { type: String, default: 'fa-inbox' },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  actionLabel: { type: String, default: '' }
})
defineEmits(['action'])
</script>

<template>
  <div class="i-zero">
    <div class="i-zi"><i class="fa-solid" :class="icon" aria-hidden="true" /></div>
    <h3>{{ title }}</h3>
    <p v-if="body">{{ body }}</p>
    <div v-if="actionLabel" class="i-za">
      <button class="i-btn i-primary" @click="$emit('action')">{{ actionLabel }}</button>
    </div>
  </div>
</template>
