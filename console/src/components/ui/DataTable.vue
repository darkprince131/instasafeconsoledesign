<script setup>
import { ref, computed, watch } from 'vue'

/**
 * The list template.
 *
 * 54 of the console's 66 screens are this component with different columns,
 * so it is the single highest-leverage piece of UI in the product. What it
 * fixes against production, beyond the visual reskin:
 *
 *   - sortable headers            (production: 0 of 54 screens have sort)
 *   - a column chooser            (0 of 54)
 *   - search that says what it searched
 *   - selection that reveals destructive actions only once something is
 *     selected, instead of a permanently armed Delete in the toolbar
 *   - an empty state that distinguishes "nothing here" from "nothing matched"
 */

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  loading: Boolean,
  page: { type: Number, default: 1 },
  perPage: { type: Number, default: 25 },
  sort: { type: String, default: '' },
  dir: { type: String, default: 'asc' },
  selectable: { type: Boolean, default: true },
  rowKey: { type: String, default: 'id' },
  rowAction: { type: Object, default: null }
})

const emit = defineEmits(['update:page', 'update:perPage', 'sort', 'selection', 'row-action', 'row-click'])

const selected = ref(new Set())
const hidden = ref(new Set())
const colsOpen = ref(false)

const visibleColumns = computed(() => props.columns.filter(c => !hidden.value.has(c.key)))
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))
const from = computed(() => props.total === 0 ? 0 : (props.page - 1) * props.perPage + 1)
const to = computed(() => Math.min(props.page * props.perPage, props.total))

// a new page of rows invalidates the old selection
watch(() => props.rows, () => { selected.value = new Set(); emitSelection() })

function emitSelection () { emit('selection', [...selected.value]) }

function toggleRow (row) {
  const s = new Set(selected.value)
  const k = row[props.rowKey]
  s.has(k) ? s.delete(k) : s.add(k)
  selected.value = s
  emitSelection()
}

const allOn = computed(() =>
  props.rows.length > 0 && props.rows.every(r => selected.value.has(r[props.rowKey])))
const someOn = computed(() =>
  props.rows.some(r => selected.value.has(r[props.rowKey])) && !allOn.value)

function toggleAll () {
  selected.value = allOn.value ? new Set() : new Set(props.rows.map(r => r[props.rowKey]))
  emitSelection()
}

function clearSelection () { selected.value = new Set(); emitSelection() }
defineExpose({ clearSelection })

function headerSort (col) {
  if (col.sortable === false) return
  emit('sort', col.key, props.sort === col.key && props.dir === 'asc' ? 'desc' : 'asc')
}

function ariaSort (col) {
  if (col.sortable === false) return null
  if (props.sort !== col.key) return 'none'
  return props.dir === 'asc' ? 'ascending' : 'descending'
}

/** Renders one cell. `pill` returning null means the value is the expected
 *  case and stays as plain text — colour is spent on exceptions only. */
function value (row, col) {
  const raw = row[col.key]
  return col.cell ? col.cell(raw, row) : raw
}

function cellClass (col) {
  return {
    'i-tech': col.mono,
    'i-dimcell': col.dim,
    'i-num': col.num,
    'text-end': col.align === 'right',
    'text-uppercase': col.upper,
    'fw-medium': col.bold
  }
}
</script>

