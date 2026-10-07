<script setup>
/**
 * A confirm dialog that names the thing.
 *
 * All 39 delete confirmations in the production console say "Are You Sure?"
 * over an 80px red trash glyph and name nothing at all. This one states the
 * object, the consequence, and labels the button with the action.
 */
defineProps({
  open: Boolean,
  title: { type: String, required: true },
  body: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Delete' },
  destructive: { type: Boolean, default: true }
})
const emit = defineEmits(['update:open', 'confirm'])
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="i-scrim" @click="emit('update:open', false)" />
    <div v-if="open" class="i-modal" role="alertdialog" aria-modal="true" aria-labelledby="cmTitle">
      <div class="i-modalb">
        <h2 id="cmTitle">{{ title }}</h2>
        <!-- Gated on the `body` prop alone, this dropped every caller that
             passes its content as slot children instead - which is all of
             them. The one thing the design asks a delete confirm to do is
             name what it is about to destroy, and that sentence was being
             rendered to nothing on all 54 list screens. -->
        <p v-if="body || $slots.default"><slot>{{ body }}</slot></p>
      </div>
      <div class="i-modalf">
        <button class="i-btn" @click="emit('update:open', false)">Cancel</button>
        <button
          class="i-btn"
          :class="destructive ? 'i-danger-solid' : 'i-primary'"
          @click="emit('confirm')"
        >{{ confirmLabel }}</button>
      </div>
    </div>
  </Teleport>
</template>
