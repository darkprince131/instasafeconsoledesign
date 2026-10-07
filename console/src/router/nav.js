/**
 * The navigation model.
 *
 * The real console has 19 top-level entries and 66 destinations in a flat
 * alphabetical-ish list, which is a 19-item decision every single time. Here
 * they are binned into seven labelled sections, so it becomes a 7-item
 * decision followed by a 3-item one. Nothing is renamed and nothing moves
 * between parents — the routes are identical to production.
 *
 * The rail renders straight off this. Adding a screen is adding a line.
 */

export const NAV = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard',       icon: 'fa-gauge-high',        to: '/dashboard' },
      { label: 'Asset inventory', icon: 'fa-boxes-stacked',     to: '/asset-inventory' },
      { label: 'Graph',           icon: 'fa-diagram-project',   to: '/graph' }
    ]
  },
  {
    section: 'Infrastructure',
    items: [
      {
        label: 'Controllers & gateways', icon: 'fa-server',
        children: [
          { label: 'Controllers', to: '/controllers' },
          { label: 'Gateways',    to: '/gateways' }
        ]
      },
      {
        label: 'General settings', icon: 'fa-sliders',
        children: [
          { label: 'Company details',      to: '/settings/company-details' },
          { label: 'Subscription details', to: '/settings/subscription-details' },
          { label: 'SMS settings',         to: '/sms-settings' },
          { label: 'Email settings',       to: '/email-settings' }
        ]
      }
    ]
  },
  {
    section: 'Identity',
    items: [
      {
        label: 'Authentication profiles', icon: 'fa-id-card',
        children: [
          { label: 'Local',             to: '/profile/local' },
          { label: 'Active Directory',  to: '/profile/active-directory' },
          { label: 'LDAP',              to: '/profile/ldap' },
          { label: 'RADIUS',            to: '/profile/radius' },
          { label: 'SAML',              to: '/profile/saml' },
          { label: 'OAuth',             to: '/profile/oauth' },
          { label: 'OpenID',            to: '/profile/openid' },
          { label: 'Passwordless',      to: '/profile/passwordless' }
        ]
      },
      {
        label: 'User providers', icon: 'fa-cloud-arrow-down',
        children: [
          { label: 'Azure AD',    to: '/profile/azuread' },
          { label: 'Google',      to: '/profile/google' },
          { label: 'SCIM import', to: '/profile/scim-import' }
        ]
      },
      {
        label: 'Users & groups', icon: 'fa-users',
        children: [
          { label: 'Users',          to: '/users' },
          { label: 'User groups',    to: '/usergroups' },
          { label: 'Blocked users',  to: '/limit-exceeders' }
        ]
      },
      {
        label: 'User settings', icon: 'fa-user-gear',
        children: [
          { label: 'Settings',       to: '/user-settings' },
          { label: 'Time schedules', to: '/time-schedules' },
          { label: 'Risk profiles',  to: '/risk-profiles' },
          { label: 'DNS / WINS',     to: '/settings/dns-wins' }
        ]
      }
    ]
  },
  {
    section: 'Security',
    items: [
      {
        label: 'Devices & checks', icon: 'fa-laptop-medical', badgeKey: 'devicesPending',
        children: [
          { label: 'Devices',           to: '/devices', badgeKey: 'devicesPending' },
          { label: 'Auth devices',      to: '/auth-devices' },
          { label: 'Software packages', to: '/software-packages' },
          { label: 'Device policy',     to: '/device-policy' },
          { label: 'Device checks',     to: '/device-checks' },
          { label: 'Geo-fences',        to: '/geo-fences' },
          { label: 'Blocked apps',      to: '/app-blocker' },
          { label: 'Device updates',    to: '/device-updates' }
        ]
      },
      {
        label: 'Filters', icon: 'fa-filter',
        children: [
          { label: 'URL filter',        to: '/url-filter' },
          { label: 'Content filter',    to: '/content-filter' },
          { label: 'File type filter',  to: '/filetype-filter' },
          { label: 'Domain lists',      to: '/domainlists' }
        ]
      }
    ]
  },
  {
    section: 'Access',
    items: [
      {
        label: 'Applications', icon: 'fa-grip',
        children: [
          { label: 'Application services', to: '/application-services' },
          { label: 'Applications',         to: '/applications' },
          { label: 'Application groups',   to: '/application-groups' }
        ]
      },
      { label: 'Access rules',    icon: 'fa-shield-halved', to: '/access-rules', badgeKey: 'rules' },
      { label: 'Access explorer', icon: 'fa-magnifying-glass-chart', to: '/access-explorer', isNew: true }
    ]
  },
  {
    section: 'Monitoring',
    items: [
      {
        label: 'Logs & reports', icon: 'fa-chart-line',
        children: [
          { label: 'Live sessions',        to: '/reports/live' },
          { label: 'Event logs',           to: '/reports/event-logs' },
          { label: 'Access logs',          to: '/reports/access-logs' },
          { label: 'Application access',   to: '/reports/application-access-logs' },
          { label: 'Gateway report',       to: '/reports/gateway' },
          { label: 'User last login',      to: '/reports/user-last-login' },
          { label: 'Data usage',           to: '/reports/data-uses-log' },
          { label: 'Time usage',           to: '/reports/time-uses-log' },
          { label: 'Anomaly logs',         to: '/reports/anomaly-logs' },
          { label: 'Session recording',    to: '/reports/session-recording' },
          { label: 'Session log',          to: '/reports/session-log' },
          { label: 'Network test',         to: '/reports/network-test' }
        ]
      },
      {
        label: 'Report settings', icon: 'fa-file-export',
        children: [
          { label: 'SIEM / export log',    to: '/profile/export-log' },
          { label: 'Report subscriptions', to: '/report-subscriptions' }
        ]
      },
      {
        label: 'Downloads', icon: 'fa-download',
        children: [
          { label: 'User agents',    to: '/downloads/user-agents' },
          { label: 'Gateway agents', to: '/downloads/gateway-agents' }
        ]
      }
    ]
  },
  {
    section: 'Administration',
    items: [
      {
        label: 'Sub admins & roles', icon: 'fa-user-shield',
        children: [
          { label: 'Sub admins', to: '/sub-admin/all' },
          { label: 'Roles',      to: '/sub-admin/roles' }
        ]
      },
      {
        label: 'IDAM', icon: 'fa-fingerprint',
        children: [
          { label: 'SCIM export',    to: '/scim-export' },
          { label: 'OAuth2 service', to: '/oauth2-service' },
          { label: 'OpenID IdP',     to: '/openid-idp' },
          { label: 'SAML IdP',       to: '/saml-idp' },
          { label: 'RADIUS server',  to: '/authserver/radius' }
        ]
      },
      { label: 'Tech support', icon: 'fa-headset', to: '/tech-support' }
    ]
  }
]

/** Flat list of every destination — used to build routes and the breadcrumb. */
export function flatRoutes () {
  const out = []
  for (const sec of NAV) {
    for (const item of sec.items) {
      if (item.to) out.push({ ...item, section: sec.section, parent: null })
      for (const child of item.children || []) {
        out.push({ ...child, section: sec.section, parent: item.label })
      }
    }
  }
  return out
}
