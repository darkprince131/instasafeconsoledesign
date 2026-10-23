<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../../api'
import CommandSearch from './CommandSearch.vue'
import AccountMenu from './AccountMenu.vue'
import DemoStates from './DemoStates.vue'

defineProps({ unread: { type: Number, default: 0 } })
const emit = defineEmits(['toggle-nav', 'open-inbox', 'open-tours'])

/**
 * What belongs under the administrator's own name.
 *
 * Company details, because that is what the old rail footer opened and
 * somebody will go looking for it there. My access, because an administrator
 * is also somebody with applications of their own — it is the same product
 * from a different seat, not a second one. Reset demo, which was a bare icon
 * beside the theme toggle: one destructive control among four cosmetic ones.
 */
const ACCOUNT_ITEMS = [
  { to: '/settings/company-details', label: 'Company details', icon: 'fa-building' },
  { to: '/sub-admin/all', label: 'Sub admins & roles', icon: 'fa-user-shield' },
  { divider: true },
  { to: '/portal', label: 'My access', icon: 'fa-user' },
  { divider: true },
  { action: 'reset', label: 'Reset demo', icon: 'fa-rotate-left' },
  { action: 'signout', label: 'Sign out', icon: 'fa-right-from-bracket', tone: 'bad' }
]

function onAccount (action) {
  if (action === 'reset') resetDemo()
  if (action === 'signout') router.push('/signin')
}

const route = useRoute()
const router = useRouter()
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

      <!-- Beside Flows, because both answer "what am I being shown": one
           walks you through the work, the other decides whether the tenant
           you are walking through has anything in it. -->
      <DemoStates class="d-none d-md-block" />

      <span class="i-tsep" aria-hidden="true" />

      <button class="i-tbtn i-icon" @click="toggleRail" :title="darkRail ? 'Light rail' : 'Dark rail'"
              :aria-label="darkRail ? 'Light rail' : 'Dark rail'">
        <i class="fa-regular fa-window-maximize" aria-hidden="true" />
      </button>

      <button class="i-tbtn i-icon" @click="toggleTheme" :title="theme === 'dark' ? 'Light theme' : 'Dark theme'"
              :aria-label="theme === 'dark' ? 'Light theme' : 'Dark theme'">
        <i class="fa-solid" :class="theme === 'dark' ? 'fa-sun' : 'fa-moon'" aria-hidden="true" />
      </button>

      <AccountMenu
        name="Demo Admin" secondary="admin" initials="DA"
        context="Administrator console"
        :items="ACCOUNT_ITEMS" @select="onAccount"
      />
    </div>
  </header>
</template>
