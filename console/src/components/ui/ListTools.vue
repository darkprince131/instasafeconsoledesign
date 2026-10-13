<script setup>
import { ref, computed, watch } from 'vue'
import Sheet from './Sheet.vue'

/**
 * Bulk Ops and Graph — now built from velto rather than from a guess.
 *
 * I had built Bulk Ops as "operations on the rows you ticked", which is what
 * the name suggests and is wrong. Velto's Bulk Ops is a **CSV wizard**: pick
 * an operation, download a template, fill it in, upload it. The table
 * selection is irrelevant — the uploaded file *is* the list. That matters,
 * because the two models fail differently: a selection acts on what you can
 * see, and a file acts on names you cannot.
 *
 * Confirmed from velto:
 *   Users    Add · Delete · Activate · Suspend
 *   Devices  Activate · Suspend · Delete      (no Add — devices enrol)
 *
 * Its rules, verbatim in substance:
 *   - Add takes First Name, Last Name, Login Id, E-Mail Id, Mobile Number,
 *     Password. Mandatory: First Name, Username, E-Mail ID.
 *   - Delete, Activate and Suspend take a single column, `username`.
 *   - Bulk operations apply to locally created users only, not to accounts
 *     imported from AD or LDAP.
 *
 * The one place this goes further: velto uploads and hopes. A file naming
 * four hundred accounts to suspend deserves to be read back to you before it
 * runs, so this parses the file, resolves every row against what is actually
 * there, and shows what will happen — created, changed, skipped and why —
 * before anything is written. Nothing is applied until that is confirmed.
 */

const props = defineProps({
  /** 'users' | 'devices' | '' — '' hides Bulk Ops entirely. */
  kind: { type: String, default: '' },
  /** Resource key on the api object, for reads and writes. */
  resource: { type: String, default: '' },
  rows: { type: Array, default: () => [] },
  /** Gateways only: the licensed maximum, from the subscription. */
  limit: { type: Number, default: 0 },
  dimensions: { type: Array, default: () => [] },
  total: { type: Number, default: 0 }
})

const emit = defineEmits(['apply', 'graph'])

/* ---- which operations this screen offers ------------------------------- */
const OPS = {
  users: [
    { key: 'add', label: 'Add users' },
    { key: 'delete', label: 'Delete users' },
    { key: 'activate', label: 'Activate users' },
    { key: 'suspend', label: 'Suspend users' }
  ],
  devices: [
    { key: 'activate', label: 'Activate' },
    { key: 'suspend', label: 'Suspend' },
    { key: 'delete', label: 'Delete' }
  ],
  /* Velto's gateway screen calls this Bulk Add and offers the one operation.
     Its modal states two rules: every gateway needs a different name, and
     every gateway must have a backup gateway name. Both are checked here
     against the tenant before anything is written. */
  gateways: [
    { key: 'add', label: 'Add gateways' }
  ]
}

/** How many gateways the licence allows, passed in from Subscription details. */
const GATEWAY_LIMIT = computed(() => props.limit || 4)
const ops = computed(() => OPS[props.kind] || [])

const opsOpen = ref(false)
const op = ref('')
watch(ops, (v) => { if (!op.value && v.length) op.value = v[0].key }, { immediate: true })

/** Add is the only operation that needs more than a name. */
const ADD_COLUMNS = ['First Name', 'Last Name', 'Login Id', 'E-Mail Id', 'Mobile Number', 'Password']
const GATEWAY_COLUMNS = ['Gateway Name', 'Backup Gateway Name', 'Location', 'Protected Networks']
const isAdd = computed(() => op.value === 'add')
const isGateway = computed(() => props.kind === 'gateways')

const columns = computed(() =>
  isGateway.value ? GATEWAY_COLUMNS : (isAdd.value ? ADD_COLUMNS : ['username']))

const sampleRows = computed(() => {
  if (isGateway.value) {
    return [
      ['gw-pun-01', 'gw-pun-02', 'Pune', '10.150.0.0/16 192.168.15.0/24'],
      ['gw-hyd-01', 'gw-hyd-02', 'Hyderabad', '10.160.0.0/16']
    ]
  }
  return isAdd.value
    ? [['Sandip', 'Panda', 'sandip.panda', 'sandip.panda@example.com', '9876543210', ''],
       ['Deepak', '', 'deepak.rao', 'deepak.rao@example.com', '', 'ChangeMe!2026']]
    : [['sandip.panda'], ['deepak.rao']]
})

