/**
 * List-screen configuration.
 *
 * 54 of the console's 66 screens are the same table with different columns.
 * Each entry here produces one of them: title, the api resource to read, the
 * columns, and what the empty state should say. ResourceList.vue does the rest.
 *
 * `cell` renders a value; `pill` marks a status so colour is spent on
 * exceptions only — healthy states return null and stay as plain text.
 */

const dash = '—'
const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : dash
const fmtAgo = (v) => {
  if (!v) return 'never'
  const s = (Date.now() - new Date(v)) / 1000
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'} ago`
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return plural(Math.floor(s / 3600), 'hour')
  return plural(Math.floor(s / 86400), 'day')
}
const bytes = (n) => {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(n) / Math.log(1024))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}

/**
 * A lockout expiry, rendered as the time left rather than a timestamp.
 *
 * Production prints the raw datetime, which makes the admin do arithmetic to
 * answer the only question they have: is this still in force, and for how
 * much longer. An expired row is the normal case on a screen nobody watches,
 * so it says so plainly instead of looking identical to a live block.
 */
const fmtUntil = (v) => {
  if (!v) return dash
  const s = (new Date(v) - Date.now()) / 1000
  if (s <= 0) return 'expired'
  if (s < 60) return `${Math.ceil(s)}s left`
  if (s < 3600) return `${Math.ceil(s / 60)} min left`
  return `${Math.round(s / 3600)} h left`
}

/** Status → pill style. Returning null means "expected, render quietly". */
const statusPill = (v) => ({
  active: null, approved: null, running: null, up: null, configured: null, enabled: null,
  pending: 'att', restarting: 'att', degraded: 'att', 'not-configured': 'att',
  suspended: 'bad', rejected: 'bad', stopped: 'bad', down: 'bad', disabled: 'bad'
}[v] ?? null)

