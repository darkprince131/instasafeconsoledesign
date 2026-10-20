<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'
import ResourceList from './ResourceList.vue'
import { RESOURCES } from '../resources'

/**
 * Tech support.
 *
 * Velto's screen is **Tech Support Access**: a list of time-boxed grants that
 * let an InstaSafe engineer into this tenant, each with an expiry, each
 * showing whether it is still live. That is the screen, and it was missing
 * here entirely — this route rendered only the diagnostics bundle below,
 * which velto has no equivalent for.
 *
 * Both now. The grant list is velto's, field for field; the diagnostics sit
 * under it, because the useful thing a support screen can also do is
 * assemble the facts an engineer will ask for anyway, so nobody has to go
 * and find them while the problem is still happening.
 */

const cfg = RESOURCES['/tech-support']
const diag = ref(null)

onMounted(async () => {
  const s = await api.stats()
  diag.value = {
    tenant: 'demo',
    consoleVersion: '3.4.1',
    users: s.users,
    devices: s.devices,
    devicesPending: s.devicesPending,
    gateways: `${s.gatewaysUp}/${s.gateways} reachable`,
    accessRules: s.rules,
    sessionsLive: s.sessionsLive,
    browser: navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    collectedAt: new Date().toISOString()
  }
})

function copy () {
  navigator.clipboard?.writeText(JSON.stringify(diag.value, null, 2))
}
</script>

<template>
  <ResourceList :config="cfg" route="/tech-support">
    <template #tail>
      <div class="mt-5" style="max-width:680px">
        <div class="i-chead">
          <h2>Diagnostics</h2>
          <span class="i-meta">Gathered from this tenant, now</span>
        </div>
        <div v-if="diag" class="i-session mb-3">
          <div class="i-session-body" style="min-height:0">{{ JSON.stringify(diag, null, 2) }}</div>
        </div>
        <button class="i-btn" @click="copy">
          <i class="fa-regular fa-copy" aria-hidden="true" /> Copy diagnostics
        </button>
        <p class="i-hint">Paste this into a ticket rather than answering twelve questions.</p>

        <div class="i-chead mt-4"><h2>Contact</h2></div>
        <dl class="i-kv">
          <dt>Support portal</dt><dd>support.instasafe.com</dd>
          <dt>Email</dt><dd>support@instasafe.com</dd>
          <dt>Severity 1</dt><dd>24x7, one hour response</dd>
          <dt>Everything else</dt><dd>Business hours, next business day</dd>
        </dl>
      </div>
    </template>
  </ResourceList>
</template>
