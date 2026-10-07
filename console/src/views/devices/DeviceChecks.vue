<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import DataTable from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'
import Sheet from '../../components/ui/Sheet.vue'
import { DEVICE_CHECKS, CHECK_VALUE_HELP, OS_FAMILIES, OS_LIST } from '../../lib/device-catalog.js'

/**
 * Device checks — the real model.
 *
 * This screen previously had six hardcoded boolean posture checks, which is
 * not what the product does. A check is: an operating system, one of 25 check
 * types, and a value. Rule Name · OS · Check · Check Value, exactly as the
 * captured list shows.
 *
 * Two things fixed while matching it. The production Check Value field is
 * labelled "Check value" for all 25 types with no further guidance, so it is
 * the field most likely to be filled in wrongly — here the label and the
 * placeholder change with the check. And the OS select ships 2,393 options,
 * 1,918 of them individual Android handset models; this groups by family.
 */

const toast = inject('toast', () => {})

const rows = ref([]); const loading = ref(true)
const selectedIds = ref([]); const table = ref(null)
const confirmOpen = ref(false); const sheetOpen = ref(false)
const saving = ref(false); const editingId = ref(null)
const form = ref(blank())

// the evaluator
const probeOs = ref('Microsoft Windows 11')
const reported = ref({})
const result = ref(null)

function blank () {
  return { ruleName: '', os: '', check: '', checkValue: '', enabled: true }
}

const help = computed(() => CHECK_VALUE_HELP[form.value.check] || ['Check value', ''])

const columns = [
  { key: 'ruleName', label: 'Rule name', bold: true },
  { key: 'os', label: 'OS' },
  { key: 'check', label: 'Check', mono: true },
  { key: 'checkValue', label: 'Check value', mono: true, cell: (v) => v || '—' },
  { key: 'enabled', label: 'Enabled', bool: true }
]

async function load () {
  loading.value = true
  const res = await api.deviceChecks.list({ perPage: 0 })
  rows.value = res.data
  loading.value = false
  seedReported()
  evaluate()
}

/** The payload an agent would report, built from whatever the rules ask about. */
function seedReported () {
  const out = { ...reported.value }
  for (const r of rows.value) {
    if (!(r.check in out)) out[r.check] = r.checkValue || ''
  }
  reported.value = out
}

/**
 * Evaluation. A check passes when what the device reported equals what the
 * rule expects — except the two negative checks, which pass when it does not.
 */
function evaluate () {
  const applicable = rows.value.filter(r =>
    r.enabled !== false && (!r.os || !probeOs.value || r.os === probeOs.value ||
      probeOs.value.startsWith(r.os) || r.os.startsWith(probeOs.value.split(' ')[0])))

  const results = applicable.map(r => {
    const actual = (reported.value[r.check] ?? '').toString().trim()
    const expected = (r.checkValue ?? '').toString().trim()
    const negative = r.check === 'FileNotExists' || r.check === 'ProcessNotRunning'
    const equal = actual.toLowerCase() === expected.toLowerCase()
    return { ...r, actual, expected, pass: negative ? !equal : equal, negative }
  })

  const failed = results.filter(r => !r.pass)
  result.value = {
    results, applicable: applicable.length, skipped: rows.value.length - applicable.length,
    failed: failed.length,
    verdict: failed.length ? 'blocked' : 'pass',
    reason: failed.length
      ? `${failed.length} check${failed.length > 1 ? 's' : ''} failed: ${failed.map(f => f.ruleName).join(', ')}`
      : `All ${results.length} applicable check${results.length === 1 ? '' : 's'} passed`
  }
}

watch([probeOs, reported], evaluate, { deep: true })

function openAdd () { form.value = blank(); editingId.value = null; sheetOpen.value = true }
function openEdit (row) { form.value = { ...blank(), ...row }; editingId.value = row.id; sheetOpen.value = true }

async function save () {
  if (!form.value.ruleName || !form.value.check) {
    toast('A rule name and a check are required', 'bad'); return
  }
  saving.value = true
  try {
    if (editingId.value) { await api.deviceChecks.update(editingId.value, { ...form.value }); toast('Saved') }
    else { await api.deviceChecks.create({ ...form.value }); toast('Check created') }
    sheetOpen.value = false
    load()
  } catch (e) {
    toast('Could not save: ' + (e?.message || 'unknown error'), 'bad')
  } finally { saving.value = false }
}

