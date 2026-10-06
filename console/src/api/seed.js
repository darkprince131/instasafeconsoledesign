/**
 * Seed data.
 *
 * Scaled to the real numbers measured off the production `velto` tenant, so
 * the demo behaves like a live console rather than a tidy mock: 1,820 users,
 * 775 devices waiting on approval, lists long enough that pagination, search
 * and bulk selection actually matter.
 *
 * Generated rather than hand-written — a 1,820-row literal would be
 * unreviewable, and generated data lets us keep the distributions honest
 * (most users enrolled, a few not; most devices approved, a long pending tail).
 */

const FIRST = ['Aarav','Priya','Marcus','Elena','Rohan','Sana','David','Mei','Omar','Laura','Vikram','Chloe','Daniel','Ananya','Peter','Nadia','Arjun','Grace','Tomas','Ishita','Samuel','Leena','Hassan','Clara','Rahul','Yuki','Felix','Divya','Noah','Zara','Imran','Beatriz','Karan','Anja','Joel','Meera','Victor','Tara','Luis','Kavya']
const LAST  = ['Sharma','Nair','Hall','Petrova','Mehta','Qureshi','Chen','Lin','Farouk','Bianchi','Singh','Dubois','Okafor','Rao','Novak','Haddad','Kapoor','Mbeki','Varga','Desai','Olsen','Krishnan','Ali','Moreau','Gupta','Tanaka','Weber','Iyer','Andersen','Khan','Baig','Costa','Malhotra','Keller','Lindqvist','Pillai','Sokolov','Bose','Alvarez','Menon']
const DEPTS = ['Engineering','Finance','Sales','Support','HR','Operations','Legal','Marketing','IT','Security']
const OS    = ['Windows 11 23H2','Windows 11 24H2','Windows 10 22H2','macOS 15.1','macOS 14.6','Ubuntu 24.04','Ubuntu 22.04','Android 15','Android 14','iOS 18.1','iOS 17.6']
const CITIES = [
  ['Bengaluru','IN',12.97,77.59], ['Mumbai','IN',19.08,72.88], ['Pune','IN',18.52,73.86],
  ['London','GB',51.51,-0.13], ['Frankfurt','DE',50.11,8.68], ['Singapore','SG',1.35,103.82],
  ['New York','US',40.71,-74.01], ['Austin','US',30.27,-97.74], ['Dubai','AE',25.20,55.27],
  ['Sydney','AU',-33.87,151.21]
]

/** Deterministic PRNG, so every visitor gets the same demo and bugs reproduce. */
function rng (seed = 20260101) {
  let s = seed >>> 0
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5;  s >>>= 0
    return s / 4294967296
  }
}
const r = rng()
const pick = (arr) => arr[Math.floor(r() * arr.length)]
const chance = (p) => r() < p
const ago = (days) => new Date(Date.now() - days * 86400000).toISOString()

function pad (n, w = 4) { return String(n).padStart(w, '0') }

