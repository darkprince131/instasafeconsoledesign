<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import Sheet from '../../components/ui/Sheet.vue'

/**
 * Settings — SMS, email, user settings, DNS, and the local password policy.
 *
 * Company details and Subscription details were configs here until the real
 * screens were read: one needs repeating contacts and file uploads, the other
 * is a table of licence periods. Neither fits a list of fields, so both are
 * their own components now.
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

  /**
   * SMS settings.
   *
   * Not a provider list. Velto has no Twilio, no sender id, no API key: it
   * takes a **generic HTTP gateway** and asks you to describe the request —
   * the method, the URL, any headers, the parameter template, and which two
   * parameters carry the message and the phone number. That is what lets a
   * tenant point it at whatever regional SMS vendor it already pays for,
   * which is the thing a provider dropdown cannot do.
   *
   * The demo had Twilio, a sender id, an API key and a secret, plus code
   * length and validity, none of which this screen holds.
   */
  '/sms-settings': {
    title: 'SMS settings',
    subtitle: 'The HTTP gateway one-time codes are sent through. Any vendor that accepts an HTTP request will do.',
    sections: [
      ['The request', [
        ['method', 'HTTP Method', 'select', 'POST', 'How the gateway expects to be called. GET puts the parameters in the query string, where they are logged by proxies — including the code.', ['GET', 'POST'], true],
        ['url', 'URL', 'url', 'https://sms.example.com/api/v1/send', '', '', true],
        ['headers', 'Custom Headers', 'textarea', '', 'One per line, Name: value. This is where an API key goes on most gateways.', 'Authorization: Bearer …']
      ]],
      ['What it sends', [
        ['parameters', 'Parameters', 'text', 'sender=INSTSF&route=otp', 'The fixed part of the request, as the gateway documents it. The two attributes below are added to it.', '', true],
        ['messageAttribute', 'Message Attribute', 'text', 'text', 'The parameter the code itself goes in.', '', true],
        ['phoneAttribute', 'Phone Number attribute', 'text', 'to', 'The parameter the number goes in.', '', true]
      ]]
    ],
    testLabel: 'Send a test SMS'
  },

  /**
   * Email settings — velto calls the section Email SMTP Settings.
   *
   * Six fields, and the password is not one of them: it sits behind a Change
   * Password button that opens New Password / Confirm Password. A password
   * that has been set is never shown again, which is right, and the demo had
   * it inline on the form instead.
   *
   * Require SSL is a Yes/No select rather than a switch. That is velto's
   * control and it is kept, because the wording is the question being asked.
   */
  '/email-settings': {
    title: 'Email settings',
    subtitle: 'The SMTP relay that sends activation links, alerts and scheduled reports.',
    sections: [
      ['Email SMTP settings', [
        ['host', 'HostName', 'text', 'smtp.example.com', '', 'Enter HostName', true],
        ['port', 'Port', 'number', '587', 'Usually 587 with SSL, or 25 without.', 'Enter Port', true],
        ['username', 'Username', 'text', 'no-reply@example.com', '', 'Enter Username', true],
        ['senderEmail', 'Sender Email-ID', 'email', 'no-reply@example.com', 'What recipients see in From, and where their replies go.', 'Enter Sender Email-ID', true],
        ['senderName', 'Sender Name', 'text', 'InstaSafe', '', 'Enter Sender Name', true],
        ['requireSsl', 'Require SSL', 'select', 'Yes', 'No sends credentials and message bodies in the clear.', ['Yes', 'No'], true]
      ]]
    ],
    testLabel: 'Send a test email',
    passwordAction: 'Change Password'
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
        ['welcomeBulkUsers', 'Send welcome emails to bulk local users', 'switch', false],
        ['notifySubAdminsDeviceApproval', 'Notify sub-admins on device approval', 'switch', true,
          'With 775 devices waiting, this is the difference between a queue somebody works and a queue nobody knows about.'],
        ['notifyUsersCheckFailure', 'Notify users on device check failure', 'switch', true,
          'A failed posture check looks like a broken product to the person it happens to, unless they are told what failed.']
      ]],
      /**
       * Velto offers these as three switches and does not ask for the
       * interval anywhere on the screen. Three day-count fields were invented
       * here instead. The switches are what the product has.
       */
      ['Inactive users', [
        ['inactiveWarn', 'Warning', 'switch', true,
          'Mail the person before anything happens to their account.'],
        ['inactiveSuspend', 'Suspend', 'switch', false],
        ['inactiveDelete', 'Delete', 'switch', false,
          'Deletion is not reversible. Anyone on parental or medical leave is idle by this measure.']
      ]],
      ['Authentication controls', [
        ['bypassMfaIps', 'Bypass MFA from public IPs', 'textarea', '',
          'Comma-separated. Every address here is somewhere multi-factor stops applying, so the list is worth keeping short.',
          '203.0.113.10, 198.51.100.0/24']
      ]],
      ['Access controls', [
        ['deviceComplianceWeb', 'Device compliance for web access', 'switch', true,
          'Applies the posture checks to browser sessions, not only to the agent.'],
        ['webElevatedAccess', 'Web based elevated access', 'switch', false],
        ['directAccessIps', 'Allow direct access from public IPs', 'textarea', '',
          'Comma-separated. These bypass the gateway.', '203.0.113.10'],
        ['adminAccessIps', 'Limit admin access from public IPs', 'textarea', '',
          'Comma-separated. Empty means admins may sign in from anywhere.', '203.0.113.10'],
        ['userAccessIps', 'Limit user access from public IPs', 'textarea', '',
          'Comma-separated. Empty means no restriction.', '203.0.113.0/24'],
        ['disallowedBrowsers', 'Disallowed browsers for users', 'textarea', '',
          'Comma-separated.', 'Internet Explorer, Opera Mini'],
        ['whitelistedUrls', 'Whitelisted URLs', 'textarea', '',
          'Comma-separated. Reachable even where direct access is otherwise closed.',
          'https://www.instasafe.com, https://office.microsoft.com']
      ]],
      ['Force user disconnect', [
        ['forceDisconnectHours', 'Disconnect the agent after (hours)', 'number', '0',
          'A hard cap on session length, whatever the user is doing. Zero means no cap.',
          '', false, [0, 24]]
      ]],
      ['Agent idle timeout', [
        ['agentIdleValue', 'Log idle agents out after', 'number', '0',
          'Zero means idle agents are never logged out.', '', false, [0, 60]],
        ['agentIdleUnit', 'Unit', 'select', 'Minutes', '', ['Minutes', 'Hours']]
      ]],
      ['Portal session timeout', [
        ['portalTimeoutMinutes', 'Log portal users out after (minutes)', 'number', '180',
          'Velto ships 180. The console holds every administrative control in the tenant, so this is the one of the three worth shortening.',
          '', false, [0, 600]]
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

const cfg = computed(() => PAGES[route.path] || PAGES['/profile/local'])
const form = ref({})
const original = ref({})
const saving = ref(false)
const testing = ref(false)

/* The SMTP password. Velto keeps it off the form behind Change Password, and
   a password that has been set is never shown again. Nothing here stores the
   value: there is no SMTP server to give it to, and a demo has no business
   holding one in a browser database. What is kept is that one was set, and
   when — which is what the screen needs to tell you. */
const pwOpen = ref(false)
const pwNew = ref('')
const pwConfirm = ref('')
const pwSaving = ref(false)

function openPassword () {
  pwNew.value = ''
  pwConfirm.value = ''
  pwOpen.value = true
}

async function savePassword () {
  if (pwNew.value.length < 8) { toast('Use at least 8 characters', 'bad'); return }
  if (pwNew.value !== pwConfirm.value) { toast('The two passwords do not match', 'bad'); return }
  pwSaving.value = true
  try {
    form.value.passwordSet = true
    form.value.passwordUpdatedAt = new Date().toISOString()
    await api.settings.set(route.path, { ...form.value })
    original.value = { ...form.value }
    await api.events.record({
      type: 'settings.updated',
      message: 'SMTP password changed',
      severity: 'warning'
    })
    pwOpen.value = false
    toast('SMTP password changed')
  } finally {
    pwSaving.value = false
  }
}

const passwordState = computed(() => {
  if (!form.value.passwordSet) return 'No password set — the relay will refuse to authenticate.'
  const when = new Date(form.value.passwordUpdatedAt)
  return `Password set ${when.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. It is not shown again.`
})

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
      ? `${form.value.method} ${form.value.url} with ${form.value.parameters}, the code in "${form.value.messageAttribute}" and the number in "${form.value.phoneAttribute}".`
      : `Test email sent as ${form.value.senderName} <${form.value.senderEmail}> through ${form.value.host}:${form.value.port}${form.value.requireSsl === 'Yes' ? ' over SSL' : ' with no SSL'}.`,
    meta: { to: isSms ? '+91 98000 00000' : form.value.senderEmail },
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
          v-if="cfg.passwordAction" class="i-btn" @click="openPassword"
        >{{ cfg.passwordAction }}</button>
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
              <label :for="'s_' + f[0]">
                {{ f[1] }}<span v-if="f[6]" class="i-req">*</span>
              </label>
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
                :min="f[7] ? f[7][0] : undefined" :max="f[7] ? f[7][1] : undefined"
              >
            </template>
            <p v-if="f[4]" class="i-hint">{{ f[4] }}</p>
          </div>
        </div>
      </div>

      <p v-if="cfg.passwordAction" class="i-demo-note">
        {{ passwordState }}
      </p>

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

    <!-- Velto's Change Email Password: two fields and Save, with the password
         never shown on the form itself. -->
    <Sheet
      v-model:open="pwOpen"
      title="Change email password"
      subtitle="The password the relay authenticates with. It is not shown again once saved."
    >
      <div class="i-formsec">
        <div class="i-field">
          <label for="password">New Password<span class="i-req">*</span></label>
          <input
            id="password" name="password" class="i-ctl" type="password"
            autocomplete="new-password" placeholder="New Password"
            v-model="pwNew"
          >
          <p class="i-hint">At least 8 characters.</p>
        </div>
        <div class="i-field">
          <label for="password_confirmation">Confirm Password<span class="i-req">*</span></label>
          <input
            id="password_confirmation" name="password_confirmation" class="i-ctl"
            type="password" autocomplete="new-password" placeholder="Confirm Password"
            v-model="pwConfirm"
          >
          <p v-if="pwConfirm && pwNew !== pwConfirm" class="i-hint">
            These two do not match yet.
          </p>
        </div>
        <p class="i-demo-note">
          This demo has no SMTP relay to hand a password to, so the value is
          not stored anywhere — only the fact that one was set, and when.
        </p>
      </div>
      <template #footer>
        <button class="i-btn i-quiet" @click="pwOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="pwSaving" @click="savePassword">
            {{ pwSaving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </template>
    </Sheet>
  </div>
</template>
