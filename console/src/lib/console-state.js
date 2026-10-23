import { reactive, watch, computed } from 'vue'

/**
 * Empty and filled, for the administrator console.
 *
 * The portal has had this for a while (`demo-state.js`) and the console has
 * not, which meant the twenty-one screens that are genuinely empty in a real
 * tenant could only be seen by deleting two thousand rows and reseeding
 * afterwards. Those are exactly the screens worth reviewing: a first-run
 * console is what every customer sees on day one, and nobody on this project
 * had looked at one.
 *
 * **How it works, and what it deliberately does not do.** A collection set to
 * `empty` hides its *seeded* rows and nothing else. Anything created since —
 * by you, by a guided flow — stays visible. So "empty" is a believable first
 * day rather than a void: turn users off, walk the onboarding flow, and watch
 * the list go from the real empty state to one row that you put there. A
 * switch that hid new rows too would break every flow it was meant to help.
 *
 * Seeded rows are told apart by their id. The seed numbers them —
 * `usr_00001`, `gw_0002` — while anything made at runtime gets a base36
 * timestamp, `usr_mk3f2b01`, which always carries letters. So an id whose
 * suffix is only digits came from the seed. It is a convention rather than a
 * column, which keeps this out of the database schema entirely; `db.js`'s
 * `id()` and `seed.js`'s `pad()` are the two places that have to stay true to
 * it.
 *
 * The filtering happens once, in `api/index.js`, because 54 list screens go
 * through one `resource()` factory. Doing it per screen would mean 54 chances
 * to disagree about what empty means.
 */

const KEY = 'i365.console.demo'

/**
 * The collections worth emptying, and what each one is for.
 *
 * Not every table: a tenant with no authentication profiles cannot sign
 * anybody in, so an empty one is a broken demo rather than an interesting
 * state. These are the ones where "none yet" is a real day-one situation.
 */
export const COLLECTIONS = [
  { key: 'users', label: 'Users', hint: 'Day one: nobody has been invited yet.' },
  { key: 'groups', label: 'Groups', hint: 'Before anyone has organised people.' },
  { key: 'devices', label: 'Devices', hint: 'Nothing has tried to connect.' },
  { key: 'applications', label: 'Applications', hint: 'Nothing has been published yet.' },
  { key: 'gateways', label: 'Gateways', hint: 'No data plane — the first thing you set up.' },
  { key: 'accessRules', label: 'Access rules', hint: 'No policy written. Everything is denied.' },
  { key: 'sessions', label: 'Live sessions', hint: 'A quiet moment, or nobody connected yet.' },
  { key: 'eventLog', label: 'Event log', hint: 'A tenant where nothing has happened.' }
]

const KEYS = COLLECTIONS.map(c => c.key)

/** Everything seeded, which is what a reviewer should land on. */
const DEFAULTS = Object.fromEntries(KEYS.map(k => [k, 'seeded']))

function load () {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    /* Only keys we still know about: a saved state should not resurrect a
       switch that has since been removed. */
    return Object.fromEntries(KEYS.map(k => [k, raw[k] === 'empty' ? 'empty' : 'seeded']))
  } catch { return { ...DEFAULTS } }
}

export const consoleDemo = reactive(load())

watch(consoleDemo, (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch {}
}, { deep: true })

/**
 * The two tenants worth showing, as one click each.
 *
 * A visitor should be able to arrive at a console where nothing has been set
 * up and do it themselves — that is the only way to feel what the product
 * asks of you on day one. An engineer should arrive at production scale,
 * because their questions are about density and whether the field sets match.
 */
export const PRESETS = {
  empty: {
    label: 'Day one',
    hint: 'A console nobody has set up yet. Every list is at its real empty state, and anything you add appears straight away.'
  },
  full: {
    label: 'Running tenant',
    hint: 'Production scale: 1,821 users, 2,140 devices, 772 of them waiting for approval.'
  }
}

export function applyPreset (key) {
  const to = key === 'empty' ? 'empty' : 'seeded'
  for (const k of KEYS) consoleDemo[k] = to
}

/** Which preset the switches currently match, if either. */
export function currentPreset () {
  if (KEYS.every(k => consoleDemo[k] === 'seeded')) return 'full'
  if (KEYS.every(k => consoleDemo[k] === 'empty')) return 'empty'
  return ''
}

export function resetConsoleState () { Object.assign(consoleDemo, DEFAULTS) }

/** True when any switch is away from its default — the widget shows a dot. */
export const isModified = computed(() => KEYS.some(k => consoleDemo[k] !== 'seeded'))

/** How many collections are currently emptied. */
export const emptiedCount = computed(() => KEYS.filter(k => consoleDemo[k] === 'empty').length)

export function isEmptied (name) { return consoleDemo[name] === 'empty' }

export function setEmptied (name, on) {
  if (name in consoleDemo) consoleDemo[name] = on ? 'empty' : 'seeded'
}

/**
 * Did the seed make this row?
 *
 * See the note at the top: a numeric suffix is the seed's, a base36 timestamp
 * is the runtime's. Anything unrecognised counts as made here, because the
 * cost of wrongly hiding something a visitor created is much higher than the
 * cost of wrongly showing a seeded row.
 */
const SEEDED_ID = /^[a-z]+_\d{1,6}$/i

export function isSeededRow (row) {
  return !!row && typeof row.id === 'string' && SEEDED_ID.test(row.id)
}

/** Drop the seeded rows from a list, if that collection is emptied. */
export function applyEmptyState (name, rows) {
  if (!Array.isArray(rows) || consoleDemo[name] !== 'empty') return rows
  return rows.filter(r => !isSeededRow(r))
}
