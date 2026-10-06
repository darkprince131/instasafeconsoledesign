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
      const applications = seed.seedApplications()
      const devices = seed.seedDevices(users, SEED_SIZE.devices)
      await request('/seed', {
        method: 'POST',
        body: {
          users, groups, applications, devices,
          appServices: seed.seedAppServices(),
          accessRules: seed.seedAccessRules(groups, applications),
          controllers: seed.seedControllers(),
          gateways: seed.seedGateways(),
          authProfiles: seed.seedAuthProfiles(),
          deviceChecks: seed.seedDeviceChecks(),
          timeSchedules: seed.seedTimeSchedules(),
          geoFences: seed.seedGeoFences(),
          eventLog: seed.seedEvents(users, SEED_SIZE.events),
          sessions: seed.seedSessions(users, applications)
        }
      })
    })()
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

      /* Everything else — the policy engine, posture evaluation, device
         binding — is pure logic over rows. It runs client-side here and
         belongs server-side in production; the mock adapter holds those
         implementations and they are the reference for the Laravel versions. */
      const { mockAdapter } = await import('./mock.js')
      return mockAdapter.call(name, payload)
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
const SEED_SIZE = { users: 420, devices: 540, events: 300 }

export default httpAdapter
