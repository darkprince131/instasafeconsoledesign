<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import QuickCreate from './QuickCreate.vue'

/**
 * A search-first picker, single or multiple.
 *
 * This replaces plain `<select>` everywhere a choice is drawn from a real
 * collection. The access explorer had 1,821 users in one, which is not a
 * control: you cannot scan it, you cannot type more than the first letter,
 * and finding `priya.bianchi` means dragging a scrollbar through two thousand
 * rows. A native select is right for eight options and wrong for eight
 * hundred, and the threshold is not subtle.
 *
 * It is also how membership is edited. Velto puts "Select Users…" and
 * "Select Applications…" inside the group form, so the group and its members
 * are one object you save once rather than a list you then have to populate
 * from somewhere else. That is the right model and this is the control it
 * needs.
 *
 * Options are fetched from the resource and filtered here. For the sizes this
 * console holds — a couple of thousand rows — filtering in the browser is
 * instant and avoids a request per keystroke.
 */

const props = defineProps({
  /** Resource key on the api object, e.g. 'users'. */
  resource: { type: String, default: '' },
  /** Or pass options directly: [{ value, label, hint }]. */
  options: { type: Array, default: null },
  /** Server-side narrowing, e.g. { type: 'web' }. */
  filters: { type: Object, default: () => ({}) },
  /** Fields on a record to build value / label / hint from. */
  valueKey: { type: String, default: 'id' },
  labelKey: { type: String, default: 'name' },
  hintKey: { type: String, default: '' },
  multiple: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Search…' },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  id: { type: String, default: () => `pl_${Math.random().toString(36).slice(2, 8)}` },
  /* Offers "Create …" in the list. On for anything a person might legitimately
     not have made yet; off where inventing a record mid-sentence makes no
     sense, like picking which gateway an existing rule runs on. */
  allowCreate: { type: Boolean, default: false }
})

/** string for single, string[] for multiple. */
const model = defineModel({ default: null })
/* The labels behind the chosen ids. A table showing "usr_00042" helps nobody,
   and the alternative is every parent re-fetching the collection purely to
   turn ids back into names it already had on screen. */
const labels = defineModel('labels', { default: null })

const all = ref([])
const loading = ref(false)
const q = ref('')
const open = ref(false)
const active = ref(0)
const box = ref(null)
const input = ref(null)

const selected = computed(() => {
  if (props.multiple) return Array.isArray(model.value) ? model.value : []
  return model.value ? [model.value] : []
})

const byValue = computed(() => new Map(all.value.map(o => [o.value, o])))
const chips = computed(() => selected.value.map(v => byValue.value.get(v) || { value: v, label: v }))

watch(chips, (c) => {
  if (labels.value === undefined) return
  labels.value = c.map(x => x.label)
}, { deep: true })

/**
 * Rank: something starting with the term beats something merely containing
 * it, so typing "pri" puts priya above a surname that happens to contain it.
 */
const matches = computed(() => {
  const t = q.value.trim().toLowerCase()
  const pool = props.multiple
    ? all.value.filter(o => !selected.value.includes(o.value))
    : all.value
  if (!t) return pool.slice(0, 50)
  const hits = []
  for (const o of pool) {
    const l = o.label.toLowerCase()
    const blob = o.search || `${l} ${(o.hint || '').toLowerCase()}`
    const rank = l.startsWith(t) ? 0 : l.includes(t) ? 1 : blob.includes(t) ? 2 : -1
    if (rank >= 0) hits.push({ o, rank })
  }
  return hits.sort((a, b) => a.rank - b.rank).slice(0, 50).map(x => x.o)
})

watch(matches, () => { active.value = 0 })

let loadToken = 0
async function load () {
  if (props.options) { all.value = props.options; return }
  if (!props.resource) return
  const mine = ++loadToken
  loading.value = true
  try {
    const api = (await import('../../api')).default
    const res = await api[props.resource].list({ perPage: 0, filters: props.filters })
    if (mine !== loadToken) return        // a newer request already won
    all.value = (res.data || []).map(r => {
      const label = [r.firstName, r.lastName].filter(Boolean).join(' ') ||
        r[props.labelKey] || r.username || r.id
      const hint = props.hintKey ? r[props.hintKey]
        : (r.username && r.username !== r[props.labelKey] ? r.username : '')
      /* Everything worth typing, whether or not it is on screen.
         The access explorer shows a department as the hint, so searching a
         username matched nothing — and because no match still leaves the
         unfiltered list, it quietly selected whoever happened to be first.
         A search that silently gives you the wrong person is worse than one
         that finds nobody. */
      return {
        value: r[props.valueKey], label, hint,
        search: [label, hint, r.username, r.email, r.name, r.host, r.type]
          .filter(Boolean).join(' ').toLowerCase()
      }
    })
  } catch {
    if (mine === loadToken) all.value = []
  } finally {
    if (mine === loadToken) loading.value = false
  }
}

/**
 * Watch a string, not an array.
 *
 * `() => [a, b, c]` builds a new array every evaluation, so Vue's identity
 * check never matches and the watcher fires on each parent render. The
 * parent hands `filters` a fresh `{}` each time it renders, which made that
 * every keystroke: load() restarted before it could finish and the list sat
 * on "Loading…" for ever. A string compares by value and settles.
 */
