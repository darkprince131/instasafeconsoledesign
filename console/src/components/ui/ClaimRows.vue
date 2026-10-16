<script setup>
import { computed } from 'vue'

/**
 * SAML custom attributes.
 *
 * Each row is an assertion the service provider expects: a name, and either a
 * standard claim taken from the user or a constant typed in. Velto renders
 * the switch as "Use Standard Claim" and swaps the value control under it,
 * which is right — the two kinds of value are not the same field.
 */

const CLAIMS = ['Username', 'Email', 'UPN', 'Immutable ID']

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: { type: String, default: 'Custom Attributes' },
  hint: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const rows = computed(() => props.modelValue.length
  ? props.modelValue
  : [{ name: '', standard: true, value: 'Email' }])

function write (list) { emit('update:modelValue', list) }
function set (i, key, v) {
  const l = rows.value.map(r => ({ ...r }))
  l[i][key] = v
  /* Flipping the switch changes what a value means, so the old one cannot
     carry over — a claim name left in a free-text field would be sent
     literally. */
  if (key === 'standard') l[i].value = v ? 'Email' : ''
  write(l)
}
function add () { write([...rows.value.map(r => ({ ...r })), { name: '', standard: true, value: 'Email' }]) }
function remove (i) {
  const l = rows.value.map(r => ({ ...r }))
  l.splice(i, 1)
  write(l)
}
</script>

<template>
  <div class="i-field">
    <label>{{ label }}</label>

    <div class="i-claimhead" aria-hidden="true">
      <span>Attribute Name</span><span>Use Standard Claim</span><span>Attribute Value</span><span />
    </div>

    <div v-for="(row, i) in rows" :key="i" class="i-claimrow">
      <input
        class="i-ctl" type="text" :value="row.name"
        placeholder="Email" :aria-label="'Attribute name ' + (i + 1)"
        @input="set(i, 'name', $event.target.value)"
      >
      <label class="i-sw mb-0">
        <input
          type="checkbox" :checked="row.standard"
          :aria-label="'Use a standard claim for attribute ' + (i + 1)"
          @change="set(i, 'standard', $event.target.checked)"
        ><span class="i-track" />
      </label>
      <select
        v-if="row.standard" class="i-ctl" :value="row.value"
        :aria-label="'Standard claim ' + (i + 1)"
        @change="set(i, 'value', $event.target.value)"
      >
        <option v-for="c in CLAIMS" :key="c">{{ c }}</option>
      </select>
      <input
        v-else class="i-ctl" type="text" :value="row.value"
        placeholder="Sent exactly as typed" :aria-label="'Attribute value ' + (i + 1)"
        @input="set(i, 'value', $event.target.value)"
      >
      <button
        v-if="rows.length > 1" class="i-btn i-sm i-quiet" type="button"
        :aria-label="'Remove attribute ' + (i + 1)" @click="remove(i)"
      ><i class="fa-solid fa-xmark" aria-hidden="true" /></button>
      <span v-else />
    </div>

    <button class="i-btn i-sm mt-1" type="button" @click="add">
      <i class="fa-solid fa-plus me-1" aria-hidden="true" />Add More
    </button>

    <p v-if="hint" class="i-hint">{{ hint }}</p>
  </div>
</template>
