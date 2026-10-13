<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'

/**
 * Subscription details.
 *
 * The demo had four invented fields — plan, seats, renews on, support tier.
 * The real screen is a table of **licence periods**, newest first, and an
 * expiry reminder:
 *
 *   Start Date · End Date · User Licences · Licenced Gateways · Type
 *
 * Velto's own rows, read on the live tenant, are 19-Sep-2026 → 31-Mar-2027
 * for 2,000 licences and 3 gateways, with the preceding period for 1,000 and
 * 3 below it. Veno's are a Trial of 5 and then a Regular of 50. So a tenant
 * carries its licence history here, and `Type` is Trial or Regular.
 *
 * **Licenced Gateways is where the gateway limit comes from.** Velto's add
 * form refuses a fifth gateway because the licence says three; this screen is
 * where that number lives, so the Gateways screen reads it from here rather
 * than holding a constant of its own.
 *
 * Two things production does not do, and this does:
 *   · the period that is actually in force is marked. Velto lists two
 *     identical-looking rows and leaves you to compare dates against today.
 *   · the reminder says who will be mailed and when, in a sentence, rather
 *     than leaving "Before [0] months of expiry" to be read as a setting that
 *     is switched off.
 */

const toast = inject('toast', () => {})

const KEY = '/settings/subscription-details'

/**
 * Licence history for the demo tenant, in velto's shape.
 *
 * The current period licenses four gateways, which is the number this demo
 * seeds and the number its Gateways screen enforces.
 */
function defaults () {
  return {
    periods: [
      { start: '2026-09-19', end: '2027-03-31', userLicences: 2000, gateways: 4, type: 'Regular' },
      { start: '2026-05-18', end: '2026-09-18', userLicences: 1000, gateways: 2, type: 'Regular' },
      { start: '2026-04-01', end: '2026-05-17', userLicences: 5, gateways: 1, type: 'Trial' }
    ],
    reminderEmails: '',
    reminderMonths: 1
  }
}

const form = ref(defaults())
const original = ref(defaults())
const saving = ref(false)

const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(original.value))

/* ---- the periods ------------------------------------------------------- */

/* toISOString() is UTC, and this console is read in IST. At 00:30 in Mumbai
   it reports yesterday, which would move a licence out of force a day early
   and date the reminder a day short. Dates here are calendar dates, so they
   are built from the local parts. */
