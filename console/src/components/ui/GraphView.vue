<script setup>
import { ref, computed } from 'vue'

/**
 * The Graph view, which replaces the table in place.
 *
 * Velto's version is a 3D force-directed scene on black — left-click rotates,
 * wheel zooms, right-click pans — showing the current page as unlabelled
 * coloured dots. The idea is right: a list of 2,140 devices is not readable
 * and the same set as a shape is. The execution loses the thing that makes it
 * useful, because ten anonymous dots floating in space answer no question you
 * could have asked, and rotating them in three dimensions answers it no
 * better.
 *
 * So: the same interaction — Graph swaps the table out, the button becomes
 * Table — and the same intent, but laid out as labelled clusters around the
 * field you choose. Every node is named, every cluster is counted, and the
 * answer ("most of these are Windows, and the Ubuntu ones are all pending")
 * is readable without touching anything.
 */

const props = defineProps({
  rows: { type: Array, default: () => [] },
  dimensions: { type: Array, default: () => [] },
  labelKey: { type: String, default: 'name' },
  total: { type: Number, default: 0 }
})

const dim = ref(props.dimensions[0]?.key || '')

const label = (r) => r[props.labelKey] || r.name || r.username || r.id

const clusters = computed(() => {
  const by = new Map()
  for (const r of props.rows) {
    const raw = r[dim.value]
    const k = raw === true ? 'Yes' : raw === false ? 'No'
      : (raw ?? '').toString().trim() || 'Not set'
    if (!by.has(k)) by.set(k, [])
    by.get(k).push(r)
  }
  return [...by.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => b.items.length - a.items.length)
})

const shown = computed(() => props.rows.length)

/* A node sits on a ring inside its cluster. Deterministic from the index, so
   it does not reshuffle on every keystroke the way a random layout would. */
function nodeStyle (i, n) {
  const ring = Math.floor(i / 8)
  const perRing = Math.min(8, n - ring * 8)
  const angle = (i % 8) / perRing * Math.PI * 2 - Math.PI / 2
  const r = 17 + ring * 19
  return {
    left: `calc(50% + ${Math.cos(angle) * r}px)`,
    top: `calc(50% + ${Math.sin(angle) * r}px)`
  }
}
</script>

<template>
  <div class="i-graphview">
    <div class="i-graphbar">
      <div class="i-field" style="margin:0">
        <label for="gvdim" class="visually-hidden">Group by</label>
        <select id="gvdim" class="i-ctl i-sm" v-model="dim">
          <option v-for="d in dimensions" :key="d.key" :value="d.key">
            Group by {{ d.label.toLowerCase() }}
          </option>
        </select>
      </div>
      <span class="i-meta">
        {{ shown.toLocaleString() }}
        <template v-if="total && shown < total">of {{ total.toLocaleString() }}</template>
        in {{ clusters.length }} group{{ clusters.length === 1 ? '' : 's' }}
      </span>
    </div>

    <div v-if="clusters.length" class="i-clusters">
      <div v-for="c in clusters" :key="c.name" class="i-cluster">
        <div class="i-cluster-plot">
          <span
            v-for="(r, i) in c.items.slice(0, 24)" :key="r.id"
            class="i-node" :style="nodeStyle(i, Math.min(24, c.items.length))"
            :title="label(r)"
          />
          <span v-if="c.items.length > 24" class="i-nodemore">+{{ c.items.length - 24 }}</span>
        </div>
        <div class="i-cluster-name">{{ c.name }}</div>
        <div class="i-cluster-n">{{ c.items.length.toLocaleString() }}</div>
        <div class="i-cluster-who">
          {{ c.items.slice(0, 3).map(label).join(', ') }}<template v-if="c.items.length > 3">…</template>
        </div>
      </div>
    </div>

    <p v-else class="i-anote">Nothing to plot — the current filter matches no rows.</p>

    <p v-if="total && shown < total" class="i-hint">
      Plotting the {{ shown.toLocaleString() }} rows on this page of
      {{ total.toLocaleString() }}. Set rows per page to All to see the whole set.
    </p>
  </div>
</template>