const sig = computed(() => `${props.resource}|${JSON.stringify(props.filters || {})}|${props.options ? 'inline' : ''}`)
watch(sig, load)
onMounted(load)

function choose (o) {
  if (!o) return
  if (props.multiple) {
    model.value = [...selected.value, o.value]
    q.value = ''
    nextTick(() => input.value?.focus())
  } else {
    model.value = o.value
    q.value = ''
    open.value = false
  }
}

function remove (v) {
  if (props.multiple) model.value = selected.value.filter(x => x !== v)
  else model.value = null
}

function onKey (e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); open.value = true; active.value = Math.min(active.value + 1, matches.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(active.value - 1, 0) }
  else if (e.key === 'Enter') { e.preventDefault(); choose(matches.value[active.value]) }
  else if (e.key === 'Escape') { open.value = false }
  else if (e.key === 'Backspace' && !q.value && props.multiple && selected.value.length) {
    remove(selected.value[selected.value.length - 1])
  }
}

/* ---- create without leaving ------------------------------------------- */
const creating = ref(false)

function startCreate () {
  open.value = false
  creating.value = true
}

/** The new record joins the list and is selected, so the sentence continues. */
function onCreated (rec) {
  if (!rec) return
  const o = {
    value: rec[props.valueKey],
    label: [rec.firstName, rec.lastName].filter(Boolean).join(' ') || rec[props.labelKey] || rec.username || rec.id,
    hint: props.hintKey ? rec[props.hintKey] : (rec.username || '')
  }
  all.value = [o, ...all.value]
  q.value = ''
  choose(o)
}

function onDocClick (e) { if (box.value && !box.value.contains(e.target) && !creating.value) open.value = false }
onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))

/** Selecting everything the filter matches, which a long list makes tedious. */
function selectAllShown () {
  if (!props.multiple) return
  model.value = [...new Set([...selected.value, ...matches.value.map(o => o.value)])]
  q.value = ''
}
</script>

<template>
  <div class="i-field">
    <label v-if="label" :for="id">
      {{ label }} <span v-if="required" class="i-req">*</span>
    </label>

    <div ref="box" class="i-pick" :class="{ 'is-open': open, 'is-disabled': disabled }">
      <div class="i-pickbox" @click="!disabled && (open = true, input?.focus())">
        <span v-for="c in chips" :key="c.value" class="i-pickchip">
          {{ c.label }}
          <button
            type="button" class="i-pickx" :aria-label="`Remove ${c.label}`"
            @click.stop="remove(c.value)"
          ><i class="fa-solid fa-xmark" aria-hidden="true" /></button>
        </span>

        <input
          :id="id" ref="input" v-model="q" type="text"
          role="combobox" :aria-expanded="open" :aria-controls="id + '_list'"
          autocomplete="off" :disabled="disabled"
          :placeholder="chips.length && !multiple ? '' : placeholder"
          @focus="open = true" @keydown="onKey"
        >
      </div>

      <div v-if="open" :id="id + '_list'" class="i-pickpop" role="listbox">
        <div v-if="multiple && matches.length > 1 && q.trim()" class="i-pickall">
          <button type="button" class="i-btn i-sm i-quiet" @click="selectAllShown">
            Add all {{ matches.length }} matching
          </button>
        </div>

        <button
          v-for="(o, i) in matches" :key="o.value"
          type="button" class="i-pickrow" :class="{ 'is-active': i === active }"
          role="option" :aria-selected="i === active"
          @mouseenter="active = i" @click="choose(o)"
        >
          <span class="i-pickl">{{ o.label }}</span>
          <span v-if="o.hint" class="i-pickh">{{ o.hint }}</span>
        </button>

        <!-- The record you need may not exist yet. Sending somebody to
             another screen to make it loses whatever they were drafting. -->
        <button
          v-if="allowCreate && !loading"
          type="button" class="i-pickrow i-pickcreate" @click="startCreate"
        >
          <i class="fa-solid fa-plus" aria-hidden="true" />
          <span class="i-pickl">
            <template v-if="q.trim()">Create “{{ q.trim() }}”</template>
            <template v-else>Create a new one</template>
          </span>
        </button>

        <p v-if="loading" class="i-picknote">Loading…</p>
        <p v-else-if="!matches.length" class="i-picknote">
          <template v-if="q.trim()">Nothing matches <strong>{{ q }}</strong>.</template>
          <template v-else-if="multiple && all.length">Everything here is already selected.</template>
          <template v-else>Nothing to choose from yet.</template>
        </p>
        <p v-else-if="!q.trim() && all.length > matches.length" class="i-picknote">
          Showing {{ matches.length }} of {{ all.length.toLocaleString() }} — type to narrow.
        </p>
      </div>
    </div>

    <QuickCreate
      v-if="allowCreate"
      v-model:open="creating" :resource="resource" :seed="q.trim()"
      @created="onCreated"
    />

    <p v-if="multiple && chips.length" class="i-hint">
      {{ chips.length }} selected.
      <button type="button" class="i-linkbtn" @click="model = []">Clear all</button>
    </p>
    <p v-else-if="hint" class="i-hint">{{ hint }}</p>
  </div>
</template>
