<script setup>
import { ref, computed } from 'vue'

/**
 * A line chart, hand-drawn in SVG.
 *
 * No charting library. Every one of them arrives with its own opinions about
 * type, colour, tooltips and radii, and the first job would be overriding all
 * four to get back to this design system — plus 40-150KB for what is, at the
 * bottom, a polyline and some text. This is about ninety lines.
 *
 * It is used where the question is genuinely "is this getting better or
 * worse". Ranking questions — top users, busiest gateway — stay as bars,
 * because a line between unordered categories draws a trend that does not
 * exist.
 *
 * Accessibility: the series are summarised in text for a screen reader, since
 * a polyline tells one nothing at all. The guide works from the keyboard.
 */

const props = defineProps({
  /** [{ name, points: number[], tone?: 'primary' | 'attention' }] */
  series: { type: Array, required: true },
  /** One label per point. Long runs are thinned on the axis, never dropped. */
  labels: { type: Array, default: () => [] },
  /** Formats a value for the axis, the guide and the summary. */
  format: { type: Function, default: (v) => v.toLocaleString() },
  height: { type: Number, default: 170 },
  /** Fill under the line. Right for one series, noise for several. */
  area: { type: Boolean, default: false }
})

const W = 760                 // viewBox width; the SVG scales to its container
const PAD_L = 46
const PAD_R = 8
const PAD_T = 10
const PAD_B = 22

const hover = ref(-1)

const count = computed(() => Math.max(...props.series.map(s => s.points.length), 0))
const plotW = computed(() => W - PAD_L - PAD_R)
const plotH = computed(() => props.height - PAD_T - PAD_B)

/** Headroom so the peak is not welded to the top edge. */
const max = computed(() => {
  const m = Math.max(1, ...props.series.flatMap(s => s.points))
  const mag = 10 ** Math.floor(Math.log10(m))
  return Math.ceil((m * 1.08) / mag) * mag
})

const x = (i) => PAD_L + (count.value <= 1 ? plotW.value / 2 : (i / (count.value - 1)) * plotW.value)
const y = (v) => PAD_T + plotH.value - (v / max.value) * plotH.value

const path = (points) => points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
const areaPath = (points) =>
  `${path(points)} L${x(points.length - 1).toFixed(1)},${(PAD_T + plotH.value).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + plotH.value).toFixed(1)} Z`

const colour = (s) => s.tone === 'attention' ? 'var(--i-c600)' : 'var(--i-v600)'

/** Four gridlines is enough to read a value off; more is wallpaper. */
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: max.value * f, y: y(max.value * f) })))

/** Thin the axis labels rather than dropping the ends: first and last matter. */
const axisLabels = computed(() => {
  const n = count.value
  if (!n) return []
  const step = Math.max(1, Math.ceil(n / 7))
  const out = []
  for (let i = 0; i < n; i += step) out.push(i)
  if (out[out.length - 1] !== n - 1) out.push(n - 1)
  return out
})

const summary = computed(() => props.series.map(s => {
  const total = s.points.reduce((a, b) => a + b, 0)
  const peak = Math.max(0, ...s.points)
  const at = props.labels[s.points.indexOf(peak)] || ''
  return `${s.name}: ${props.format(total)} in total, peaking at ${props.format(peak)}${at ? ` on ${at}` : ''}.`
}).join(' '))

function onMove (e) {
  const box = e.currentTarget.getBoundingClientRect()
  const rel = ((e.clientX - box.left) / box.width) * W
  const i = Math.round(((rel - PAD_L) / plotW.value) * (count.value - 1))
  hover.value = Math.min(count.value - 1, Math.max(0, i))
}
function onKey (e) {
  if (e.key === 'ArrowRight') { hover.value = Math.min(count.value - 1, (hover.value < 0 ? -1 : hover.value) + 1); e.preventDefault() }
  else if (e.key === 'ArrowLeft') { hover.value = Math.max(0, (hover.value < 0 ? 1 : hover.value) - 1); e.preventDefault() }
  else if (e.key === 'Escape') hover.value = -1
}
</script>

<template>
  <figure class="i-lc">
    <figcaption class="visually-hidden">{{ summary }}</figcaption>

    <div v-if="series.length > 1" class="i-lclegend">
      <span v-for="s in series" :key="s.name" class="i-legenditem">
        <span class="i-legendswatch" :style="{ background: colour(s) }" />{{ s.name }}
      </span>
    </div>

    <svg
      :viewBox="`0 0 ${W} ${height}`" class="i-lcsvg" role="img"
      :aria-label="summary" tabindex="0"
      @mousemove="onMove" @mouseleave="hover = -1" @keydown="onKey" @blur="hover = -1"
    >
      <!-- grid -->
      <g class="i-lcgrid">
        <line v-for="t in ticks" :key="t.v" :x1="PAD_L" :x2="W - PAD_R" :y1="t.y" :y2="t.y" />
      </g>
      <g class="i-lcaxis">
        <text v-for="t in ticks" :key="t.v" :x="PAD_L - 8" :y="t.y + 3.5" text-anchor="end">
          {{ format(t.v) }}
        </text>
      </g>

      <!-- series -->
      <g v-for="s in series" :key="s.name">
        <path v-if="area" :d="areaPath(s.points)" :fill="colour(s)" class="i-lcarea" />
        <path :d="path(s.points)" :stroke="colour(s)" class="i-lcline" />
      </g>

      <!-- guide -->
      <g v-if="hover >= 0">
        <line
          class="i-lcguide" :x1="x(hover)" :x2="x(hover)"
          :y1="PAD_T" :y2="PAD_T + plotH"
        />
        <circle
          v-for="s in series" :key="s.name"
          :cx="x(hover)" :cy="y(s.points[hover] ?? 0)" r="3.5"
          :fill="colour(s)" class="i-lcdot"
        />
      </g>

      <!-- x axis -->
      <g class="i-lcaxis">
        <text
          v-for="i in axisLabels" :key="i" :x="x(i)" :y="height - 6"
          :text-anchor="i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'"
        >{{ labels[i] }}</text>
      </g>
    </svg>

    <p v-if="hover >= 0" class="i-lcread">
      <strong>{{ labels[hover] }}</strong>
      <span v-for="s in series" :key="s.name">
        {{ s.name }} <b>{{ format(s.points[hover] ?? 0) }}</b>
      </span>
    </p>
    <p v-else class="i-lcread is-idle">Hover the chart, or focus it and use the arrow keys.</p>
  </figure>
</template>