async function removeSelected () {
  const n = selectedIds.value.length
  await api.deviceChecks.removeMany(selectedIds.value)
  confirmOpen.value = false
  table.value?.clearSelection()
  toast(n + ' deleted')
  load()
}

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="Device checks"
      subtitle="Each check is an operating system, a check type and a value. A device has to satisfy every check that applies to it."
    >
      <template #actions>
        <button class="i-btn"><i class="fa-solid fa-download" aria-hidden="true" /> CSV</button>
        <button class="i-btn i-primary" @click="openAdd">
          <i class="fa-solid fa-plus" aria-hidden="true" /> Add
        </button>
      </template>
    </PageHeader>

    <div class="row g-4">
      <div class="col-12 col-xl-7">
        <DataTable
          ref="table" :columns="columns" :rows="rows" :total="rows.length"
          :loading="loading" :per-page="50"
          @selection="selectedIds = $event" @row-click="openEdit"
        >
          <template #bulk>
            <button class="i-btn i-sm i-danger" @click="confirmOpen = true">Delete</button>
          </template>
          <template #empty>
            <EmptyState
              icon="fa-laptop-medical"
              title="No device checks"
              body="With none defined, every device passes posture regardless of its state."
              action-label="Add"
              @action="openAdd"
            />
          </template>
        </DataTable>
      </div>

      <!-- the evaluator -->
      <div class="col-12 col-xl-5">
        <div class="i-chead">
          <h2>Try it against a device</h2>
          <span class="i-meta">Really evaluates</span>
        </div>
        <p style="font-size:12.5px;color:var(--i-dim);margin:0 0 12px">
          What an agent would report. Change a value and the verdict recomputes.
        </p>

        <div class="i-field mb-3">
          <label for="pos">Device operating system</label>
          <select id="pos" class="i-ctl" v-model="probeOs">
            <optgroup v-for="(list, fam) in OS_FAMILIES" :key="fam" :label="fam">
              <option v-for="o in list" :key="o">{{ o }}</option>
            </optgroup>
          </select>
          <p class="i-hint">Checks pinned to another OS are skipped rather than failed.</p>
        </div>

        <div v-if="rows.length" class="mb-3">
          <div v-for="r in rows" :key="r.id" class="i-field mb-2">
            <label :for="'rep_' + r.id" style="font-size:12px">
              {{ r.check }}<span style="color:var(--i-mute)"> — reported</span>
            </label>
            <input :id="'rep_' + r.id" class="i-ctl" v-model="reported[r.check]">
          </div>
        </div>

        <div
          v-if="result" class="i-verdict"
          :class="result.verdict === 'pass' ? 'is-pass' : 'is-block'"
        >
          <h3>
            <i class="fa-solid me-2" aria-hidden="true"
               :class="result.verdict === 'pass' ? 'fa-circle-check' : 'fa-circle-xmark'" />
            {{ result.verdict === 'pass' ? 'Device allowed' : 'Device blocked' }}
          </h3>
          <p>{{ result.reason }}</p>
        </div>

        <div v-if="result" class="mt-3">
          <div v-for="r in result.results" :key="r.id" class="i-checkrow">
            <span class="i-checkicon">
              <i class="fa-solid" aria-hidden="true" :class="r.pass ? 'fa-check' : 'fa-xmark'"
                 :style="{ color: r.pass ? 'var(--i-ok)' : 'var(--i-bad)' }" />
            </span>
            <div style="flex:1;min-width:0">
              <div style="font-size:12.5px">{{ r.ruleName }}</div>
              <div style="font-size:11.5px;color:var(--i-mute)">
                <code class="i-tech">{{ r.check }}</code>
                {{ r.negative ? 'must not be' : 'expects' }}
                <code class="i-tech">{{ r.expected || '—' }}</code>
              </div>
            </div>
          </div>
          <p v-if="result.skipped" class="i-hint">
            {{ result.skipped }} check{{ result.skipped === 1 ? '' : 's' }} skipped — pinned to another operating system.
          </p>
        </div>
      </div>
    </div>

    <Sheet
      v-model:open="sheetOpen"
      :title="editingId ? 'Edit device check' : 'Add device check'"
      subtitle="A check applies only to the operating system it names."
    >
      <div class="i-formsec">
        <div class="i-frow" style="grid-template-columns:1fr">
          <div class="i-field">
            <label for="dcn">Rule name <span class="i-req">*</span></label>
            <input id="dcn" class="i-ctl" v-model="form.ruleName" placeholder="Windows must run Falcon">
          </div>
          <div class="i-field">
            <label for="dcos">Operating system</label>
            <select id="dcos" class="i-ctl" v-model="form.os">
              <option value="">Any operating system</option>
              <optgroup v-for="(list, fam) in OS_FAMILIES" :key="fam" :label="fam">
                <option v-for="o in list" :key="o">{{ o }}</option>
              </optgroup>
            </select>
            <p class="i-hint">
              Production offers 2,393 entries here, 1,918 of them individual Android
              handset models. Grouped by family instead.
            </p>
          </div>
        </div>
      </div>

      <div class="i-formsec">
        <h3>The check</h3>
        <div class="i-frow" style="grid-template-columns:1fr">
          <div class="i-field">
            <label for="dcc">Check <span class="i-req">*</span></label>
            <select id="dcc" class="i-ctl" v-model="form.check">
              <option value="">Select Check</option>
              <option v-for="c in DEVICE_CHECKS" :key="c">{{ c }}</option>
            </select>
          </div>
          <div class="i-field">
            <label for="dcv">{{ help[0] }}</label>
            <input id="dcv" class="i-ctl" v-model="form.checkValue" :placeholder="help[1]">
            <p class="i-hint">
              <template v-if="form.check === 'FileNotExists' || form.check === 'ProcessNotRunning'">
                A negative check: it passes when this is <strong>absent</strong>.
              </template>
              <template v-else-if="form.check">
                The device has to report this value for the check to pass.
              </template>
              <template v-else>
                Pick a check and this field explains what it wants. Production labels it
                "Check value" for all 25 and leaves you to guess.
              </template>
            </p>
          </div>
        </div>
        <label class="i-sw mt-2">
          <input type="checkbox" v-model="form.enabled"><span class="i-track" />Check is enabled
        </label>
      </div>

      <template #footer>
        <button class="i-btn i-quiet" @click="sheetOpen = false">Cancel</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Create') }}
          </button>
        </div>
      </template>
    </Sheet>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="'Delete ' + selectedIds.length + ' check' + (selectedIds.length === 1 ? '' : 's') + '?'"
      :confirm-label="'Delete ' + selectedIds.length"
      @confirm="removeSelected"
    >
      Devices that were failing on {{ selectedIds.length === 1 ? 'this check' : 'these checks' }}
      will start passing posture from the next evaluation.
    </ConfirmModal>
  </div>
</template>
