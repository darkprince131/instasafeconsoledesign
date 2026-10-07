/**
 * Mock adapter — the demo's backend.
 *
 * Implements the contract in ../index.js against IndexedDB. It deliberately
 * behaves like an HTTP API rather than a local object store: list() takes
 * query params and returns {data, total, page}, writes are async, and there is
 * a small artificial latency so the UI's loading states are real rather than
 * theoretical.
 *
 * The important rule: everything genuinely computes. Posture checks evaluate
 * rules against a payload, the policy engine walks the rule table in priority
 * order, TOTP is verified with real crypto. Nothing returns a canned "pass".
 */

import { db, id } from '../../lib/db.js'
import { verifyTOTP, generateSecret, otpauthURI } from '../../lib/totp.js'
import { evaluateAccess, evaluatePosture } from '../../lib/policy.js'
import * as seed from '../seed.js'

const SEED_FLAG = 'i365.seeded.v1'
const LATENCY = [40, 140]   // ms — enough for spinners to be honest, not annoying

const wait = () => new Promise(r =>
  setTimeout(r, LATENCY[0] + Math.random() * (LATENCY[1] - LATENCY[0])))

/**
 * IndexedDB stores values with the structured clone algorithm, which throws
 * DataCloneError on a Proxy — and everything handed in from a Vue component
 * is a reactive proxy. Unwrapping here rather than in each component means no
 * caller has to remember, and it is also what a real HTTP adapter does
 * implicitly when it serialises the body to JSON.
 */
function plain (value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

// ------------------------------------------------------------- seeding
async function ensureSeeded () {
  if (localStorage.getItem(SEED_FLAG)) return
  await reseed()
}

async function reseed () {
  const users = seed.seedUsers()
  const groups = seed.seedGroups()
  seed.linkUsersToGroups(users, groups)   // membership, so group rules can match
  const apps = seed.seedApplications()
  const devices = seed.seedDevices(users)

  await db.putMany('users', users)
  await db.putMany('groups', groups)
  await db.putMany('devices', devices)
  await db.putMany('applications', apps)
  await db.putMany('appServices', seed.seedAppServices())
  await db.putMany('accessRules', seed.seedAccessRules(groups, apps))
  await db.putMany('controllers', seed.seedControllers())
  await db.putMany('gateways', seed.seedGateways())
  await db.putMany('authProfiles', seed.seedAuthProfiles())
  await db.putMany('deviceChecks', seed.seedDeviceChecks())
  await db.putMany('timeSchedules', seed.seedTimeSchedules())
  await db.putMany('geoFences', seed.seedGeoFences())
  await db.putMany('lockouts', seed.seedLockouts())
  await db.putMany('eventLog', seed.seedEvents(users))
  await db.putMany('sessions', seed.seedSessions(users, apps))

  localStorage.setItem(SEED_FLAG, new Date().toISOString())
}

// ------------------------------------------------------- query helpers
function matches (row, search, fields) {
  if (!search) return true
  const q = String(search).toLowerCase()
  const keys = fields || Object.keys(row)
  return keys.some(k => String(row[k] ?? '').toLowerCase().includes(q))
}

function applyFilters (rows, filters) {
  if (!filters) return rows
  return rows.filter(row => Object.entries(filters).every(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === 'all') return true
    if (Array.isArray(v)) return v.includes(row[k])
    if (typeof v === 'function') return v(row)
    return row[k] === v
  }))
}

function applySort (rows, sort, dir = 'asc') {
  if (!sort) return rows
  const s = [...rows].sort((a, b) => {
    const x = a[sort], y = b[sort]
    if (x === y) return 0
    if (x === null || x === undefined) return 1
    if (y === null || y === undefined) return -1
    return typeof x === 'number' ? x - y : String(x).localeCompare(String(y))
  })
  return dir === 'desc' ? s.reverse() : s
}

// --------------------------------------------------- the event log hook
/** Every meaningful write lands here, so the demo can prove it is wired. */
async function record (type, message, extra = {}) {
  const evt = {
    id: id('evt'),
    type,
    severity: extra.severity || 'info',
    actor: extra.actor || 'admin',
    message,
    ip: '49.205.12.8',
    city: 'Bengaluru',
    at: new Date().toISOString(),
    ...extra
  }
  await db.put('eventLog', evt)
  return evt
}

