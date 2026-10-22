<script setup>
import { RouterView, RouterLink, useRouter, useRoute } from 'vue-router'
import { ref, computed, onMounted } from 'vue'
import { portalUser, portalSignOut } from '../../lib/portal-session.js'
import AccountMenu from '../../components/shell/AccountMenu.vue'
import DemoStates from '../../components/portal/DemoStates.vue'
import Mark from '../../components/ui/Mark.vue'
import Buddy from '../../components/guide/Buddy.vue'
import { demo } from '../../lib/demo-state.js'

/**
 * The end-user side of the console.
 *
 * Not a second product — the same one, seen from a seat with fewer
 * privileges. An administrator runs the tenant; everybody else sees their own
 * access. Calling these "two products" in the copy was wrong and has been
 * taken out: it told a visitor they were being shown something separate when
 * they were being shown the other half of the same thing.
 *
 * Two earlier mistakes, both now corrected.
 *
 * The first was the comment that used to sit here: it claimed velto's member
 * area is "one screen that asks a single question". It is five screens.
 *
 * The second was the layout. This was built as a top tab bar over a centred
 * 980px column, on the reasoning that a portal with three destinations is a
 * different product from a console with sixty-six and should not look like
 * one. That is true of the *content* and wrong about the *frame*: velto's
 * member area has a left sidebar, the admin console has a left sidebar, and
 * a person who uses both should not have to relearn where navigation lives.
 * A centred column also left two thirds of a desktop window empty.
 *
 * So the frame is the admin console's, class for class — `i-app`, `i-rail`,
 * `i-main`, `i-topbar` — and it inherits that chrome, including the dark-rail
 * and dark-theme toggles, for free. What stays different is what belongs on
 * the pages: no tables of 2,000 rows, no bulk actions, bigger type, plain
 * language.
 */

const router = useRouter()
const route = useRoute()
const user = portalUser
const navOpen = ref(false)

/* Velto's three, in velto's order. */
const NAV = [
  { to: '/portal', label: 'Dashboard', icon: 'fa-gauge-high', exact: true },
  { to: '/portal/downloads', label: 'Downloads', icon: 'fa-download' },
  { to: '/portal/applications', label: 'Applications', icon: 'fa-grip' }
]

/* Velto keeps these two behind the avatar rather than in the sidebar. They
   are on the rail as well, because a security setting nobody finds is a
   security setting nobody uses. */
/**
 * Velto's avatar menu, item for item: Profile, MFA, Sign out.
 *
 * These were also in the rail, on the argument that a security setting
 * nobody finds is a security setting nobody uses. Two places for one thing is
 * worse than one place people already look — and enrolment has a better
 * prompt than a nav entry anyway: the Multi-factor card on the dashboard
 * says "Not enrolled" in words and links straight here.
 */
const ACCOUNT_ITEMS = computed(() => [
  { to: '/portal/profile', label: 'Profile', icon: 'fa-user' },
  { to: '/portal/mfa', label: 'Multi-factor authentication', icon: 'fa-shield-halved',
    mark: user.value?.mfaEnrolled ? null : '1' },
  { divider: true },
  { to: '/dashboard', label: 'Administrator console', icon: 'fa-gauge' },
  { divider: true },
  { action: 'signout', label: 'Sign out', icon: 'fa-right-from-bracket', tone: 'bad' }
])

function onAccount (action) { if (action === 'signout') signOut() }


const crumb = computed(() => {
  const all = [...NAV,
      { to: '/portal/profile', label: 'Profile' },
      { to: '/portal/mfa', label: 'Multi-factor' }]
  const hit = all.find(n => n.exact ? route.path === n.to : route.path.startsWith(n.to))
  return ['My access', hit?.label || 'Dashboard']
})

function isOn (n) { return n.exact ? route.path === n.to : route.path.startsWith(n.to) }

const theme = ref(localStorage.getItem('i365.theme') || 'light')
function toggleTheme () {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-i-theme', theme.value)
  try { localStorage.setItem('i365.theme', theme.value) } catch {}
}

function signOut () {
  portalSignOut()
  router.push('/portal/signin')
}

onMounted(() => {
  if (!portalUser.value) router.replace('/portal/signin')
  document.documentElement.setAttribute('data-i-theme', theme.value)
})
</script>

<template>
  <div class="i-app" :class="{ 'i-navopen': navOpen }">
    <!-- The admin console's rail, carrying the portal's own map. -->
    <nav class="i-rail" aria-label="Main navigation">
      <div class="i-brand">
        <span class="i-mark" aria-hidden="true">
          <Mark :size="22" />
        </span>
        <span class="i-wm">InstaSafe</span>
        <span class="i-tenant">my access</span>
      </div>

      <div class="i-navwrap">
        <div class="i-navsec">Overview</div>
        <RouterLink
          v-for="n in NAV" :key="n.to" class="i-navitem" :to="n.to"
          :aria-current="isOn(n) ? 'page' : null" @click="navOpen = false"
        >
          <i class="fa-solid" :class="n.icon" aria-hidden="true" />
          <span class="i-lab">{{ n.label }}</span>
        </RouterLink>

      </div>

    </nav>

    <main class="i-main">
      <header class="i-topbar">
        <button class="i-tbtn i-icon d-md-none" aria-label="Open navigation" @click="navOpen = !navOpen">
          <i class="fa-solid fa-bars" aria-hidden="true" />
        </button>

        <nav class="i-crumb d-none d-lg-flex" aria-label="Breadcrumb">
          <template v-for="(c, i) in crumb" :key="c">
            <span v-if="i" aria-hidden="true">&rsaquo;</span>
            <strong v-if="i === crumb.length - 1">{{ c }}</strong>
            <span v-else>{{ c }}</span>
          </template>
        </nav>

        <span style="flex:1" />

        <div class="i-tgroup">
          <button
            class="i-tbtn i-icon" :title="theme === 'dark' ? 'Light theme' : 'Dark theme'"
            :aria-label="theme === 'dark' ? 'Light theme' : 'Dark theme'" @click="toggleTheme"
          >
            <i class="fa-solid" :class="theme === 'dark' ? 'fa-sun' : 'fa-moon'" aria-hidden="true" />
          </button>

          <!-- Velto's three, in velto's place. -->
          <AccountMenu
            :name="[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username"
            :secondary="user?.email || user?.username"
            :photo="user?.photo || ''"
            context="My access"
            :items="ACCOUNT_ITEMS" @select="onAccount"
          />
        </div>
      </header>

      <!-- Velto never tells an employee their sessions are recorded. If a
           company is going to watch, saying so is the minimum, and it costs
           one line. -->
      <p v-if="demo.sessionRecording" class="p-recbar">
        <i class="fa-solid fa-circle-dot" aria-hidden="true" />
        Your sessions to company applications are being recorded.
      </p>

      <RouterView />
    </main>

    <div v-if="navOpen" class="i-scrim d-md-none" @click="navOpen = false" />

    <!-- Demo scaffolding: the states a seeded tenant never reaches. -->
    <DemoStates />

    <!-- The same guide as the console, reading the portal's half of the
         script. One character across both seats, because it is one product. -->
    <Buddy scope="portal" />
  </div>
</template>
