/**
 * Passwords, hashed properly.
 *
 * PBKDF2-HMAC-SHA256 over Web Crypto, 210,000 iterations — OWASP's 2023
 * floor for this algorithm — with a 16-byte random salt per password and a
 * 32-byte derived key. The same primitive the TOTP module uses, and like it,
 * this file is production-correct and would ship unchanged; only *where* it
 * runs is a demo compromise.
 *
 * In production the derivation happens on the server and the password never
 * leaves the TLS session as anything a browser holds. Here there is no
 * server, so it runs in the page. What matters for the demo is that the
 * stored value is a real hash and not the password: the record this console
 * keeps could be handed to anybody and it would not give them an account.
 *
 * The format is the usual self-describing one, so a backend can verify a
 * hash this console produced without being told the parameters:
 *
 *   pbkdf2$sha256$210000$<salt-b64>$<hash-b64>
 */

const ITERATIONS = 210_000
const KEY_BITS = 256
const SALT_BYTES = 16

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

async function derive (password, salt, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, KEY_BITS
  )
}

/** Hash a password for storage. Returns the encoded string above. */
export async function hashPassword (password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const bits = await derive(password, salt)
  return `pbkdf2$sha256$${ITERATIONS}$${b64(salt)}$${b64(bits)}`
}

/**
 * Check a password against a stored hash.
 *
 * The comparison is constant-time in the sense that matters here: it walks
 * every byte rather than returning at the first difference, so the time
 * taken does not leak how much of the hash was right.
 */
export async function verifyPassword (password, stored) {
  if (!stored || typeof stored !== 'string') return false
  const [scheme, algo, iterStr, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2' || algo !== 'sha256') return false
  const iterations = Number(iterStr)
  if (!Number.isFinite(iterations) || iterations < 1000) return false

  let bits
  try {
    bits = await derive(password, unb64(saltB64), iterations)
  } catch { return false }

  const a = new Uint8Array(bits)
  const b = unb64(hashB64)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * The rules, in one place.
 *
 * The sign-up form shows these as they are met, and the same function decides
 * whether a password is accepted — so the list on screen cannot drift away
 * from what is actually enforced, which is the usual way these two disagree.
 */
export function passwordRules (value, { username = '' } = {}) {
  const v = value || ''
  const name = (username || '').toLowerCase()
  return [
    { key: 'len', ok: v.length >= 12, text: 'At least 12 characters' },
    { key: 'case', ok: /[a-z]/.test(v) && /[A-Z]/.test(v), text: 'Upper and lower case' },
    { key: 'digit', ok: /\d/.test(v), text: 'A digit' },
    { key: 'symbol', ok: /[^A-Za-z0-9]/.test(v), text: 'A symbol' },
    /* A password containing the username is the commonest thing a rule list
       forgets to forbid and the first thing an attacker tries. */
    { key: 'name', ok: !!v && (!name || !v.toLowerCase().includes(name)),
      text: 'Does not contain your username' }
  ]
}

export function passwordOk (value, opts) {
  return passwordRules(value, opts).every(r => r.ok)
}

/**
 * An invite token.
 *
 * Random, URL-safe, and long enough that guessing one is not a strategy:
 * 24 bytes is 192 bits of entropy. In production this is stored hashed with
 * an expiry and a single-use flag, exactly as a password reset token is.
 */
export function inviteToken (bytes = 24) {
  return b64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
