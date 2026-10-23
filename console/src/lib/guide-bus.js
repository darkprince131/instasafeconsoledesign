/**
 * What Pip is being asked to look at.
 *
 * The guided-flow runner owns the spotlight; Pip is a separate component
 * mounted at the other end of the app. Rather than wire a prop through four
 * layers of shell, the runner publishes what it is pointing at and Pip reads
 * it. One ref, written by one place, read by one place.
 *
 * `spotlight` is null when nothing is highlighted — which the runner does
 * deliberately whenever a sheet or modal covers the page, so Pip stops
 * following at exactly the moment following would mean standing on the form.
 */

import { ref } from 'vue'

/** { top, left, width, height, title, text, index } | null */
export const spotlight = ref(null)

/** Set by the runner so Pip can celebrate a finished flow rather than guess. */
export const flowDone = ref(0)

export function pointAt (rect, text, index, title = '') {
  spotlight.value = rect ? { ...rect, text, index, title } : null
}

export function clearPointer () { spotlight.value = null }

export function celebrate () { flowDone.value++ }
