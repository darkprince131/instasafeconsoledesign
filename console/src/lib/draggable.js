/**
 * Make a fixed-position panel draggable, and get it out of the way on its own.
 *
 * Both the guided-flow panel and Pip dock bottom-right, which is exactly where
 * the slide-in sheet arrives. A step that says "press Add application" and
 * then sits on top of the Add application form is worse than no step at all —
 * that is a real report, from a real attempt to finish a flow.
 *
 * Two answers, and both are needed.
 *
 *   · **Dodge.** When a sheet or modal opens, anything docked on that side
 *     moves to the other one by itself. The visitor should not have to manage
 *     the helper's furniture to use the screen it is explaining.
 *   · **Drag.** Dodging guesses; dragging is certain. Once the visitor has
 *     moved it themselves, their position wins and the dodge stops — having
 *     your window moved out from under you is worse than it being in the
 *     wrong place.
 *
 * Positions are kept per key so the flow panel and Pip do not fight over one
 * slot, and are clamped into the viewport on resize, because a panel dragged
 * to the right of a wide window is off-screen on a narrow one.
 */

import { ref, onMounted, onUnmounted } from 'vue'

const MARGIN = 14

export function useDock (key, opts = {}) {
  const { width = 372, height = 320, dodgeSelector = '.i-sheet, .i-modal' } = opts

  /* null = "wherever CSS puts it". A position only becomes concrete once the
     visitor drags it or something makes it dodge, so the default layout stays
     in the stylesheet where it belongs. */
  const pos = ref(null)
  const moved = ref(false)       // the visitor has taken charge
  const dragging = ref(false)

  const STORE = 'i365.dock.' + key

  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || 'null')
    if (raw && typeof raw.x === 'number') { pos.value = raw; moved.value = true }
  } catch { /* no storage: the CSS default is a fine answer */ }

  function clamp (p) {
    const maxX = Math.max(MARGIN, window.innerWidth - width - MARGIN)
    const maxY = Math.max(MARGIN, window.innerHeight - height - MARGIN)
    return {
      x: Math.min(Math.max(MARGIN, p.x), maxX),
      y: Math.min(Math.max(MARGIN, p.y), maxY)
    }
  }

  /** The inline style for the panel, or nothing when CSS should decide. */
  function style () {
    if (!pos.value) return {}
    return {
      left: pos.value.x + 'px',
      top: pos.value.y + 'px',
      right: 'auto',
      bottom: 'auto'
    }
  }

  // ------------------------------------------------------------ dragging
  let from = null

  function onDown (e) {
    // Only the primary button, and never from a control inside the header —
    // dragging off the close button means the close button cannot be pressed.
    if (e.button !== 0) return
    if (e.target.closest('button, a, input, select, textarea')) return

    const el = e.currentTarget.closest('[data-dock]') || e.currentTarget.parentElement
    const r = el.getBoundingClientRect()
    from = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    pos.value = clamp({ x: r.left, y: r.top })
    dragging.value = true
    moved.value = true

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    e.preventDefault()
  }

  function onMove (e) {
    if (!from) return
    pos.value = clamp({ x: e.clientX - from.dx, y: e.clientY - from.dy })
  }

  function onUp () {
    dragging.value = false
    from = null
    window.removeEventListener('pointermove', onMove)
    try { localStorage.setItem(STORE, JSON.stringify(pos.value)) } catch {}
  }

  // -------------------------------------------------------------- dodging
  /**
   * Watch for anything that covers the dock's corner, and step aside.
   *
   * A MutationObserver rather than a poll: the sheet is a `v-if`, so it
   * arrives and leaves as a DOM change, and that is the event we care about.
   */
  let mo = null
  const dodged = ref(false)
  /* True when something covers the page and there is nowhere beside it to
     stand. Stepping aside is only an answer when aside exists; on a narrow
     window a centred modal leaves no room at all, and a panel shoved to a
     margin it does not fit in still covers the form. The caller uses this to
     collapse instead. */
  const covered = ref(false)

  function checkDodge () {
    const sheet = document.querySelector(dodgeSelector)

    if (!sheet) {
      covered.value = false
      if (dodged.value && !moved.value) { pos.value = null; dodged.value = false }
      return
    }

    const r = sheet.getBoundingClientRect()
    const leftRoom = r.left
    const rightRoom = window.innerWidth - r.right
    const room = Math.max(leftRoom, rightRoom)

    covered.value = room < width + MARGIN * 2

    if (moved.value || covered.value) return   // their position wins; or no room

    const x = leftRoom >= rightRoom
      ? Math.max(MARGIN, r.left - width - MARGIN)
      : Math.min(window.innerWidth - width - MARGIN, r.right + MARGIN)
    pos.value = clamp({ x, y: window.innerHeight - height - MARGIN })
    dodged.value = true
  }

  function onResize () { if (pos.value) pos.value = clamp(pos.value) }

  onMounted(() => {
    mo = new MutationObserver(checkDodge)
    mo.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', onResize)
    checkDodge()
  })

  onUnmounted(() => {
    mo?.disconnect()
    window.removeEventListener('resize', onResize)
    window.removeEventListener('pointermove', onMove)
  })

  /** Give the visitor their corner back. */
  function reset () {
    pos.value = null; moved.value = false; dodged.value = false
    try { localStorage.removeItem(STORE) } catch {}
  }

  return { pos, style, onDown, dragging, moved, covered, reset }
}
