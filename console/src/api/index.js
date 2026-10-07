/**
 * The API contract.
 *
 * This is the whole surface the console talks to. Components never touch
 * IndexedDB, never touch axios — they call `api.users.list()` and get a
 * promise back. That indirection is the entire handoff story:
 *
 *   today    adapter = mock   → IndexedDB in the browser
 *   later    adapter = http   → axios → Laravel
 *
 * Swapping is changing the import on the next line. Every component, route,
 * form and table keeps working untouched, because the shapes are the same.
 *
 * Each method below is annotated with the HTTP call a real backend would
 * serve, so the Laravel routes can be written straight off this file.
 */

import { mockAdapter } from './adapters/mock.js'
import { httpAdapter } from './adapters/http.js'

/* Which backend is live is a build-time environment variable, not an edit
   here, so switching is a Netlify setting and a redeploy rather than a
   commit - and rolling back is the same, instantly.

     VITE_BACKEND=http   Neon Postgres via /api  (netlify/functions/api.mjs)
     anything else       IndexedDB in the browser

   Nothing below this line, and nothing in any component, knows which. */
const adapter = import.meta.env.VITE_BACKEND === 'http'
  ? httpAdapter({ baseURL: '/api' })
  : mockAdapter

export const BACKEND = import.meta.env.VITE_BACKEND === 'http' ? 'postgres' : 'browser'

/**
 * Builds a standard CRUD surface over one collection.
 * GET /x · GET /x/:id · POST /x · PUT /x/:id · DELETE /x/:id · POST /x/bulk-delete
 */
function resource (name) {
  return {
    list: (params) => adapter.list(name, params),
    get: (id) => adapter.get(name, id),
    create: (body) => adapter.create(name, body),
    update: (id, body) => adapter.update(name, id, body),
    remove: (id) => adapter.remove(name, id),
    removeMany: (ids) => adapter.removeMany(name, ids),
    count: (params) => adapter.count(name, params)
  }
}

