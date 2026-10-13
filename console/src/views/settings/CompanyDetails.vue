<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'

/**
 * Company details.
 *
 * The demo had five invented fields and one contact per type. The real screen
 * holds four things, and three of them were missing entirely:
 *
 *   · the company, its Secure Access URL and a five-part address
 *   · a logo and a background image, both uploaded
 *   · three kinds of contact — business, technical, renewal — each holding
 *     **several** people, added one card at a time
 *   · a welcome banner, switched on and written here, which users then see
 *     in a dashboard popup
 *
 * Field names and `name` attributes are velto's. One thing is deliberately
 * not copied: production gives every contact card the same `id`
 * (`first_name`, `email`, …) however many cards are on the page and across
 * all three tabs, so the ids repeat and a label points at whichever input the
 * browser finds first. Here the id carries the contact type and index while
 * the `name` stays velto's, so clicking a label focuses its own field.
 */

const toast = inject('toast', () => {})

const KEY = '/settings/company-details'

/** Velto's own accept list on both upload controls. */
const IMAGE_TYPES = '.webp,.jpg,.jpeg,.png'
const MAX_IMAGE_BYTES = 1024 * 1024

const CONTACT_TABS = [
  { key: 'business', label: 'Business Contact',
    hint: 'Who the contract and the invoices belong to.' },
  { key: 'tech', label: 'Tech Contact',
    hint: 'Where outage, certificate-expiry and maintenance notices go.' },
  { key: 'renewal', label: 'Renewal Contact',
    hint: 'Who is told before the subscription lapses. The expiry reminder on Subscription details mails these people.' }
]

/** velto's fields, in velto's order. `required` is velto's asterisk. */
const CONTACT_FIELDS = [
  { key: 'firstName', name: 'first_name', label: 'First Name', required: true, placeholder: 'First name' },
  { key: 'lastName', name: 'lastName', label: 'Last Name', placeholder: 'Last name' },
  { key: 'email', name: 'email', label: 'Email ID', required: true, type: 'email', placeholder: 'Enter your email' },
  { key: 'officeNumber', name: 'officeNum', label: 'Office Number', required: true, type: 'tel', placeholder: 'Office Number' },
  { key: 'mobile', name: 'mobile', label: 'Mobile Number', type: 'tel', placeholder: 'Mobile Number' },
  { key: 'designation', name: 'designation', label: 'Designation', placeholder: 'Enter Designation' }
]

function blankContact () {
  return { firstName: '', lastName: '', email: '', officeNumber: '', mobile: '', designation: '' }
}

function defaults () {
  return {
    name: 'InstaSafe Demo',
    url: 'https://instasafe-console-demo.netlify.app',
    addressLine: '',
    addressArea: '',
    city: '',
    state: '',
    zipcode: '',
    logo: '',
    background: '',
    contacts: {
      business: [{ firstName: 'Asha', lastName: 'Rao', email: 'asha.rao@example.com', officeNumber: '+91 80 4000 1000', mobile: '', designation: 'Head of IT' }],
      tech: [{ firstName: 'Deepak', lastName: 'Menon', email: 'deepak.menon@example.com', officeNumber: '+91 80 4000 1021', mobile: '+91 98000 10021', designation: 'Network Engineer' }],
      renewal: []
    },
    bannerEnabled: false,
    bannerText: ''
  }
}

const form = ref(defaults())
const original = ref(defaults())
const saving = ref(false)
const tab = ref('business')

const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(original.value))

const changed = computed(() => {
  const out = []
  for (const k of Object.keys(form.value)) {
    if (JSON.stringify(form.value[k]) !== JSON.stringify(original.value[k])) out.push(k)
  }
  return out
})

const activeTab = computed(() => CONTACT_TABS.find(t => t.key === tab.value))
const contacts = computed(() => form.value.contacts[tab.value])

function countFor (key) { return form.value.contacts[key].length }

async function load () {
  const stored = await api.settings.get(KEY)
  form.value = { ...defaults(), ...(stored || {}) }
  form.value.contacts = { ...defaults().contacts, ...(stored?.contacts || {}) }
  original.value = JSON.parse(JSON.stringify(form.value))
}

/* ---- contacts ---------------------------------------------------------- */

function addContact () {
  form.value.contacts[tab.value].push(blankContact())
}

function removeContact (i) {
  form.value.contacts[tab.value].splice(i, 1)
}

function contactName (c, i) {
  const n = [c.firstName, c.lastName].filter(Boolean).join(' ')
  return n || `Contact ${i + 1}`
}