/** Anything that would leave the system in production goes to the inbox. */
async function toInbox (kind, subject, body, meta = {}) {
  const msg = {
    id: id('msg'),
    kind,                 // sms | email | push | webhook | siem | report
    subject, body, meta,
    read: false,
    at: new Date().toISOString()
  }
  await db.put('inbox', msg)
  return msg
}

// ------------------------------------------------------------ handlers
const handlers = {
  // ---- auth ----------------------------------------------------------
  async 'auth.login' ({ username, password }) {
    const users = await db.all('users')
    const user = users.find(u => u.username === username || u.email === username)
    if (!user) {
      await record('auth.login.failed', `Failed sign-in for ${username}`, { severity: 'warning' })
      return { ok: false, error: 'Unknown user or wrong password.' }
    }
    if (user.status === 'suspended') {
      await record('auth.login.failed', `${username} is suspended`, { severity: 'warning' })
      return { ok: false, error: 'This account is suspended.' }
    }
    // Demo: any non-empty password is accepted for seeded users. Real
    // password verification is the backend's job and is not simulated here.
    if (!password) return { ok: false, error: 'Enter a password.' }

    await record('auth.login.success', `${user.firstName} ${user.lastName} signed in`, { actor: user.username })
    return {
      ok: true,
      user,
      mfaRequired: user.mfaEnrolled,
      sessionToken: id('tok')
    }
  },

  async 'auth.verifyMfa' ({ userId, code }) {
    const user = await db.get('users', userId)
    if (!user?.mfaSecret) return { ok: false, error: 'MFA is not set up for this account.' }
    const ok = await verifyTOTP(user.mfaSecret, code)
    await record(
      ok ? 'auth.mfa.success' : 'auth.mfa.failed',
      ok ? `${user.firstName} passed MFA` : `${user.firstName} failed MFA`,
      { actor: user.username, severity: ok ? 'info' : 'warning' }
    )
    return ok ? { ok: true } : { ok: false, error: 'That code is not valid. Check the clock on your phone.' }
  },

  async 'auth.startMfaEnrolment' ({ userId }) {
    const user = await db.get('users', userId)
    const secret = generateSecret()
    // held unconfirmed until a correct code proves the phone has it
    await db.put('users', { ...user, mfaPendingSecret: secret })
    return {
      ok: true,
      secret,
      uri: otpauthURI({ secret, account: user.email, issuer: 'InstaSafe i365' })
    }
  },

  async 'auth.confirmMfaEnrolment' ({ userId, code }) {
    const user = await db.get('users', userId)
    if (!user?.mfaPendingSecret) return { ok: false, error: 'Start enrolment first.' }
    const ok = await verifyTOTP(user.mfaPendingSecret, code)
    if (!ok) return { ok: false, error: 'That code is not valid. Try the next one.' }
    await db.put('users', {
      ...user, mfaSecret: user.mfaPendingSecret, mfaPendingSecret: null, mfaEnrolled: true
    })
    await record('auth.mfa.enrolled', `${user.firstName} enrolled an authenticator`, { actor: user.username })
    return { ok: true }
  },

  async 'auth.resetMfa' ({ userId }) {
    const user = await db.get('users', userId)
    await db.put('users', { ...user, mfaSecret: null, mfaPendingSecret: null, mfaEnrolled: false })
    await record('auth.mfa.reset', `MFA reset for ${user.firstName} ${user.lastName}`, { severity: 'warning' })
    return { ok: true }
  },

  /** SMS and email OTP: the flow is real, the delivery lands in the inbox. */
  async 'auth.sendOtp' ({ userId, channel = 'sms' }) {
    const user = await db.get('users', userId)
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const key = `otp:${userId}`
    sessionStorage.setItem(key, JSON.stringify({ code, at: Date.now() }))
    const to = channel === 'sms' ? `+${user.countryCode} ${user.mobile}` : user.email
    await toInbox(channel,
      channel === 'sms' ? `Verification code` : `Your InstaSafe verification code`,
      `${code} is your InstaSafe verification code. It expires in 5 minutes.`,
      { to, code })
    return { ok: true, sentTo: to, hint: 'Open the Demo Inbox to read it.' }
  },

  async 'auth.verifyOtp' ({ userId, code }) {
    const raw = sessionStorage.getItem(`otp:${userId}`)
    if (!raw) return { ok: false, error: 'No code was sent. Request one first.' }
    const { code: expected, at } = JSON.parse(raw)
    if (Date.now() - at > 5 * 60 * 1000) return { ok: false, error: 'That code has expired.' }
    if (String(code) !== expected) return { ok: false, error: 'That code is not valid.' }
    sessionStorage.removeItem(`otp:${userId}`)
    return { ok: true }
  },

  async 'auth.logout' () { return { ok: true } },
  async 'auth.me' () { return db.get('users', 'usr_00000') },

  // ---- users ---------------------------------------------------------
  async 'users.suspend' ({ id: uid }) {
    const u = await db.get('users', uid)
    await db.put('users', { ...u, status: 'suspended' })
    await record('user.suspended', `${u.firstName} ${u.lastName} was suspended`, { severity: 'warning' })
    return { ok: true }
  },
  async 'users.activate' ({ id: uid }) {
    const u = await db.get('users', uid)
    await db.put('users', { ...u, status: 'active' })
    await record('user.activated', `${u.firstName} ${u.lastName} was activated`)
    return { ok: true }
  },

  // ---- devices -------------------------------------------------------
  async 'devices.approve' ({ id: did }) {
    const d = await db.get('devices', did)
    await db.put('devices', { ...d, status: 'approved', bound: true })
    await record('device.approved', `Device ${d.name} approved`)
    return { ok: true }
  },
  async 'devices.reject' ({ id: did }) {
    const d = await db.get('devices', did)
    await db.put('devices', { ...d, status: 'rejected', bound: false })
    await record('device.rejected', `Device ${d.name} rejected`, { severity: 'warning' })
    return { ok: true }
  },
  async 'devices.approveMany' ({ ids }) {
    const all = await db.all('devices')
    const hit = all.filter(d => ids.includes(d.id))
    await db.putMany('devices', hit.map(d => ({ ...d, status: 'approved', bound: true })))
    await record('device.approved', `${ids.length} devices approved in bulk`)
    return { ok: true, count: ids.length }
  },

  /**
   * Binds the actual browser this demo is running in, as a device.
   * The fingerprint is real — platform, screen, timezone, hardware — so the
   * "this device is already bound, a second one needs approval" story is
   * genuinely demonstrable rather than narrated.
   */
  async 'devices.bind' ({ userId }) {
    const fp = [
      navigator.platform, navigator.hardwareConcurrency,
      screen.width + 'x' + screen.height, screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language
    ].join('|')
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fp))
    const hash = Array.from(new Uint8Array(buf)).slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0')).join('')

    const user = await db.get('users', userId)
    const existing = (await db.all('devices')).find(d => d.fingerprint === hash)
    if (existing) return { ok: true, device: existing, alreadyBound: true }

    const device = {
      id: id('dev'),
      name: `${user.firstName}-ThisBrowser`,
      userId, username: user.username,
      os: navigator.platform,
      osFamily: navigator.platform.includes('Win') ? 'Windows' : navigator.platform.includes('Mac') ? 'macOS' : 'Linux',
      agentVersion: '4.8.2 (browser)',
      fingerprint: hash,
      macAddress: '—', ipAddress: '—',
      status: 'pending', bound: false,
      city: Intl.DateTimeFormat().resolvedOptions().timeZone,
      lastSeenAt: new Date().toISOString(),
      enrolledAt: new Date().toISOString(),
      posture: {
        diskEncryption: true, antivirus: true, firewall: true,
        osUpToDate: true, screenLock: true, jailbroken: false
      },
      isThisBrowser: true
    }
    await db.put('devices', device)
    await record('device.enrolled', `${user.firstName} enrolled this browser as a device`)
    return { ok: true, device, fingerprint: hash }
  },

  /** Genuinely evaluates posture rules against a payload. Nothing canned. */
  async 'deviceChecks.evaluate' ({ posture: rawPosture, checkIds }) {
    const posture = plain(rawPosture)
    let checks = await db.all('deviceChecks')
    if (checkIds?.length) checks = checks.filter(c => checkIds.includes(c.id))
    const results = checks.filter(c => c.enabled).map(c => {
      const actual = posture?.[c.postureKey]
      const pass = actual === c.expect
      return {
        id: c.id, name: c.name, postureKey: c.postureKey,
        expected: c.expect, actual, pass, severity: c.severity
      }
    })
    const failed = results.filter(r => !r.pass)
    const blocking = failed.filter(r => r.severity === 'critical')
    return {
      ok: true, results,
      passed: results.length - failed.length,
      failed: failed.length,
      verdict: blocking.length ? 'blocked' : failed.length ? 'warn' : 'pass',
      reason: blocking.length
        ? `${blocking.length} critical check${blocking.length > 1 ? 's' : ''} failed: ${blocking.map(b => b.name).join(', ')}`
        : failed.length ? `${failed.length} non-critical check${failed.length > 1 ? 's' : ''} failed`
        : 'All checks passed'
    }
  },

  // ---- the policy engine ---------------------------------------------
  /**
   * The access explorer. Walks the rule table in priority order and returns
   * the decision plus the rule that made it and every rule considered — which
   * is the question the real console cannot answer today.
   */
  async 'accessRules.evaluate' ({ userId, applicationId, at, posture: rawPosture }) {
    const posture = plain(rawPosture)
    const user = await db.get('users', userId)
    const app = await db.get('applications', applicationId)
    if (!user || !app) return { ok: false, error: 'Pick a user and an application.' }

    const groups = await db.all('groups')
    const rules = (await db.all('accessRules'))
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority)

    const userGroupNames = groups
      .filter(g => (user.groups || []).includes(g.id) || g.name === user.department)
      .map(g => g.name)

    const considered = []
    let decision = null

    for (const rule of rules) {
      const sourceHit =
        (rule.sourceType === 'group' && userGroupNames.includes(rule.source)) ||
        (rule.sourceType === 'user' && rule.source === user.username)
      const destHit = rule.destType === 'application' && rule.dest === app.name
      const hit = sourceHit && destHit
      considered.push({ ...rule, matched: hit, skippedBy: hit && decision ? decision.id : null })
      if (hit && !decision) decision = rule
    }

    // posture gate — a critical failure overrides an allow
    let postureVerdict = null
    if (posture) {
      postureVerdict = await handlers['deviceChecks.evaluate']({ posture })
    }

    let outcome = decision ? decision.action : 'deny'
    let because = decision
      ? `Rule #${decision.priority} "${decision.name}" (${decision.action})`
      : 'No rule matched. Default policy is deny.'

    if (outcome === 'allow' && postureVerdict?.verdict === 'blocked') {
      outcome = 'deny'
      because = `Rule #${decision.priority} allows this, but the device failed posture: ${postureVerdict.reason}`
    }

    await record(
      outcome === 'allow' ? 'access.granted' : 'access.denied',
      `${user.firstName} ${user.lastName} ${outcome === 'allow' ? 'reached' : 'was denied'} ${app.name}`,
      { severity: outcome === 'allow' ? 'info' : 'warning', actor: user.username }
    )

    return {
      ok: true, outcome, because,
      user: { id: user.id, name: `${user.firstName} ${user.lastName}`, groups: userGroupNames },
      application: { id: app.id, name: app.name, type: app.type },
      decidedBy: decision || null,
      considered,
      posture: postureVerdict,
      shadowed: considered.filter(c => c.matched && c.skippedBy)
    }
  },

  // ---- controllers ---------------------------------------------------
  async 'controllers.action' ({ id: cid, action }) {
    const c = await db.get('controllers', cid)
    const next = { stop: 'stopped', restart: 'restarting', commit: 'running' }[action]
    await db.put('controllers', {
      ...c, status: next, pendingCommit: action === 'commit' ? false : c.pendingCommit
    })
    await record(`controller.${action}`, `${c.name} — ${action}`, { severity: action === 'stop' ? 'warning' : 'info' })
    // restarting settles back to running, so the state machine is visibly live
    if (action === 'restart') {
      setTimeout(async () => {
        const cur = await db.get('controllers', cid)
        await db.put('controllers', { ...cur, status: 'running' })
      }, 4000)
    }
    return { ok: true, status: next }
  },

  // ---- misc ----------------------------------------------------------
  async 'events.record' (payload) { return record(payload.type, payload.message, payload) },
  async 'inbox.markRead' ({ id: mid }) {
    const m = await db.get('inbox', mid)
    await db.put('inbox', { ...m, read: true })
    return { ok: true }
  },
  async 'inbox.clear' () { await db.clear('inbox'); return { ok: true } },

  async 'settings.get' ({ key }) {
    const row = await db.get('settings', key)
    return row?.value ?? null
  },
  async 'settings.set' ({ key, value }) {
    await db.put('settings', plain({ id: key, value }))
    return { ok: true }
  },

  async 'stats' () {
    const [users, devices, sessions, gateways, rules, apps] = await Promise.all([
      db.all('users'), db.all('devices'), db.all('sessions'),
      db.all('gateways'), db.all('accessRules'), db.all('applications')
    ])
    return {
      users: users.length,
      usersActive: users.filter(u => u.status === 'active').length,
      usersWithoutMfa: users.filter(u => !u.mfaEnrolled).length,
      usersSuspended: users.filter(u => u.status === 'suspended').length,
      devices: devices.length,
      devicesPending: devices.filter(d => d.status === 'pending').length,
      sessionsLive: sessions.filter(s => s.status === 'active').length,
      gateways: gateways.length,
      gatewaysUp: gateways.filter(g => g.status === 'up').length,
      rules: rules.length,
      applications: apps.length,
      licences: { used: users.length, total: 2000 }
    }
  },

  async 'demo.reset' () {
    await db.clearAll()
    localStorage.removeItem(SEED_FLAG)
    await reseed()
    return { ok: true }
  },
  async 'demo.seeded' () { return !!localStorage.getItem(SEED_FLAG) }
}

