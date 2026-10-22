import { reactive, watch } from 'vue'

/**
 * Demo states.
 *
 * A console is mostly states, and the interesting ones are the ones a seeded
 * tenant never shows: nobody has any applications yet, the agent is down, an
 * administrator has turned session recording on, a brand-new employee has no
 * devices. Those are exactly the screens worth reviewing, and until now the
 * only way to see one was to empty a table and reseed afterwards.
 *
 * So they are switches. The widget writes here, the screens read here, and
 * nothing is faked downstream: a screen in the "no applications" state runs
 * the same empty-state branch it would run for a real tenant with none.
 *
 * Persisted per visitor, so a state survives a reload and a reviewer can
 * send somebody a link and say "turn applications off".
 */

const KEY = 'i365.demo'

/** Everything a reviewer might want to see, with its honest default. */
export const DEFAULTS = {
  /* what the person can reach */
  applications: 'all',        // all · web · none
  devices: 'some',            // some · none
  history: 'some',            // some · none

  /* the machine they are sitting at */
  agent: 'auto',              // auto (really probe) · running · missing

  /* what the administrator has turned on for them */
  sessionRecording: false,
  shiftSchedule: false,
  geoBinding: false,
  mfaRequired: true,

  /* how hard the demo makes you work */
  mfaSimulator: true          // any code is accepted, and the screen says so
}

function load () {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    /* Only keys we still know about: an old saved state should not resurrect
       a switch that has since been removed. */
    return Object.fromEntries(
      Object.keys(DEFAULTS).map(k => [k, k in raw ? raw[k] : DEFAULTS[k]])
    )
  } catch { return { ...DEFAULTS } }
}

export const demo = reactive(load())

watch(demo, (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch {}
}, { deep: true })

/**
 * The two tenants worth showing, as one click each.
 *
 * They are the two audiences this console serves. A visitor should arrive at
 * a tenant where nothing has happened yet and set it up — that is the only
 * way to feel what the product asks of you. An engineer should arrive at a
 * tenant at production scale, because the questions they have are about
 * density, empty states they will never otherwise reach, and whether the
 * field sets match.
 *
 * Individual switches still work; these just set all of them at once, which
 * is what somebody standing in front of an audience actually needs.
 */
export const PRESETS = {
  empty: {
    label: 'New tenant',
    hint: 'Nothing set up yet. You do it: enrol a factor, install the agent, get applications assigned.',
    state: {
      applications: 'none', devices: 'none', history: 'none',
      agent: 'missing', sessionRecording: false, shiftSchedule: false,
      geoBinding: false, mfaRequired: true, mfaSimulator: true
    }
  },
  full: {
    label: 'Running tenant',
    hint: 'A company already using it — applications assigned, devices registered, policy in force.',
    state: {
      applications: 'all', devices: 'some', history: 'some',
      agent: 'auto', sessionRecording: true, shiftSchedule: true,
      geoBinding: false, mfaRequired: true, mfaSimulator: true
    }
  }
}

export function applyPreset (key) {
  const p = PRESETS[key]
  if (p) Object.assign(demo, p.state)
}

/** Which preset the switches currently match, if either. */
export function currentPreset () {
  for (const [key, p] of Object.entries(PRESETS)) {
    if (Object.entries(p.state).every(([k, v]) => demo[k] === v)) return key
  }
  return ''
}

export function resetDemoState () {
  Object.assign(demo, DEFAULTS)
}

/** True when any switch is away from its default — the widget shows a dot. */
export function isModified () {
  return Object.keys(DEFAULTS).some(k => demo[k] !== DEFAULTS[k])
}

/**
 * Apply the application switch to a list.
 *
 * Done here rather than in each screen so the two screens that show
 * applications cannot disagree about what "web only" means.
 */
const BROWSER_TYPES = ['web', 'rdp', 'ssh', 'vnc', 'wfs', 'db']

export function filterApplications (rows) {
  if (demo.applications === 'none') return []
  if (demo.applications === 'web') {
    return rows.filter(a => BROWSER_TYPES.includes(String(a.type).toLowerCase()))
  }
  return rows
}

export function filterDevices (rows) {
  return demo.devices === 'none' ? [] : rows
}

export function filterHistory (rows) {
  return demo.history === 'none' ? [] : rows
}

export { BROWSER_TYPES }
