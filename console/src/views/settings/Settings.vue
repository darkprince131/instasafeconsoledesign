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
  /**
   * The local authentication profile.
   *
   * It sits under Authentication profiles in the navigation beside SAML and
   * RADIUS, which makes it look like it should be a list of profiles too. It
   * is not, and velto does not pretend otherwise: there is exactly one local
   * directory per tenant, so the screen is its password policy — thirteen
   * fields, Save and Cancel, no table.
   *
   * Field names and defaults are velto's.
   */
  '/profile/local': {
    title: 'Local profile',
    subtitle: 'The password policy for accounts held in this console rather than in a directory. One local directory per tenant, so this is a policy rather than a list.',
    sections: [
      ['Password composition', [
        ['maxLength', 'Maximum password length', 'number', '20'],
        ['minLength', 'Minimum password length', 'number', '6'],
        ['minNumeric', 'Minimum numeric characters', 'number', '2'],
        ['minUpper', 'Minimum uppercase characters', 'number', '1'],
        ['minLower', 'Minimum lowercase characters', 'number', '2'],
        ['minSpecial', 'Minimum special characters', 'number', '1'],
        ['specialSet', 'Set of "special" characters', 'text', '~!@#$%^&*()',
          'Only these count towards the minimum above. Anything outside the set is treated as an ordinary character.']
      ]],
      ['Rotation', [
        ['forceChange', 'Force user to change password on next login', 'switch', false],
        ['expiryEnabled', 'Enable password expiry', 'switch', false],
        ['expiryDays', 'Passwords expire after (days)', 'number', '365',
          'Applies only while expiry is enabled.']
      ]],
      ['Reuse', [
        ['preventReuse', 'Prevent any password reuse', 'switch', false],
        ['restrictRecentReuse', 'Restrict recent password reuse', 'switch', false],
        ['reuseHistory', 'Number of previous passwords to block', 'number', '15',
          'Applies only while recent reuse is restricted.']
      ]]
    ]
  },

  '/settings/company-details': {
    title: 'Company details',
    subtitle: 'Who this tenant belongs to, and who to contact about it.',
    sections: [
      ['Organisation', [
        ['companyName', 'Company name', 'text', 'InstaSafe Demo Ltd'],
        ['tenantId', 'Tenant identifier', 'text', 'demo', 'Appears in every portal URL. Changing it breaks saved links.'],
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
  /**
   * User settings.
   *
   * This was largely invented — concurrent sessions, devices per user, lockout
   * thresholds. Velto's is a different list, and a more revealing one: most of
   * it is about *where* a person is connecting from rather than how many times
   * they may try. Four separate public-IP lists, a browser deny-list, and
   * three timeouts.
   *
   * The IP fields are textareas because they hold several addresses. A
   * single-line input for four of them makes you scroll a box to see what is
   * already in it, which is how an allow-list ends up with a duplicate nobody
   * noticed.
   */
  '/user-settings': {
    title: 'User settings',
    subtitle: 'Defaults applied to every user unless their profile overrides them.',
    sections: [
      ['Email settings', [
        ['welcomeAdUsers', 'Send welcome emails to AD users', 'switch', false],
        ['welcomeBulkUsers', 'Send welcome emails to bulk local users', 'switch', false]
      ]],
      ['Inactive users', [
        ['inactiveWarnDays', 'Warn after days idle', 'number', '60'],
        ['inactiveSuspendDays', 'Suspend after days idle', 'number', '90'],
        ['inactiveDeleteDays', 'Delete after days idle', 'number', '365',
          'Deletion is not reversible, so it should be the longest of the three — and well clear of anyone on parental or medical leave.']
      ]],
      ['Authentication controls', [
        ['bypassMfaIps', 'Bypass MFA from public IPs', 'textarea', '',
          'Comma-separated. Every address here is somewhere multi-factor stops applying, so the list is worth keeping short.',
          '203.0.113.10, 198.51.100.0/24']
      ]],
      ['Elevated access controls', [
        ['webElevatedAccess', 'Web based elevated access', 'switch', false]
      ]],
      ['Access controls', [
        ['deviceComplianceWeb', 'Device compliance for web access', 'switch', true,
          'Applies the posture checks to browser sessions, not only to the agent.'],
        ['directAccessIps', 'Allow direct access from public IPs', 'textarea', '',
          'Comma-separated. These bypass the gateway.', '203.0.113.10'],
        ['adminAccessIps', 'Limit admin access to public IPs', 'textarea', '',
          'Comma-separated. Empty means admins may sign in from anywhere.', '203.0.113.10'],
        ['userAccessIps', 'Limit user access to public IPs', 'textarea', '',
          'Comma-separated. Empty means no restriction.', '203.0.113.0/24'],
        ['disallowedBrowsers', 'Disallowed browsers for users', 'textarea', '',
          'Comma-separated.', 'Internet Explorer, Opera Mini']
      ]],
      ['Force user disconnect', [
        ['forceDisconnectHours', 'Disconnect the agent after (hours)', 'number', '12',
          'A hard cap on session length, whatever the user is doing.']
      ]],
      ['Agent idle timeout', [
        ['agentIdleValue', 'Log idle agents out after', 'number', '30'],
        ['agentIdleUnit', 'Unit', 'select', 'Minutes', '', ['Minutes', 'Hours']]
      ]],
      ['Portal session timeout', [
        ['portalTimeoutMinutes', 'Log portal users out after (minutes)', 'number', '30']
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
    </PageHeader>

    <div class="i-strip">
      <div class="i-tools">
        <button
          v-if="cfg.testLabel" class="i-btn" :disabled="testing" @click="sendTest"
        >{{ testing ? 'Sending…' : cfg.testLabel }}</button>
        <button
          v-if="!cfg.readOnly" class="i-btn i-primary"
          :disabled="saving || !dirty" @click="save"
        >{{ saving ? 'Saving…' : 'Save changes' }}</button>
      </div>
    </div>

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
              <!-- IP allow-lists and browser lists are many short lines, not
                   one long one. A single-line input for four addresses makes
                   you scroll a text box to check what is in it. -->
              <textarea
                v-else-if="f[2] === 'textarea'" :id="'s_' + f[0]" class="i-ctl i-tech"
                rows="2" v-model="form[f[0]]" :disabled="cfg.readOnly"
                :placeholder="f[5] || ''"
              />
              <input
                v-else :id="'s_' + f[0]" class="i-ctl" :type="f[2]"
                v-model="form[f[0]]" :disabled="cfg.readOnly"
                :placeholder="f[5] || ''"
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
