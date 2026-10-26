/**
 * Keep the deploy badge from eating clicks.
 *
 * Netlify injects `#nl-badge-frame` into every page on this plan: a fixed
 * iframe, 197×64, pinned to the bottom-right corner at z-index 2147483645.
 * It is not ours and it is not in the build — it arrives from the edge — and
 * because it is an iframe with its own hit area, anything of ours underneath
 * it stops being clickable. Measured on the live site, it was swallowing
 * table rows; it also sits exactly where the sheet's Save button, the
 * pagination and the toasts go.
 *
 * Hiding it is not our call to make: it is the hosting provider's badge on
 * the plan this demo runs on. So the app gets out of its way instead. This
 * measures the badge and publishes its height and width as custom properties,
 * and the stylesheet reserves that much room in the handful of places that
 * reach into that corner. No badge, no gap — local development and any other
 * host are unaffected, because the properties stay at zero.
 *
 * It is measured rather than hard-coded because it is somebody else's
 * element: if the badge changes size, the gap changes with it.
 */

const SELECTOR = '#nl-badge-frame, .netlify-badge, [id^="netlify-badge"]'

/** A little more than the badge, so a row's hover edge is not flush with it. */
const PAD = 8

function apply () {
  const el = document.querySelector(SELECTOR)
  const root = document.documentElement

  if (!el) {
    root.style.setProperty('--i-badge-h', '0px')
    root.style.setProperty('--i-badge-w', '0px')
    return
  }

  const r = el.getBoundingClientRect()
  /* A badge that has been scrolled or collapsed to nothing is not in the way.
     Guard against a zero box so an absent badge cannot reserve 8px for ever. */
  const h = r.height > 0 ? Math.ceil(r.height) + PAD : 0
  const w = r.width > 0 ? Math.ceil(r.width) + PAD : 0
  root.style.setProperty('--i-badge-h', h + 'px')
  root.style.setProperty('--i-badge-w', w + 'px')
}

export function watchDeployBadge () {
  apply()

  /* The badge is injected after the document is ready, and on a soft
     navigation it can be re-inserted, so this watches rather than checking
     once. Cheap: it only reads the DOM when something is added or removed. */
  const mo = new MutationObserver(apply)
  mo.observe(document.body, { childList: true, subtree: false })

  window.addEventListener('resize', apply)
  /* Its own width changes when it expands on hover. */
  window.addEventListener('load', apply)
}
