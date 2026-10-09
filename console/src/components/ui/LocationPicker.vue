<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * A real map, with the fence drawn on it.
 *
 * Velto puts a Google Map behind "Want Map": a draggable pin, a translucent
 * circle at the fence radius, and a location search over the top. The circle
 * is the point — a radius in metres means nothing until you see what it
 * covers, and "500" is either the car park or half the campus depending on
 * where you are standing.
 *
 * This uses Leaflet and OpenStreetMap rather than Google. Not for want of
 * trying to match: the Google Maps JavaScript API needs a key tied to a
 * billing account, and that key ships in client-side JavaScript on a public
 * demo, where anyone can lift it and spend against the account behind it.
 * Referrer restrictions reduce that without closing it. Leaflet is BSD, OSM
 * tiles are free with attribution, neither needs a key, and L.circle takes
 * its radius in metres — which is the unit velto stores.
 *
 * Geocoding is Nominatim, OSM's own, also free and also keyless. It asks for
 * no more than one request a second, so the search is debounced rather than
 * fired per keystroke.
 */

const props = defineProps({
  lat: { type: [Number, String], default: null },
  lon: { type: [Number, String], default: null },
  /** Metres, as velto stores it. */
  radius: { type: [Number, String], default: 500 }
})
const emit = defineEmits(['pick'])

const PIN = L.divIcon({
  className: 'i-mappin',
  html: '<span></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
})

const el = ref(null)
const q = ref('')
const results = ref([])
const searching = ref(false)
const open = ref(false)
const failed = ref(false)

let map = null
let marker = null
let circle = null

const num = (v, d) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

function draw () {
  if (!map) return
  const lat = num(props.lat, null)
  const lon = num(props.lon, null)
  if (lat === null || lon === null) {
    if (marker) { marker.remove(); marker = null }
    if (circle) { circle.remove(); circle = null }
    return
  }
  const at = [lat, lon]
  const r = Math.max(10, num(props.radius, 500))

  if (!marker) {
    /* Leaflet's default marker is three PNGs resolved from the stylesheet's
       own URL, which a bundler rewrites and the icon then 404s — the familiar
       broken-image pin. A div icon needs no assets and matches the console. */
    marker = L.marker(at, { draggable: true, icon: PIN }).addTo(map)
    /* Dragging the pin is the fastest way to nudge a fence onto the right
       building, and it writes straight back into the form. */
    marker.on('dragend', () => {
      const p = marker.getLatLng()
      emit('pick', { lat: round(p.lat), lon: round(p.lng) })
    })
  } else marker.setLatLng(at)

  if (!circle) {
    circle = L.circle(at, {
      radius: r, color: '#5b4fd1', weight: 2, fillColor: '#5b4fd1', fillOpacity: 0.15
    }).addTo(map)
  } else {
    circle.setLatLng(at)
    circle.setRadius(r)
  }

  /* Frame the fence rather than the pin: a 50m circle and a 5km one need very
     different zooms, and guessing one of them wrong makes the map useless. */
  map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 17 })
}

function round (n) { return Math.round(n * 1e6) / 1e6 }

onMounted(async () => {
  await nextTick()
  try {
    map = L.map(el.value, { attributionControl: true, scrollWheelZoom: true })
      .setView([num(props.lat, 20), num(props.lon, 10)], props.lat ? 14 : 2)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)

    /* Clicking the map places the fence, which is what somebody reaches for
       before they find any of the fields. */
    map.on('click', (e) => emit('pick', { lat: round(e.latlng.lat), lon: round(e.latlng.lng) }))
    draw()
  } catch {
    failed.value = true          // offline, blocked tiles: say so, do not hang
  }
})

onUnmounted(() => { if (map) { map.remove(); map = null } })

watch(() => [props.lat, props.lon, props.radius], draw)

/* ---- search ------------------------------------------------------------ */
let timer
watch(q, (t) => {
  clearTimeout(timer)
  if (!t.trim() || t.trim().length < 3) { results.value = []; return }
  searching.value = true
  timer = setTimeout(() => lookup(t.trim()), 450)
})

async function lookup (t) {
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&q=' +
      encodeURIComponent(t)
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const json = await res.json()
    if (q.value.trim() !== t) return
    results.value = (json || []).map(r => ({
      label: r.display_name, lat: Number(r.lat), lon: Number(r.lon)
    }))
  } catch {
    results.value = []
  } finally {
    if (q.value.trim() === t) searching.value = false
  }
}

function choose (r) {
  q.value = ''
  results.value = []
  open.value = false
  /* The first comma-separated part is the place; the rest is the postal tail
     nobody wants in a field called City. */
  emit('pick', { lat: round(r.lat), lon: round(r.lon), city: r.label.split(',')[0].trim() })
}
</script>

<template>
  <div class="i-field i-locpick">
    <label for="locq">Find a location</label>

    <div class="i-pick" :class="{ 'is-open': open && results.length }">
      <div class="i-pickbox" @click="open = true">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"
           style="color:var(--i-mute);font-size:12px" />
        <input
          id="locq" v-model="q" type="text" autocomplete="off"
          placeholder="Search an address or place, or click the map"
          @focus="open = true"
        >
      </div>
      <div v-if="open && (results.length || searching)" class="i-pickpop">
        <button
          v-for="r in results" :key="r.label"
          type="button" class="i-pickrow" @click="choose(r)"
        >
          <span class="i-pickl">{{ r.label }}</span>
        </button>
        <p v-if="searching && !results.length" class="i-picknote">Searching…</p>
      </div>
    </div>

    <div ref="el" class="i-map" />

    <p v-if="failed" class="i-hint">
      The map could not load — tiles are fetched from OpenStreetMap and
      something is blocking them. The latitude, longitude and radius fields
      below still work.
    </p>
    <p v-else class="i-hint">
      Click the map or drag the pin to move the fence; the circle is the radius
      below, drawn to scale. Map data from OpenStreetMap, which needs no API
      key — Google's does, and that key would be readable by anyone using this
      demo.
    </p>
  </div>
</template>
