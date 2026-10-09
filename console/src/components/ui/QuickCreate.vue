<script setup>
import { ref, watch, inject } from 'vue'
import Sheet from './Sheet.vue'

/**
 * Create the thing you are halfway through needing.
 *
 * Writing an access rule means naming a user and an application. If either
 * does not exist yet, the console sent you away to make it — losing the rule
 * you were drafting, and asking you to remember where you were when you got
 * back. People stop writing the rule instead.
 *
 * So a picker can create. This is the smallest form that produces a valid
 * record of the kind being picked, opened over the one already in front of
 * you, and the new record is selected when it saves. The full screens still
 * exist for everything else; this is the field set you cannot do without.
 *
 * Deliberately not a wizard: a wizard is right when the steps have an order
 * that matters, and "a user needs a name and an email" has no order. One
 * short form over the top is less to get through and less to get lost in.
 */

const props = defineProps({
  /** 'users' | 'groups' | 'applications' | 'appGroups' */
  resource: { type: String, required: true },
  /** Prefills the first field, so what was typed into the search is not lost. */
  seed: { type: String, default: '' }
})

const open = defineModel('open', { type: Boolean, default: false })
const emit = defineEmits(['created'])

const toast = inject('toast', () => {})

/**
 * The minimum that makes each kind valid. Anything the full screen offers and
 * this does not is a default somebody can change later — and the point is to
 * get back to the rule, not to finish configuring a user.
 */
const SHAPES = {
  users: {
    title: 'New user',
    sub: 'The minimum that makes an account. Everything else has a sensible default and can be changed on the Users screen.',
    fields: [
      { key: 'firstName', label: 'First name', required: true, seedable: true },
      { key: 'lastName', label: 'Last name' },
      { key: 'username', label: 'Username', required: true, mono: true },
      { key: 'email', label: 'Email', required: true, type: 'email' },
      { key: 'department', label: 'Department',
        options: ['Engineering', 'Finance', 'Sales', 'Support', 'HR',
                  'Operations', 'Legal', 'Marketing', 'IT', 'Security'] }
    ],
    defaults: { authProfile: 'Local', status: 'pending', mfaEnrolled: false, groups: [] },
    /* A username nobody typed is better than a blank one they have to invent:
       first.last is the convention every row in this tenant already follows. */
    derive: (f) => ({
      username: f.username ||
        [f.firstName, f.lastName].filter(Boolean).join('.').toLowerCase().replace(/[^a-z0-9.]/g, '')
    })
  },
  groups: {
    title: 'New user group',
    sub: 'Members can be added here or from the group itself.',
    fields: [
      { key: 'name', label: 'Group name', required: true, seedable: true },
      { key: 'authType', label: 'Authentication type',
        options: ['Local', 'Azure AD', 'RADIUS', 'LDAP', 'SAML', 'Google'] },
      { key: 'description', label: 'Description' }
    ],
    defaults: { members: 0, memberIds: [], accessRules: 0, twoFactor: true, deviceBinding: true }
  },
  applications: {
    title: 'New application',
    sub: 'Where it lives and how it is reached. Policy comes from the rule that points at it.',
    fields: [
      { key: 'name', label: 'Name', required: true, seedable: true },
      { key: 'type', label: 'Type', required: true, options: ['web', 'rdp', 'ssh', 'vnc'] },
      { key: 'host', label: 'Host', required: true, mono: true,
        placeholder: 'https://app.internal or 10.20.4.10' },
      { key: 'port', label: 'Port', type: 'number', mono: true }
    ],
    defaults: { status: 'active', owner: 'IT', sessionRecording: false },
    derive: (f) => ({
      port: Number(f.port) || ({ web: 443, rdp: 3389, ssh: 22, vnc: 5900 }[f.type] || 443)
    })
  },
  appGroups: {
    title: 'New application group',
    sub: 'A group holds applications of one type. Add them here or from the group itself.',
    fields: [
      { key: 'name', label: 'Group name', required: true, seedable: true },
      { key: 'type', label: 'Type', required: true,
        options: ['WEB', 'FQDN', 'RDP', 'SSH', 'VNC', 'DB', 'WFS', 'NET'] },
      { key: 'description', label: 'Description' }
    ],
    defaults: { memberIds: [] }
  }
}

const shape = () => SHAPES[props.resource] || SHAPES.users
const form = ref({})
const saving = ref(false)
const error = ref('')

watch(open, (v) => {
  if (!v) return
  const s = shape()
  const out = {}
  for (const f of s.fields) out[f.key] = f.seedable ? props.seed : ''
  form.value = out
  error.value = ''
})

async function save () {
  const s = shape()
  error.value = ''
  const merged = { ...form.value, ...(s.derive ? s.derive(form.value) : {}) }
  const missing = s.fields.filter(f => f.required && !merged[f.key]).map(f => f.label)
  if (missing.length) { error.value = `Still needed: ${missing.join(', ')}.`; return }

  saving.value = true
  try {
    const api = (await import('../../api')).default
    const created = await api[props.resource].create({ ...s.defaults, ...merged })
    toast(`${s.title.replace('New ', '')} created`)
    emit('created', created)
    open.value = false
  } catch (e) {
    error.value = e?.message || 'Could not save that.'
  } finally { saving.value = false }
}
</script>

<template>
  <Sheet v-model:open="open" :title="shape().title" :subtitle="shape().sub" nested>
    <div class="i-formsec">
      <div v-for="f in shape().fields" :key="f.key" class="i-frow" style="grid-template-columns:1fr">
        <div class="i-field">
          <label :for="'qc_' + f.key">
            {{ f.label }}<span v-if="f.required" class="i-req">*</span>
          </label>
          <select v-if="f.options" :id="'qc_' + f.key" class="i-ctl" v-model="form[f.key]">
            <option value="">Select…</option>
            <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
          </select>
          <input
            v-else :id="'qc_' + f.key" class="i-ctl" :class="{ 'i-tech': f.mono }"
            :type="f.type || 'text'" v-model="form[f.key]"
            :placeholder="f.placeholder || ''"
          >
        </div>
      </div>
      <p v-if="error" class="i-err">{{ error }}</p>
    </div>

    <template #footer>
      <button class="i-btn i-quiet" @click="open = false">Cancel</button>
      <div class="i-right">
        <button class="i-btn i-primary" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Create and use' }}
        </button>
      </div>
    </template>
  </Sheet>
</template>