export const RESOURCES = {
  '/usergroups': {
    singular: 'group',
    formSubtitle: 'Policy set here is inherited by every member.',
    form: [
      { key: 'name', label: 'Group name', required: true, placeholder: 'Finance' },
      { key: 'authType', label: 'Authentication type',
        options: ['Local', 'Azure AD', 'RADIUS', 'LDAP', 'SAML', 'Google'] },
      { key: 'twoFactor', label: 'Require two-factor', type: 'switch' },
      { key: 'deviceBinding', label: 'Bind members to their first device', type: 'switch' },
      { key: 'deviceChecks', label: 'Run device posture checks', type: 'switch' }
    ],
    title: 'User groups',
    subtitle: 'Groups carry policy. A user inherits every rule attached to every group they are in.',
    resource: 'groups',
    primaryAction: 'Add group',
    searchFields: ['name', 'authType'],
    columns: [
      { key: 'name', label: 'Group', bold: true },
      { key: 'authType', label: 'Auth type' },
      { key: 'members', label: 'Members', align: 'right', num: true },
      { key: 'accessRules', label: 'Access rules', align: 'right', num: true },
      { key: 'twoFactor', label: 'Two factor', bool: true },
      { key: 'deviceBinding', label: 'Device binding', bool: true },
      { key: 'createdAt', label: 'Created', cell: fmtDate, dim: true }
    ]
  },

  '/application-services': {
    singular: 'service',
    formSubtitle: 'A protocol and port that applications and rules can point at.',
    form: [
      { key: 'name', label: 'Service name', required: true, placeholder: 'HTTPS' },
      { key: 'protocol', label: 'Protocol', options: ['tcp', 'udp', 'icmp'] },
      { key: 'port', label: 'Port', type: 'number', required: true, placeholder: '443' }
    ],
    title: 'Application services',
    subtitle: 'Protocol and port definitions that applications reference.',
    resource: 'appServices',
    primaryAction: 'Add service',
    columns: [
      { key: 'name', label: 'Service', bold: true },
      { key: 'protocol', label: 'Protocol', upper: true },
      { key: 'port', label: 'Port', mono: true, align: 'right' },
      { key: 'createdAt', label: 'Created', cell: fmtDate, dim: true }
    ]
  },

  '/gateways': {
    singular: 'gateway',
    formSubtitle: 'Where traffic enters. A gateway has to be reachable before a rule using it can work.',
    form: [
      { key: 'name', label: 'Gateway name', required: true, placeholder: 'gw-mum-02' },
      { key: 'region', label: 'Region', placeholder: 'Mumbai' },
      { key: 'ip', label: 'Public IP', placeholder: '103.21.44.13' },
      { key: 'version', label: 'Agent version', placeholder: '3.4.1' }
    ],
    title: 'Gateways',
    subtitle: 'The data plane. Traffic reaches applications through these.',
    resource: 'gateways',
    primaryAction: 'Add gateway',
    columns: [
      { key: 'name', label: 'Gateway', bold: true },
      { key: 'region', label: 'Region' },
      { key: 'ip', label: 'IP address', mono: true },
      { key: 'version', label: 'Version', mono: true },
      { key: 'sessions', label: 'Sessions', align: 'right', num: true },
      { key: 'throughputMbps', label: 'Mbps', align: 'right', num: true },
      { key: 'latencyMs', label: 'Latency', align: 'right', cell: (v) => `${v} ms`, mono: true },
      { key: 'status', label: 'Status', pill: statusPill }
    ]
  },

  '/auth-devices': {
    title: 'Auth devices',
    subtitle: 'Devices bound to a user for authentication.',
    resource: 'devices',
    baseFilter: { bound: true },
    columns: [
      { key: 'name', label: 'Device', bold: true },
      { key: 'username', label: 'User' },
      { key: 'os', label: 'Operating system' },
      { key: 'macAddress', label: 'MAC', mono: true },
      { key: 'lastSeenAt', label: 'Last seen', cell: fmtAgo, dim: true },
      { key: 'status', label: 'Status', pill: statusPill }
    ]
  },

  '/time-schedules': {
    singular: 'schedule',
    formSubtitle: 'Access rules can reference a schedule; outside it they do not match.',
    form: [
      { key: 'name', label: 'Schedule name', required: true, placeholder: 'Business hours' },
      { key: 'startTime', label: 'From', placeholder: '09:00' },
      { key: 'endTime', label: 'To', placeholder: '18:00' },
      { key: 'timezone', label: 'Timezone',
        options: ['Asia/Kolkata', 'UTC', 'Europe/London', 'America/New_York'] }
    ],
    title: 'Time schedules',
    subtitle: 'Access windows. Referenced by access rules, and genuinely enforced at evaluation.',
    resource: 'timeSchedules',
    primaryAction: 'Add schedule',
    columns: [
      { key: 'name', label: 'Schedule', bold: true },
      { key: 'days', label: 'Days', cell: (v) => (v || []).map(d => 'SMTWTFS'[d]).join(' ') , mono: true },
      { key: 'startTime', label: 'From', mono: true },
      { key: 'endTime', label: 'To', mono: true },
      { key: 'timezone', label: 'Timezone' }
    ]
  },

  '/geo-fences': {
    singular: 'geo-fence',
    formSubtitle: 'A circle on the map. A sign-in from outside it is evaluated against the action.',
    form: [
      { key: 'name', label: 'Fence name', required: true, placeholder: 'Pune office' },
      { key: 'city', label: 'City', placeholder: 'Pune' },
      { key: 'countryCode', label: 'Country code', placeholder: 'IN' },
      { key: 'radiusKm', label: 'Radius in km', type: 'number', placeholder: '25' },
      { key: 'action', label: 'Action', options: ['allow', 'deny'] },
      { key: 'enabled', label: 'Fence is enabled', type: 'switch' }
    ],
    title: 'Geo-fences',
    subtitle: 'Locations access is allowed from. A simulated client position is evaluated against these.',
    resource: 'geoFences',
    primaryAction: 'Add geo-fence',
    columns: [
      { key: 'name', label: 'Fence', bold: true },
      { key: 'city', label: 'City' },
      { key: 'countryCode', label: 'Country', mono: true },
      { key: 'radiusKm', label: 'Radius', cell: (v) => `${v} km`, align: 'right', mono: true },
      { key: 'action', label: 'Action', upper: true },
      { key: 'enabled', label: 'Enabled', bool: true }
    ]
  },

  '/reports/access-logs': {
    title: 'Access logs',
    subtitle: 'Every allow and deny decision, with the rule that made it.',
    resource: 'events',
    baseFilter: { type: ['access.granted', 'access.denied'] },
    columns: [
      { key: 'at', label: 'When', cell: fmtAgo, dim: true },
      { key: 'actor', label: 'User' },
      { key: 'message', label: 'Event' },
      { key: 'ip', label: 'Source IP', mono: true },
      { key: 'city', label: 'Location' },
      { key: 'severity', label: 'Severity', pill: (v) => v === 'warning' ? 'att' : null }
    ]
  },

  '/profile/azuread': {
    singular: 'provider',
    formSubtitle: 'A provider pulls users in. An authentication profile decides how they sign in - the two are separate.',
    form: [
      { key: 'name', label: 'Connection name', required: true, placeholder: 'Corp Azure AD' },
      { key: 'kind', label: 'Provider', options: ['Azure AD', 'Google Workspace', 'Okta', 'SCIM'] },
      { key: 'tenantId', label: 'Directory / tenant ID', placeholder: '00000000-0000-0000-0000-000000000000' },
      { key: 'clientId', label: 'Client ID' },
      { key: 'syncGroups', label: 'Import group membership too', type: 'switch' },
      { key: 'enabled', label: 'Sync is active', type: 'switch' }
    ],
    title: 'User providers',
    subtitle: 'Where users are imported from. Importing somebody does not by itself let them sign in.',
    resource: 'userProviders',
    primaryAction: 'Add provider',
    emptyTitle: 'No user providers',
    emptyBody: 'Without one, users have to be created by hand or imported from CSV.',
    columns: [
      { key: 'name', label: 'Connection', bold: true },
      { key: 'kind', label: 'Provider' },
      { key: 'tenantId', label: 'Directory', mono: true },
      { key: 'syncGroups', label: 'Groups', bool: true },
      { key: 'enabled', label: 'Active', bool: true }
    ]
  },

  '/profile/google': { alias: '/profile/azuread' },
  '/profile/scim-import': { alias: '/profile/azuread' },
  '/downloads/gateway-agents': { alias: '/downloads/user-agents' },

  '/downloads/user-agents': {
    title: 'User agents',
    subtitle: 'The client people install. An out-of-date agent is the commonest cause of a posture failure.',
    resource: 'deviceUpdates',
    emptyTitle: 'No agent releases listed',
    emptyBody: 'Add a release under Device updates and it appears here.',
    columns: [
      { key: 'platform', label: 'Platform', bold: true },
      { key: 'version', label: 'Version', mono: true },
      { key: 'mandatory', label: 'Mandatory', bool: true },
      { key: 'notes', label: 'Release notes', dim: true }
    ]
  },

  '/sub-admin/all': {
    singular: 'sub admin',
    formSubtitle: 'A sub admin signs into this console with a role that limits what they can touch.',
    form: [
      { key: 'name', label: 'Name', required: true, placeholder: 'Priya Nair' },
      { key: 'email', label: 'Email', required: true, placeholder: 'priya@example.com' },
      { key: 'role', label: 'Role', options: ['Read only', 'Helpdesk', 'Security analyst', 'Full admin'] },
      { key: 'enabled', label: 'Account is active', type: 'switch' }
    ],
    title: 'Sub admins',
    subtitle: 'People who administer this tenant, and how much of it they can reach.',
    resource: 'subAdmins',
    primaryAction: 'Add sub admin',
    emptyTitle: 'No sub admins',
    emptyBody: 'Only the primary administrator can sign in. Add one to delegate.',
    columns: [
      { key: 'name', label: 'Name', bold: true },
      { key: 'email', label: 'Email', dim: true },
      { key: 'role', label: 'Role' },
      { key: 'enabled', label: 'Active', bool: true }
    ]
  },

  '/sub-admin/roles': {
    singular: 'role',
    formSubtitle: 'A role is a set of permissions. The production form has 58 switches on one page with no grouping.',
    form: [
      { key: 'name', label: 'Role name', required: true, placeholder: 'Security analyst' },
      { key: 'description', label: 'What this role is for', placeholder: 'Read logs and approve devices' },
      { key: 'canManageUsers', label: 'Create and edit users', type: 'switch' },
      { key: 'canApproveDevices', label: 'Approve devices', type: 'switch' },
      { key: 'canEditRules', label: 'Edit access rules', type: 'switch' },
      { key: 'canViewLogs', label: 'Read logs and reports', type: 'switch' },
      { key: 'canEditSettings', label: 'Change tenant settings', type: 'switch' }
    ],
    title: 'Roles',
    subtitle: 'What a sub admin is allowed to do.',
    resource: 'roles',
    primaryAction: 'Add role',
    columns: [
      { key: 'name', label: 'Role', bold: true },
      { key: 'description', label: 'Purpose', dim: true },
      { key: 'canManageUsers', label: 'Users', bool: true },
      { key: 'canApproveDevices', label: 'Devices', bool: true },
      { key: 'canEditRules', label: 'Rules', bool: true },
      { key: 'canViewLogs', label: 'Logs', bool: true },
      { key: 'canEditSettings', label: 'Settings', bool: true }
    ]
  },

  '/application-groups': {
    singular: 'application group',
    formSubtitle: 'Group applications so one access rule can cover several.',
    form: [
      { key: 'name', label: 'Group name', required: true, placeholder: 'Finance systems' },
      { key: 'description', label: 'Description', placeholder: 'Everything the finance team needs' }
    ],
    title: 'Application groups',
    subtitle: 'A rule pointing at a group covers every application in it.',
    resource: 'appGroups',
    primaryAction: 'Add group',
    columns: [
      { key: 'name', label: 'Group', bold: true },
      { key: 'description', label: 'Description', dim: true },
      { key: 'createdAt', label: 'Created', cell: fmtDate, dim: true }
    ]
  },

  '/device-policy': {
    singular: 'device policy',
    formSubtitle: 'A named bundle of device requirements that users and groups can be assigned.',
    form: [
      { key: 'name', label: 'Policy name', required: true, placeholder: 'Contractor laptops' },
      { key: 'requireEncryption', label: 'Require disk encryption', type: 'switch' },
      { key: 'requireAntivirus', label: 'Require antivirus', type: 'switch' },
      { key: 'blockJailbroken', label: 'Block jailbroken devices', type: 'switch' },
      { key: 'maxAgentAge', label: 'Maximum agent age in days', type: 'number', placeholder: '90' }
    ],
    title: 'Device policy',
    subtitle: 'Requirements a device has to meet before its user can connect.',
    resource: 'devicePolicies',
    primaryAction: 'Add policy',
    columns: [
      { key: 'name', label: 'Policy', bold: true },
      { key: 'requireEncryption', label: 'Encryption', bool: true },
      { key: 'requireAntivirus', label: 'Antivirus', bool: true },
      { key: 'blockJailbroken', label: 'Block jailbroken', bool: true },
      { key: 'maxAgentAge', label: 'Max agent age', align: 'right', mono: true }
    ]
  },

  '/app-blocker': {
    singular: 'blocked application',
    formSubtitle: 'Applications the agent prevents from running while a tunnel is up.',
    form: [
      { key: 'name', label: 'Application name', required: true, placeholder: 'uTorrent' },
      { key: 'process', label: 'Process name', placeholder: 'utorrent.exe' },
      { key: 'platform', label: 'Platform', options: ['Windows', 'macOS', 'Linux', 'All'] },
      { key: 'enabled', label: 'Rule is enabled', type: 'switch' }
    ],
    title: 'Blocked apps',
    subtitle: 'Stopped from running on a device while it is connected.',
    resource: 'blockedApps',
    primaryAction: 'Add blocked app',
    emptyTitle: 'Nothing is blocked',
    emptyBody: 'Add an application here to stop it running while a device is connected.',
    columns: [
      { key: 'name', label: 'Application', bold: true },
      { key: 'process', label: 'Process', mono: true },
      { key: 'platform', label: 'Platform' },
      { key: 'enabled', label: 'Enabled', bool: true }
    ]
  },

  '/device-updates': {
    singular: 'agent release',
    formSubtitle: 'Which agent build each platform should be running.',
    form: [
      { key: 'platform', label: 'Platform', required: true,
        options: ['Windows', 'macOS', 'Linux', 'Android', 'iOS'] },
      { key: 'version', label: 'Version', required: true, placeholder: '4.8.2' },
      { key: 'mandatory', label: 'Mandatory — block older agents', type: 'switch' },
      { key: 'notes', label: 'Release notes', placeholder: 'Fixes posture reporting on Windows 11 24H2' }
    ],
    title: 'Device updates',
    subtitle: 'The agent version each platform is expected to run.',
    resource: 'deviceUpdates',
    primaryAction: 'Add release',
    columns: [
      { key: 'platform', label: 'Platform', bold: true },
      { key: 'version', label: 'Version', mono: true },
      { key: 'mandatory', label: 'Mandatory', bool: true },
      { key: 'notes', label: 'Notes', dim: true }
    ]
  },

  '/risk-profiles': {
    singular: 'risk profile',
    formSubtitle: 'A score built from device posture, location and time. Access rules can require a maximum.',
    form: [
      { key: 'name', label: 'Profile name', required: true, placeholder: 'Standard' },
      { key: 'maxScore', label: 'Maximum allowed score', type: 'number', placeholder: '60' },
      { key: 'weightPosture', label: 'Weight — device posture', type: 'number', placeholder: '50' },
      { key: 'weightGeo', label: 'Weight — unusual location', type: 'number', placeholder: '30' },
      { key: 'weightTime', label: 'Weight — outside hours', type: 'number', placeholder: '20' }
    ],
    title: 'Risk profiles',
    subtitle: 'How a session is scored, and the score above which it is refused.',
    resource: 'riskProfiles',
    primaryAction: 'Add profile',
    columns: [
      { key: 'name', label: 'Profile', bold: true },
      { key: 'maxScore', label: 'Max score', align: 'right', mono: true },
      { key: 'weightPosture', label: 'Posture', align: 'right', mono: true },
      { key: 'weightGeo', label: 'Location', align: 'right', mono: true },
      { key: 'weightTime', label: 'Time', align: 'right', mono: true }
    ]
  },

  '/asset-inventory': {
    title: 'Asset inventory',
    subtitle: 'Everything this tenant knows about, in one list.',
    resource: 'devices',
    columns: [
      { key: 'name', label: 'Asset', bold: true },
      { key: 'osFamily', label: 'Platform' },
      { key: 'os', label: 'Operating system', dim: true },
      { key: 'agentVersion', label: 'Agent', mono: true },
      { key: 'ipAddress', label: 'Address', mono: true },
      { key: 'city', label: 'Location' },
      { key: 'status', label: 'Status',
        cell: (v) => v.charAt(0).toUpperCase() + v.slice(1),
        pill: (v) => v === 'approved' ? null : v === 'pending' ? 'att' : 'bad' }
    ]
  },


  '/reports/session-log': {
    title: 'Session log',
    subtitle: 'Every session that has been opened, including ones that have ended.',
    resource: 'sessions',
    columns: [
      { key: 'username', label: 'User', bold: true },
      { key: 'application', label: 'Application' },
      { key: 'type', label: 'Type', upper: true },
      { key: 'gateway', label: 'Gateway', mono: true },
      { key: 'city', label: 'Location' },
      { key: 'startedAt', label: 'Started', cell: fmtAgo, dim: true },
      { key: 'bytesIn', label: 'In', cell: bytes, mono: true, align: 'right' },
      { key: 'bytesOut', label: 'Out', cell: bytes, mono: true, align: 'right' },
      { key: 'status', label: 'Status', pill: (v) => v === 'active' ? null : 'att' }
    ]
  },

  '/report-subscriptions': {
    singular: 'subscription',
    formSubtitle: 'Scheduled reports are delivered by mail. In the demo they arrive in the Demo Inbox.',
    form: [
      { key: 'name', label: 'Subscription name', required: true, placeholder: 'Weekly access summary' },
      { key: 'report', label: 'Report',
        options: ['Access logs', 'Event logs', 'Data usage', 'Time usage', 'User last login'] },
      { key: 'cadence', label: 'Cadence', options: ['Daily', 'Weekly', 'Monthly'] },
      { key: 'recipients', label: 'Recipients', placeholder: 'security@example.com' },
      { key: 'enabled', label: 'Subscription is active', type: 'switch' }
    ],
    title: 'Report subscriptions',
    subtitle: 'Reports that go out on a schedule without anyone opening the console.',
    resource: 'reportSubscriptions',
    primaryAction: 'Add subscription',
    emptyTitle: 'No scheduled reports',
    emptyBody: 'A subscription mails a report on a cadence, so nobody has to remember to run it.',
    columns: [
      { key: 'name', label: 'Subscription', bold: true },
      { key: 'report', label: 'Report' },
      { key: 'cadence', label: 'Cadence' },
      { key: 'recipients', label: 'Recipients', dim: true },
      { key: 'enabled', label: 'Active', bool: true }
    ]
  },

  '/reports/user-last-login': {
    title: 'User last login',
    resource: 'users',
    columns: [
      { key: 'username', label: 'Username', bold: true },
      { key: 'email', label: 'Email', dim: true },
      { key: 'authProfile', label: 'Auth profile' },
      { key: 'lastSeenAt', label: 'Last login', cell: fmtAgo },
      { key: 'status', label: 'Status', pill: statusPill }
    ]
  },

  /**
   * Blocked Users — and the assumption that was wrong about it.
   *
   * This screen was built as `users` filtered to `status: suspended`, on the
   * reasonable-sounding guess that "blocked" meant a disabled account. It does
   * not. Production's columns are **IP · Username · Blocked At · Blocked
   * Until** and its only action is **Unblock**: these are source-address
   * lockouts written by the rate limiter after repeated failed sign-ins, and
   * they expire by themselves. The route name `/limit-exceeders` says so.
   *
   * The difference matters. A suspended account is a decision an admin made
   * and has to undo; a lockout is a transient automatic block that an admin
   * usually only needs to lift early — for the person who fat-fingered their
   * password from a conference wifi and cannot wait out the timer. Modelling
   * it as account status put a destructive Delete where Unblock belongs and
   * hid the one fact the admin actually needs, which is when it lifts.
   */
  '/limit-exceeders': {
    title: 'Blocked users',
    subtitle: 'Source addresses locked out by the rate limiter after repeated failed sign-ins. Each lockout expires on its own; unblocking only lifts it early.',
    resource: 'lockouts',
    searchFields: ['ip', 'username'],
    emptyTitle: 'Nothing is blocked',
    emptyBody: 'Addresses appear here after repeated failed sign-ins and clear themselves when the lockout expires. Empty is the healthy state.',
    bulkAction: {
      label: 'Unblock', past: 'unblocked', noun: 'lockout', tone: 'normal',
      body: 'will be able to sign in again immediately.'
    },
    columns: [
      { key: 'ip', label: 'IP', mono: true, bold: true },
      { key: 'username', label: 'Username', dim: true, cell: (v) => v || 'unknown' },
      { key: 'attempts', label: 'Failed attempts', align: 'right', num: true },
      { key: 'blockedAt', label: 'Blocked at', cell: fmtAgo, dim: true },
      { key: 'blockedUntil', label: 'Blocked until', cell: fmtUntil, mono: true }
    ]
  }
}

/* A couple of routes are the same screen under another name in the nav.
   Resolving aliases here keeps one definition rather than two that drift. */
for (const [path, cfg] of Object.entries(RESOURCES)) {
  if (cfg.alias) RESOURCES[path] = { ...RESOURCES[cfg.alias] }
}

export { fmtDate, fmtAgo, bytes, statusPill }
