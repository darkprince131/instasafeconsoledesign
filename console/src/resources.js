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

/** Status → pill style. Returning null means "expected, render quietly". */
const statusPill = (v) => ({
  active: null, approved: null, running: null, up: null, configured: null, enabled: null,
  pending: 'att', restarting: 'att', degraded: 'att', 'not-configured': 'att',
  suspended: 'bad', rejected: 'bad', stopped: 'bad', down: 'bad', disabled: 'bad'
}[v] ?? null)

export const RESOURCES = {
  '/usergroups': {
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

  '/applications': {
    title: 'Applications',
    subtitle: 'What people connect to. RDP, SSH and VNC applications can be launched from here.',
    resource: 'applications',
    primaryAction: 'Add application',
    searchFields: ['name', 'host', 'owner'],
    filters: [
      { key: 'type', label: 'All types', options: ['web', 'rdp', 'ssh', 'vnc'] }
    ],
    columns: [
      { key: 'name', label: 'Application', bold: true },
      { key: 'type', label: 'Type', upper: true },
      { key: 'host', label: 'Host', mono: true },
      { key: 'port', label: 'Port', mono: true, align: 'right' },
      { key: 'owner', label: 'Owner' },
      { key: 'sessionRecording', label: 'Recording', bool: true },
      { key: 'status', label: 'Status', pill: statusPill }
    ],
    rowAction: { label: 'Connect', when: (r) => ['rdp', 'ssh', 'vnc'].includes(r.type) }
  },

  '/application-services': {
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
      { key: 'lastSeen', label: 'Last seen', cell: fmtAgo, dim: true },
      { key: 'status', label: 'Status', pill: statusPill }
    ]
  },

  '/time-schedules': {
    title: 'Time schedules',
    subtitle: 'Access windows. Referenced by access rules, and genuinely enforced at evaluation.',
    resource: 'timeSchedules',
    primaryAction: 'Add schedule',
    columns: [
      { key: 'name', label: 'Schedule', bold: true },
      { key: 'days', label: 'Days', cell: (v) => (v || []).map(d => 'SMTWTFS'[d]).join(' ') , mono: true },
      { key: 'start', label: 'From', mono: true },
      { key: 'end', label: 'To', mono: true },
      { key: 'timezone', label: 'Timezone' }
    ]
  },

  '/geo-fences': {
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

  '/profile/local': {
    title: 'Authentication profiles',
    subtitle: 'How people prove who they are. Eight profile types, each with its own connection test.',
    resource: 'authProfiles',
    primaryAction: 'Add profile',
    searchFields: ['name', 'type'],
    columns: [
      { key: 'name', label: 'Profile', bold: true },
      { key: 'type', label: 'Type', upper: true },
      { key: 'host', label: 'Host', mono: true, cell: (v) => v || dash },
      { key: 'port', label: 'Port', mono: true, align: 'right', cell: (v) => v || dash },
      { key: 'users', label: 'Users', align: 'right', num: true },
      { key: 'status', label: 'Status', pill: statusPill }
    ],
    rowAction: { label: 'Test' }
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

  '/reports/user-last-login': {
    title: 'User last login',
    resource: 'users',
    columns: [
      { key: 'username', label: 'Username', bold: true },
      { key: 'email', label: 'Email', dim: true },
      { key: 'authProfile', label: 'Auth profile' },
      { key: 'lastSeen', label: 'Last login', cell: fmtAgo },
      { key: 'status', label: 'Status', pill: statusPill }
    ]
  },

  '/limit-exceeders': {
    title: 'Blocked users',
    subtitle: 'Accounts locked out after repeated failed sign-ins.',
    resource: 'users',
    baseFilter: { status: 'suspended' },
    emptyTitle: 'Nobody is blocked',
    emptyBody: 'Accounts appear here after repeated failed sign-ins. That is the healthy state.',
    columns: [
      { key: 'username', label: 'Username', bold: true },
      { key: 'email', label: 'Email', dim: true },
      { key: 'department', label: 'Department' },
      { key: 'lastSeen', label: 'Last seen', cell: fmtAgo, dim: true },
      { key: 'status', label: 'Status', pill: statusPill }
    ]
  }
}

export { fmtDate, fmtAgo, bytes, statusPill }