export const api = {
  // ---- identity -------------------------------------------------------
  auth: {
    /** POST /auth/login */
    login: (payload) => adapter.call('auth.login', payload),
    /** POST /auth/verify-mfa — real TOTP verification */
    verifyMfa: (payload) => adapter.call('auth.verifyMfa', payload),
    /** POST /auth/logout */
    logout: () => adapter.call('auth.logout'),
    /** GET /auth/me */
    me: () => adapter.call('auth.me'),
    /** POST /auth/mfa/enrol — returns secret + otpauth URI */
    startMfaEnrolment: (payload) => adapter.call('auth.startMfaEnrolment', payload),
    /** POST /auth/mfa/confirm */
    confirmMfaEnrolment: (payload) => adapter.call('auth.confirmMfaEnrolment', payload),
    /** DELETE /auth/mfa */
    resetMfa: (userId) => adapter.call('auth.resetMfa', { userId }),
    /** POST /auth/otp/send — SMS or email; lands in the Demo Inbox */
    sendOtp: (payload) => adapter.call('auth.sendOtp', payload),
    /** POST /auth/otp/verify */
    verifyOtp: (payload) => adapter.call('auth.verifyOtp', payload)
  },

  users: {
    ...resource('users'),
    /** POST /users/:id/suspend */
    suspend: (id) => adapter.call('users.suspend', { id }),
    /** POST /users/:id/activate */
    activate: (id) => adapter.call('users.activate', { id }),
    /** POST /users/import — CSV, with a dry-run diff before anything is written */
    importCsv: (payload) => adapter.call('users.importCsv', payload),
    /** GET /users/export */
    exportCsv: (params) => adapter.call('users.exportCsv', params)
  },

  groups: resource('groups'),
  /** Rate-limiter lockouts behind /limit-exceeders. Unblock is a delete:
      removing the lockout row is exactly what lifting it means. */
  lockouts: resource('lockouts'),
  subAdmins: resource('subAdmins'),
  roles: resource('roles'),

  // ---- devices --------------------------------------------------------
  devices: {
    ...resource('devices'),
    /** POST /devices/:id/approve */
    approve: (id) => adapter.call('devices.approve', { id }),
    /** POST /devices/:id/reject */
    reject: (id) => adapter.call('devices.reject', { id }),
    /** POST /devices/bulk-approve */
    approveMany: (ids) => adapter.call('devices.approveMany', { ids }),
    /** POST /devices/bind — takes a real browser fingerprint */
    bind: (payload) => adapter.call('devices.bind', payload)
  },
  authDevices: resource('authDevices'),
  deviceChecks: {
    ...resource('deviceChecks'),
    /** POST /device-checks/evaluate — genuinely evaluates posture rules */
    evaluate: (payload) => adapter.call('deviceChecks.evaluate', payload)
  },
  devicePolicies: resource('devicePolicies'),
  geoFences: {
    ...resource('geoFences'),
    /** POST /geo-fences/evaluate */
    evaluate: (payload) => adapter.call('geoFences.evaluate', payload)
  },
  blockedApps: resource('blockedApps'),
  deviceUpdates: resource('deviceUpdates'),
  /** Read-only inventory behind /software-packages. */
  softwarePackages: resource('softwarePackages'),

  // ---- network and applications ---------------------------------------
  controllers: {
    ...resource('controllers'),
    /** POST /controllers/:id/:action — stop | restart | commit */
    action: (id, action) => adapter.call('controllers.action', { id, action })
  },
  gateways: resource('gateways'),
  applications: {
    ...resource('applications'),
    /** POST /applications/:id/launch — opens an RDP/SSH/VNC session surface */
    launch: (id) => adapter.call('applications.launch', { id })
  },
  appServices: resource('appServices'),
  appGroups: resource('appGroups'),

  accessRules: {
    ...resource('accessRules'),
    /**
     * POST /access-rules/evaluate
     * The policy engine. Answers "can this user, on this device, from here,
     * at this time, reach that application — and which rule decided it".
     * This is the one endpoint the real console does not have today.
     */
    evaluate: (payload) => adapter.call('accessRules.evaluate', payload)
  },

  // ---- auth profiles and identity providers ---------------------------
  authProfiles: {
    ...resource('authProfiles'),
    /** POST /auth-profiles/:id/test — directory bind, SAML probe, RADIUS ping */
    test: (id) => adapter.call('authProfiles.test', { id })
  },
  userProviders: {
    ...resource('userProviders'),
    /** POST /user-providers/:id/sync — SCIM pull, with a dry run first */
    sync: (id, opts) => adapter.call('userProviders.sync', { id, ...opts })
  },
  idam: resource('idamServices'),

  // ---- filters --------------------------------------------------------
  urlFilters: resource('urlFilters'),
  contentFilters: resource('contentFilters'),
  fileTypeFilters: resource('fileTypeFilters'),
  domainLists: resource('domainLists'),

  // ---- monitoring -----------------------------------------------------
  sessions: {
    ...resource('sessions'),
    /** POST /sessions/:id/disconnect */
    disconnect: (id) => adapter.call('sessions.disconnect', { id })
  },
  events: {
    ...resource('eventLog'),
    /** POST /events — every meaningful action writes one. This is the proof
     *  the demo is actually wired rather than a set of screenshots. */
    record: (payload) => adapter.call('events.record', payload)
  },
  accessLog: resource('accessLog'),
  anomalies: resource('anomalies'),
  reportSubscriptions: resource('reportSubscriptions'),
  exportProfiles: {
    ...resource('exportProfiles'),
    /** POST /siem/preview — renders syslog / CEF / LEEF exactly as it would ship */
    preview: (payload) => adapter.call('siem.preview', payload)
  },

  // ---- settings -------------------------------------------------------
  settings: {
    /** GET /settings/:key */
    get: (key) => adapter.call('settings.get', { key }),
    /** PUT /settings/:key */
    set: (key, value) => adapter.call('settings.set', { key, value })
  },
  timeSchedules: resource('timeSchedules'),
  riskProfiles: {
    ...resource('riskProfiles'),
    /** POST /risk-profiles/score */
    score: (payload) => adapter.call('riskProfiles.score', payload)
  },

  /** Everything that would leave the system in production. */
  inbox: {
    ...resource('inbox'),
    markRead: (id) => adapter.call('inbox.markRead', { id }),
    clear: () => adapter.call('inbox.clear')
  },

  /** Dashboard rollups — GET /stats */
  stats: () => adapter.call('stats'),

  /** Demo plumbing. A real backend has no equivalent and does not need one. */
  demo: {
    reset: () => adapter.call('demo.reset'),
    seeded: () => adapter.call('demo.seeded')
  }
}

export default api
