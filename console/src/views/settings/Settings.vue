<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'

/**
 * Settings — company details, subscription, SMS, email, user settings, DNS.
 *
 * One component over six routes, because they are all the same thing: a set
 * of fields grouped under headings, saved as a blob.
 *
 * The production versions are the worst screens in the console by the
 * measurements in the audit: company details has 29 controls under one Save,
 * user settings has 19 controls in eight unlabelled sections, and four of the
 * six end with a single Save that commits everything at once with no
 * indication of what changed. Here each section is a section, each field that
 * needs explaining has a hint, and Save is disabled until something is
 * actually different.
 */

const route = useRoute()
const toast = inject('toast', () => {})

const PAGES = {
  '/settings/company-details': {
    title: 'Company details',
    subtitle: 'Who this tenant belongs to, and who to contact about it.',
    sections: [
      ['Organisation', [
        ['companyName', 'Company name', 'text', 'InstaSafe Demo Ltd'],
        ['tenantId', 'Tenant identifier', 'text', 'veno', 'Appears in every portal URL. Changing it breaks saved links.'],
        ['industry', 'Industry', 'select', 'Technology', '', ['Technology','Finance','Healthcare','Manufacturing','Retail','Government','Education']],
        ['employees', 'Employees', 'number', '1800'],
        ['country', 'Country', 'text', 'India']
      ]],
      ['Business contact', [
        ['bizName', 'Name', 'text', ''],
        ['bizEmail', 'Email', 'email', ''],
        ['bizPhone', 'Phone', 'text', '']
      ]],
      ['Technical contact', [
        ['techName', 'Name', 'text', ''],
        ['techEmail', 'Email', 'email', '', 'Where outage and certificate-expiry notices go.'],
        ['techPhone', 'Phone', 'text', '']
      ]],
      ['Renewal contact', [
        ['renName', 'Name', 'text', ''],
        ['renEmail', 'Email', 'email', '']
      ]]
    ]
  },
  '/settings/subscription-details': {
    title: 'Subscription',
    subtitle: 'What this tenant is licensed for.',
    readOnly: true,
    sections: [
      ['Licence', [
        ['plan', 'Plan', 'text', 'Enterprise'],
        ['seats', 'Licensed seats', 'number', '2000'],
        ['expiry', 'Renews on', 'text', '31 Dec 2026'],
        ['support', 'Support tier', 'text', '24x7']
      ]]
    ]
  },
  '/sms-settings': {
    title: 'SMS settings',
    subtitle: 'How one-time codes reach a phone.',
    sections: [
      ['Gateway', [
        ['provider', 'Provider', 'select', 'Twilio', '', ['Twilio','MessageBird','AWS SNS','Custom HTTP']],
        ['senderId', 'Sender ID', 'text', 'INSTSF', 'Six characters. Alphanumeric sender IDs are not deliverable in every country.'],
        ['apiKey', 'API key', 'password', ''],
        ['apiSecret', 'API secret', 'password', '']
      ]],
      ['Behaviour', [
        ['ttl', 'Code valid for (minutes)', 'number', '5'],
        ['length', 'Code length', 'number', '6'],
        ['retries', 'Attempts before lockout', 'number', '3']
      ]]
    ],
    testLabel: 'Send a test SMS'
  },
  '/email-settings': {
    title: 'Email settings',
    subtitle: 'How activation links, alerts and scheduled reports are sent.',
    sections: [
      ['SMTP', [
        ['host', 'Server', 'text', 'smtp.example.com'],
        ['port', 'Port', 'number', '587'],
        ['username', 'Username', 'text', ''],
        ['password', 'Password', 'password', ''],
        ['tls', 'Use STARTTLS', 'switch', true]
      ]],
      ['Addressing', [
        ['fromName', 'From name', 'text', 'InstaSafe'],
        ['fromAddress', 'From address', 'email', 'no-reply@instasafe.com'],
        ['replyTo', 'Reply-to', 'email', '', 'Leave empty and replies bounce, which is usually not what anyone intends.']
      ]]
    ],
    testLabel: 'Send a test email'
  },
  '/user-settings': {
    title: 'User settings',
    subtitle: 'Defaults applied to every user unless their profile overrides them.',
    sections: [
      ['Sessions', [
        ['portalTimeout', 'Portal session timeout (minutes)', 'number', '30'],
        ['agentIdle', 'Agent idle timeout (minutes)', 'number', '60'],
        ['forceDisconnect', 'Disconnect on policy change', 'switch', true,
          'When a rule changes, drop sessions it would no longer permit instead of waiting for them to end.']
      ]],
      ['Inactive accounts', [
        ['inactiveDays', 'Suspend after days idle', 'number', '90'],
        ['inactiveNotify', 'Warn the user first', 'switch', true]
      ]],
      ['Authentication controls', [
        ['maxFailed', 'Failed attempts before lockout', 'number', '5'],
        ['lockoutMinutes', 'Lockout duration (minutes)', 'number', '15'],
        ['requireMfa', 'Require MFA for every user', 'switch', false,
          'Overrides per-profile settings. Turning this on locks out anyone not yet enrolled.']
      ]],
      ['Access controls', [
        ['allowConcurrent', 'Allow concurrent sessions', 'switch', true],
        ['maxDevices', 'Devices per user', 'number', '3']
      ]]
    ]
  },
  '/settings/dns-wins': {
    title: 'DNS and WINS',
    subtitle: 'Name resolution handed to the agent when a tunnel comes up.',
    sections: [
      ['DNS', [
        ['dnsPrimary', 'Primary DNS', 'text', '10.20.0.53'],
        ['dnsSecondary', 'Secondary DNS', 'text', '10.20.0.54'],
        ['searchDomains', 'Search domains', 'text', 'corp.example.com',
          'Comma separated.']
      ]],
      ['WINS', [
        ['winsPrimary', 'Primary WINS', 'text', ''],
        ['winsSecondary', 'Secondary WINS', 'text', '']
      ]]
    ]
  }
}

