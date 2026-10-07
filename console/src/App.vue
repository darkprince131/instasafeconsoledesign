<script setup>
import { ref, computed, onMounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import Rail from './components/shell/Rail.vue'
import Topbar from './components/shell/Topbar.vue'
import DemoInbox from './components/shell/DemoInbox.vue'
import Toasts from './components/ui/Toasts.vue'
import Tour from './components/shell/Tour.vue'
import api from './api'

const route = useRoute()
const stats = ref({})
const navOpen = ref(false)
const inboxOpen = ref(false)
const unread = ref(0)

/** Rollups the rail and dashboard both read. Refreshed after any write. */
async function refreshStats () {
  stats.value = await api.stats()
  const msgs = await api.inbox.list({ perPage: 0 })
  unread.value = msgs.data.filter(m => !m.read).length
}

const toastRef = ref(null)
const tourRef = ref(null)
provide('toast', (msg, kind) => toastRef.value?.push(msg, kind))
provide('refreshStats', refreshStats)
provide('stats', stats)
provide('openInbox', () => { inboxOpen.value = true })
provide('startTour', (id) => id ? tourRef.value?.start(id) : tourRef.value?.openMenu())

const bare = computed(() => route.meta?.bare === true)

onMounted(refreshStats)
</script>

<template>
  <!-- Sign-in renders without the shell; everything else inside it. -->
  <RouterView v-if="bare" />

  <div v-else class="i-app" :class="{ 'i-navopen': navOpen }">
    <Rail :stats="stats" @close="navOpen = false" />

    <main class="i-main">
      <Topbar
        :unread="unread"
        @toggle-nav="navOpen = !navOpen"
        @open-inbox="inboxOpen = true"
        @open-tours="tourRef?.openMenu()"
      />
      <RouterView v-slot="{ Component }">
        <Suspense>
          <component :is="Component" @changed="refreshStats" />
          <template #fallback>
            <div class="i-page"><div class="i-skeleton-page" aria-busy="true" /></div>
          </template>
        </Suspense>
      </RouterView>
    </main>

    <div v-if="navOpen" class="i-scrim d-md-none" @click="navOpen = false" />
  </div>

  <DemoInbox v-model:open="inboxOpen" @read="refreshStats" />
  <Tour ref="tourRef" />
  <Toasts ref="toastRef" />
</template>
