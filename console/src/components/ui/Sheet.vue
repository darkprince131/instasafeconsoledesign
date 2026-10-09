<script setup>
/**
 * The side panel. Replaces the slide-in card that pushed the table sideways.
 * A floating layer, so it is one of the few things that earns a shadow.
 */
defineProps({
  open: Boolean,
  /* A sheet opened from inside another sheet. Teleport gives this component
     two roots, so a fallthrough class cannot reach either one. */
  nested: Boolean,
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  width: { type: String, default: '560px' }
})
const emit = defineEmits(['update:open'])

function onKey (e) { if (e.key === 'Escape') emit('update:open', false) }
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="i-scrim" :class="{ 'is-nested': nested }" @click="emit('update:open', false)" />
    <aside
      v-if="open" class="i-sheet" :class="{ 'is-nested': nested }" role="dialog" aria-modal="true"
      :style="{ width: `min(${width},100vw)` }"
      @keydown="onKey"
    >
      <div class="i-sheeth">
        <div>
          <h2>{{ title }}</h2>
          <p v-if="subtitle" class="i-sub">{{ subtitle }}</p>
        </div>
        <button class="i-x" @click="emit('update:open', false)" aria-label="Close">
          <i class="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
      <div class="i-sheetb"><slot /></div>
      <div v-if="$slots.footer" class="i-sheetf"><slot name="footer" /></div>
    </aside>
  </Teleport>
</template>
