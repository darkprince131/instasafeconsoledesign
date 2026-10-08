<script setup>
import { RouterView, useRouter } from 'vue-router'
import { ref, onMounted } from 'vue'
import { portalUser, portalSignOut } from '../../lib/portal-session.js'

/**
 * The end-user portal.
 *
 * This is a different product from the admin console and should look like
 * one. An employee comes here perhaps three times: to enrol an authenticator,
 * to see which of their devices are approved, and to find out why something
 * will not connect. There is no navigation tree, no tables, no bulk anything
 * — one column, a handful of cards, done.
 *
 * It exists because enrolment was wrongly built into the admin console. An
 * administrator cannot enrol somebody else's authenticator: enrolment means
 * scanning a QR with a phone the admin is not holding. The admin requires MFA
 * and resets it; the person with the phone does the rest, here.
 */

const router = useRouter()
const user = portalUser
const menuOpen = ref(false)

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

      <div v-if="user" class="p-acct">
        <button class="p-acctb" @click="menuOpen = !menuOpen" :aria-expanded="menuOpen">
          <span class="p-av">{{ (user.firstName || user.username || '?').slice(0, 1).toUpperCase() }}</span>
          <span class="d-none d-sm-inline">{{ user.firstName || user.username }}</span>
        </button>
        <div v-if="menuOpen" class="p-menu">
          <p class="p-menuh">{{ user.email || user.username }}</p>
          <button class="p-menui" @click="signOut">Sign out</button>
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
