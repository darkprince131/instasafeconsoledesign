<script setup>
import { computed } from 'vue'

/**
 * A field that holds several of the same thing — redirect URIs, logout URIs.
 *
 * Velto renders these as one input with an "Add More" button that appends
 * another, and the production field names carry the index: `redirect_uris[0]`,
 * `redirect_uris[1]`. That shape is kept, because QA binds to it.
 *
 * The one addition is a remove control. Velto has none: an added row can only
 * be emptied, and an empty row submits as an empty string. Removing the last
 * row is not offered, because a required list with nothing in it is not a
 * state the form should be able to reach.
 */

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  name: { type: String, default: 'items' },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  hint: { type: String, default: '' },
  type: { type: String, default: 'text' },
  addLabel: { type: String, default: 'Add More' }
})
const emit = defineEmits(['update:modelValue'])

/* An empty list still shows one row: a control you have to press a button to
   see is a control people do not find. */
const rows = computed(() => props.modelValue.length ? props.modelValue : [''])

function write (list) { emit('update:modelValue', list) }
function set (i, v) { const l = [...rows.value]; l[i] = v; write(l) }
function add () { write([...rows.value, '']) }
function remove (i) { const l = [...rows.value]; l.splice(i, 1); write(l.length ? l : ['']) }
</script>

<template>
  <div class="i-field">
    <label :for="name + '_0'">{{ label }}<span v-if="required" class="i-req">*</span></label>

    <div v-for="(v, i) in rows" :key="i" class="i-mtrow">
      <input
        :id="name + '_' + i" class="i-ctl" :type="type"
        :name="name + '[' + i + ']'"
        :value="v" :placeholder="placeholder"
        @input="set(i, $event.target.value)"
      >
      <button
        v-if="rows.length > 1" class="i-btn i-sm i-quiet" type="button"
        :aria-label="'Remove ' + (label || 'entry') + ' ' + (i + 1)"
        @click="remove(i)"
      ><i class="fa-solid fa-xmark" aria-hidden="true" /></button>
    </div>

    <button class="i-btn i-sm mt-1" type="button" @click="add">
      <i class="fa-solid fa-plus me-1" aria-hidden="true" />{{ addLabel }}
    </button>

    <p v-if="hint" class="i-hint">{{ hint }}</p>
  </div>
</template>
