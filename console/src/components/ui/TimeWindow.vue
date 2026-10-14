<script setup>
import { computed } from 'vue'

/**
 * A shift window, shown as the span it is.
 *
 * Two time inputs side by side are correct and tell you nothing: you cannot
 * see from them that 22:00–06:00 runs through midnight, or that a schedule is
 * eleven hours long, or that somebody has typed a window of fifteen minutes.
 * Velto's is worse again — a date-picker widget asked to pick a time, with a
 * calendar icon beside it.
 *
 * So the window is drawn on a 24-hour track, the inputs stay underneath for
 * typing and for the keyboard, and the length is said in words. A window that
 * wraps past midnight draws as two segments, which is what it is.
 */

const props = defineProps({
  start: { type: String, default: '09:00' },
  end: { type: String, default: '18:00' }
})
const emit = defineEmits(['update:start', 'update:end'])

const PRESETS = [
  { label: 'Business hours', start: '09:00', end: '18:00' },
  { label: 'Night shift', start: '22:00', end: '06:00' },
  { label: 'Round the clock', start: '00:00', end: '23:59' }
]

function mins (t) {
  const [h, m] = String(t || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const startMin = computed(() => mins(props.start))
const endMin = computed(() => mins(props.end))

/** Through midnight when the end is at or before the start. */
const wraps = computed(() => endMin.value <= startMin.value)

const lengthMin = computed(() =>
  wraps.value ? (1440 - startMin.value) + endMin.value : endMin.value - startMin.value)

/** One segment, or two when it runs past midnight. */
const segments = computed(() => {
  const pct = (m) => (m / 1440) * 100
  if (!wraps.value) {
    return [{ left: pct(startMin.value), width: pct(endMin.value - startMin.value) }]
  }
  return [
    { left: pct(startMin.value), width: pct(1440 - startMin.value) },
    { left: 0, width: pct(endMin.value) }
  ]
})

const lengthLabel = computed(() => {
  const h = Math.floor(lengthMin.value / 60)
  const m = lengthMin.value % 60
  if (!lengthMin.value) return 'No window — nothing matches this schedule'
  const parts = []
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`)
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`)
  return parts.join(' ') + (wraps.value ? ', through midnight' : '')
})

const TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

function apply (p) {
  emit('update:start', p.start)
  emit('update:end', p.end)
}

const isPreset = (p) => p.start === props.start && p.end === props.end
</script>

<template>
  <div class="i-field">
    <label for="startTime">Shift window<span class="i-req">*</span></label>

    <!-- The window itself. In the page flow, so no shadow: a rule, a tint and
         the hours written under it. -->
    <div class="i-tw">
      <div class="i-tw-track" role="img" :aria-label="`From ${start} to ${end}, ${lengthLabel}`">
        <span
          v-for="(seg, i) in segments" :key="i"
          class="i-tw-fill"
          :style="{ left: seg.left + '%', width: seg.width + '%' }"
        />
        <span v-for="t in TICKS" :key="'t' + t" class="i-tw-tick" :style="{ left: (t / 24) * 100 + '%' }" />
      </div>
      <div class="i-tw-scale">
        <span v-for="t in TICKS" :key="'l' + t" :style="{ left: (t / 24) * 100 + '%' }">
          {{ String(t).padStart(2, '0') }}
        </span>
      </div>
      <p class="i-tw-len">{{ lengthLabel }}</p>
    </div>

    <div class="i-frow mt-2">
      <div class="i-field">
        <label for="startTime">Start time</label>
        <input
          id="startTime" name="start_time" class="i-ctl i-tech" type="time"
          :value="start" @input="emit('update:start', $event.target.value)"
        >
      </div>
      <div class="i-field">
        <label for="endTime">End time</label>
        <input
          id="endTime" name="end_time" class="i-ctl i-tech" type="time"
          :value="end" @input="emit('update:end', $event.target.value)"
        >
      </div>
    </div>

    <div class="i-ftabs mt-2">
      <button
        v-for="p in PRESETS" :key="p.label"
        type="button" class="i-chip" :class="{ 'is-on': isPreset(p) }"
        :aria-pressed="isPreset(p)"
        @click="apply(p)"
      >{{ p.label }}</button>
    </div>

    <p class="i-hint">
      An end before the start runs through midnight, which is what a night
      shift is. Outside this window a rule naming the schedule does not match.
    </p>
  </div>
</template>