// ---------------------------------------------------------------- users
export function seedUsers (count = 1820) {
  const out = []
  /* Usernames must be unique: the database has a unique index on
     (tenant_id, username) and will refuse the insert otherwise. Forty first
     names against forty surnames collide long before 420 rows, so a name
     that has already been used gets a numeric suffix. IndexedDB had no such
     constraint and silently overwrote the earlier row, which hid this. */
  const taken = new Set()
  for (let i = 1; i <= count; i++) {
    const first = pick(FIRST), last = pick(LAST)
    const base = `${first}.${last}`.toLowerCase()
    let username = base
    let n = 1
    while (taken.has(username)) username = base + ++n
    taken.add(username)
    const enrolled = chance(0.94)               // most people have MFA
    const status = chance(0.975) ? 'active' : (chance(0.5) ? 'suspended' : 'pending')
    out.push({
      id: `usr_${pad(i, 5)}`,
      firstName: first,
      lastName: last,
      username,
      email: `${username}@instasafe.com`,
      department: pick(DEPTS),
      authProfile: chance(0.62) ? 'Local' : pick(['Azure AD','RADIUS','LDAP','SAML','Google']),
      mfaEnrolled: enrolled,
      mfaSecret: null,                          // set for real on enrolment
      status,
      groups: [],
      countryCode: '91',
      mobile: `98${pad(Math.floor(r() * 99999999), 8)}`,
      location: pick(CITIES)[0],
      lastSeenAt: status === 'pending' ? null : ago(r() * 45),
      createdAt: ago(60 + r() * 600),
      deviceBinding: chance(0.8),
      deviceCheckEnabled: chance(0.7),
      geoFenceEnabled: chance(0.25),
      autoSuspend: chance(0.3)
    })
  }
  // A known admin, so the demo always has a predictable way in.
  out.unshift({
    id: 'usr_00000',
    firstName: 'Demo', lastName: 'Admin',
    username: 'admin',
    email: 'admin@instasafe.com',
    department: 'IT',
    authProfile: 'Local',
    mfaEnrolled: false, mfaSecret: null,
    status: 'active',
    groups: ['grp_0001'],
    countryCode: '91', mobile: '9800000000',
    location: 'Bengaluru',
    lastSeenAt: new Date().toISOString(),
    createdAt: ago(720),
    isAdmin: true,
    deviceBinding: true, deviceCheckEnabled: true,
    geoFenceEnabled: false, autoSuspend: false
  })
  return out
}

// --------------------------------------------------------------- groups
export function seedGroups () {
  return [
    ['grp_0001','Administrators','Local',4],
    ['grp_0002','Engineering','Azure AD',412],
    ['grp_0003','Finance','Azure AD',88],
    ['grp_0004','Sales','Azure AD',260],
    ['grp_0005','Contractors','Local',137],
    ['grp_0006','Support','LDAP',94],
    ['grp_0007','Field Engineers','RADIUS',58],
    ['grp_0008','Executives','SAML',12]
  ].map(([id, name, authType, members]) => ({
    id, name, authType, members,
    twoFactor: name !== 'Contractors',
    deviceBinding: !['Contractors','Sales'].includes(name),
    deviceChecks: ['Administrators','Engineering','Finance','Executives'].includes(name),
    accessRules: Math.floor(r() * 6),
    createdAt: ago(200 + r() * 400)
  }))
}

// -------------------------------------------------------------- devices
export function seedDevices (users, count = 2140) {
  const out = []
  for (let i = 1; i <= count; i++) {
    const u = users[1 + Math.floor(r() * (users.length - 1))]
    const [city, cc, lat, lon] = pick(CITIES)
    // 775 pending is the real measured number from production
    const status = i <= 775 ? 'pending' : (chance(0.985) ? 'approved' : 'rejected')
    const os = pick(OS)
    out.push({
      id: `dev_${pad(i, 5)}`,
      name: `${u.firstName}-${os.split(' ')[0]}-${pad(i, 3)}`,
      userId: u.id,
      username: u.username,
      os,
      osFamily: os.split(' ')[0],
      agentVersion: chance(0.72) ? '4.8.2' : pick(['4.7.9','4.6.1','4.8.0']),
      macAddress: Array.from({ length: 6 }, () => Math.floor(r() * 256).toString(16).padStart(2, '0')).join(':'),
      ipAddress: `10.${Math.floor(r() * 254)}.${Math.floor(r() * 254)}.${Math.floor(r() * 254)}`,
      status,
      bound: status === 'approved' && chance(0.88),
      city, countryCode: cc, lat, lon,
      lastSeenAt: status === 'pending' ? ago(r() * 14) : ago(r() * 30),
      enrolledAt: ago(r() * 300),
      posture: {
        diskEncryption: chance(0.9),
        antivirus: chance(0.86),
        firewall: chance(0.93),
        osUpToDate: chance(0.74),
        screenLock: chance(0.95),
        jailbroken: chance(0.02)
      }
    })
  }
  return out
}

