<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import { FORMATS, renderBatch } from '../../lib/siem.js'

/**
 * SIEM export.
 *
 * The question a security team asks in the first ten minutes is "what does
 * this look like in my SIEM", and the honest answer is a sample of their own
 * events in the wire format they use. So this renders real rows from the
 * event log into real syslog, CEF, LEEF or JSON — the actual specifications,
 * with the escaping done properly — and lets them copy or download it.
 *
 * Nothing is sent anywhere. The destination form is real configuration that a
 * backend would act on; here the payload goes to the Demo Inbox instead, so
 * what would have crossed the boundary is visible rather than imagined.
 */

const toast = inject('toast', () => {})

const events = ref([])
const loading = ref(true)
const format = ref('cef')
const host = ref('i365.instasafe.com')
const limit = ref(25)
const filter = ref('all')
const saving = ref(false)

const destination = ref({
  enabled: true,
  protocol: 'tls',
  host: 'siem.corp.example.com',
  port: 6514,
  format: 'cef',
  batchSize: 100
})

const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'warning', label: 'Warnings only' },
  { key: 'auth', label: 'Authentication' },
  { key: 'access', label: 'Access decisions' },
  { key: 'device', label: 'Devices' }
]

const filtered = computed(() => {
  let out = events.value
  if (filter.value === 'warning') out = out.filter(e => e.severity === 'warning')
  else if (filter.value !== 'all') out = out.filter(e => String(e.type).startsWith(filter.value))
  return out.slice(0, limit.value)
})

const rendered = computed(() => renderBatch(filtered.value, format.value, host.value))
const bytes = computed(() => new Blob([rendered.value]).size)

/* A rough but honest daily volume: events in the last 24h, times the bytes
   per record this format produces. Sizing a collector is the first thing a
   SIEM team asks and nobody ever tells them. */
const perDay = computed(() => {
  const dayAgo = Date.now() - 86_400_000
  const recent = events.value.filter(e => new Date(e.at).getTime() > dayAgo).length
  if (!filtered.value.length) return null
  const avg = bytes.value / filtered.value.length
  return { events: recent, bytes: Math.round(recent * avg) }
})

function human (n) {
  if (n < 1024) return n + ' B'
  if (n < 1024 ** 2) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 ** 2).toFixed(1) + ' MB'
}

async function load () {
  loading.value = true
  const res = await api.events.list({ perPage: 0, sort: 'at', dir: 'desc' })
  events.value = res.data
  loading.value = false
}

function copy () {
  navigator.clipboard?.writeText(rendered.value)
  toast('Copied ' + filtered.value.length + ' records')
}

