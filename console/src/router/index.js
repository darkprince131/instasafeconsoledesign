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
  /* The seven protocol screens are list-template configs in resources.js now,
     one each, with their own columns and toolbars. Only /profile/local is
     bespoke, and it is bespoke because it is not a list at all: it is the
     tenant's password policy. */
  '/profile/local':             () => import('../views/settings/Settings.vue'),
  '/devices':          () => import('../views/devices/Devices.vue'),
  '/device-checks':    () => import('../views/devices/DeviceChecks.vue'),
  '/applications':     () => import('../views/network/Applications.vue'),
  '/access-rules':     () => import('../views/network/AccessRules.vue'),
  '/access-explorer':  () => import('../views/network/AccessExplorer.vue'),
  '/controllers':      () => import('../views/network/Controllers.vue'),
  '/gateways':         () => import('../views/network/Gateways.vue'),
  '/downloads/user-agents':    () => import('../views/Downloads.vue'),
  '/downloads/gateway-agents': () => import('../views/Downloads.vue'),
  '/profile/scim-import': () => import('../views/settings/ScimImport.vue'),
  '/reports/live':     () => import('../views/monitoring/LiveSessions.vue'),
  '/reports/event-logs': () => import('../views/monitoring/EventLog.vue'),
  '/profile/export-log':  () => import('../views/monitoring/ExportLog.vue'),
  '/reports/session-recording': () => import('../views/monitoring/SessionRecording.vue'),
  '/reports/data-uses-log':            () => import('../views/monitoring/UsageReport.vue'),
  '/reports/time-uses-log':            () => import('../views/monitoring/UsageReport.vue'),
  '/reports/gateway':                  () => import('../views/monitoring/UsageReport.vue'),

  '/reports/anomaly-logs':             () => import('../views/monitoring/AnomalyLogs.vue'),

  // filters: four routes, one component - same object, different matcher
  '/url-filter':      () => import('../views/security/Filters.vue'),
  '/content-filter':  () => import('../views/security/Filters.vue'),
  '/filetype-filter': () => import('../views/security/Filters.vue'),
  '/domainlists':     () => import('../views/security/Filters.vue'),

  // IDAM: i365 as the provider. These describe the IdP running at /idp.
  /* IDAM is five lists now, not five static pages: a tenant runs several
     OAuth2 clients and several SAML service providers, and velto lists them.
     They render through the shared list template like every other list.
     SCIM export alone has a record page, because its record has tabs. */

  // settings: six routes of grouped fields saved as a blob
  '/settings/company-details':      () => import('../views/settings/CompanyDetails.vue'),
  '/settings/subscription-details': () => import('../views/settings/SubscriptionDetails.vue'),
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
      /* Velto's three nav destinations, plus the two behind the avatar.
         The portal is a product of its own and these are its whole map. */
      { path: '', name: 'portal', component: () => import('../views/portal/PortalDashboard.vue') },
      { path: 'downloads', name: 'portal-downloads', component: () => import('../views/portal/PortalDownloads.vue') },
      { path: 'applications', name: 'portal-apps', component: () => import('../views/portal/PortalApplications.vue') },
      { path: 'profile', name: 'portal-profile', component: () => import('../views/portal/PortalProfile.vue') },
      { path: 'mfa', name: 'portal-mfa', component: () => import('../views/portal/PortalMfa.vue') }
    ]
  },
  /* Activation is bare like sign-in: somebody arriving on an invite link has
     no session yet, so there is no shell to put them in. */
  {
    path: '/portal/activate',
    name: 'portal-activate',
    component: () => import('../views/portal/PortalActivate.vue'),
    meta: { bare: true, portalBare: true, title: 'Set up your account' }
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

/* A record page under a list. The loop above only registers nav
   destinations, and this is not one — it is reached by clicking a row. */
routes.push({
  path: '/scim-export/:id',
  name: 'scim-export-detail',
  component: () => import('../views/identity/ScimExportDetail.vue'),
  meta: { section: 'Administration', parent: 'SCIM Export',
    label: 'Profile', title: 'SCIM Export Profile' }
})

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