/* ---- images ------------------------------------------------------------ */

/**
 * Held as a data URL in the same IndexedDB as everything else, so an uploaded
 * logo survives a reload without a server to put it on. A real backend takes
 * the file itself; this is the one place the demo has to differ, and the size
 * cap is here so a 12MP photograph does not go into the settings blob.
 */
function onImage (field, e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!/\.(webp|jpe?g|png)$/i.test(file.name)) {
    toast('Use a WEBP, JPG or PNG', 'bad'); return
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep it under 1 MB.`, 'bad'); return
  }
  const reader = new FileReader()
  reader.onload = () => { form.value[field] = String(reader.result) }
  reader.onerror = () => toast('That file could not be read', 'bad')
  reader.readAsDataURL(file)
}

/* ---- save -------------------------------------------------------------- */

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/

function validate () {
  if (!form.value.name.trim()) return 'Company name is required'
  if (form.value.url && !/^https?:\/\//i.test(form.value.url)) {
    return 'The Secure Access URL needs to start with http:// or https://'
  }
  for (const t of CONTACT_TABS) {
    const list = form.value.contacts[t.key]
    for (let i = 0; i < list.length; i++) {
      const c = list[i]
      const where = `${t.label} ${i + 1}`
      if (!c.firstName.trim()) return `${where} needs a first name`
      if (!EMAIL.test(c.email.trim())) return `${where} needs a valid email`
      if (!c.officeNumber.trim()) return `${where} needs an office number`
    }
  }
  if (form.value.bannerEnabled && !form.value.bannerText.trim()) {
    return 'The banner is switched on but has no text — users would see an empty popup'
  }
  return ''
}

async function save () {
  const problem = validate()
  if (problem) { toast(problem, 'bad'); return }
  saving.value = true
  try {
    await api.settings.set(KEY, JSON.parse(JSON.stringify(form.value)))
    await api.events.record({
      type: 'settings.updated',
      message: `Company details updated — ${changed.value.join(', ')}`
    })
    original.value = JSON.parse(JSON.stringify(form.value))
    toast('Company details saved')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Company details"
      subtitle="Who this tenant belongs to, who to contact about it, and what users see when they sign in."
    />

    <div class="i-strip">
      <div class="i-tools">
        <button class="i-btn i-primary" :disabled="saving || !dirty" @click="save">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </div>

    <div style="max-width:760px">
      <div class="i-formsec">
        <h3>Organisation</h3>
        <div class="i-frow">
          <div class="i-field">
            <label for="name">Name<span class="i-req">*</span></label>
            <input id="name" name="name" class="i-ctl" type="text" placeholder="Enter company name" v-model="form.name">
          </div>
          <div class="i-field">
            <label for="url">Secure Access custom URL</label>
            <input id="url" name="url" class="i-ctl" type="url" placeholder="Enter URL" v-model="form.url">
            <p class="i-hint">Where users reach their portal. It appears in every invitation and enrolment mail.</p>
          </div>
        </div>
      </div>

      <div class="i-formsec">
        <h3>Address</h3>
        <div class="i-frow">
          <div class="i-field">
            <label for="lane-1">Address<span class="i-req">*</span></label>
            <input id="lane-1" name="lane-1" class="i-ctl" type="text" placeholder="Address" v-model="form.addressLine">
          </div>
          <div class="i-field">
            <label for="address-area">Area</label>
            <input id="address-area" name="address-area" class="i-ctl" type="text" placeholder="Address" v-model="form.addressArea">
          </div>
          <div class="i-field">
            <label for="city">City</label>
            <input id="city" name="city" class="i-ctl" type="text" placeholder="City" v-model="form.city">
          </div>
          <div class="i-field">
            <label for="address">State</label>
            <input id="address" name="address" class="i-ctl" type="text" placeholder="State" v-model="form.state">
          </div>
          <div class="i-field">
            <label for="zipcode">Zipcode</label>
            <input id="zipcode" name="zipcode" class="i-ctl i-tech" type="text" placeholder="Zipcode" v-model="form.zipcode">
          </div>
        </div>
      </div>

      <div class="i-formsec">
        <h3>Branding</h3>
        <div class="i-frow">
          <div class="i-field">
            <label for="logo">Logo</label>
            <div v-if="form.logo" class="i-imgprev">
              <img :src="form.logo" alt="Current logo">
              <button class="i-btn i-sm i-quiet" @click="form.logo = ''">Remove</button>
            </div>
            <label class="i-filepick">
              <input id="logo" name="logo" type="file" :accept="IMAGE_TYPES" @change="onImage('logo', $event)">
              <i class="fa-solid fa-upload" aria-hidden="true" />
              <span>{{ form.logo ? 'Replace file' : 'Upload file' }}</span>
            </label>
            <p class="i-hint">
              WEBP, JPG or PNG, under 1 MB. Where a customer logo appears —
              beside InstaSafe's in the rail, instead of it, or on the
              end-user portal only — is still an open question; most ZTNA
              vendors do the last.
            </p>
          </div>

          <div class="i-field">
            <label for="bg">Background image</label>
            <div v-if="form.background" class="i-imgprev">
              <img :src="form.background" alt="Current background image">
              <button class="i-btn i-sm i-quiet" @click="form.background = ''">Remove</button>
            </div>
            <label class="i-filepick">
              <input id="bg" name="bg" type="file" :accept="IMAGE_TYPES" @change="onImage('background', $event)">
              <i class="fa-solid fa-upload" aria-hidden="true" />
              <span>{{ form.background ? 'Replace file' : 'Upload file' }}</span>
            </label>
            <p class="i-hint">Shown behind the sign-in screen of the end-user portal.</p>
          </div>
        </div>
      </div>

      <!-- Three kinds of contact, each holding several people. The demo had
           one name and one email per kind, which cannot describe a tenant
           with two network engineers on call. -->
      <div class="i-formsec">
        <h3>Contacts</h3>

        <div class="i-ftabs">
          <button
            v-for="t in CONTACT_TABS" :key="t.key"
            class="i-chip" :class="{ 'is-on': tab === t.key }"
            :aria-pressed="tab === t.key"
            @click="tab = t.key"
          >{{ t.label }}<template v-if="countFor(t.key)"> · {{ countFor(t.key) }}</template></button>
        </div>

        <p class="i-secsub">{{ activeTab.hint }}</p>

        <p v-if="!contacts.length" class="i-hint">
          No {{ activeTab.label.toLowerCase() }} yet. Add one so there is somebody to reach.
        </p>

        <div v-for="(c, i) in contacts" :key="tab + i" class="i-formsec">
          <!-- i-chead styles h2, and the house keeps a contact's name lighter
               than the page title. -->
          <div class="i-chead">
            <h2>{{ contactName(c, i) }}</h2>
            <button
              class="i-btn i-sm i-quiet ms-auto"
              :aria-label="`Remove ${contactName(c, i)}`"
              @click="removeContact(i)"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true" /> Remove
            </button>
          </div>
          <div class="i-frow">
            <div v-for="f in CONTACT_FIELDS" :key="f.key" class="i-field">
              <label :for="`${f.name}-${tab}-${i}`">
                {{ f.label }}<span v-if="f.required" class="i-req">*</span>
              </label>
              <input
                :id="`${f.name}-${tab}-${i}`"
                :name="f.name"
                class="i-ctl"
                :type="f.type || 'text'"
                :placeholder="f.placeholder"
                v-model="c[f.key]"
              >
            </div>
          </div>
        </div>

        <button class="i-btn i-sm" @click="addContact">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add contact
        </button>
      </div>

      <div class="i-formsec">
        <h3>Welcome banner</h3>
        <p class="i-secsub">
          A custom message shown to users in a dashboard popup when they sign
          in. Tenants use it for a welcome, and for the warning notice that
          some regulators require before access.
        </p>
        <div class="i-field">
          <label class="i-sw">
            <input id="banner" name="banner" type="checkbox" v-model="form.bannerEnabled">
            <span class="i-track" />Enable welcome / warning banner
          </label>
        </div>
        <div class="i-field">
          <label for="banner_text">Banner text</label>
          <textarea
            id="banner_text" name="banner_text" class="i-ctl" rows="4"
            placeholder="Welcome banner text…"
            v-model="form.bannerText"
          />
          <p class="i-hint">
            Shown exactly as written. Switching the banner on without text is
            refused rather than showing users an empty popup.
          </p>
        </div>
      </div>

      <!-- what Save is about to commit, which production never shows -->
      <div v-if="dirty" class="i-verdict is-warn">
        <h3>
          <i class="fa-solid fa-pen me-2" aria-hidden="true" />
          {{ changed.length }} unsaved change{{ changed.length === 1 ? '' : 's' }}
        </h3>
        <p>
          <template v-for="(k, i) in changed" :key="k">
            <code class="i-tech">{{ k }}</code><template v-if="i < changed.length - 1">, </template>
          </template>
        </p>
      </div>
    </div>
  </div>
</template>