const cfg = computed(() => PAGES[route.path] || PAGES['/settings/company-details'])
const form = ref({})
const original = ref({})
const saving = ref(false)
const testing = ref(false)

const dirty = computed(() =>
  JSON.stringify(form.value) !== JSON.stringify(original.value))

const changedKeys = computed(() =>
  Object.keys(form.value).filter(k => form.value[k] !== original.value[k]))

async function load () {
  const stored = await api.settings.get(route.path)
  const defaults = {}
  for (const [, fields] of cfg.value.sections) {
    for (const [key, , type, def] of fields) {
      defaults[key] = type === 'switch' ? !!def : (def ?? '')
    }
  }
  form.value = { ...defaults, ...(stored || {}) }
  original.value = { ...form.value }
}

async function save () {
  saving.value = true
  await api.settings.set(route.path, { ...form.value })
  await api.events.record({
    type: 'settings.updated',
    message: `${cfg.value.title} updated — ${changedKeys.value.join(', ')}`
  })
  original.value = { ...form.value }
  saving.value = false
  toast(cfg.value.title + ' saved')
}

/** Test send goes to the Demo Inbox, which is where the boundary is. */
async function sendTest () {
  testing.value = true
  const isSms = route.path === '/sms-settings'
  await api.inbox.create({
    id: 'msg_' + Date.now().toString(36),
    kind: isSms ? 'sms' : 'email',
    subject: isSms ? 'Test message' : 'Test email from InstaSafe',
    body: isSms
      ? `Test from ${form.value.senderId || 'INSTSF'} via ${form.value.provider}. Codes are ${form.value.length} digits and valid for ${form.value.ttl} minutes.`
      : `Test email sent through ${form.value.host}:${form.value.port}${form.value.tls ? ' over STARTTLS' : ' with no TLS'}.`,
    meta: { to: isSms ? '+91 98000 00000' : (form.value.replyTo || form.value.fromAddress) },
    read: false,
    at: new Date().toISOString()
  })
  testing.value = false
  toast('Test written to the Demo Inbox — open it to see what would have been sent')
}

watch(() => route.path, load)
onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader :title="cfg.title" :subtitle="cfg.subtitle">
      <template #actions>
        <button
          v-if="cfg.testLabel" class="i-btn" :disabled="testing" @click="sendTest"
        >{{ testing ? 'Sending…' : cfg.testLabel }}</button>
        <button
          v-if="!cfg.readOnly" class="i-btn i-primary"
          :disabled="saving || !dirty" @click="save"
        >{{ saving ? 'Saving…' : 'Save changes' }}</button>
      </template>
    </PageHeader>

    <div style="max-width:760px">
      <div v-for="[heading, fields] in cfg.sections" :key="heading" class="i-formsec">
        <h3>{{ heading }}</h3>
        <div class="i-frow">
          <div v-for="f in fields" :key="f[0]" class="i-field">
            <template v-if="f[2] === 'switch'">
              <label class="i-sw">
                <input type="checkbox" v-model="form[f[0]]" :disabled="cfg.readOnly">
                <span class="i-track" />{{ f[1] }}
              </label>
            </template>
            <template v-else>
              <label :for="'s_' + f[0]">{{ f[1] }}</label>
              <select
                v-if="f[2] === 'select'" :id="'s_' + f[0]" class="i-ctl"
                v-model="form[f[0]]" :disabled="cfg.readOnly"
              >
                <option v-for="o in f[5]" :key="o">{{ o }}</option>
              </select>
              <input
                v-else :id="'s_' + f[0]" class="i-ctl" :type="f[2]"
                v-model="form[f[0]]" :disabled="cfg.readOnly"
              >
            </template>
            <p v-if="f[4]" class="i-hint">{{ f[4] }}</p>
          </div>
        </div>
      </div>

      <!-- what Save is about to commit, which production never shows -->
      <div v-if="dirty" class="i-verdict is-warn">
        <h3><i class="fa-solid fa-pen me-2" aria-hidden="true" />{{ changedKeys.length }} unsaved change{{ changedKeys.length === 1 ? '' : 's' }}</h3>
        <p>
          <template v-for="(k, i) in changedKeys" :key="k">
            <code class="i-tech">{{ k }}</code><template v-if="i < changedKeys.length - 1">, </template>
          </template>
        </p>
      </div>

      <p v-if="cfg.readOnly" class="i-demo-note">
        Set by your contract rather than in the console. Changing a plan or a seat
        count goes through your account team.
      </p>
    </div>
  </div>
</template>
