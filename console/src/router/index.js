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
  '/reports/event-logs': () => import('../views/monitoring/EventLog.vue')
}

const routes = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/signin',
    name: 'signin',
    component: () => import('../views/SignIn.vue'),
    meta: { bare: true }
  },
  {
    path: '/mfa-profile',
    name: 'mfa',
    component: () => import('../views/identity/MfaEnrol.vue'),
    meta: { title: 'Multi-factor authentication', section: 'Identity' }
  }
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
