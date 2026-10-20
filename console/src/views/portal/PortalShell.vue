<script setup>
import { RouterView, RouterLink, useRouter, useRoute } from 'vue-router'
import { ref, computed, onMounted } from 'vue'
import { portalUser, portalSignOut } from '../../lib/portal-session.js'

/**
 * The end-user portal.
 *
 * An earlier note here said velto's member area is "one screen that asks a
 * single question: is the agent installed". That was wrong, and it was wrong
 * because the area had not been looked at. Velto's `/member` is a product of
 * its own: a dashboard carrying sessions, devices, applications, an access
 * history and a live network test; a downloads page; an applications
 * launcher; a profile; and six ways to set up multi-factor authentication.
 *
 * So it keeps velto's three nav entries and velto's two account entries, and
 * the agent check — which was the only thing here and is genuinely useful —
 * becomes one card on the dashboard rather than the whole portal.
 *
 * It still does not look like the admin console, and should not. One column,
 * generous type, no tables of 2,000 rows. The person here is an employee who
 * wants to get to work, not an administrator.
 */

const router = useRouter()
const route = useRoute()
const user = portalUser
const menuOpen = ref(false)

const NAV = [
  { to: '/portal', label: 'Dashboard', icon: 'fa-gauge-high', exact: true },
  { to: '/portal/downloads', label: 'Downloads', icon: 'fa-download' },
  { to: '/portal/applications', label: 'Applications', icon: 'fa-grip' }
]

const initials = computed(() => {
  const u = user.value || {}
  const first = (u.firstName || u.username || '?').slice(0, 1)
  const last = (u.lastName || '').slice(0, 1)
  return (first + last).toUpperCase()
})

function isOn (item) {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to)
}

function go (to) { menuOpen.value = false; router.push(to) }

function signOut () {
  portalSignOut()
  router.push('/portal/signin')
}

onMounted(() => {
  if (!portalUser.value) router.replace('/portal/signin')
})
</script>

<template>
  <div class="p-app">
    <header class="p-top">
      <span class="p-brand">
        <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
          <circle cx="16" cy="16" r="15" fill="#5B4FD1" />
          <circle cx="16" cy="16" r="6.5" fill="#fff" opacity=".92" />
        </svg>
        InstaSafe
      </span>

      <!-- Velto's three, as tabs rather than a rail: three destinations do
           not need a sidebar, and a sidebar here would make the portal look
           like the console it is deliberately not. -->
      <nav v-if="user" class="p-nav" aria-label="Portal">
        <RouterLink
          v-for="n in NAV" :key="n.to" :to="n.to"
          class="p-navi" :class="{ 'is-on': isOn(n) }"
        >
          <i class="fa-solid" :class="n.icon" aria-hidden="true" />
          <span>{{ n.label }}</span>
        </RouterLink>
      </nav>

      <div v-if="user" class="p-acct">
        <button class="p-acctb" @click="menuOpen = !menuOpen" :aria-expanded="menuOpen">
          <span class="p-av">{{ initials }}</span>
          <span class="d-none d-sm-inline">{{ user.firstName || user.username }}</span>
          <i class="fa-solid fa-chevron-down" style="font-size:9px" aria-hidden="true" />
        </button>
        <div v-if="menuOpen" class="p-menu">
          <p class="p-menuh">{{ user.email || user.username }}</p>
          <button class="p-menui" @click="go('/portal/profile')">
            <i class="fa-solid fa-user" aria-hidden="true" /> Profile
          </button>
          <button class="p-menui" @click="go('/portal/mfa')">
            <i class="fa-solid fa-shield-halved" aria-hidden="true" /> Multi-factor authentication
          </button>
          <button class="p-menui" @click="signOut">
            <i class="fa-solid fa-right-from-bracket" aria-hidden="true" /> Sign out
          </button>
        </div>
      </div>
    </header>

    <main class="p-main">
      <RouterView />
    </main>

    <footer class="p-foot">
      <span>InstaSafe i365</span>
      <RouterLink to="/dashboard">Administrator console</RouterLink>
    </footer>
  </div>
</template>
