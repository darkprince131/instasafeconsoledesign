<script setup>
import { ref, computed } from 'vue'
import Sheet from './Sheet.vue'

/**
 * Bulk Ops and Graph — the two buttons every velto list carries and this
 * console did not.
 *
 * **Bulk Ops.** The console already had bulk actions, but only as a strip
 * that appears once rows are ticked, so there was no way to find out what
 * bulk operations a screen supports without first selecting something. This
 * is the persistent entry point: it lists the operations, says what each one
 * does, and tells you plainly when nothing is selected rather than quietly
 * doing nothing.
 *
 * **Graph.** The same rows, counted by one field. A list of 2,140 devices
 * cannot be read; the same set as "578 Windows, 417 iOS" can. The dimension
 * is whatever the screen nominates, and the view is the list's own data — not
 * a second query that can disagree with the table above it.
 *
 * NOTE: velto's own Bulk Ops dialog could not be captured — the session
 * expired before it opened — so what each operation *is* comes from this
 * console's existing bulk actions, not from production. The button and its
 * placement are theirs; the contents are ours until that can be checked.
 */

const props = defineProps({
  /** [{ key, label, body, tone }] — tone 'bad' renders destructive. */
  operations: { type: Array, default: () => [] },
  /** Ids currently ticked in the table. */
  selected: { type: Array, default: () => [] },
  /** Every row the current filter matches, for the graph. */
  rows: { type: Array, default: () => [] },
  /** [{ key, label }] — the fields worth counting on this screen. */
  dimensions: { type: Array, default: () => [] },
  total: { type: Number, default: 0 }
})

const emit = defineEmits(['run'])

const opsOpen = ref(false)
const graphOpen = ref(false)
const dimension = ref(props.dimensions[0]?.key || '')

const counted = computed(() => {
  const by = {}
  for (const r of props.rows) {
    const raw = r[dimension.value]
    const k = raw === true ? 'Yes' : raw === false ? 'No'
      : (raw ?? '').toString().trim() || 'Not set'
    by[k] = (by[k] || 0) + 1
  }
  return Object.entries(by)
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n)
})
const graphMax = computed(() => Math.max(1, ...counted.value.map(c => c.n)))
const graphTotal = computed(() => counted.value.reduce((a, c) => a + c.n, 0))

function run (op) {
  opsOpen.value = false
  emit('run', op.key)
}
</script>

<template>
  <button
    v-if="operations.length"
    class="i-btn" title="Operations on the selected rows"
    @click="opsOpen = true"
  >
    <i class="fa-solid fa-layer-group" aria-hidden="true" />
    <span class="d-none d-lg-inline">Bulk Ops</span>
  </button>

  <button
    v-if="dimensions.length"
    class="i-btn" title="Count these rows by a field"
    @click="graphOpen = true"
  >
    <i class="fa-solid fa-chart-simple" aria-hidden="true" />
    <span class="d-none d-lg-inline">Graph</span>
  </button>

  <!-- bulk operations -->
  <Sheet
    v-model:open="opsOpen"
    title="Bulk operations"
    :subtitle="selected.length
      ? `${selected.length} row${selected.length === 1 ? '' : 's'} selected.`
      : 'Nothing is selected yet.'"
  >
    <div v-if="!selected.length" class="i-zero" style="padding:28px 0">
      <h3>Select some rows first</h3>
      <p>
        Tick the rows you want to act on, then reopen this. Operations apply only
        to what is selected — never to everything the filter matches, which is
        how people destroy a thousand records meaning to destroy three.
      </p>
    </div>

    <div v-else class="i-oplist">
      <button
        v-for="op in operations" :key="op.key"
        class="i-oprow" :class="{ 'is-bad': op.tone === 'bad' }"
        @click="run(op)"
      >
        <span class="i-opt">
          {{ op.label }}
          <span class="i-opn">{{ selected.length }}</span>
        </span>
        <span class="i-opb">{{ op.body }}</span>
      </button>
    </div>
  </Sheet>

  <!-- graph -->
  <Sheet
    v-model:open="graphOpen"
    title="Graph"
    :subtitle="`${graphTotal.toLocaleString()} rows, counted by one field.`"
  >
    <div class="i-field mb-3">
      <label for="gdim">Count by</label>
      <select id="gdim" class="i-ctl" v-model="dimension">
        <option v-for="d in dimensions" :key="d.key" :value="d.key">{{ d.label }}</option>
      </select>
      <p class="i-hint">
        These are the rows the current filter matches, not a separate query —
        so this and the table behind it can never disagree.
      </p>
    </div>

    <div v-if="counted.length">
      <div v-for="(c, i) in counted" :key="c.name" class="i-barrow">
        <span class="i-bl" :title="c.name">{{ c.name }}</span>
        <span class="i-bartrack">
          <span class="i-barfill" :style="{ width: (c.n / graphMax * 100) + '%', opacity: i ? .5 : 1 }" />
        </span>
        <span class="i-barval">{{ c.n.toLocaleString() }}</span>
      </div>
    </div>
    <p v-else class="i-anote">Nothing to count — the current filter matches no rows.</p>

    <p v-if="total && graphTotal < total" class="i-hint mt-3">
      Counting the {{ graphTotal.toLocaleString() }} rows loaded on this page of
      {{ total.toLocaleString() }}. Set rows per page to All to graph the whole set.
    </p>
  </Sheet>
</template>
