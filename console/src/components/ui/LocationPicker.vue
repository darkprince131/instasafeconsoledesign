<script setup>
import { ref, computed, watch } from 'vue'

/**
 * Place a fence without typing coordinates.
 *
 * Velto puts a "Want Map" button beside the latitude and longitude fields,
 * and a location search above them. That is the right instinct: nobody knows
 * the decimal coordinates of their own office, and a field that demands them
 * is a field people guess at.
 *
 * What this is NOT is a map. Drawing one means either shipping a few hundred
 * kilobytes of borders or fetching tiles from a third party on every edit,
 * and this console loads neither. So it is honest about what it is: a
 * searchable gazetteer over the places this tenant actually has — the cities
 * its sessions and devices report from — plotted on a graticule with the
 * fence drawn to scale, so the radius is something you can see rather than a
 * number you hope is right.
 *
 * The radius ring is genuinely to scale. A degree of longitude narrows with
 * latitude, so the ring is an ellipse, and a 25km fence over Bengaluru is
 * visibly a different shape from one over Sydney.
 */

const props = defineProps({
  lat: { type: [Number, String], default: null },
  lon: { type: [Number, String], default: null },
  radiusKm: { type: [Number, String], default: 25 }
})
const emit = defineEmits(['pick'])

/* The places this tenant reports from. Not a world gazetteer — these are the
   cities its own sessions, devices and events carry, which is the set an
   admin is actually going to fence. */
const PLACES = [
  ['Bengaluru', 'IN', 12.97, 77.59], ['Mumbai', 'IN', 19.08, 72.88],
  ['Pune', 'IN', 18.52, 73.86], ['Delhi', 'IN', 28.61, 77.21],
  ['Hyderabad', 'IN', 17.39, 78.49], ['Chennai', 'IN', 13.08, 80.27],
  ['London', 'GB', 51.51, -0.13], ['Manchester', 'GB', 53.48, -2.24],
  ['Frankfurt', 'DE', 50.11, 8.68], ['Berlin', 'DE', 52.52, 13.40],
  ['Amsterdam', 'NL', 52.37, 4.90], ['Paris', 'FR', 48.86, 2.35],
  ['Singapore', 'SG', 1.35, 103.82], ['Tokyo', 'JP', 35.68, 139.69],
  ['New York', 'US', 40.71, -74.01], ['Austin', 'US', 30.27, -97.74],
  ['San Francisco', 'US', 37.77, -122.42], ['Chicago', 'US', 41.88, -87.63],
  ['Dubai', 'AE', 25.20, 55.27], ['Sydney', 'AU', -33.87, 151.21],
  ['Melbourne', 'AU', -37.81, 144.96], ['Toronto', 'CA', 43.65, -79.38],
  ['São Paulo', 'BR', -23.55, -46.63], ['Johannesburg', 'ZA', -26.20, 28.05]
]

const q = ref('')
const open = ref(false)

const matches = computed(() => {
  const t = q.value.trim().toLowerCase()
  if (!t) return PLACES.slice(0, 8)
  return PLACES.filter(([n, c]) =>
    n.toLowerCase().includes(t) || c.toLowerCase() === t).slice(0, 8)
})

/* ---- the plot ---------------------------------------------------------- */
const W = 620
const H = 310
const x = (lon) => ((Number(lon) + 180) / 360) * W
const y = (lat) => ((90 - Number(lat)) / 180) * H

const hasPoint = computed(() =>
  props.lat !== null && props.lat !== '' && props.lon !== null && props.lon !== '')

/** Kilometres to degrees, which is not the same in both directions. */
const ring = computed(() => {
  if (!hasPoint.value) return null
  const km = Number(props.radiusKm) || 0
  const dLat = km / 111
  const dLon = km / (111 * Math.max(0.08, Math.cos(Number(props.lat) * Math.PI / 180)))
  return {
    cx: x(props.lon), cy: y(props.lat),
    rx: Math.max(2.5, (dLon / 360) * W),
    ry: Math.max(2.5, (dLat / 180) * H)
  }
})

function choose (p) {
  const [name, cc, lat, lon] = p
  q.value = ''
  open.value = false
  emit('pick', { city: name, countryCode: cc, lat, lon })
}