function download () {
  const ext = { syslog: 'log', cef: 'cef', leef: 'leef', json: 'ndjson' }[format.value]
  const blob = new Blob([rendered.value], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `i365-events.${ext}`
  a.click()
  URL.revokeObjectURL(a.href)
  toast('Downloaded ' + filtered.value.length + ' records')
}

/** Sends a batch — to the Demo Inbox, which is where the boundary is. */
async function sendTest () {
  saving.value = true
  await api.inbox.create({
    id: 'msg_' + Date.now().toString(36),
    kind: 'siem',
    subject: `${FORMATS[format.value].label} batch → ${destination.value.host}:${destination.value.port}`,
    body: rendered.value.split('\n').slice(0, 3).join('\n') +
      (filtered.value.length > 3 ? `\n… ${filtered.value.length - 3} more records` : ''),
    meta: {
      to: `${destination.value.protocol}://${destination.value.host}:${destination.value.port}`,
      records: filtered.value.length,
      bytes: bytes.value
    },
    read: false,
    at: new Date().toISOString()
  })
  await api.events.record({
    type: 'siem.batch.sent',
    message: `${filtered.value.length} events exported as ${format.value.toUpperCase()} to ${destination.value.host}`
  })
  saving.value = false
  toast('Batch written to the Demo Inbox — open it to see exactly what left')
}

watch(() => destination.value.protocol, (p) => {
  destination.value.port = { udp: 514, tcp: 601, tls: 6514, https: 443 }[p] ?? destination.value.port
})

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="SIEM export"
      subtitle="What your events look like in your SIEM, in the format it actually ingests."
    >
    </PageHeader>

    <div class="i-strip">
      <div class="i-tools">
        <button class="i-btn" :disabled="!filtered.length" @click="copy">
          <i class="fa-regular fa-copy" aria-hidden="true" /> Copy
        </button>
        <button class="i-btn" :disabled="!filtered.length" @click="download">
          <i class="fa-solid fa-download" aria-hidden="true" /> Download
        </button>
        <button class="i-btn i-primary" :disabled="saving || !filtered.length" @click="sendTest">
          {{ saving ? 'Sending…' : 'Send test batch' }}
        </button>
      </div>
    </div>

    <div class="row g-4">
      <!-- the payload -->
      <div class="col-12 col-xl-8">
        <div class="i-strip">
          <div class="i-ftabs">
            <button
              v-for="(f, key) in FORMATS" :key="key"
              class="i-chip" :class="{ 'is-on': format === key }"
              :aria-pressed="format === key" @click="format = key"
            >{{ f.label }}</button>
          </div>
        </div>

        <p class="i-hint" style="margin:0 0 12px">{{ FORMATS[format].note }}</p>

        <div class="i-strip" style="padding-top:0">
          <div class="i-ftabs">
            <button
              v-for="f in FILTERS" :key="f.key"
              class="i-chip" :class="{ 'is-on': filter === f.key }"
              :aria-pressed="filter === f.key" @click="filter = f.key"
            >{{ f.label }}</button>
          </div>
          <div class="i-right">
            <select class="i-ctl" style="width:auto" v-model.number="limit" aria-label="Records to render">
              <option :value="10">10 records</option>
              <option :value="25">25 records</option>
              <option :value="100">100 records</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="i-skeleton-page" />
        <template v-else-if="filtered.length">
          <div class="i-session">
            <div class="i-session-bar">
              <span class="i-dot i-ok" />
              {{ filtered.length }} records · {{ human(bytes) }}
              <span class="ms-auto i-tech">{{ FORMATS[format].transport }}</span>
            </div>
            <div class="i-session-body" style="white-space:pre;overflow-x:auto;font-size:11px">{{ rendered }}</div>
          </div>
          <p v-if="perDay" class="i-hint mt-2">
            At this tenant's current rate — {{ perDay.events.toLocaleString() }} events in
            the last 24 hours — that is about <strong>{{ human(perDay.bytes) }} per day</strong>
            in {{ format.toUpperCase() }}. Worth knowing before you size a collector or a licence.
          </p>
        </template>
        <div v-else class="i-zero">
          <div class="i-zi"><i class="fa-solid fa-filter" aria-hidden="true" /></div>
          <h3>Nothing matches this filter</h3>
          <p>Switch back to Everything, or do something in the console and come back.</p>
        </div>
      </div>

      <!-- where it goes -->
      <div class="col-12 col-xl-4">
        <div class="i-chead"><h2>Destination</h2></div>
        <div class="i-formsec">
          <label class="i-sw mb-3">
            <input type="checkbox" v-model="destination.enabled"><span class="i-track" />
            Forward events continuously
          </label>

          <div class="i-field mb-3">
            <label for="proto">Transport</label>
            <select id="proto" class="i-ctl" v-model="destination.protocol">
              <option value="udp">Syslog over UDP</option>
              <option value="tcp">Syslog over TCP</option>
              <option value="tls">Syslog over TLS</option>
              <option value="https">HTTPS collector</option>
            </select>
            <p v-if="destination.protocol === 'udp'" class="i-hint">
              UDP does not retry and does not encrypt. Fine inside a trusted
              network, a poor choice across one.
            </p>
          </div>

          <div class="i-frow">
            <div class="i-field">
              <label for="dh">Collector host</label>
              <input id="dh" class="i-ctl" v-model="destination.host">
            </div>
            <div class="i-field">
              <label for="dp">Port</label>
              <input id="dp" class="i-ctl" type="number" v-model.number="destination.port">
            </div>
          </div>

          <div class="i-field mt-3">
            <label for="bs">Batch size</label>
            <input id="bs" class="i-ctl" type="number" v-model.number="destination.batchSize">
            <p class="i-hint">Records per flush. Larger batches cost less and lose more if a flush fails.</p>
          </div>
        </div>

        <div class="i-demo-note">
          <strong style="color:var(--i-ink)">What is real.</strong>
          The formatting. These are the actual specifications — RFC 5424 with its
          structured-data element, CEF 0 with the prefix and extension escaped
          separately, LEEF 2.0 tab-delimited — rendered from this tenant's own
          event rows. Paste them into your parser and they will parse.
          <br><br>
          <strong style="color:var(--i-ink)">What is not.</strong>
          Nothing leaves the browser. Send test batch writes the payload to the
          Demo Inbox so you can read exactly what would have crossed the boundary.
        </div>
      </div>
    </div>
  </div>
</template>
