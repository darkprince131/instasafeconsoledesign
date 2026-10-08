<script setup>
import { ref, onMounted, inject } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'

/**
 * Controllers.
 *
 * Stop, Restart and Commit drive a real state machine rather than a toast —
 * Restart genuinely goes to "restarting" and settles back to "running" a few
 * seconds later, so the state is something you watch rather than something
 * you are told about.
 *
 * Stop is confirmed, and the confirmation names the controller and says what
 * happens. In production all three are bare buttons that fire immediately.
 */

const toast = inject('toast', () => {})

const rows = ref([])
const loading = ref(true)
const confirmOpen = ref(false)
const target = ref(null)
let poll

async function load () {
  const res = await api.controllers.list({ perPage: 0 })
  rows.value = res.data
  loading.value = false
}

async function act (c, action) {
  if (action === 'stop') { target.value = c; confirmOpen.value = true; return }
  await api.controllers.action(c.id, action)
  toast(c.name + ' — ' + action)
  load()
}

async function confirmStop () {
  await api.controllers.action(target.value.id, 'stop')
  toast(target.value.name + ' stopped')
  confirmOpen.value = false
  load()
}

const PILL = { running: null, restarting: 'att', stopped: 'bad' }

onMounted(() => {
  load()
  // the restart transition settles on its own, so keep the view honest
  poll = setInterval(load, 2000)
})
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Controllers"
      subtitle="The control plane. Policy changes take effect when they are committed here."
    >
    </PageHeader>

    <div class="i-strip">
      <div class="i-tools">
        <button class="i-btn i-primary"><i class="fa-solid fa-plus" aria-hidden="true" /> Add controller</button>
      </div>
    </div>

    <section v-if="rows.some(c => c.pendingCommit)" class="i-band">
      <div>
        <div class="i-bt">
          <span class="i-fdot" aria-hidden="true" />
          Uncommitted policy changes
        </div>
        <p class="i-bs">
          One controller is holding changes that are not live yet. Until it is
          committed, the rules you edited are not enforcing.
        </p>
      </div>
    </section>

    <div v-if="loading" class="i-skeleton-page" />

    <div v-else class="table-responsive">
      <table class="i-table">
        <thead>
          <tr>
            <th>Controller</th><th>Region</th><th>IP address</th><th>Version</th>
            <th class="text-end">Uptime</th><th>Status</th><th style="width:230px" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in rows" :key="c.id">
            <td class="fw-medium">
              {{ c.name }}
              <span v-if="c.pendingCommit" class="i-pill i-att ms-2">uncommitted</span>
            </td>
            <td>{{ c.region }}</td>
            <td class="i-tech">{{ c.ip }}</td>
            <td class="i-tech">{{ c.version }}</td>
            <td class="text-end i-num">{{ c.uptimeDays }} days</td>
            <td>
              <span class="i-pill" :class="PILL[c.status] ? 'i-' + PILL[c.status] : ''">
                <span v-if="!PILL[c.status]" class="i-dot i-ok" />
                {{ c.status }}
              </span>
            </td>
            <td class="text-end">
              <button
                class="i-btn i-sm me-1" :disabled="!c.pendingCommit"
                @click="act(c, 'commit')"
              >Commit</button>
              <button
                class="i-btn i-sm me-1" :disabled="c.status !== 'running'"
                @click="act(c, 'restart')"
              >Restart</button>
              <button
                class="i-btn i-sm i-danger" :disabled="c.status === 'stopped'"
                @click="act(c, 'stop')"
              >Stop</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="'Stop ' + (target?.name || '') + '?'"
      confirm-label="Stop controller"
      @confirm="confirmStop"
    >
      Every session routed through <strong class="i-named">{{ target?.name }}</strong>
      in {{ target?.region }} drops immediately, and policy changes cannot be
      committed until it is running again.
    </ConfirmModal>
  </div>
</template>
