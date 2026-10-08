import { createRouter, createWebHistory } from 'vue-router'
import { flatRoutes } from './nav.js'
import { RESOURCES } from '../resources.js'

/**
 * 54 of the console's screens are the same list template with different
 * columns. That is the single biggest fact about this product, so the router
 * reflects it: those routes all resolve to one component, configured by a
 * entry in resources.js. Writing a new list screen is adding a config object,
 * not a file.
 *
 * Screens that genuinely differ — the dashboard, sign-in, MFA enrolment, the
 * access explorer — get their own component.
 */

const bespoke = {
  '/dashboard':        () => import('../views/Dashboard.vue'),
  '/users':            () => import('../views/identity/Users.vue'),
  '/profile/local':             () => import('../views/identity/AuthProfiles.vue'),
  '/profile/active-directory':  () => import('../views/identity/AuthProfiles.vue'),
  '/profile/ldap':              () => import('../views/identity/AuthProfiles.vue'),
  '/profile/radius':            () => import('../views/identity/AuthProfiles.vue'),
  '/profile/saml':              () => import('../views/identity/AuthProfiles.vue'),
  '/profile/oauth':             () => import('../views/identity/AuthProfiles.vue'),
  '/profile/openid':            () => import('../views/identity/AuthProfiles.vue'),
  '/profile/passwordless':      () => import('../views/identity/AuthProfiles.vue'),
  '/devices':          () => import('../views/devices/Devices.vue'),
  '/device-checks':    () => import('../views/devices/DeviceChecks.vue'),
  '/applications':     () => import('../views/network/Applications.vue'),
  '/access-rules':     () => import('../views/network/AccessRules.vue'),
  '/access-explorer':  () => import('../views/network/AccessExplorer.vue'),
  '/controllers':      () => import('../views/network/Controllers.vue'),
  '/reports/live':     () => import('../views/monitoring/LiveSessions.vue'),
  '/reports/event-logs': () => import('../views/monitoring/EventLog.vue'),
  '/profile/export-log':  () => import('../views/monitoring/SiemExport.vue'),
  '/reports/session-recording': () => import('../views/monitoring/SessionRecording.vue'),
  '/reports/data-uses-log':            () => import('../views/monitoring/UsageReport.vue'),
  '/reports/time-uses-log':            () => import('../views/monitoring/UsageReport.vue'),
  '/reports/gateway':                  () => import('../views/monitoring/UsageReport.vue'),
  '/reports/application-access-logs':  () => import('../views/monitoring/UsageReport.vue'),
  '/reports/anomaly-logs':             () => import('../views/monitoring/AnomalyLogs.vue'),

  // filters: four routes, one component - same object, different matcher
  '/url-filter':      () => import('../views/security/Filters.vue'),
  '/content-filter':  () => import('../views/security/Filters.vue'),
  '/filetype-filter': () => import('../views/security/Filters.vue'),
  '/domainlists':     () => import('../views/security/Filters.vue'),

  // IDAM: i365 as the provider. These describe the IdP running at /idp.
  '/openid-idp':       () => import('../views/identity/IdamServices.vue'),
  '/saml-idp':         () => import('../views/identity/IdamServices.vue'),
  '/oauth2-service':   () => import('../views/identity/IdamServices.vue'),
  '/scim-export':      () => import('../views/identity/IdamServices.vue'),
  '/authserver/radius':() => import('../views/identity/IdamServices.vue'),

  // settings: six routes of grouped fields saved as a blob
  '/settings/company-details':      () => import('../views/settings/Settings.vue'),
  '/settings/subscription-details': () => import('../views/settings/Settings.vue'),
  '/sms-settings':                  () => import('../views/settings/Settings.vue'),
  '/email-settings':                () => import('../views/settings/Settings.vue'),
  '/user-settings':                 () => import('../views/settings/Settings.vue'),
  '/settings/dns-wins':             () => import('../views/settings/Settings.vue'),

  '/reports/network-test': () => import('../views/monitoring/NetworkTest.vue'),
  '/tech-support':         () => import('../views/TechSupport.vue'),
  '/graph':                () => import('../views/Graph.vue')
}

const routes = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/signin',
    name: 'signin',
    component: () => import('../views/SignIn.vue'),
    meta: { bare: true }
  },
  /**
   * The end-user portal.
   *
   * `/mfa-profile` used to live here, inside the admin console, as the
   * administrator's own enrolment screen hung off the rail footer. That was
   * the wrong product: an administrator cannot enrol somebody else's
   * authenticator, because enrolment means scanning a QR with a phone they
   * are not holding. Enrolment belongs to the person with the phone, so it
   * moved here, and the admin side kept what an admin actually does —
   * require MFA, see whether it happened, reset it when the phone is lost.
   *
   * `bare: true` keeps the console shell off these routes entirely. The
   * portal brings its own.
   */
  {
    path: '/portal',
    component: () => import('../views/portal/PortalShell.vue'),
    meta: { bare: true },
    children: [
      { path: '', name: 'portal', component: () => import('../views/portal/PortalHome.vue') }
    ]
  },
  {
    path: '/portal/signin',
    name: 'portal-signin',
    component: () => import('../views/portal/PortalSignIn.vue'),
    meta: { bare: true, portalBare: true }
  },
  /* the old path still resolves, so a bookmark lands somewhere sensible */
  { path: '/mfa-profile', redirect: '/portal' }
]

// one route per documented destination
for (const dest of flatRoutes()) {
  if (dest.to === '/dashboard') {
    routes.push({ path: dest.to, name: dest.to, component: bespoke[dest.to], meta: dest })
    continue
  }
  const loader = bespoke[dest.to]
  if (loader) {
    routes.push({ path: dest.to, name: dest.to, component: loader, meta: dest })
  } else {
    routes.push({
      path: dest.to,
      name: dest.to,
      component: () => import('../views/ResourceList.vue'),
      props: { config: RESOURCES[dest.to] || null, route: dest.to },
      meta: dest
    })
  }
}

routes.push({
  path: '/:pathMatch(.*)*',
  component: () => import('../views/NotFound.vue'),
  meta: { title: 'Not found' }
})

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.afterEach((to) => {
  const label = to.meta?.label || to.meta?.title
  document.title = label ? `${label} — InstaSafe i365` : 'InstaSafe i365'
})

export default router
