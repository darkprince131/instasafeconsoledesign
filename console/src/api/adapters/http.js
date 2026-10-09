/**
 * HTTP adapter — the real backend.
 *
 * Implements the same contract as mockAdapter, against the Netlify Function
 * in netlify/functions/api.mjs, which talks to Neon Postgres.
 *
 * Switching the app over is one line in ../index.js:
 *
 *   import { httpAdapter } from './adapters/http.js'
 *   const adapter = httpAdapter({ baseURL: '/api' })
 *
 * No component changes, because nothing outside this folder knows which
 * adapter is underneath.
 *
 * The tenant is NOT sent from here. The server derives it from a signed
 * HttpOnly cookie, so a visitor cannot address another visitor's data even
 * by editing the request. `credentials: 'same-origin'` is what carries it.
 */

import * as seed from '../seed.js'
import { verifyTOTP, generateSecret, otpauthURI } from '../../lib/totp.js'
import { evaluateAccess, evaluatePosture, browserFingerprint } from '../../lib/policy.js'

export function httpAdapter ({ baseURL = '/api' } = {}) {
  async function request (path, { method = 'GET', body, params } = {}) {
    const url = new URL(baseURL + path, location.origin)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
      }
    }
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`)
    if (data.error) throw new Error(data.error)
    return data
  }

  /* On a visitor's first arrival their tenant is empty, so the client
     generates the seed and posts it. Keeping generation in src/api/seed.js
     means there is one definition of the demo data rather than two that
     drift apart. */
  let seeding = null
  async function ensureSeeded () {
    if (seeding) return seeding
    seeding = (async () => {
      const { seeded } = await request('/seeded')
      if (seeded) return

      const users = seed.seedUsers(SEED_SIZE.users)
      const groups = seed.seedGroups()
      seed.linkUsersToGroups(users, groups)   // membership, so group rules can match
      const applications = seed.seedApplications()

      /* One request per resource, not one request for everything.
         A single payload meant a single function invocation doing twenty-odd
         round trips to Neon, which runs past Netlify's ten-second limit - and
         a timeout mid-seed leaves a tenant holding whatever happened to have
         been written before the clock ran out. Resource by resource, each
         call is small, and a failure is both visible and retryable. */
      const batches = [
        ['groups', groups],
        ['applications', applications],
        ['appGroups', seed.seedAppGroups(applications)],
        ['appServices', seed.seedAppServices()],
        ['accessRules', seed.seedAccessRules(groups, applications)],
        ['controllers', seed.seedControllers()],
        ['gateways', seed.seedGateways()],
        ['authProfiles', seed.seedAuthProfiles()],
        ['deviceChecks', seed.seedDeviceChecks()],
        ['timeSchedules', seed.seedTimeSchedules()],
        ['riskProfiles', seed.seedRiskProfiles()],
        ['geoFences', seed.seedGeoFences()],
        ['lockouts', seed.seedLockouts()],
        ['softwarePackages', seed.seedSoftwarePackages()],
        ['users', users],
        ['devices', seed.seedDevices(users, SEED_SIZE.devices)],
        ['sessions', seed.seedSessions(users, applications)],
        ['eventLog', seed.seedEvents(users, SEED_SIZE.events, applications)]
      ]
      /* The small reference tables go first, so a slow tail cannot leave the
         console without the rows every screen depends on.

         Each resource is then posted in slices rather than whole. Posting
         1,821 users in one request ran the function past its time limit
         partway through the server's own 200-row chunks, and because those
         inserts are not in a transaction the rows already written stayed:
         every visitor got exactly 421 users, deterministically, with a
         successful-looking seed and no error anywhere. A slice that fails now
         fails on its own and is small enough to finish. */
      const SLICE = 300
      for (const [resource, rows] of batches) {
        if (!rows?.length) continue
        for (let i = 0; i < rows.length; i += SLICE) {
          await request('/seed', { method: 'POST', body: { [resource]: rows.slice(i, i + SLICE) } })
        }
      }
    })()
    try {
      await seeding
    } catch (err) {
      seeding = null          // let the next call retry rather than wedging
      throw err
    }
    return seeding
  }

  return {
    async list (resource, params = {}) {
      await ensureSeeded()
      const q = {
        page: params.page, perPage: params.perPage,
        search: params.search, sort: params.sort, dir: params.dir
      }
      for (const [k, v] of Object.entries(params.filters || {})) {
        if (typeof v !== 'function') q['f.' + k] = v
      }
      return request('/' + resource, { params: q })
    },

    async get (resource, id) {
      await ensureSeeded()
      return request(`/${resource}/${id}`)
    },

    async create (resource, body) {
      await ensureSeeded()
      return request('/' + resource, { method: 'POST', body })
    },

    async update (resource, id, body) {
      await ensureSeeded()
      return request(`/${resource}/${id}`, { method: 'PUT', body })
    },

    async remove (resource, id) {
      await ensureSeeded()
      return request(`/${resource}/${id}`, { method: 'DELETE' })
    },

    async removeMany (resource, ids) {
      await ensureSeeded()
      return request(`/${resource}/bulk-delete`, { method: 'POST', body: { ids } })
    },

    async count (resource, params = {}) {
      const res = await this.list(resource, { ...params, perPage: 1 })
      return res.total
    },

    async call (name, payload = {}) {
      await ensureSeeded()

      /* TOTP stays on the client in the demo because the secret lives in the
         users row and the verification is pure computation. In production
         this moves server-side: the secret must never reach the browser.
         src/lib/totp.js itself is production-correct and ships unchanged —
         only where it runs changes. */
      if (name === 'auth.startMfaEnrolment') {
        const user = await request(`/users/${payload.userId}`)
        const secret = generateSecret()
        await request(`/users/${payload.userId}`, {
          method: 'PUT', body: { mfaPendingSecret: secret }
        })
        return {
          ok: true, secret,
          uri: otpauthURI({ secret, account: user.email, issuer: 'InstaSafe i365' })
        }
      }

      if (name === 'auth.confirmMfaEnrolment') {
        const user = await request(`/users/${payload.userId}`)
        if (!user?.mfaPendingSecret) return { ok: false, error: 'Start enrolment first.' }
        const ok = await verifyTOTP(user.mfaPendingSecret, payload.code)
        if (!ok) return { ok: false, error: 'That code is not valid. Try the next one.' }
        await request(`/users/${payload.userId}`, {
          method: 'PUT',
          body: { mfaSecret: user.mfaPendingSecret, mfaPendingSecret: null, mfaEnrolled: true }
        })
        await this.call('events.record', {
          type: 'auth.mfa.enrolled',
          message: `${user.firstName} enrolled an authenticator`
        })
        return { ok: true }
      }

      if (name === 'auth.verifyMfa') {
        const user = await request(`/users/${payload.userId}`)
        if (!user?.mfaSecret) return { ok: false, error: 'MFA is not set up for this account.' }
        const ok = await verifyTOTP(user.mfaSecret, payload.code)
        return ok ? { ok: true }
          : { ok: false, error: 'That code is not valid. Check the clock on your phone.' }
      }

      if (name === 'auth.resetMfa') {
        await request(`/users/${payload.userId}`, {
          method: 'PUT', body: { mfaSecret: null, mfaPendingSecret: null, mfaEnrolled: false }
        })
        return { ok: true }
      }

      if (name === 'stats') return request('/stats')

      if (name === 'events.record') {
        return request('/eventLog', {
          method: 'POST',
          body: {
            id: 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            type: payload.type, severity: payload.severity || 'info',
            actor: payload.actor || 'admin', message: payload.message,
            ip: '49.205.12.8', city: 'Bengaluru', at: new Date().toISOString()
          }
        })
      }

      if (name === 'demo.reset') {
        await request('/reset', { method: 'POST' })
        seeding = null
        await ensureSeeded()
        return { ok: true }
      }

      if (name === 'demo.seeded') return request('/seeded')

      /* The compute-only calls. These used to fall through to the mock
         adapter, which reads IndexedDB - so on this backend the access
         explorer was evaluating a different copy of the data entirely and
         returning a confident answer about the wrong tenant.
         They now run the shared engine in lib/policy.js over rows fetched
         from this backend. In production the same functions move server-side;
         nothing about them changes. */

      if (name === 'deviceChecks.evaluate') {
        const checks = (await request('/deviceChecks', { params: { perPage: 0 } })).data
        return evaluatePosture(checks, payload.posture)
      }

      if (name === 'accessRules.evaluate') {
        const [user, application, groupsRes, rulesRes, schedRes] = await Promise.all([
          request(`/users/${payload.userId}`),
          request(`/applications/${payload.applicationId}`),
          request('/groups', { params: { perPage: 0 } }),
          request('/accessRules', { params: { perPage: 0 } }),
          /* A rule can be limited to a shift. Without the schedules here the
             engine cannot tell whether it is in its window. */
          request('/timeSchedules', { params: { perPage: 0 } })
        ])
        let postureVerdict = null
        if (payload.posture) {
          const checks = (await request('/deviceChecks', { params: { perPage: 0 } })).data
          postureVerdict = evaluatePosture(checks, payload.posture)
        }
        const result = evaluateAccess({
          user, application, groups: groupsRes.data, rules: rulesRes.data,
          schedules: schedRes.data, postureVerdict
        })
        if (result.ok) {
          await this.call('events.record', {
            type: result.outcome === 'allow' ? 'access.granted' : 'access.denied',
            message: `${result.user.name} ${result.outcome === 'allow' ? 'reached' : 'was denied'} ${application.name}`,
            severity: result.outcome === 'allow' ? 'info' : 'warning',
            actor: user.username
          })
        }
        return result
      }

      if (name === 'devices.bind') {
        const hash = await browserFingerprint()
        const existing = (await request('/devices', { params: { perPage: 0, search: hash } }))
          .data.find(d => d.fingerprint === hash)
        if (existing) return { ok: true, device: existing, alreadyBound: true }

        const user = await request(`/users/${payload.userId}`)
        const device = await request('/devices', {
          method: 'POST',
          body: {
            name: `${user.firstName}-ThisBrowser`,
            userId: user.id, username: user.username,
            os: navigator.platform,
            osFamily: navigator.platform.includes('Win') ? 'Windows'
              : navigator.platform.includes('Mac') ? 'macOS' : 'Linux',
            agentVersion: '4.8.2 (browser)',
            fingerprint: hash, macAddress: '—', ipAddress: null,
            status: 'pending', bound: false,
            city: Intl.DateTimeFormat().resolvedOptions().timeZone,
            lastSeenAt: new Date().toISOString(),
            posture: {
              diskEncryption: true, antivirus: true, firewall: true,
              osUpToDate: true, screenLock: true, jailbroken: false
            },
            isThisBrowser: true
          }
        })
        await this.call('events.record', {
          type: 'device.enrolled',
          message: `${user.firstName} enrolled this browser as a device`
        })
        return { ok: true, device, fingerprint: hash }
      }

      if (name === 'devices.approve' || name === 'devices.reject') {
        const approve = name === 'devices.approve'
        await request(`/devices/${payload.id}`, {
          method: 'PUT', body: { status: approve ? 'approved' : 'rejected', bound: approve }
        })
        return { ok: true }
      }

      if (name === 'devices.approveMany') {
        for (const id of payload.ids || []) {
          await request(`/devices/${id}`, { method: 'PUT', body: { status: 'approved', bound: true } })
        }
        await this.call('events.record', {
          type: 'device.approved', message: `${(payload.ids || []).length} devices approved in bulk`
        })
        return { ok: true, count: (payload.ids || []).length }
      }

      if (name === 'users.suspend' || name === 'users.activate') {
        const status = name === 'users.suspend' ? 'suspended' : 'active'
        await request(`/users/${payload.id}`, { method: 'PUT', body: { status } })
        return { ok: true }
      }

      if (name === 'controllers.action') {
        const next = { stop: 'stopped', restart: 'restarting', commit: 'running' }[payload.action]
        await request(`/controllers/${payload.id}`, {
          method: 'PUT',
          body: { status: next, ...(payload.action === 'commit' ? { pendingCommit: false } : {}) }
        })
        if (payload.action === 'restart') {
          setTimeout(() => request(`/controllers/${payload.id}`, {
            method: 'PUT', body: { status: 'running' }
          }).catch(() => {}), 4000)
        }
        return { ok: true, status: next }
      }

      if (name === 'inbox.markRead') {
        await request(`/inbox/${payload.id}`, { method: 'PUT', body: { read: true } })
        return { ok: true }
      }

      if (name === 'inbox.clear') {
        const { data } = await request('/inbox', { params: { perPage: 0 } })
        if (data.length) {
          await request('/inbox/bulk-delete', { method: 'POST', body: { ids: data.map(m => m.id) } })
        }
        return { ok: true }
      }

      if (name === 'settings.get') {
        const { data } = await request('/records', { params: { perPage: 0, 'f.kind': 'setting' } })
          .catch(() => ({ data: [] }))
        return data.find(r => r.name === payload.key)?.value ?? null
      }

      if (name === 'settings.set') {
        const { data } = await request('/records', { params: { perPage: 0, 'f.kind': 'setting' } })
          .catch(() => ({ data: [] }))
        const existing = data.find(r => r.name === payload.key)
        if (existing) {
          await request(`/records/${existing.id}`, { method: 'PUT', body: { value: payload.value } })
        } else {
          await request('/records', {
            method: 'POST', body: { kind: 'setting', name: payload.key, value: payload.value }
          })
        }
        return { ok: true }
      }

      if (name === 'auth.me') {
        const { data } = await request('/users', { params: { perPage: 1, search: 'admin' } })
        return data[0] || null
      }

      throw new Error(`No HTTP implementation for "${name}"`)
    }
  }
}

/**
 * Seed size for the hosted backend.
 *
 * Deliberately smaller than the IndexedDB demo, which seeds to the measured
 * production numbers (1,820 users / 2,140 devices). Every visitor gets their
 * own tenant, and Neon's free tier is 0.5 GB — at full production scale that
 * is roughly 5,000 rows and ~5 MB per visitor, so a hundred visitors would
 * fill it.
 *
 * These numbers still exercise everything that matters: pagination, search
 * across pages, bulk selection spanning a page boundary, and a pending queue
 * too long to clear by hand. Raise them if the tier is raised.
 */
/* Production scale, which is what this demo claims to be: 1,820 users, 2,140
   devices, 794 events. These were capped at 420/540/300 because the whole set
   went up in one request and a big one ran past the function's time limit.
   The seed is posted in slices of 300 now, so the cap is no longer buying
   anything except a console a quarter the size of the one being demonstrated. */
const SEED_SIZE = { users: 1820, devices: 2140, events: 794 }

export default httpAdapter
