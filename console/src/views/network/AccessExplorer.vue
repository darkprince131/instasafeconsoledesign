<script setup>
import { ref, onMounted, inject } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'

/**
 * The access explorer.
 *
 * Answers the question the console cannot answer today: "can this person
 * reach that application, and why?". The production console has 57 access
 * rules, no evaluation endpoint and no way to test a rule short of asking the
 * user to try it.
 *
 * The engine genuinely walks the rule table in priority order. It reports the
 * rule that decided, every rule it considered, any rule that was shadowed by
 * an earlier one, and whether device posture overrode an allow.
 *
 * That last part matters: the seed data contains a deliberately shadowed rule
 * so there is always something real to find.
 */

const toast = inject('toast', () => {})

const users = ref([])
const apps = ref([])
const userId = ref('')
const appId = ref('')
const withPosture = ref(true)
const result = ref(null)
const busy = ref(false)

const posture = ref({
  diskEncryption: true, antivirus: true, firewall: true,
  osUpToDate: true, screenLock: true, jailbroken: false
})

async function run () {
  if (!userId.value || !appId.value) return
  busy.value = true
  result.value = await api.accessRules.evaluate({
    userId: userId.value,
    applicationId: appId.value,
    posture: withPosture.value ? posture.value : null
  })
  busy.value = false
}

onMounted(async () => {
  const [u, a] = await Promise.all([
    api.users.list({ perPage: 40, sort: 'firstName' }),
    api.applications.list({ perPage: 0, sort: 'name' })
  ])
  users.value = u.data
  apps.value = a.data
  userId.value = u.data[0]?.id || ''
  appId.value = a.data.find(x => x.name === 'Finance DB')?.id || a.data[0]?.id || ''
  run()
})
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Access explorer"
      subtitle="Pick a person and an application. The policy engine answers, and shows its working."
    >
      <template #sub>
        <p class="i-sub" style="margin-top:6px">
          <span class="i-new me-2">New</span>
          Not in the current console. It needs a policy-evaluation endpoint, which is
          the one dependency this screen carries.
        </p>
      </template>
    </PageHeader>

    <div class="row g-4">
      <div class="col-12 col-lg-5">
        <div class="i-formsec">
          <div class="i-frow" style="grid-template-columns:1fr">
            <div class="i-field">
              <label for="u">User</label>
              <select id="u" class="i-ctl" v-model="userId" @change="run">
                <option v-for="u in users" :key="u.id" :value="u.id">
                  {{ u.firstName }} {{ u.lastName }} — {{ u.department }}
                </option>
              </select>
            </div>
          </div>
          <div class="i-frow" style="grid-template-columns:1fr">
            <div class="i-field">
              <label for="a">Application</label>
              <select id="a" class="i-ctl" v-model="appId" @change="run">
                <option v-for="a in apps" :key="a.id" :value="a.id">
                  {{ a.name }} ({{ a.type.toUpperCase() }})
                </option>
              </select>
            </div>
          </div>

          <label class="i-sw mt-2">
            <input type="checkbox" v-model="withPosture" @change="run">
            <span class="i-track" />
            Also evaluate device posture
          </label>

          <div v-if="withPosture" class="mt-3 d-flex flex-column gap-2">
            <label class="i-sw" style="font-size:12px">
              <input type="checkbox" v-model="posture.diskEncryption" @change="run">
              <span class="i-track" />Disk encryption
            </label>
            <label class="i-sw" style="font-size:12px">
              <input type="checkbox" v-model="posture.antivirus" @change="run">
              <span class="i-track" />Antivirus running
            </label>
            <label class="i-sw" style="font-size:12px">
              <input type="checkbox" v-model="posture.jailbroken" @change="run">
              <span class="i-track" />Jailbroken
            </label>
          </div>

          <button class="i-btn i-primary mt-3" :disabled="busy" @click="run">
            {{ busy ? 'Evaluating…' : 'Evaluate' }}
          </button>
        </div>
      </div>

      <div class="col-12 col-lg-7">
        <div v-if="!result" class="i-skeleton-page" />

        <template v-else>
          <div class="i-verdict" :class="result.outcome === 'allow' ? 'is-pass' : 'is-block'">
            <h3>
              <i
                class="fa-solid me-2" aria-hidden="true"
                :class="result.outcome === 'allow' ? 'fa-circle-check' : 'fa-circle-xmark'"
              />
              {{ result.outcome === 'allow' ? 'Access allowed' : 'Access denied' }}
            </h3>
            <p>{{ result.because }}</p>
          </div>

          <dl class="i-kv mt-4">
            <dt>User</dt>
            <dd>{{ result.user.name }}</dd>
            <dt>Groups considered</dt>
            <dd>{{ result.user.groups.length ? result.user.groups.join(', ') : 'none' }}</dd>
            <dt>Application</dt>
            <dd>{{ result.application.name }} ({{ result.application.type.toUpperCase() }})</dd>
            <dt v-if="result.posture">Device posture</dt>
            <dd v-if="result.posture">
              {{ result.posture.passed }} of {{ result.posture.results.length }} checks passed
              — {{ result.posture.reason }}
            </dd>
          </dl>

          <div class="i-chead mt-4">
            <h2>How it was decided</h2>
            <span class="i-meta">{{ result.considered.length }} rules in priority order</span>
          </div>

          <div
            v-for="rule in result.considered.filter(r => r.matched)" :key="rule.id"
            class="i-trace" :class="{ 'is-hit': rule.id === result.decidedBy?.id, 'is-shadowed': rule.skippedBy }"
          >
            <div class="d-flex align-items-center gap-2">
              <span class="i-tech" style="font-size:11px">#{{ rule.priority }}</span>
              <span class="i-trace-name">{{ rule.name }}</span>
              <span class="i-pill ms-2" :class="rule.action === 'deny' ? 'i-bad' : ''">
                <span v-if="rule.action !== 'deny'" class="i-dot i-ok" />{{ rule.action }}
              </span>
              <span v-if="rule.id === result.decidedBy?.id" class="i-new ms-auto">decided</span>
              <span v-else-if="rule.skippedBy" class="ms-auto" style="font-size:11px;color:var(--i-mute)">
                shadowed by #{{ result.decidedBy?.priority }}
              </span>
            </div>
            <div v-if="rule.schedule && rule.schedule !== 'Always'" style="font-size:11.5px;color:var(--i-mute);margin-top:2px">
              only during {{ rule.schedule }}
            </div>
          </div>

          <p v-if="!result.considered.some(r => r.matched)" style="font-size:12.5px;color:var(--i-mute)">
            No rule matched this pair, so the default deny applied. That is why the
            answer is no.
          </p>

          <div v-if="result.shadowed.length" class="i-demo-note mt-3">
            <strong style="color:var(--i-ink)">
              {{ result.shadowed.length }} rule{{ result.shadowed.length === 1 ? ' is' : 's are' }} unreachable.
            </strong>
            An earlier rule already decided this pair, so {{ result.shadowed.length === 1 ? 'it' : 'they' }}
            can never fire. Worth deleting — a rule that cannot run is a rule
            somebody will later believe is protecting them.
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
