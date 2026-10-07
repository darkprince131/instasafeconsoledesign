<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../api'
import CommandSearch from './CommandSearch.vue'

defineProps({ unread: { type: Number, default: 0 } })
const emit = defineEmits(['toggle-nav', 'open-inbox', 'open-tours'])

const route = useRoute()
const theme = ref(document.documentElement.getAttribute('data-i-theme') || 'light')
const darkRail = ref(false)
const resetting = ref(false)

/** Where you are. Not a second navigation — just the answer. */
const crumb = computed(() => {
  const m = route.meta || {}
  return [m.section, m.parent, m.label || m.title].filter(Boolean)
})

function toggleTheme () {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-i-theme', theme.value)
  try { localStorage.setItem('i365.theme', theme.value) } catch {}
}

function toggleRail () {
  darkRail.value = !darkRail.value
  const r = document.documentElement
  darkRail.value ? r.setAttribute('data-i-rail', 'dark') : r.removeAttribute('data-i-rail')
  try { localStorage.setItem('i365.rail', darkRail.value ? 'dark' : '') } catch {}
}

/** Session countdown — the production console shows one, so this does too. */
const left = ref(2 * 3600 + 43 * 60 + 15)
let timer
const clock = computed(() => {
  const h = Math.floor(left.value / 3600)
  const m = Math.floor((left.value % 3600) / 60)
  const s = left.value % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
})

async function resetDemo () {
  if (!confirm('Reset the demo?\n\nThis wipes every change you have made and reseeds the original data. It only affects this browser.')) return
  resetting.value = true
  await api.demo.reset()
  location.reload()
}

onMounted(() => {
  try {
    const t = localStorage.getItem('i365.theme')
    if (t) { theme.value = t; document.documentElement.setAttribute('data-i-theme', t) }
    if (localStorage.getItem('i365.rail') === 'dark') { darkRail.value = true; document.documentElement.setAttribute('data-i-rail', 'dark') }
  } catch {}
  timer = setInterval(() => { if (left.value > 0) left.value-- }, 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <header class="i-topbar">
    <button class="i-tbtn i-icon d-md-none" @click="emit('toggle-nav')" aria-label="Open navigation">
      <i class="fa-solid fa-bars" aria-hidden="true" />
    </button>

    <nav class="i-crumb d-none d-lg-flex" aria-label="Breadcrumb">
      <template v-for="(c, i) in crumb" :key="c">
        <span v-if="i" aria-hidden="true">&rsaquo;</span>
        <strong v-if="i === crumb.length - 1">{{ c }}</strong>
        <span v-else>{{ c }}</span>
      </template>
    </nav>

    <CommandSearch />

    <!-- Two groups, not one row of six.
         Things you do - flows, inbox - keep their labels. Things that change
         how the console looks, and the destructive reset, are icons with
         titles: they were competing for attention with the work. -->
    <div class="i-tgroup">
      <span class="i-sessclock d-none d-lg-inline" title="Session expires in">{{ clock }}</span>

      <button class="i-tbtn" @click="emit('open-tours')" title="Guided flows">
        <i class="fa-solid fa-route" aria-hidden="true" />
        <span class="d-none d-xl-inline">Flows</span>
      </button>

      <button class="i-tbtn" @click="emit('open-inbox')" :title="unread ? `${unread} unread` : 'Demo Inbox'">
        <i class="fa-regular fa-envelope" aria-hidden="true" />
        <span class="d-none d-xl-inline">Inbox</span>
        <span v-if="unread" class="i-count">{{ unread }}</span>
      </button>

      <span class="i-tsep" aria-hidden="true" />

      <button class="i-tbtn i-icon" @click="toggleRail" :title="darkRail ? 'Light rail' : 'Dark rail'"
              :aria-label="darkRail ? 'Light rail' : 'Dark rail'">
        <i class="fa-regular fa-window-maximize" aria-hidden="true" />
      </button>

      <button class="i-tbtn i-icon" @click="toggleTheme" :title="theme === 'dark' ? 'Light theme' : 'Dark theme'"
              :aria-label="theme === 'dark' ? 'Light theme' : 'Dark theme'">
        <i class="fa-solid" :class="theme === 'dark' ? 'fa-sun' : 'fa-moon'" aria-hidden="true" />
      </button>

      <button class="i-tbtn i-icon" @click="resetDemo" :disabled="resetting"
              title="Reset demo - wipes changes and reseeds" aria-label="Reset demo">
        <i class="fa-solid fa-rotate-left" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>