// --------------------------------------------------------- applications
export function seedApplications () {
  /* Columns: name, type, host, port, owner, recording, blockCopyPaste, watermark.
     The session controls are set deliberately rather than randomly: these three
     switches are the differentiated part of the RDP/SSH story, so the demo has
     to contain a clear example of each one being on and each being off.
     Leaving it to chance once produced a seed where copy-blocking appeared
     nowhere at all. */
  const apps = [
    ['Jira',              'web',  'https://jira.internal',      443, 'Engineering', 0, 0, 0],
    ['Confluence',        'web',  'https://wiki.internal',      443, 'Engineering', 0, 0, 0],
    ['GitLab',            'web',  'https://git.internal',       443, 'Engineering', 0, 0, 0],
    ['Finance DB',        'rdp',  '10.20.4.17',                3389, 'Finance',     1, 1, 1],
    ['Payroll Web',       'web',  'https://payroll.internal',   443, 'Finance',     0, 0, 0],
    ['Reports DB',        'ssh',  '10.20.4.33',                  22, 'Finance',     1, 1, 0],
    ['Build Server',      'ssh',  '10.20.8.12',                  22, 'Engineering', 1, 0, 0],
    ['Jump Host',         'ssh',  '10.20.0.5',                   22, 'IT',          1, 1, 1],
    ['Code Server',       'web',  'https://code.internal',      443, 'Engineering', 0, 0, 0],
    ['Salesforce',        'web',  'https://sf.internal',        443, 'Sales',       0, 0, 0],
    ['Legacy ERP',        'rdp',  '10.20.6.41',                3389, 'Operations',  1, 0, 1],
    ['Design VM',         'vnc',  '10.20.9.22',                5900, 'Marketing',   0, 1, 0],
    ['HR Portal',         'web',  'https://hr.internal',        443, 'HR',          0, 0, 0],
    ['Support Desk',      'web',  'https://desk.internal',      443, 'Support',     0, 0, 0],
    ['Log Collector',     'ssh',  '10.20.1.90',                  22, 'Security',    1, 0, 0],
    ['Domain Controller', 'rdp',  '10.20.0.10',                3389, 'IT',          1, 1, 1]
  ]
  return apps.map(([name, type, host, port, owner, rec, cpb, wm], i) => ({
    id: `app_${pad(i + 1, 4)}`,
    name, type, host, port, owner,
    status: name === 'Legacy ERP' ? 'disabled' : 'active',
    sessionRecording: !!rec,
    blockCopyPaste: !!cpb,
    watermark: !!wm,
    createdAt: ago(100 + r() * 500)
  }))
}

export function seedAppServices () {
  return [
    ['HTTPS','tcp',443], ['HTTP','tcp',80], ['RDP','tcp',3389], ['SSH','tcp',22],
    ['VNC','tcp',5900], ['MySQL','tcp',3306], ['PostgreSQL','tcp',5432],
    ['SMB','tcp',445], ['DNS','udp',53], ['LDAPS','tcp',636]
  ].map(([name, proto, port], i) => ({
    id: `svc_${pad(i + 1, 4)}`, name, protocol: proto, port, createdAt: ago(400)
  }))
}

