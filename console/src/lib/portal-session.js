import { ref } from 'vue'

/**
 * Who is signed in to the end-user portal.
 *
 * Deliberately separate from whoever is using the admin console. They are two
 * different sessions for two different people, and conflating them is how the
 * enrolment screen ended up in the administrator's navigation in the first
 * place: if the admin is implicitly "the user", then enrolling an
 * authenticator looks like something the admin does.
 *
 * The id is kept in sessionStorage rather than localStorage. A portal sign-in
 * should not outlive the tab — this is the session an employee opens on a
 * shared machine to enrol a phone.
 */

const KEY = 'i365.portal.user'

export const portalUser = ref(null)

/**
 * The account being activated, handed from sign-in to the activation page.
 *
 * This went through `history.state` first, which Vue Router does carry — but
 * the activation page reads it on mount and did not reliably see it, landing
 * somebody on "this link cannot be used" one click after being invited to set
 * their password. A module ref has no such timing, and keeps the username out
 * of the URL, which was the reason for not using a query parameter.
 */
export const pendingActivation = ref(null)

export function portalSignIn (user) {
  portalUser.value = user
  try { sessionStorage.setItem(KEY, JSON.stringify(user)) } catch {}
}

export function portalSignOut () {
  portalUser.value = null
  try { sessionStorage.removeItem(KEY) } catch {}
}

/** Called once at startup; storage can throw or be empty, and that is fine. */
export function restorePortalSession () {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) portalUser.value = JSON.parse(raw)
  } catch {
    portalUser.value = null
  }
}
