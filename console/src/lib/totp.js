/**
 * TOTP — RFC 6238, for real.
 *
 * This is not a simulation. It is HMAC-SHA1 over a 30-second counter via Web
 * Crypto, which is the same algorithm Google Authenticator, Authy, 1Password
 * and Microsoft Authenticator implement. Scan the QR, and the code on the
 * phone is the code this verifies. A wrong code is rejected.
 *
 * That matters for the demo: MFA is the capability people are most sceptical
 * about, and this one can be proved in ten seconds with someone's own phone.
 *
 * Developers keep this file. It is production-correct; the only thing a real
 * backend changes is where the secret is stored (server-side, not IndexedDB).
 */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Cryptographically random base32 secret. 20 bytes = 160 bits, per the RFC. */
export function generateSecret (bytes = 20) {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  let out = '', bits = 0, value = 0
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

function base32Decode (input) {
  const clean = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()
  let bits = 0, value = 0
  const out = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx === -1) throw new Error(`Invalid base32 character: ${ch}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/**
 * The code for a given secret and moment.
 * @param {string} secret base32
 * @param {object} opts  {digits=6, period=30, timestamp=Date.now()}
 */
export async function generateTOTP (secret, opts = {}) {
  const { digits = 6, period = 30, timestamp = Date.now() } = opts
  const counter = Math.floor(timestamp / 1000 / period)

  // counter as a 64-bit big-endian value
  const msg = new ArrayBuffer(8)
  const view = new DataView(msg)
  view.setUint32(0, Math.floor(counter / 0x100000000))
  view.setUint32(4, counter >>> 0)

  const key = await crypto.subtle.importKey(
    'raw', base32Decode(secret),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))

  // dynamic truncation, RFC 4226 §5.3
  const offset = sig[sig.length - 1] & 0x0f
  const bin =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff)

  return String(bin % 10 ** digits).padStart(digits, '0')
}

/**
 * Verify a user-supplied code.
 *
 * `window` allows one step either side, which absorbs clock drift between the
 * phone and this machine. That is what real implementations do; without it,
 * perfectly correct codes get rejected near a period boundary.
 */
export async function verifyTOTP (secret, token, opts = {}) {
  const { window = 1, period = 30, digits = 6, timestamp = Date.now() } = opts
  const candidate = String(token || '').replace(/\s/g, '')
  if (!/^\d+$/.test(candidate) || candidate.length !== digits) return false

  for (let drift = -window; drift <= window; drift++) {
    const expected = await generateTOTP(secret, {
      digits, period, timestamp: timestamp + drift * period * 1000
    })
    // constant-time-ish compare; the real win is not short-circuiting on the
    // first differing digit
    if (expected.length === candidate.length) {
      let diff = 0
      for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i)
      }
      if (diff === 0) return true
    }
  }
  return false
}

/** Seconds left in the current step — drives the countdown ring in the UI. */
export function secondsRemaining (period = 30) {
  return period - (Math.floor(Date.now() / 1000) % period)
}

/** The otpauth:// URI an authenticator app expects behind a QR code. */
export function otpauthURI ({ secret, account, issuer = 'InstaSafe', digits = 6, period = 30 }) {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({
    secret, issuer, algorithm: 'SHA1', digits: String(digits), period: String(period)
  })
  return `otpauth://totp/${label}?${params.toString()}`
}