// --------------------------------------------------------- access rules
export function seedAccessRules (groups, apps) {
  const out = []
  let n = 1
  const rule = (sourceType, source, destType, dest, action, extra = {}) => out.push({
    id: `acl_${pad(n, 4)}`,
    name: `${source} → ${dest}`,
    sourceType, source, destType, dest, action,
    priority: n++,
    enabled: true,
    schedule: extra.schedule || 'Always',
    createdAt: ago(50 + r() * 300),
    ...extra
  })
  rule('group', 'Administrators', 'application', 'Domain Controller', 'allow')
  rule('group', 'Administrators', 'application', 'Jump Host', 'allow')
  rule('group', 'Engineering', 'application', 'GitLab', 'allow')
  rule('group', 'Engineering', 'application', 'Jira', 'allow')
  rule('group', 'Engineering', 'application', 'Build Server', 'allow')
  rule('group', 'Engineering', 'application', 'Code Server', 'allow')
  rule('group', 'Engineering', 'application', 'Finance DB', 'deny')
  rule('group', 'Finance', 'application', 'Finance DB', 'allow', { schedule: 'Business hours' })
  rule('group', 'Finance', 'application', 'Payroll Web', 'allow', { schedule: 'Business hours' })
  rule('group', 'Finance', 'application', 'Reports DB', 'allow')
  rule('group', 'Sales', 'application', 'Salesforce', 'allow')
  rule('group', 'Support', 'application', 'Support Desk', 'allow')
  rule('group', 'HR', 'application', 'HR Portal', 'allow')
  rule('group', 'Contractors', 'application', 'Jira', 'allow', { schedule: 'Business hours' })
  rule('group', 'Contractors', 'application', 'Finance DB', 'deny')
  rule('group', 'Contractors', 'application', 'Domain Controller', 'deny')
  rule('group', 'Executives', 'application', 'Payroll Web', 'allow')
  rule('group', 'Field Engineers', 'application', 'Jump Host', 'allow', { schedule: 'Business hours' })
  // a deliberate shadowed rule, so the access explorer has something to find
  rule('group', 'Engineering', 'application', 'Jira', 'deny')
  return out
}

// ------------------------------------------- controllers and gateways
export function seedControllers () {
  return [
    ['ctl-mum-01','Mumbai','10.0.1.10','running'],
    ['ctl-blr-01','Bengaluru','10.0.2.10','running'],
    ['ctl-lon-01','London','10.0.3.10','running']
  ].map(([name, region, ip, status], i) => ({
    id: `ctl_${pad(i + 1, 4)}`, name, region, ip, status,
    version: '3.4.1', uptimeDays: Math.floor(30 + r() * 300),
    pendingCommit: i === 1, createdAt: ago(500)
  }))
}

export function seedGateways () {
  return [
    ['gw-mum-01','Mumbai','103.21.44.12','up',188],
    ['gw-blr-01','Bengaluru','103.21.45.9','up',104],
    ['gw-lon-01','London','185.42.7.18','up',22],
    ['gw-sin-01','Singapore','139.59.12.4','degraded',4]
  ].map(([name, region, ip, status, sessions], i) => ({
    id: `gw_${pad(i + 1, 4)}`, name, region, ip, status, sessions,
    version: '3.4.1', throughputMbps: Math.round(sessions * (1.5 + r() * 3)),
    latencyMs: Math.round(8 + r() * 40), createdAt: ago(480)
  }))
}

// ------------------------------------------------------- auth profiles
export function seedAuthProfiles () {
  return [
    ['Local Directory','local','configured'],
    ['Corp Active Directory','active-directory','configured'],
    ['Corp LDAPS','ldap','configured'],
    ['RADIUS NPS','radius','configured'],
    ['Okta SAML','saml','configured'],
    ['Azure OIDC','openid','configured'],
    ['Google OAuth','oauth','not-configured'],
    ['Passwordless Email','passwordless','configured']
  ].map(([name, type, status], i) => ({
    id: `ap_${pad(i + 1, 4)}`, name, type, status,
    users: Math.floor(r() * 600),
    host: type === 'local' ? null : `${type}.corp.instasafe.com`,
    port: { 'active-directory': 389, ldap: 636, radius: 1812 }[type] || null,
    tls: ['ldap', 'radius'].includes(type),
    createdAt: ago(300 + r() * 300)
  }))
}

export function seedDeviceChecks () {
  return [
    ['Disk encryption required','diskEncryption',true,'critical'],
    ['Antivirus running','antivirus',true,'critical'],
    ['Firewall enabled','firewall',true,'high'],
    ['OS up to date','osUpToDate',true,'medium'],
    ['Screen lock enabled','screenLock',true,'medium'],
    ['Device not jailbroken','jailbroken',false,'critical']
  ].map(([name, postureKey, expect, severity], i) => ({
    /* postureKey, not key: it is the field inside devices.posture that this
       check reads, and it maps to the posture_key column. Calling it "key"
       meant the column mapper dropped it and the insert failed on NOT NULL. */
    id: `dc_${pad(i + 1, 4)}`, name, postureKey, expect, severity,
    enabled: true, createdAt: ago(250)
  }))
}