function downloadTemplate () {
  const csv = [columns.value.join(','), ...sampleRows.value.map(r => r.join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.kind}-${op.value}-template.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ---- the file, and what it would do ------------------------------------ */
const fileName = ref('')
const parseError = ref('')
const plan = ref(null)
const applying = ref(false)

/** Minimal CSV: no embedded newlines, quotes stripped. Enough for this shape. */
function parseCsv (text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim())
  if (!lines.length) throw new Error('The file is empty.')
  const head = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  return lines.slice(1).map(line => {
    const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']))
  })
}

/** Accept the header however it was spelled: "Login Id", "login_id", "username". */
function pick (row, ...names) {
  for (const n of names) {
    const k = Object.keys(row).find(x => x.replace(/[\s_-]/g, '') === n.replace(/[\s_-]/g, ''))
    if (k && row[k]) return row[k]
  }
  return ''
}

async function onFile (e) {
  const f = e.target.files?.[0]
  if (!f) return
  fileName.value = f.name
  parseError.value = ''
  plan.value = null
  try {
    const parsed = parseCsv(await f.text())
    if (!parsed.length) throw new Error('No data rows under the header.')
    plan.value = await buildPlan(parsed)
  } catch (err) {
    parseError.value = err?.message || 'That file could not be read.'
  } finally {
    e.target.value = ''        // so re-picking the same file fires again
  }
}

/**
 * Resolve every row against what is actually in the tenant.
 *
 * This is the step velto does not have, and it is the one that stops a
 * mistyped column from suspending four hundred people. Every row comes back
 * as an action with a reason, and rows that cannot be matched are listed
 * rather than silently dropped.
 */
const CIDR = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/

function badNetwork (value) {
  const m = CIDR.exec(String(value || '').trim())
  if (!m) return `${value} is not CIDR`
  if (m.slice(1, 5).some(o => Number(o) > 255)) return `${value} has an octet over 255`
  if (Number(m[5]) > 32) return `${value} has a prefix over /32`
  return ''
}

/**
 * Gateways, where the file is checked against velto's own two rules and
 * against the licence before anything is created.
 *
 * Velto's modal states the rules and then uploads anyway; a file that repeats
 * a name or omits a backup fails somewhere inside the import. Here each row
 * comes back as create or skip, with the reason, and the licence limit is
 * counted as the plan is built rather than hit halfway through writing.
 */
function planGateways (parsed, existing) {
  const taken = new Set(existing.map(g => g.name.toLowerCase()))
  const actions = []
  let room = GATEWAY_LIMIT.value - existing.length

  for (const row of parsed) {
    const name = pick(row, 'gateway name', 'gw_name', 'name')
    const backup = pick(row, 'backup gateway name', 'backup_name', 'backup')
    const location = pick(row, 'location')
    const nets = pick(row, 'protected networks', 'protected network', 'networks')
      .split(/[\s;|]+/).map(n => n.trim()).filter(Boolean)

    if (!name) { actions.push({ name: '—', verb: 'skip', why: 'No gateway name in this row.' }); continue }
    if (taken.has(name.toLowerCase())) {
      actions.push({ name, verb: 'skip', why: 'A gateway with this name already exists.' }); continue
    }
    if (!backup) {
      actions.push({ name, verb: 'skip', why: 'Every gateway must have a backup gateway name.' }); continue
    }
    if (backup.toLowerCase() === name.toLowerCase()) {
      actions.push({ name, verb: 'skip', why: 'A gateway cannot be its own backup.' }); continue
    }
    if (!location) {
      actions.push({ name, verb: 'skip', why: 'Location is required.' }); continue
    }
    if (!nets.length) {
      actions.push({ name, verb: 'skip', why: 'At least one protected network is required.' }); continue
    }
    const bad = nets.map(badNetwork).find(Boolean)
    if (bad) { actions.push({ name, verb: 'skip', why: bad + '.' }); continue }
    if (room <= 0) {
      actions.push({ name, verb: 'skip', why: `This tenant is licensed for ${GATEWAY_LIMIT.value} gateways.` }); continue
    }

    room -= 1
    taken.add(name.toLowerCase())
    actions.push({
      name,
      verb: 'create',
      why: `${backup} standing by · ${location} · ${nets.length} network${nets.length === 1 ? '' : 's'}`,
      payload: {
        name, backupName: backup, location, protectedNetworks: nets,
        status: 'down', sessions: 0, version: '3.4.1'
      }
    })
  }

  const willRun = actions.filter(a => a.verb !== 'skip')
  return { actions, willRun: willRun.length, skipped: actions.length - willRun.length }
}

async function buildPlan (parsed) {
  const api = (await import('../../api')).default
  const existing = (await api[props.resource].list({ perPage: 0 })).data
  if (isGateway.value) return planGateways(parsed, existing)
  const byName = new Map(existing.map(r => [(r.username || r.name || '').toLowerCase(), r]))

  const actions = []
  for (const row of parsed) {
    const name = props.kind === 'users'
      ? pick(row, 'username', 'login id', 'loginid')
      : pick(row, 'username', 'name', 'device')
    if (!name) { actions.push({ name: '—', verb: 'skip', why: 'No username in this row.' }); continue }

    const hit = byName.get(name.toLowerCase())

    if (isAdd.value) {
      const email = pick(row, 'e-mail id', 'email', 'emailid')
      const first = pick(row, 'first name', 'firstname')
      if (!first || !email) {
        actions.push({ name, verb: 'skip', why: 'First name and e-mail are mandatory.' })
      } else if (hit) {
        actions.push({ name, verb: 'skip', why: 'A user with this username already exists.' })
      } else {
        actions.push({
          name, verb: 'create', why: `${first} · ${email}`,
          payload: {
            firstName: first, lastName: pick(row, 'last name', 'lastname'),
            username: name, email, mobile: pick(row, 'mobile number', 'mobile'),
            authProfile: 'Local', status: 'pending'
          }
        })
      }
      continue
    }

    if (!hit) { actions.push({ name, verb: 'skip', why: 'No such record in this tenant.' }); continue }

    /* Velto restricts bulk operations to locally created accounts. Honour it,
       and say why rather than failing quietly at apply time. */
    if (props.kind === 'users' && hit.authProfile && hit.authProfile !== 'Local') {
      actions.push({ name, verb: 'skip', why: `Imported from ${hit.authProfile} — bulk operations are for local accounts only.` })
      continue
    }

    const already = (op.value === 'suspend' && hit.status === 'suspended') ||
                    (op.value === 'activate' && hit.status === 'active')
    if (already) { actions.push({ name, verb: 'skip', why: `Already ${hit.status}.` }); continue }

    actions.push({
      name, verb: op.value, id: hit.id,
      why: op.value === 'delete' ? 'Removed permanently.' : `${hit.status} → ${op.value === 'suspend' ? 'suspended' : 'active'}`
    })
  }

  const willRun = actions.filter(a => a.verb !== 'skip')
  return { actions, willRun: willRun.length, skipped: actions.length - willRun.length }
}

async function apply () {
  if (!plan.value?.willRun) return
  applying.value = true
  try {
    const api = (await import('../../api')).default
    const r = api[props.resource]
    const toDelete = []
    for (const a of plan.value.actions) {
      if (a.verb === 'skip') continue
      if (a.verb === 'create') await r.create(a.payload)
      else if (a.verb === 'delete') toDelete.push(a.id)
      else if (a.verb === 'suspend') await r.update(a.id, { status: 'suspended' })
      else if (a.verb === 'activate') await r.update(a.id, { status: 'active' })
    }
    if (toDelete.length) await r.removeMany(toDelete)
    emit('apply', { op: op.value, count: plan.value.willRun })
    reset()
    opsOpen.value = false
  } finally { applying.value = false }
}

function reset () { fileName.value = ''; plan.value = null; parseError.value = '' }
watch(op, reset)

const VERB_LABEL = {
  create: 'Create', delete: 'Delete', suspend: 'Suspend', activate: 'Activate', skip: 'Skip'
}

/* ---- graph ------------------------------------------------------------- */
/* Velto's Graph swaps the table for a 3D node scene in place and the button
   becomes "Table". The toggle is the parent's business; this just asks. */
const graphOn = defineModel('graph', { type: Boolean, default: false })
</script>

<template>
  <button
    v-if="ops.length"
    class="i-btn"
    :title="isGateway
      ? 'Create gateways from an uploaded list'
      : 'Add, delete, activate or suspend from an uploaded list'"
    @click="opsOpen = true"
  >
    <i class="fa-solid fa-file-csv" aria-hidden="true" />
    <span class="d-none d-lg-inline">{{ isGateway ? 'Bulk Add' : 'Bulk Ops' }}</span>
  </button>

  <button
    v-if="dimensions.length"
    class="i-btn" :title="graphOn ? 'Back to the table' : 'See these rows as a graph'"
    @click="graphOn = !graphOn"
  >
    <i class="fa-solid" :class="graphOn ? 'fa-table' : 'fa-chart-simple'" aria-hidden="true" />
    <span class="d-none d-lg-inline">{{ graphOn ? 'Table' : 'Graph' }}</span>
  </button>

  <Sheet
    v-model:open="opsOpen"
    :title="isGateway ? 'Bulk add gateways' : `Bulk operations for ${kind}`"
    subtitle="The uploaded file is the list. What is ticked in the table is not used."
  >
    <!-- One operation needs no chooser. Velto's gateway modal has none
         either; it opens straight on the instructions. -->
    <div v-if="ops.length > 1" class="i-formsec">
      <h3>1 · Choose the operation</h3>
      <div class="i-field">
        <label for="bop">Operation</label>
        <select id="bop" class="i-ctl" v-model="op">
          <option v-for="o in ops" :key="o.key" :value="o.key">{{ o.label }}</option>
        </select>
      </div>
    </div>

    <div class="i-formsec">
      <h3>{{ ops.length > 1 ? '2' : '1' }} · Make the list</h3>
      <p class="i-secsub">
        <template v-if="isGateway">
          One row per gateway. <strong>Every column is required</strong>: each
          gateway needs a name of its own, a backup gateway, a location, and at
          least one protected network. Put several networks in the one cell,
          separated by spaces — <span class="i-tech">10.150.0.0/16
          192.168.15.0/24</span> — so no network contains a comma.
        </template>
        <template v-else-if="isAdd">
          One row per person. <strong>First name, username and e-mail are
          mandatory</strong>; the rest may be blank. A row with no password
          gets an activation mail instead.
        </template>
        <template v-else>
          One column, <code class="i-tech">username</code>, one row each.
        </template>
      </p>

      <table class="i-csvex">
        <thead><tr><th v-for="c in columns" :key="c">{{ c }}</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in sampleRows" :key="i">
            <td v-for="(c, j) in r" :key="j">{{ c || '—' }}</td>
          </tr>
        </tbody>
      </table>

      <p v-if="isGateway" class="i-hint">
        This tenant is licensed for {{ GATEWAY_LIMIT }} gateways. Rows beyond
        the licence, rows repeating a name that already exists, and rows
        missing a backup gateway are listed as skipped below before anything
        is created — not discovered part-way through the import.
      </p>
      <p v-else class="i-hint">
        Bulk operations apply to locally created {{ kind }} only. Accounts
        imported from Active Directory or LDAP are managed there, and rows
        naming one are listed as skipped rather than failing silently.
      </p>

      <button class="i-btn i-sm mt-2" @click="downloadTemplate">
        <i class="fa-solid fa-download" aria-hidden="true" /> Download sample CSV
      </button>
    </div>

    <div class="i-formsec">
      <h3>{{ ops.length > 1 ? '3' : '2' }} · Upload it</h3>
      <label class="i-filepick">
        <input type="file" accept=".csv,text/csv" @change="onFile">
        <i class="fa-solid fa-upload" aria-hidden="true" />
        <span>{{ fileName || 'Choose a CSV file' }}</span>
      </label>
      <p v-if="parseError" class="i-err mt-2">{{ parseError }}</p>
    </div>

    <!-- the dry run -->
    <div v-if="plan" class="i-formsec">
      <h3>Before anything is written</h3>
      <p class="i-secsub">
        {{ plan.willRun }} of {{ plan.actions.length }}
        row{{ plan.actions.length === 1 ? '' : 's' }} will run.
        <template v-if="plan.skipped">{{ plan.skipped }} skipped.</template>
        Nothing has been changed yet.
      </p>
      <div class="i-planlist">
        <div
          v-for="(a, i) in plan.actions" :key="i"
          class="i-planrow" :class="{ 'is-skip': a.verb === 'skip' }"
        >
          <span class="i-planverb">{{ VERB_LABEL[a.verb] }}</span>
          <span class="i-planname">{{ a.name }}</span>
          <span class="i-planwhy">{{ a.why }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="i-btn i-quiet" @click="opsOpen = false">Cancel</button>
      <div class="i-right">
        <button
          class="i-btn i-primary"
          :disabled="!plan || !plan.willRun || applying"
          @click="apply"
        >
          {{ applying ? 'Applying…' : plan ? `Apply to ${plan.willRun}` : 'Upload a file first' }}
        </button>
      </div>
    </template>
  </Sheet>
</template>
