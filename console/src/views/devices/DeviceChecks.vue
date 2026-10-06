<script setup>
import { ref, onMounted, inject } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'

/**
 * Device posture checks, with a live evaluator.
 *
 * The rules on the left are real records. The panel on the right is an
 * editable device payload, and the verdict underneath is genuinely computed
 * by the policy code — flip a switch and the answer changes, including
 * whether the failure is blocking or merely a warning.
 *
 * That turns an abstract settings screen into something a visitor can poke
 * at and understand in about fifteen seconds.
 */

const toast = inject('toast', () => {})

const checks = ref([])
const loading = ref(true)
const result = ref(null)
const evaluating = ref(false)

/* The simulated endpoint. In production this arrives from the agent. */
const posture = ref({
  diskEncryption: true,
  antivirus: true,
  firewall: true,
  osUpToDate: false,
  screenLock: true,
  jailbroken: false
})

const LABELS = {
  diskEncryption: 'Disk encryption on',
  antivirus: 'Antivirus running',
  firewall: 'Firewall enabled',
  osUpToDate: 'Operating system up to date',
  screenLock: 'Screen lock enabled',
  jailbroken: 'Device jailbroken or rooted'
}

async function load () {
  loading.value = true
  const res = await api.deviceChecks.list({ perPage: 0 })
  checks.value = res.data
  loading.value = false
  evaluate()
}

async function evaluate () {
  evaluating.value = true
  result.value = await api.deviceChecks.evaluate({ posture: posture.value })
  evaluating.value = false
}

async function toggleCheck (c) {
  await api.deviceChecks.update(c.id, { enabled: !c.enabled })
  c.enabled = !c.enabled
  toast(c.name + (c.enabled ? ' enabled' : ' disabled'))
  evaluate()
}

const SEV = { critical: 'bad', high: 'att', medium: null, low: null }

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Device checks"
      subtitle="Posture rules every endpoint is measured against before it is allowed to connect."
    >
      <template #actions>
        <button class="i-btn i-primary"><i class="fa-solid fa-plus" aria-hidden="true" /> Add check</button>
      </template>
    </PageHeader>

    <div class="row g-4">
      <!-- the rules -->
      <div class="col-12 col-lg-7">
        <div class="i-chead">
          <h2>Rules</h2>
          <span class="i-meta">{{ checks.filter(c => c.enabled).length }} of {{ checks.length }} enabled</span>
        </div>

        <div v-if="loading">
          <div v-for="n in 5" :key="n" class="i-skel mb-3" />
        </div>

        <div v-else>
          <div v-for="c in checks" :key="c.id" class="i-checkrow">
            <label class="i-sw" style="flex:none">
              <input type="checkbox" :checked="c.enabled" @change="toggleCheck(c)">
              <span class="i-track" />
            </label>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px">{{ c.name }}</div>
              <div style="font-size:11.5px;color:var(--i-mute)">
                expects <code class="i-tech">{{ c.postureKey }}</code> = {{ c.expect }}
              </div>
            </div>
            <span class="i-pill" :class="SEV[c.severity] ? 'i-' + SEV[c.severity] : ''">
              <span v-if="!SEV[c.severity]" class="i-dot" />
              {{ c.severity }}
            </span>
          </div>
        </div>
      </div>

      <!-- the evaluator -->
      <div class="col-12 col-lg-5">
        <div class="i-chead">
          <h2>Try it against a device</h2>
          <span class="i-meta">Really evaluates</span>
        </div>

        <p style="font-size:12.5px;color:var(--i-dim);margin:0 0 14px">
          This is the payload an agent reports. Change it and the verdict below
          recomputes — nothing here is canned.
        </p>

        <div class="d-flex flex-column gap-2 mb-4">
          <label v-for="(v, k) in posture" :key="k" class="i-sw">
            <input type="checkbox" v-model="posture[k]" @change="evaluate()">
            <span class="i-track" />
            {{ LABELS[k] }}
          </label>
        </div>

        <div
          v-if="result"
          class="i-verdict"
          :class="{
            'is-pass': result.verdict === 'pass',
            'is-warn': result.verdict === 'warn',
            'is-block': result.verdict === 'blocked'
          }"
        >
          <h3>
            <i
              class="fa-solid me-2" aria-hidden="true"
              :class="{
                'fa-circle-check': result.verdict === 'pass',
                'fa-triangle-exclamation': result.verdict === 'warn',
                'fa-circle-xmark': result.verdict === 'blocked'
              }"
            />
            {{ result.verdict === 'pass' ? 'Device allowed'
             : result.verdict === 'warn' ? 'Allowed with warnings' : 'Device blocked' }}
          </h3>
          <p>{{ result.reason }}</p>
        </div>

        <div v-if="result" class="mt-3">
          <div v-for="rr in result.results" :key="rr.id" class="i-checkrow">
            <span class="i-checkicon">
              <i
                class="fa-solid" aria-hidden="true"
                :class="rr.pass ? 'fa-check' : 'fa-xmark'"
                :style="{ color: rr.pass ? 'var(--i-ok)' : 'var(--i-bad)' }"
              />
            </span>
            <span style="flex:1;font-size:12.5px">{{ rr.name }}</span>
            <span v-if="!rr.pass" class="i-pill" :class="rr.severity === 'critical' ? 'i-bad' : 'i-att'">
              {{ rr.severity }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
