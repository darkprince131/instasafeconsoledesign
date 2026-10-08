<script setup>
import { ref, computed, watch, onMounted } from 'vue'

/**
 * The Graph view — the same rows, read rather than listed.
 *
 * Velto renders this as a 3D force-directed scene of unlabelled dots that you
 * rotate with the mouse. The instinct is right (a list of 2,140 devices is
 * not readable, the shape of it is) and the execution answers no question:
 * anonymous points in space have no magnitude you can compare and no name you
 * can act on. Rotating them does not help.
 *
 * What a person actually asks of a list this size is comparative and usually
 * two-dimensional: not "how many are Windows" but "how many are Windows, and
 * are those the ones stuck in the approval queue". So this groups on one
 * field and optionally splits each group by a second, as proportional bars —
 * sorted, labelled, counted, and with the exact split readable without
 * hovering.
 *
 * Every group opens to the rows inside it. A view that tells you Ubuntu is
 * the problem and then cannot tell you *which* Ubuntu machines has stopped
 * one step short of being useful.
 */

const props = defineProps({
  rows: { type: Array, default: () => [] },
  dimensions: { type: Array, default: () => [] },
  labelKey: { type: String, default: 'name' },
  total: { type: Number, default: 0 },
  /* Given these, the view fetches the whole set rather than reading the
     twenty-five rows the table happens to be showing. */
  resource: { type: String, default: '' },
  baseFilter: { type: Object, default: () => ({}) }
})

/**
 * A graph of one page is not a graph of anything.
 *
 * The table pages at 25, and summarising 25 of 2,140 devices tells you about
 * the first page rather than the estate — the proportions are whatever the
 * sort put at the top. So opening this fetches the full set once. It is the
 * one extra request in the console, it happens only when somebody asks for
 * the graph, and without it the view is actively misleading rather than
 * merely limited.
 */
const full = ref(null)
const loadingFull = ref(false)

onMounted(async () => {
  if (!props.resource || props.total <= props.rows.length) return
  loadingFull.value = true
  try {
    const api = (await import('../../api')).default
    const res = await api[props.resource].list({ perPage: 0, filters: props.baseFilter })
    full.value = res.data
  } catch {
    full.value = null          // fall back to the page; the note says which
  } finally { loadingFull.value = false }
})

const source = computed(() => full.value || props.rows)

const dim = ref(props.dimensions[0]?.key || '')
const split = ref('')
const openGroup = ref('')

/* Splitting by the field you are already grouping by says nothing. */
const splitOptions = computed(() => props.dimensions.filter(d => d.key !== dim.value))
watch(dim, () => { if (split.value === dim.value) split.value = '' })

const label = (r) => r[props.labelKey] || r.name || r.username || r.id

/** Booleans and blanks need words, not `true` and `""`. */
function valueOf (r, key) {
  const raw = r[key]
  if (raw === true) return 'Yes'
  if (raw === false) return 'No'
  return (raw ?? '').toString().trim() || 'Not set'
}

const groups = computed(() => {
  const by = new Map()
  for (const r of source.value) {
    const k = valueOf(r, dim.value)
    if (!by.has(k)) by.set(k, [])
    by.get(k).push(r)
  }
  const out = [...by.entries()].map(([name, items]) => {
    const parts = new Map()
    if (split.value) {
      for (const r of items) {
        const k = valueOf(r, split.value)
        parts.set(k, (parts.get(k) || 0) + 1)
      }
    }
    return {
      name,
      items,
      n: items.length,
      parts: [...parts.entries()].sort((a, b) => b[1] - a[1])
    }
  })
  return out.sort((a, b) => b.n - a.n)
})

const shown = computed(() => source.value.length)
const biggest = computed(() => Math.max(1, ...groups.value.map(g => g.n)))

/** Every value the split produces, in one stable order, so the colours and
    the legend agree across every bar. */
