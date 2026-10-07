<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'
import PageHeader from '../components/ui/PageHeader.vue'

/* Tech support. The useful thing a support screen can do is assemble the
   facts an engineer will ask for anyway, so nobody has to go and find them
   while the problem is still happening. */
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
  <div class="i-page">
    <PageHeader
      title="Tech support"
      subtitle="Everything an engineer will ask for, already gathered."
    />
    <div style="max-width:680px">
      <div class="i-chead"><h2>Diagnostics</h2></div>
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
  </div>
</template>