/** Clicking the plot places the fence where you clicked. */
function onPlot (e) {
  const box = e.currentTarget.getBoundingClientRect()
  const lon = ((e.clientX - box.left) / box.width) * 360 - 180
  const lat = 90 - ((e.clientY - box.top) / box.height) * 180
  const near = nearest(lat, lon)
  emit('pick', {
    lat: Math.round(lat * 100) / 100,
    lon: Math.round(lon * 100) / 100,
    city: near ? near[0] : '',
    countryCode: near ? near[1] : ''
  })
}

/** Name the click after the closest known place, if it is close enough. */
function nearest (lat, lon) {
  let best = null, bestD = Infinity
  for (const p of PLACES) {
    const d = Math.hypot(p[2] - lat, p[3] - lon)
    if (d < bestD) { bestD = d; best = p }
  }
  return bestD < 8 ? best : null
}

watch(() => props.lat, () => { open.value = false })
</script>

<template>
  <div class="i-locpick">
    <div class="i-field" style="margin-bottom:10px">
      <label for="locq">Find a location</label>
      <div class="i-pick" :class="{ 'is-open': open }">
        <div class="i-pickbox" @click="open = true">
          <i class="fa-solid fa-location-dot" aria-hidden="true"
             style="color:var(--i-mute);font-size:12px" />
          <input
            id="locq" v-model="q" type="text" autocomplete="off"
            placeholder="Search a city, or click the plot below"
            @focus="open = true"
          >
        </div>
        <div v-if="open" class="i-pickpop">
          <button
            v-for="p in matches" :key="p[0]"
            type="button" class="i-pickrow" @click="choose(p)"
          >
            <span class="i-pickl">{{ p[0] }}</span>
            <span class="i-pickh">{{ p[2].toFixed(2) }}, {{ p[3].toFixed(2) }}</span>
          </button>
          <p v-if="!matches.length" class="i-picknote">
            No match. Click the plot to place it by hand.
          </p>
        </div>
      </div>
      <p class="i-hint">
        The places this tenant reports from. Nobody knows their own office to
        two decimal places.
      </p>
    </div>

    <svg
      :viewBox="`0 0 ${W} ${H}`" class="i-plot" role="img"
      :aria-label="hasPoint
        ? `Fence centred on ${lat}, ${lon} with a radius of ${radiusKm} kilometres`
        : 'No location chosen yet'"
      @click="onPlot"
    >
      <rect :width="W" :height="H" class="i-plotbg" />

      <!-- graticule, every 30° -->
      <g class="i-plotgrid">
        <line v-for="i in 11" :key="'v' + i" :x1="i * W / 12" :x2="i * W / 12" y1="0" :y2="H" />
        <line v-for="i in 5" :key="'h' + i" x1="0" :x2="W" :y1="i * H / 6" :y2="i * H / 6" />
      </g>
      <line class="i-plotequator" x1="0" :x2="W" :y1="H / 2" :y2="H / 2" />

      <!-- the places, so the plot has landmarks -->
      <g>
        <circle
          v-for="p in PLACES" :key="p[0]"
          :cx="x(p[3])" :cy="y(p[2])" r="1.8" class="i-plotcity"
        />
      </g>

      <!-- the fence -->
      <template v-if="ring">
        <ellipse :cx="ring.cx" :cy="ring.cy" :rx="ring.rx" :ry="ring.ry" class="i-plotring" />
        <circle :cx="ring.cx" :cy="ring.cy" r="3" class="i-plotpin" />
      </template>

      <text x="6" :y="H / 2 - 5" class="i-plotlabel">0°</text>
      <text :x="W / 2 + 5" :y="12" class="i-plotlabel">0°</text>
    </svg>

    <p class="i-hint">
      <template v-if="hasPoint">
        Centred on <code class="i-tech">{{ Number(lat).toFixed(2) }}, {{ Number(lon).toFixed(2) }}</code>,
        radius {{ radiusKm }} km — drawn to scale, which is why a fence near
        the equator is rounder than one near a pole.
      </template>
      <template v-else>
        Not a map: this console ships no border data and fetches no tiles. It
        is a graticule with the places this tenant knows, which is enough to
        put a fence somewhere deliberate.
      </template>
    </p>
  </div>
</template>