<template>
  <!-- selection bar: destructive actions exist only once something is selected -->
  <div v-if="selectable && selected.size" class="i-selnote">
    <strong>{{ selected.size }} selected</strong>
    <div class="i-right">
      <slot name="bulk" :ids="[...selected]" :clear="clearSelection" />
      <button class="i-btn i-sm i-quiet" @click="clearSelection">Clear</button>
    </div>
  </div>

  <div class="table-responsive">
    <table class="i-table">
      <thead>
        <tr>
          <th v-if="selectable" style="width:34px">
            <input
              type="checkbox" aria-label="Select all on this page"
              :checked="allOn"
              :indeterminate.prop="someOn"
              @change="toggleAll"
            >
          </th>
          <th
            v-for="col in visibleColumns" :key="col.key"
            :aria-sort="ariaSort(col)"
            :class="{ 'text-end': col.align === 'right' }"
            @click="headerSort(col)"
          >
            {{ col.label }}
            <i
              v-if="col.sortable !== false"
              class="fa-solid fa-arrow-up i-sarr" aria-hidden="true"
              style="font-size:9px"
            />
          </th>
          <th v-if="rowAction" style="width:96px" />
        </tr>
      </thead>

      <tbody v-if="loading">
        <tr v-for="n in 8" :key="n" class="is-skel">
          <td v-if="selectable"><div class="i-skel" style="width:14px;height:14px" /></td>
          <td v-for="col in visibleColumns" :key="col.key"><div class="i-skel" /></td>
          <td v-if="rowAction" />
        </tr>
      </tbody>

      <tbody v-else>
        <tr
          v-for="row in rows" :key="row[rowKey]"
          :aria-selected="selected.has(row[rowKey])"
          @click="emit('row-click', row)"
        >
          <td v-if="selectable" @click.stop>
            <input
              type="checkbox"
              :aria-label="`Select ${row.name || row.username || row[rowKey]}`"
              :checked="selected.has(row[rowKey])"
              @change="toggleRow(row)"
            >
          </td>

          <td v-for="col in visibleColumns" :key="col.key" :class="cellClass(col)">
            <!-- booleans read as words, not as a tick that could mean anything -->
            <template v-if="col.bool">
              <span class="i-pill">
                <span class="i-dot" :class="{ 'i-ok': row[col.key] }" />
                {{ row[col.key] ? 'On' : 'Off' }}
              </span>
            </template>

            <template v-else-if="col.pill">
              <span
                class="i-pill"
                :class="col.pill(row[col.key], row) ? `i-${col.pill(row[col.key], row)}` : ''"
              >
                <span v-if="!col.pill(row[col.key], row)" class="i-dot i-ok" />
                {{ value(row, col) }}
              </span>
            </template>

            <template v-else>{{ value(row, col) ?? '—' }}</template>
          </td>

          <td v-if="rowAction" class="text-end" @click.stop>
            <button
              v-if="!rowAction.when || rowAction.when(row)"
              class="i-btn i-sm"
              @click="emit('row-action', row)"
            >{{ rowAction.label }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <slot v-if="!loading && !rows.length" name="empty" />

  <div v-if="rows.length || loading" class="i-tfoot">
    <span>{{ from }}–{{ to }} of {{ total.toLocaleString() }}</span>

    <div class="i-right">
      <div class="position-relative">
        <button class="i-btn i-sm" @click="colsOpen = !colsOpen">
          <i class="fa-solid fa-table-columns" aria-hidden="true" /> Columns
        </button>
        <div v-if="colsOpen" class="i-menu" style="right:0;top:34px">
          <button
            v-for="col in columns" :key="col.key"
            @click="hidden.has(col.key) ? hidden.delete(col.key) : hidden.add(col.key); hidden = new Set(hidden)"
          >
            <i
              class="fa-solid" :class="hidden.has(col.key) ? 'fa-square' : 'fa-square-check'"
              style="width:14px" aria-hidden="true"
            />
            {{ col.label }}
          </button>
        </div>
      </div>

      <select
        class="i-ctl" style="width:auto;height:28px;padding:0 26px 0 9px"
        :value="perPage" aria-label="Rows per page"
        @change="emit('update:perPage', Number($event.target.value))"
      >
        <option :value="25">25</option>
        <option :value="50">50</option>
        <option :value="100">100</option>
      </select>

      <button class="i-pbtn" :disabled="page <= 1" aria-label="Previous page" @click="emit('update:page', page - 1)">
        <i class="fa-solid fa-chevron-left" style="font-size:10px" aria-hidden="true" />
      </button>
      <button class="i-pbtn" :disabled="page >= pages" aria-label="Next page" @click="emit('update:page', page + 1)">
        <i class="fa-solid fa-chevron-right" style="font-size:10px" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
