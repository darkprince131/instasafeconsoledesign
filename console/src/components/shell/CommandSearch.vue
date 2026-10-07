<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { flatRoutes } from '../../router/nav.js'
import api from '../../api'

/**
 * Global search.
 *
 * The console has 68 destinations across 19 nav groups, and the measured cost
 * of onboarding one user in production is 23 clicks across four of them. A
 * tree that deep needs a way past itself: typing "gate" should reach Gateways
 * without three expansions, and typing a username should reach the person
 * rather than the screen they happen to live on.
 *
 * Screens match locally and instantly. Records — users, devices, applications
 * — are fetched on a debounce, because those are real queries against a real
 * backend and firing one per keystroke is how a search box becomes the
 * slowest thing in a product.
 */

const router = useRouter()

const q = ref('')
const open = ref(false)
const records = ref([])
const loading = ref(false)
const active = ref(0)
const box = ref(null)
const input = ref(null)

const SCREENS = flatRoutes()

/** Screens, ranked: a name that starts with the term beats one that contains it. */
const screens = computed(() => {
  const t = q.value.trim().toLowerCase()
  if (!t) return []
  const hits = []
  for (const s of SCREENS) {
    const label = (s.label || '').toLowerCase()
    const where = [s.section, s.parent].filter(Boolean).join(' ').toLowerCase()
    const rank = label.startsWith(t) ? 0 : label.includes(t) ? 1 : where.includes(t) ? 2 : -1
    if (rank >= 0) hits.push({ ...s, rank })
  }
  return hits.sort((a, b) => a.rank - b.rank).slice(0, 6)
})

const results = computed(() => [
  ...screens.value.map(s => ({
    kind: 'Screen', icon: s.icon || 'fa-regular fa-square',
    title: s.label, sub: [s.section, s.parent].filter(Boolean).join(' · '), to: s.to
  })),
  ...records.value
])

watch(results, () => { active.value = 0 })

let timer
watch(q, (t) => {
  clearTimeout(timer)
  if (!t.trim()) { records.value = []; loading.value = false; return }
  loading.value = true
  timer = setTimeout(() => lookup(t.trim()), 260)
})

/**
 * Three small queries rather than one big one. Each is capped at four rows:
 * this is a way to reach a known thing, not a report, and a list long enough
 * to scroll is a list you read instead of a shortcut you take.
 */
async function lookup (t) {
  const want = [
    ['users', 'User', 'fa-solid fa-user', ['username', 'email', 'department'],
      (r) => [r.firstName, r.lastName].filter(Boolean).join(' ') || r.username, (r) => r.username, '/users'],
    ['devices', 'Device', 'fa-solid fa-laptop', ['name', 'mac', 'serialNumber'],
      (r) => r.name, (r) => r.os || r.mac, '/devices'],
    ['applications', 'Application', 'fa-solid fa-cube', ['name', 'host'],
      (r) => r.name, (r) => r.host || r.protocol, '/applications']
  ]
  try {
    const sets = await Promise.all(want.map(([res, , , fields]) =>
      api[res].list({ page: 1, perPage: 4, search: t, searchFields: fields })
        .then(x => x.data).catch(() => [])))
    if (q.value.trim() !== t) return          // a newer keystroke already won
    records.value = sets.flatMap((rows, i) => {
      const [, kind, icon, , title, sub, to] = want[i]
      return rows.map(r => ({ kind, icon, title: title(r), sub: sub(r), to }))
    })
  } finally {
    if (q.value.trim() === t) loading.value = false
  }
}

function go (r) {
  if (!r) return
  open.value = false
  q.value = ''
  router.push(r.to)
}

function onKey (e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = Math.min(active.value + 1, results.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(active.value - 1, 0) }
  else if (e.key === 'Enter') { e.preventDefault(); go(results.value[active.value]) }
  else if (e.key === 'Escape') { open.value = false; input.value?.blur() }
}

/** Ctrl/Cmd+K from anywhere, which is what people now reach for by reflex. */
function onGlobalKey (e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value = true
    nextTick(() => input.value?.focus())
  }
}

function onDocClick (e) { if (box.value && !box.value.contains(e.target)) open.value = false }

onMounted(() => {
  document.addEventListener('keydown', onGlobalKey)
  document.addEventListener('mousedown', onDocClick)
})
onUnmounted(() => {
  clearTimeout(timer)
  document.removeEventListener('keydown', onGlobalKey)
  document.removeEventListener('mousedown', onDocClick)
})
</script>

<template>
  <div ref="box" class="i-cmd">
    <label class="i-cmdbar" :class="{ 'is-open': open }">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true" />
      <input
        ref="input"
        v-model="q"
        type="search"
        role="combobox"
        aria-controls="cmdResults"
        :aria-expanded="open && !!q"
        placeholder="Search screens, users, devices, applications"
        @focus="open = true"
        @keydown="onKey"
      >
      <kbd v-if="!q" class="i-kbd" aria-hidden="true">Ctrl K</kbd>
    </label>

    <div v-if="open && q.trim()" id="cmdResults" class="i-cmdpop" role="listbox">
      <button
        v-for="(r, i) in results" :key="r.kind + r.title + i"
        class="i-cmdrow" :class="{ 'is-active': i === active }"
        role="option" :aria-selected="i === active"
        @mouseenter="active = i"
        @click="go(r)"
      >
        <i class="i-cmdicon" :class="r.icon" aria-hidden="true" />
        <span class="i-cmdtext">
          <span class="i-cmdt">{{ r.title }}</span>
          <span v-if="r.sub" class="i-cmds">{{ r.sub }}</span>
        </span>
        <span class="i-cmdkind">{{ r.kind }}</span>
      </button>

      <p v-if="loading && !results.length" class="i-cmdnote">Searching…</p>
      <p v-else-if="!results.length" class="i-cmdnote">
        Nothing matches <strong>{{ q }}</strong>.
      </p>
    </div>
  </div>
</template>