// -------------------------------------------------------- the adapter
export const mockAdapter = {
  async list (store, params = {}) {
    await ensureSeeded(); await wait()
    let rows = await db.all(store)
    rows = rows.filter(r => matches(r, params.search, params.searchFields))
    rows = applyFilters(rows, params.filters)
    rows = applySort(rows, params.sort, params.dir)
    const total = rows.length
    const page = params.page || 1
    const perPage = params.perPage || 25
    if (params.perPage !== 0) rows = rows.slice((page - 1) * perPage, page * perPage)
    return { data: rows, total, page, perPage, pages: Math.ceil(total / perPage) }
  },

  async get (store, rid) { await ensureSeeded(); await wait(); return db.get(store, rid) },

  async create (store, body) {
    await ensureSeeded(); await wait()
    const row = plain({ id: body.id || id(store.slice(0, 3)), createdAt: new Date().toISOString(), ...body })
    await db.put(store, row)
    await record(`${store}.created`, `Created ${row.name || row.username || row.id} in ${store}`)
    return row
  },

  async update (store, rid, body) {
    await ensureSeeded(); await wait()
    const existing = await db.get(store, rid)
    const row = plain({ ...existing, ...body, id: rid, updatedAt: new Date().toISOString() })
    await db.put(store, row)
    await record(`${store}.updated`, `Updated ${row.name || row.username || rid}`)
    return row
  },

  async remove (store, rid) {
    await ensureSeeded(); await wait()
    const row = await db.get(store, rid)
    await db.remove(store, rid)
    await record(`${store}.deleted`, `Deleted ${row?.name || row?.username || rid}`, { severity: 'warning' })
    return { ok: true }
  },

  async removeMany (store, ids) {
    await ensureSeeded(); await wait()
    await db.removeMany(store, ids)
    await record(`${store}.deleted`, `Deleted ${ids.length} records from ${store}`, { severity: 'warning' })
    return { ok: true, count: ids.length }
  },

  async count (store, params = {}) {
    await ensureSeeded()
    let rows = await db.all(store)
    rows = applyFilters(rows, params.filters)
    return rows.length
  },

  async call (name, payload = {}) {
    await ensureSeeded()
    const fn = handlers[name]
    if (!fn) throw new Error(`No mock handler for "${name}"`)
    if (name !== 'stats') await wait()
    return fn(payload)
  }
}

export default mockAdapter