function isoLocal (d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const today = isoLocal(new Date())

/** Newest first, the way velto orders them. */
const periods = computed(() =>
  [...form.value.periods].sort((a, b) => b.start.localeCompare(a.start)))

function state (p) {
  if (p.start > today) return 'future'
  if (p.end < today) return 'expired'
  return 'current'
}

const current = computed(() => periods.value.find(p => state(p) === 'current') || null)

/* en-GB's short month for September is "Sept", and velto prints "Sep". The
   dates here sit beside a contract, so they match the contract's spelling. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmt (iso) {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
}

/** Whole days from today to the end of the period in force. */
const daysLeft = computed(() => {
  if (!current.value) return null
  const ms = new Date(current.value.end + 'T00:00:00') - new Date(today + 'T00:00:00')
  return Math.round(ms / 86400000)
})

/* ---- the reminder ------------------------------------------------------ */

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/

const reminderList = computed(() =>
  form.value.reminderEmails.split(',').map(e => e.trim()).filter(Boolean))

const badEmails = computed(() => reminderList.value.filter(e => !EMAIL.test(e)))

/** The date the reminder would actually be sent, which velto leaves you to work out. */
const remindOn = computed(() => {
  if (!current.value || !form.value.reminderMonths) return null
  const d = new Date(current.value.end + 'T00:00:00')
  d.setMonth(d.getMonth() - Number(form.value.reminderMonths))
  return isoLocal(d)
})

async function load () {
  const stored = await api.settings.get(KEY)
  form.value = { ...defaults(), ...(stored || {}) }
  original.value = JSON.parse(JSON.stringify(form.value))
}

async function save () {
  if (badEmails.value.length) {
    toast(`${badEmails.value[0]} is not a valid email`, 'bad'); return
  }
  if (reminderList.value.length && !Number(form.value.reminderMonths)) {
    toast('Set how long before expiry to send the reminder', 'bad'); return
  }
  saving.value = true
  try {
    await api.settings.set(KEY, JSON.parse(JSON.stringify(form.value)))
    await api.events.record({
      type: 'settings.updated',
      message: `Subscription expiry reminder updated — ${reminderList.value.length} recipient${reminderList.value.length === 1 ? '' : 's'}`
    })
    original.value = JSON.parse(JSON.stringify(form.value))
    toast('Subscription reminder saved')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Subscription details"
      subtitle="What this tenant is licensed for, and who hears about it before it lapses."
    />

    <div class="i-strip">
      <div class="i-tools">
        <button class="i-btn i-primary" :disabled="saving || !dirty" @click="save">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </div>

    <!-- The period in force, said once in words. Production prints the rows
         and leaves you to compare the dates against today's date. -->
    <section v-if="current" class="i-band" :class="{ 'is-warn': daysLeft <= 60 }">
      <div>
        <div class="i-bt">
          <span class="i-fdot" aria-hidden="true" />
          {{ current.type }} licence, {{ daysLeft.toLocaleString() }} days left
        </div>
        <p class="i-bs">
          {{ current.userLicences.toLocaleString() }} user licences and
          {{ current.gateways }} licenced gateway{{ current.gateways === 1 ? '' : 's' }},
          until {{ fmt(current.end) }}. The gateway limit on
          <RouterLink to="/gateways">Gateways</RouterLink> is this number.
        </p>
      </div>
    </section>

    <div class="table-responsive">
      <table class="i-table">
        <thead>
          <tr>
            <th>Start Date</th>
            <th>End Date</th>
            <th class="text-end">User Licences</th>
            <th class="text-end">Licenced Gateways</th>
            <th>Type</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in periods" :key="p.start">
            <td class="i-tech">{{ fmt(p.start) }}</td>
            <td class="i-tech">{{ fmt(p.end) }}</td>
            <td class="text-end i-num">{{ p.userLicences.toLocaleString() }}</td>
            <td class="text-end i-num">{{ p.gateways }}</td>
            <td>{{ p.type }}</td>
            <td>
              <span v-if="state(p) === 'current'" class="fw-medium">In force</span>
              <span v-else-if="state(p) === 'future'" class="i-pill i-att">Starts {{ fmt(p.start) }}</span>
              <span v-else class="i-dimcell">Ended</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="max-width:760px">
      <div class="i-formsec">
        <h3>Subscription expiry reminder</h3>
        <p class="i-secsub">
          Who to mail before the licence lapses. These are addresses rather
          than console accounts, so a renewal notice reaches somebody who does
          not sign in here.
        </p>

        <div class="i-field">
          <label for="emails">Remind (email addresses separated by commas)</label>
          <textarea
            id="emails" name="emails" class="i-ctl" rows="2"
            placeholder="Enter emails"
            v-model="form.reminderEmails"
          />
          <p v-if="badEmails.length" class="i-hint">
            <span class="i-tech">{{ badEmails.join(', ') }}</span>
            — not a valid address. Separate addresses with commas.
          </p>
          <p v-else-if="!reminderList.length" class="i-hint">
            Nobody is on this list, so no reminder is sent. The renewal
            contacts on
            <RouterLink to="/settings/company-details">Company details</RouterLink>
            are the people this usually goes to.
          </p>
        </div>

        <div class="i-field">
          <label for="months">Before (months of expiry)</label>
          <input
            id="months" name="months" class="i-ctl i-tech" type="number"
            min="0" max="48" v-model.number="form.reminderMonths"
            style="max-width:120px"
          >
          <p class="i-hint">
            <template v-if="reminderList.length && remindOn">
              {{ reminderList.length }} recipient{{ reminderList.length === 1 ? '' : 's' }}
              would be mailed on <strong>{{ fmt(remindOn) }}</strong>,
              {{ form.reminderMonths }} month{{ form.reminderMonths === 1 ? '' : 's' }}
              before this licence ends.
            </template>
            <template v-else>
              Zero means the reminder goes out on the day the licence ends,
              which is too late to renew.
            </template>
          </p>
        </div>
      </div>

      <p class="i-demo-note">
        The licence periods are set by your contract rather than in the
        console. Changing a seat count or a gateway count goes through your
        account team; the reminder above is yours to set.
      </p>
    </div>
  </div>
</template>
