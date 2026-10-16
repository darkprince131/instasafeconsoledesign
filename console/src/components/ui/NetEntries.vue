<script setup>
import PickList from './PickList.vue'

/**
 * The repeating half of a NET application group.
 *
 * Velto's group form asks for an IP or network and the services reachable on
 * it, and then offers **Add More** — because a group is normally several
 * addresses, not one. A single pair could be filled in and the second one had
 * nowhere to go.
 *
 * Each row is one address and the ports open on it. Removing the last row
 * leaves an empty one rather than none, so the control never disappears.
 */

const props = defineProps({
  modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

function rows () {
  return props.modelValue.length ? props.modelValue : [blank()]
}

function blank () { return { ip: '', serviceIds: [] } }

function update (next) { emit('update:modelValue', next) }

function setIp (i, v) {
  const next = rows().map((r, n) => n === i ? { ...r, ip: v } : r)
  update(next)
}

function setServices (i, v) {
  const next = rows().map((r, n) => n === i ? { ...r, serviceIds: v } : r)
  update(next)
}

function add () { update([...rows(), blank()]) }

function remove (i) {
  const next = rows().filter((_, n) => n !== i)
  update(next.length ? next : [blank()])
}
</script>

<template>
  <div class="i-field">
    <label>IP Address/Network<span class="i-req">*</span></label>
    <p class="i-hint mb-2">
      One address or network per row, with the services reachable on it. A
      group usually covers several, which is why velto offers Add More here.
    </p>

    <div v-for="(row, i) in rows()" :key="i" class="i-frow mb-2" style="grid-template-columns:1fr 1fr auto">
      <div class="i-field">
        <input
          :id="'pro_ip-' + i" :name="'ip_address-' + i"
          class="i-ctl i-tech" type="text"
          placeholder="Eg: 192.168.1.21"
          :value="row.ip"
          @input="setIp(i, $event.target.value)"
        >
      </div>
      <div class="i-field">
        <PickList
          :model-value="row.serviceIds"
          resource="appServices"
          label=""
          placeholder="Select services…"
          label-key="name"
          hint-key="port"
          @update:model-value="setServices(i, $event)"
        />
      </div>
      <div class="i-field">
        <button
          class="i-btn i-sm i-quiet" type="button"
          :aria-label="`Remove ${row.ip || 'this address'}`"
          @click="remove(i)"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
    </div>

    <button class="i-btn i-sm" type="button" @click="add">
      <i class="fa-solid fa-plus" aria-hidden="true" /> Add More
    </button>
  </div>
</template>