export function seedTimeSchedules () {
  return [
    { id: 'ts_0001', name: 'Business hours', days: [1,2,3,4,5], startTime: '09:00', endTime: '18:00', timezone: 'Asia/Kolkata', createdAt: ago(300) },
    { id: 'ts_0002', name: 'Extended hours', days: [1,2,3,4,5,6], startTime: '07:00', endTime: '22:00', timezone: 'Asia/Kolkata', createdAt: ago(300) },
    { id: 'ts_0003', name: 'Always', days: [0,1,2,3,4,5,6], startTime: '00:00', endTime: '23:59', timezone: 'UTC', createdAt: ago(300) }
  ]
}

export function seedGeoFences () {
  return CITIES.slice(0, 4).map(([city, cc, lat, lon], i) => ({
    id: `gf_${pad(i + 1, 4)}`,
    name: `${city} office`,
    city, countryCode: cc, lat, lon,
    radiusKm: 25, action: 'allow', enabled: true, createdAt: ago(200)
  }))
}

export function seedEvents (users, count = 794) {
  const kinds = [
    ['auth.login.success','info'], ['auth.login.failed','warning'],
    ['auth.mfa.success','info'], ['auth.mfa.failed','warning'],
    ['device.enrolled','info'], ['device.approved','info'], ['device.rejected','warning'],
    ['device.check.failed','warning'], ['access.granted','info'], ['access.denied','warning'],
    ['user.created','info'], ['user.suspended','warning'], ['rule.updated','info'],
    ['session.started','info'], ['session.ended','info']
  ]
  const out = []
  for (let i = count; i >= 1; i--) {
    const u = users[1 + Math.floor(r() * (users.length - 1))]
    const [type, severity] = pick(kinds)
    const [city] = pick(CITIES)
    out.push({
      id: `evt_${pad(count - i + 1, 6)}`,
      type, severity,
      actor: u.username,
      message: describeEvent(type, u),
      ip: `49.${Math.floor(r() * 254)}.${Math.floor(r() * 254)}.${Math.floor(r() * 254)}`,
      city,
      at: ago(r() * 30)
    })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

function describeEvent (type, u) {
  const n = `${u.firstName} ${u.lastName}`
  return {
    'auth.login.success': `${n} signed in`,
    'auth.login.failed': `Failed sign-in for ${u.username}`,
    'auth.mfa.success': `${n} passed MFA`,
    'auth.mfa.failed': `${n} failed MFA`,
    'device.enrolled': `${n} enrolled a new device`,
    'device.approved': `Device approved for ${n}`,
    'device.rejected': `Device rejected for ${n}`,
    'device.check.failed': `Posture check failed for ${n}`,
    'access.granted': `${n} reached an application`,
    'access.denied': `${n} was denied access`,
    'user.created': `${n} was created`,
    'user.suspended': `${n} was suspended`,
    'rule.updated': `An access rule was updated`,
    'session.started': `${n} started a session`,
    'session.ended': `${n} ended a session`
  }[type] || type
}

export function seedSessions (users, apps) {
  return Array.from({ length: 318 }, (_, i) => {
    const u = users[1 + Math.floor(r() * (users.length - 1))]
    const a = pick(apps)
    const [city] = pick(CITIES)
    return {
      id: `ses_${pad(i + 1, 5)}`,
      userId: u.id, username: u.username,
      applicationId: a.id, application: a.name, type: a.type,
      gateway: pick(['gw-mum-01','gw-blr-01','gw-lon-01','gw-sin-01']),
      city,
      startedAt: ago(r() * 0.4),
      bytesIn: Math.floor(r() * 90_000_000),
      bytesOut: Math.floor(r() * 30_000_000),
      status: 'active'
    }
  })
}
