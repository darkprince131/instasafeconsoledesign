<script setup>
import { ref } from 'vue'

/** Confirmation that something happened. Short, specific, never a modal. */
const items = ref([])
let n = 0

function push (message, kind = 'ok', ms = 3400) {
  const id = ++n
  items.value.push({ id, message, kind })
  setTimeout(() => dismiss(id), ms)
}
function dismiss (id) {
  items.value = items.value.filter(t => t.id !== id)
}
defineExpose({ push })
</script>

<template>
  <div class="i-toasts" role="status" aria-live="polite">
    <div v-for="t in items" :key="t.id" class="i-toast" :class="{ 'i-bad': t.kind === 'bad' }">
      <span class="i-td" />
      <span>{{ t.message }}</span>
      <button class="i-tx" @click="dismiss(t.id)" aria-label="Dismiss">
        <i class="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