const splitKeys = computed(() => {
  if (!split.value) return []
  const tally = new Map()
  for (const r of source.value) {
    const k = valueOf(r, split.value)
    tally.set(k, (tally.get(k) || 0) + 1)
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
})

/* One hue, stepped. A categorical rainbow would imply the categories are
   unrelated; they are values of one field. */
const shade = (k) => {
  const i = splitKeys.value.indexOf(k)
  return `var(--i-seg${Math.min(6, Math.max(1, i + 1))})`
}

const pct = (n) => shown.value ? Math.round((n / shown.value) * 100) : 0
function toggle (name) { openGroup.value = openGroup.value === name ? '' : name }
</script>

<template>
  <div class="i-graphview">
    <div class="i-graphbar">
      <div class="i-field" style="margin:0">
        <label for="gvdim" class="visually-hidden">Group by</label>
        <select id="gvdim" class="i-ctl" v-model="dim">
          <option v-for="d in dimensions" :key="d.key" :value="d.key">
            Group by {{ d.label.toLowerCase() }}
          </option>
        </select>
      </div>

      <div v-if="splitOptions.length" class="i-field" style="margin:0">
        <label for="gvsplit" class="visually-hidden">Split by</label>
        <select id="gvsplit" class="i-ctl" v-model="split">
          <option value="">No split</option>
          <option v-for="d in splitOptions" :key="d.key" :value="d.key">
            Split by {{ d.label.toLowerCase() }}
          </option>
        </select>
      </div>

      <span class="i-meta">
        {{ shown.toLocaleString() }}
        <template v-if="total && shown < total">of {{ total.toLocaleString() }}</template>
        in {{ groups.length }} group{{ groups.length === 1 ? '' : 's' }}
      </span>
    </div>

    <div v-if="split" class="i-legend">
      <span v-for="k in splitKeys" :key="k" class="i-legenditem">
        <span class="i-legendswatch" :style="{ background: shade(k) }" />{{ k }}
      </span>
    </div>

    <div v-if="groups.length" class="i-gbars">
      <div v-for="g in groups" :key="g.name" class="i-gbar">
        <button
          class="i-gbarhead" :aria-expanded="openGroup === g.name"
          @click="toggle(g.name)"
        >
          <span class="i-gbarlabel" :title="g.name">{{ g.name }}</span>

          <span class="i-gbartrack">
            <span class="i-gbarfill" :style="{ width: (g.n / biggest * 100) + '%' }">
              <template v-if="split">
                <span
                  v-for="[k, n] in g.parts" :key="k"
                  class="i-gbarseg"
                  :style="{ flex: n, background: shade(k) }"
                  :title="`${k}: ${n.toLocaleString()}`"
                />
              </template>
            </span>
          </span>

          <span class="i-gbarn">{{ g.n.toLocaleString() }}</span>
          <span class="i-gbarpct">{{ pct(g.n) }}%</span>
          <i
            class="fa-solid fa-chevron-down i-gbarchev"
            :class="{ 'is-open': openGroup === g.name }" aria-hidden="true"
          />
        </button>

        <div v-if="split && openGroup !== g.name" class="i-gbarparts">
          <span v-for="[k, n] in g.parts" :key="k">{{ k }} {{ n.toLocaleString() }}</span>
        </div>

        <!-- the rows behind the bar -->
        <ul v-if="openGroup === g.name" class="i-gmembers">
          <li v-for="r in g.items.slice(0, 40)" :key="r.id">
            <span class="i-gmname">{{ label(r) }}</span>
            <span v-if="split" class="i-gmsplit">{{ valueOf(r, split) }}</span>
          </li>
          <li v-if="g.items.length > 40" class="i-gmmore">
            and {{ (g.items.length - 40).toLocaleString() }} more
          </li>
        </ul>
      </div>
    </div>

    <p v-else class="i-anote">Nothing to plot — the current filter matches no rows.</p>

    <p v-if="loadingFull" class="i-hint">Loading the full set…</p>
    <p v-else-if="total && shown < total" class="i-hint">
      Reading the {{ shown.toLocaleString() }} rows on this page of
      {{ total.toLocaleString() }} — the whole set could not be loaded, so these
      proportions describe this page rather than the estate.
    </p>
  </div>
</template>
