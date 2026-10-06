<script setup>
import { ref, watch, computed } from 'vue'
import api from '../../api'

/**
 * The Demo Inbox.
 *
 * Everything that would leave the system in production arrives here instead:
 * SMS codes, emails, push approvals, magic links, SIEM payloads, scheduled
 * reports. It is what makes the simulated half of the demo honest — the flow
 * runs for real right up to the boundary, and then you can see exactly what
 * crossed it.
 *
 * A visitor can watch an OTP be generated, read it, type it in, and be let
 * through. Without us owning an SMS gateway.
 */

const props = defineProps({ open: Boolean })
const emit = defineEmits(['update:open', 'read'])

const items = ref([])
const loading = ref(false)

const ICONS = {
  sms: 'fa-comment-sms', email: 'fa-envelope', push: 'fa-bell',
  webhook: 'fa-code', siem: 'fa-shield-halved', report: 'fa-file-lines'
}

async function load () {
  loading.value = true
  const res = await api.inbox.list({ perPage: 0, sort: 'at', dir: 'desc' })
  items.value = res.data
  loading.value = false
}

watch(() => props.open, (o) => { if (o) load() })

async function markRead (m) {
  if (m.read) return
  await api.inbox.markRead(m.id)
  m.read = true
  emit('read')
}

async function clearAll () {
  await api.inbox.clear()
  items.value = []
  emit('read')
}

function when (at) {
  const s = (Date.now() - new Date(at)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  return new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const unread = computed(() => items.value.filter(m => !m.read).length)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="i-scrim" @click="emit('update:open', false)" />
    <aside v-if="open" class="i-inbox" role="dialog" aria-modal="true" aria-labelledby="inboxTitle">
      <div class="i-sheeth">
        <div>
          <h2 id="inboxTitle">Demo Inbox</h2>
          <p class="i-sub">
            Anything that would leave the system in production lands here —
            SMS, email, push, SIEM payloads.
          </p>
        </div>
        <button class="i-x" @click="emit('update:open', false)" aria-label="Close">
          <i class="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>

      <div class="i-sheetb" style="padding:0">
        <div v-if="loading" class="p-4">
          <div class="i-skel mb-2" style="width:60%" />
          <div class="i-skel" style="width:40%" />
        </div>

        <div v-else-if="!items.length" class="i-zero" style="padding:56px 24px">
          <div class="i-zi"><i class="fa-regular fa-envelope-open" aria-hidden="true" /></div>
          <h3>Nothing sent yet</h3>
          <p>
            Trigger an SMS or email code from a sign-in or MFA flow and it will
            show up here, with the real code in it.
          </p>
        </div>

        <article
          v-for="m in items" :key="m.id"
          class="i-inbox-msg" :class="{ 'is-unread': !m.read }"
          @click="markRead(m)"
        >
          <div class="d-flex align-items-center gap-2">
            <span class="i-inbox-kind">
              <i class="fa-solid me-1" :class="ICONS[m.kind] || 'fa-circle-info'" aria-hidden="true" />{{ m.kind }}
            </span>
            <strong style="font-size:12.5px;font-weight:500">{{ m.subject }}</strong>
            <span class="ms-auto" style="font-size:11.5px;color:var(--i-mute)">{{ when(m.at) }}</span>
          </div>
          <p v-if="m.meta?.to" class="i-inbox-body" style="margin-top:3px">
            To <span class="i-tech">{{ m.meta.to }}</span>
          </p>
          <p class="i-inbox-body">{{ m.body }}</p>
          <div v-if="m.meta?.code" class="i-inbox-code">{{ m.meta.code }}</div>
        </article>
      </div>

      <div class="i-sheetf">
        <span style="font-size:12px;color:var(--i-mute)">
          {{ items.length }} message{{ items.length === 1 ? '' : 's' }}<template v-if="unread"> · {{ unread }} unread</template>
        </span>
        <div class="i-right">
          <button class="i-btn i-quiet" :disabled="!items.length" @click="clearAll">Clear all</button>
        </div>
      </div>
    </aside>
  </Teleport>
</template>
