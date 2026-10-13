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

/* Velto offers a full UTC-offset list rather than IANA names, which is the
   right call for a field somebody picks from a dropdown: "(UTC+05:30) Indian
   Standard Time" is readable and "Asia/Kolkata" is a lookup. */
/**
 * The twelve risk events velto watches for, exactly as its picker lists them.
 *
 * Worth reading as a set: most are a *change* rather than a failure — a
 * different browser, a different platform, a different IP, a login from
 * somewhere new. That is the shape of a stolen credential, which is the thing
 * these exist to catch.
 */
export const RISK_TYPES = [
  'Login Failure',
  'Device Check Failure',
  'Device Bind Failure',
  'Browser Switch',
  'IP Switch',
  'Long Inactivity Login',
  'MFA Failure',
  'Suspicious Activity',
  'User Access of Blocked Apps',
  'Platform Switch',
  'Geo Bind Failure',
  'Login from Different Locations'
]

export const RISK_ACTIONS = ['Email Admin', 'Deny Access', 'Suspend User', 'Disconnect User']

const TIMEZONES = [
  '(UTC-11:00) Niue Time',
  '(UTC-10:00) Hawaii-Aleutian Time',
  '(UTC-08:00) Pacific Standard Time',
  '(UTC-07:00) Mountain Standard Time',
  '(UTC-06:00) Central Standard Time',
  '(UTC-05:00) Eastern Standard Time',
  '(UTC-03:00) Argentina Time',
  '(UTC+00:00) Coordinated Universal Time',
  '(UTC+01:00) Central European Time',
  '(UTC+02:00) Eastern European Time',
  '(UTC+03:00) Moscow Standard Time',
  '(UTC+04:00) Gulf Standard Time',
  '(UTC+05:30) Indian Standard Time',
  '(UTC+07:00) Indochina Time',
  '(UTC+08:00) China Standard Time',
  '(UTC+09:00) Japan Standard Time',
  '(UTC+10:00) Australian Eastern Time',
  '(UTC+12:00) New Zealand Standard Time'
]
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

/**
 * Status -> pill style. Returning null means "expected, render quietly".
 *
 * Matched case-insensitively: screens carrying production's own casing
 * ("Active", "Pending-Approval") would otherwise fall through to null and
 * render every state unmarked, including the ones the design spends colour
 * on. A status that earns a mark and silently does not get one is the
 * failure this is for.
 */
const statusPill = (raw) => {
  const v = String(raw ?? '').toLowerCase().replace(/[\s_]+/g, '-')
  return ({
    active: null, approved: null, running: null, up: null, configured: null, enabled: null,
    pending: 'att', restarting: 'att', degraded: 'att', 'not-configured': 'att',
    suspended: 'bad', rejected: 'bad', stopped: 'bad', down: 'bad', disabled: 'bad',
    // production's own hyphenated casing, seen on velto's device list
    'pending-approval': 'att', expired: 'att', blocked: 'bad'
  }[v] ?? null)
}

const LOCK_REASON = 'Access rules and sessions refer to a profile by name, so a renamed profile is a new one. Create another profile and move the rules across.'

export const RESOURCES = {
  /* ============================================================
     Authentication profiles - seven screens, not one with a filter.

     This was a single screen behind eight routes with a type chip, which is
     the shape you get from thinking "they are all auth profiles". Velto
     treats each protocol as its own destination with its own columns, its
     own form and its own toolbar, and it is right to: a domain and two
     server IPs mean nothing to OAuth2, and a client id and redirect URI mean
     nothing to RADIUS. Filtering one table by type forces every screen to
     show the union of fields that no single protocol uses.

     `baseFilter` keeps them in one collection, because they do share a
     lifecycle - but nothing about that is visible, and no screen offers to
     show you another protocol's rows.

     /profile/local is deliberately absent: it is not a list. It is the
     tenant's password policy and it lives in settings.
     ============================================================ */

  '/profile/active-directory': {
    title: 'Active Directory profile',
    subtitle: 'Domain controllers users authenticate against. Sync pulls accounts and group membership across.',
    resource: 'authProfiles',
    baseFilter: { type: 'active-directory' },
    singular: 'Active Directory profile',
    primaryAction: 'Add profile',
    searchFields: ['name', 'domain', 'primaryServerIp'],
    emptyTitle: 'No Active Directory profiles',
    emptyBody: 'Add one to authenticate users against a domain controller.',
    tools: [{ key: 'sync', label: 'Sync Now', icon: 'fa-rotate' }],
    /**
     * Velto's own form, field for field, with its `name` attributes.
     *
     * The demo asked four questions. The real one asks seventeen, and the
     * missing thirteen are the ones that decide whether the bind works at
     * all: the bind user, the base DN, the filter, which attribute holds the
     * username, and whether the connection is TLS. A profile created from
     * four fields could never have authenticated anybody.
     *
     * Velto marks the backup server required too, which is worth keeping:
     * a directory with one server is a single point of failure for every
     * sign-in in the tenant.
     */
    formSubtitle: 'Where the directory is, how to bind to it, and which users to let in.',
    secretAction: { key: 'bindPassword', label: 'Change Password', noun: 'bind password' },
    form: [
      { key: 'name', name: 'profile_name', label: 'Profile Name', required: true, placeholder: 'Enter Profile Name',
        lockedOnEdit: LOCK_REASON },
      { key: 'domain', name: 'domain', label: 'Domain', required: true, placeholder: 'corp.example.com' },
      { key: 'primaryServerIp', name: 'ads_ip', label: 'Primary AD Server IP', required: true, placeholder: 'Eg: 10.x.x.x' },
      { key: 'backupServerIp', name: 'bads_ip', label: 'Backup AD Server IP', required: true, placeholder: 'Eg: 10.x.x.x',
        hint: 'Answered when the primary does not. A directory with one server is a single point of failure for every sign-in.' },
      { key: 'usernameAttribute', name: 'username_attribute', label: 'Username Attribute', required: true,
        options: ['Username', 'User Principal Name (UPN)'],
        hint: 'Which attribute a person types. UPN is the full name@domain form; Username is the short sAMAccountName.' },
      { key: 'authType', name: 'auth_type', label: 'Authentication Type', required: true,
        options: ['Certificate', 'Password + Certs'] },
      { key: 'bindUser', name: 'bind_user', label: 'Bind User', required: true, placeholder: 'Bind User',
        hint: 'The account this console reads the directory with. It only needs read.' },
      { key: 'baseDn', name: 'base_dn', label: 'Base DN', required: true, placeholder: 'CN=Users, DC=corp, DC=example' },
      { key: 'filter', name: 'filter', label: 'Filter', required: true, type: 'textarea',
        placeholder: '(&(objectClass=user)(memberOf=CN=GROUPNAME,CN=Users,dc=corp,dc=example))',
        hint: 'Which directory accounts may sign in. Without a memberOf clause this is everybody in the base DN.' },
      { key: 'primaryDns', name: 'ps_ip', label: 'Primary DNS Server IP', placeholder: 'Eg: 10.x.x.x' },
      { key: 'secondaryDns', name: 'backup_dns', label: 'Secondary DNS Server IP', placeholder: 'Eg: 10.x.x.x' },
      { key: 'primaryWins', name: 'primary_wins', label: 'Primary WINS Server IP', placeholder: 'Eg: 10.x.x.x' },
      { key: 'secondaryWins', name: 'backup_wins', label: 'Secondary WINS Server IP', placeholder: 'Eg: 10.x.x.x' },
      { key: 'requireSsl', name: 'port', label: 'Require SSL/TLS secure connection', type: 'switch',
        hint: 'Off sends the bind password and every lookup in the clear.' },
      { key: 'kerberosAuth', name: 'kerberos_auth', label: 'Enable Kerberos Authentication', type: 'switch' },
      /* Velto reveals the keytab upload only once Kerberos is on, and its
         filename box is filled from the file rather than typed — which is
         why it reads as greyed out. Same here. */
      { key: 'kerberosFilename', name: 'kerberos_filename', label: 'Keytab', type: 'file',
        accept: '.keytab', dataKey: 'keytabData', uploadLabel: 'Upload keytab',
        when: (f) => !!f.kerberosAuth,
        placeholder: 'No keytab chosen',
        hint: 'The service account keytab exported from the domain controller. The filename comes from the file itself.' }
    ],
    columns: [
      { key: 'name', label: 'Profile name', bold: true },
      { key: 'domain', label: 'Domain' },
      { key: 'primaryServerIp', label: 'Primary server IP', mono: true },
      { key: 'backupServerIp', label: 'Backup server IP', mono: true, cell: (v) => v || dash }
    ]
  },

  '/profile/ldap': {
    title: 'OpenLDAP',
    subtitle: 'LDAP directories users authenticate against. Port and protocol decide whether the bind is encrypted.',
    resource: 'authProfiles',
    baseFilter: { type: 'ldap' },
    singular: 'OpenLDAP profile',
    primaryAction: 'Add profile',
    searchFields: ['name', 'domain', 'primaryServerIp'],
    emptyTitle: 'No LDAP profiles',
    emptyBody: 'Add one to authenticate users against an LDAP directory.',
    tools: [{ key: 'sync', label: 'Sync Now', icon: 'fa-rotate' }],
    /**
     * Velto's form. Eleven fields, read off the add form and confirmed
     * against an Edit Ldap Profile panel on the live tenant.
     *
     * Protocol is **disabled everywhere**, carrying TCP — on the add form as
     * well as on edit. The console does not offer the choice, so the earlier
     * TLS/TCP select here was offering something the product does not have,
     * and the attention pill on TCP marked every row in the list.
     */
    formSubtitle: 'Where the directory is, how to bind to it, and which users to let in.',
    secretAction: { key: 'bindPassword', label: 'Change Password', noun: 'bind password' },
    form: [
      { key: 'name', name: 'profile_name', label: 'Profile Name', required: true, placeholder: 'Enter Profile Name',
        lockedOnEdit: LOCK_REASON },
      { key: 'domain', name: 'domain', label: 'Domain', required: true, placeholder: 'ldap.example.com' },
      { key: 'primaryServerIp', name: 'ads_ip', label: 'Primary AD Server IP', required: true, placeholder: 'Eg: 10.x.x.x' },
      { key: 'backupServerIp', name: 'bads_ip', label: 'Backup AD Server IP', required: true, placeholder: 'Eg: 10.x.x.x' },
      { key: 'bindUser', name: 'bind_user', label: 'Bind User', required: true, placeholder: 'cn=admin,dc=example,dc=com',
        hint: 'The account this console reads the directory with. It only needs read.' },
      { key: 'authType', name: 'auth_type', label: 'Authentication Type', required: true,
        options: ['Certificate', 'Password + Certs'] },
      { key: 'baseDn', name: 'base_dn', label: 'Base DN', required: true, placeholder: 'dc=example,dc=com' },
      { key: 'filter', name: 'filter', label: 'Filter', required: true, type: 'textarea',
        placeholder: '(|(gidNumber=48681))',
        hint: 'Which directory accounts may sign in. Without it, everybody under the base DN can.' },
      { key: 'port', name: 'port', label: 'Port', required: true, type: 'number', placeholder: 'Eg: 389' },
      { key: 'protocol', name: 'protocol', label: 'Protocol', default: 'TCP',
        locked: 'LDAP profiles run over TCP. The console does not offer the choice, here or on the add form.' },
      { key: 'usernameAttribute', name: 'username', label: 'Username Attribute', required: true,
        options: ['UID'],
        hint: 'The attribute a person types. OpenLDAP offers UID alone; Active Directory also offers UPN.' }
    ],
    columns: [
      { key: 'name', label: 'Profile Name', bold: true },
      { key: 'domain', label: 'Domain' },
      { key: 'primaryServerIp', label: 'Primary Server IP', mono: true },
      { key: 'backupServerIp', label: 'Backup Server IP', mono: true, cell: (v) => v || dash },
      { key: 'port', label: 'Port', mono: true, align: 'right' },
      /* No pill. Every profile is TCP because the field is fixed, and a mark
         on all of them says nothing — it only spends the colour budget. */
      { key: 'protocol', label: 'Protocol' }
    ]
  },

  '/profile/radius': {
    title: 'RADIUS profile',
    subtitle: 'RADIUS servers users authenticate against, usually fronting an existing directory or MFA appliance.',
    resource: 'authProfiles',
    baseFilter: { type: 'radius' },
    singular: 'RADIUS profile',
    primaryAction: 'Add profile',
    searchFields: ['name', 'radiusServerIp'],
    emptyTitle: 'No RADIUS profiles',
    emptyBody: 'Add one to authenticate users against a RADIUS server.',
    /**
     * Four fields, confirmed against an Edit Radius Profile panel on the live
     * tenant: the name locks, the rest stay editable. The shared secret was a
     * password field on this form; velto keeps it behind Change Client Secret
     * on the view panel, which is where a write-only secret belongs.
     */
    secretAction: { key: 'clientSecret', label: 'Change Client Secret', noun: 'client secret' },
    form: [
      { key: 'name', name: 'profile_name', label: 'Profile Name', required: true, placeholder: 'Enter Profile Name',
        lockedOnEdit: LOCK_REASON },
      { key: 'port', name: 'port', label: 'Port', required: true, type: 'number', placeholder: 'Eg: 1812', default: 1812,
        hint: '1812 is the standard authentication port; 1645 on older equipment.' },
      { key: 'radiusServerIp', name: 'rs_ip', label: 'RADIUS Server IP', required: true, placeholder: 'Eg: 10.x.x.x' },
      { key: 'backupRadiusServerIp', name: 'brs_ip', label: 'Backup RADIUS Server IP', required: true, placeholder: 'Eg: 10.x.x.x' }
    ],
    columns: [
      { key: 'name', label: 'Name', bold: true },
      { key: 'radiusServerIp', label: 'RADIUS Server IP', mono: true },
      { key: 'backupRadiusServerIp', label: 'Backup RADIUS Server IP', mono: true, cell: (v) => v || dash },
      { key: 'port', label: 'Port', mono: true, align: 'right' }
    ]
  },

  '/profile/saml': {
    title: 'SAML',
    subtitle: 'Identity providers that assert who a user is. Import the IdP metadata rather than typing these by hand.',
    resource: 'authProfiles',
    baseFilter: { type: 'saml' },
    singular: 'SAML profile',
    primaryAction: 'Add profile',
    searchFields: ['name', 'idpEntityId'],
    emptyTitle: 'No SAML profiles',
    emptyBody: 'Add one, or import an identity provider metadata file.',
    tools: [
      { key: 'import-idp', label: 'Import IDP Metadata', icon: 'fa-file-import' },
      { key: 'download-sp', label: 'Download SP MetaData', icon: 'fa-file-export' }
    ],
    /**
     * Velto's form. The demo was missing the three that matter most: the IdP
     * certificate an assertion is verified against, the sign-out URL, and
     * which attribute carries the identity.
     */
    form: [
      { key: 'name', name: 'profile_name', label: 'Profile Name', required: true, placeholder: 'Enter Profile Name',
        lockedOnEdit: LOCK_REASON },
      { key: 'integrationType', name: 'sso_integration_type', label: 'Integration Type', required: true,
        options: ['SAML2.0'], default: 'SAML2.0' },
      { key: 'idpEntityId', name: 'identity_provider', label: 'IDP EntityId', required: true,
        placeholder: 'http://idp.example.com' },
      /* A PEM block, seven rows of it in velto. Without the certificate the
         console cannot verify an assertion at all, and the demo did not ask
         for it. */
      { key: 'idpCertificate', name: 'fingerprint', label: 'IDP Certificate', required: true, type: 'textarea',
        placeholder: '-----BEGIN CERTIFICATE-----',
        hint: 'The IdP signing certificate, PEM. Assertions are verified against this, so a rotation at the IdP has to be pasted here or every sign-in fails.' },
      { key: 'idpSignInUrl', name: 'signin_url', label: 'IDP Sign-In URL', required: true,
        placeholder: 'http://idp.example.com' },
      { key: 'idpSignOutUrl', name: 'signout_url', label: 'IDP Sign-Out URL', required: true,
        placeholder: 'http://idp.example.com' },
      { key: 'nameIdAttribute', name: 'name_id', label: 'NameID Attribute', required: true,
        options: ['Username', 'Email'], default: 'Username',
        hint: 'Which attribute the assertion carries the identity in. It has to match what the IdP sends, or every sign-in arrives as an unknown user.' }
    ],
    columns: [
      { key: 'name', label: 'Name', bold: true },
      { key: 'integrationType', label: 'Integration type' },
      { key: 'idpEntityId', label: 'IdP entity ID', mono: true },
      { key: 'idpSignInUrl', label: 'IdP sign-in URL', mono: true }
    ]
  },

  '/profile/oauth': {
    title: 'OAuth2',
    subtitle: 'OAuth2 providers. The redirect URI has to match what the provider has registered, character for character.',
    resource: 'authProfiles',
    baseFilter: { type: 'oauth' },
    singular: 'OAuth2 profile',
    primaryAction: 'Add profile',
    searchFields: ['name', 'clientId'],
    emptyTitle: 'No OAuth2 profiles',
    emptyBody: 'Add one to let users sign in through an OAuth2 provider.',
    /**
     * Provider is a real dropdown, and it changes the form: **Tenant ID
     * appears for Azure only**, not for Generic or Google. Confirmed against
     * all three captured provider states.
     *
     * The redirect URI is readonly in velto and derived from the tenant's own
     * host. It is not something you choose: it is what the console will be
     * called back on, shown so it can be copied into the provider.
     */
    secretAction: { key: 'clientSecret', label: 'Change Client Secret', noun: 'client secret' },
    form: [
      { key: 'name', name: 'profile_name', label: 'Profile Name', required: true, placeholder: 'Enter Profile Name',
        lockedOnEdit: LOCK_REASON },
      { key: 'provider', name: 'provider', label: 'Provider', required: true,
        options: ['Generic', 'Google', 'Azure'], default: 'Generic' },
      { key: 'tenantId', name: 'tenant_id', label: 'Tenant ID', required: true, placeholder: 'Enter Tenant Id',
        when: (f) => f.provider === 'Azure',
        hint: 'Azure issues tokens per directory, so the tenant is part of the endpoint. Generic and Google are not asked for one.' },
      { key: 'clientId', name: 'client_id', label: 'Client Id', required: true, placeholder: 'Enter Client Id' },
      { key: 'redirectUri', name: 'redirect_uri', label: 'Redirect URI',
        default: 'https://instasafe-console-demo.netlify.app/oauth2/callback',
        locked: 'Where the provider sends the user back. The console decides it; copy it into the provider exactly, because a trailing slash is a different URI.' }
    ],
    columns: [
      { key: 'name', label: 'Name', bold: true },
      { key: 'provider', label: 'Provider' },
      { key: 'clientId', label: 'Client ID', mono: true },
      { key: 'redirectUri', label: 'Redirect URI', mono: true }
    ]
  },

  '/profile/openid': {
    title: 'OpenID',
    subtitle: 'OpenID Connect providers. The issuer URL is what the console reads the discovery document from.',
    resource: 'authProfiles',
    baseFilter: { type: 'openid' },
    singular: 'OpenID profile',
    primaryAction: 'Add profile',
    searchFields: ['name', 'clientId', 'issuerUrl'],
    emptyTitle: 'No OpenID profiles',
    emptyBody: 'Add one to let users sign in through an OpenID Connect provider.',
    secretAction: { key: 'clientSecret', label: 'Change Client Secret', noun: 'client secret' },
    form: [
      { key: 'name', name: 'profile_name', label: 'Profile Name', required: true, placeholder: 'Enter Profile Name',
        lockedOnEdit: LOCK_REASON },
      { key: 'clientId', name: 'client_id', label: 'Client Id', required: true, placeholder: 'Enter Client Id' },
      { key: 'scopes', name: 'scopes', label: 'Scopes', required: true, placeholder: 'Enter Scopes',
        hint: 'Space separated. openid is required; profile and email are what fill in the username and the address.' },
      { key: 'issuerUrl', name: 'issuer_url', label: 'Issuer URL', required: true, placeholder: 'Enter Issuer URL',
        hint: 'The console appends /.well-known/openid-configuration to this.' },
      { key: 'redirectUri', name: 'redirect_uri', label: 'Redirect URI',
        default: 'https://instasafe-console-demo.netlify.app/openid/callback',
        locked: 'Where the provider sends the user back. The console decides it; copy it into the provider exactly.' }
    ],
    columns: [
      { key: 'name', label: 'Name', bold: true },
      { key: 'clientId', label: 'Client ID', mono: true },
      { key: 'issuerUrl', label: 'Issuer URL', mono: true }
    ]
  },

  '/profile/passwordless': {
    title: 'Passwordless profiles',
    subtitle: 'What a user presents instead of a password, and what they fall back to when it is unavailable.',
    resource: 'authProfiles',
    baseFilter: { type: 'passwordless' },
    singular: 'passwordless profile',
    primaryAction: 'Add profile',
    searchFields: ['name'],
    emptyTitle: 'No passwordless profiles',
    emptyBody: 'Add one to let users sign in with a security key instead of a password.',
    /**
     * Both lists were invented — FIDO Key, Push notification, Magic link, OTP.
     * Velto offers three primaries and three fallbacks, and they are not the
     * same three: **Kerberos can be primary but never a fallback, and Password
     * can be a fallback but never primary**, which is the whole point of the
     * screen.
     */
    form: [
      { key: 'name', name: 'profile_name', label: 'Profile Name', required: true, placeholder: 'Enter Profile Name',
        lockedOnEdit: LOCK_REASON },
      { key: 'primaryAuth', name: 'primary', label: 'Primary Auth', required: true,
        options: ['Hardware Key', 'Digital Certificate', 'Kerberos'], default: 'Hardware Key',
        hint: 'What a user presents instead of a password. Password is not offered here — avoiding it is what this profile is for.' },
      { key: 'fallbackAuth', name: 'fallback', label: 'Fallback Auth', required: true,
        options: ['Password', 'Hardware Key', 'Digital Certificate'], default: 'Digital Certificate',
        hint: 'What they use when the primary is unavailable. Kerberos is not offered: it needs a domain-joined machine, which is the case where the primary already worked.' }
    ],
    columns: [
      { key: 'name', label: 'Name', bold: true },
      { key: 'primaryAuth', label: 'Primary auth' },
      { key: 'fallbackAuth', label: 'Fallback auth' }
    ]
  },

  '/usergroups': {
    singular: 'group',
    formSubtitle: 'Policy set here is inherited by every member. Membership is part of the group, so both are saved together.',
    /* Velto's field set. The one that was missing is `members`: without it
       there was no way to put a user in a group from the group's side at all,
       which is the side an admin works from when onboarding a team. */
    form: [
      { key: 'name', label: 'Group name', required: true, placeholder: 'Finance' },
      { key: 'location', label: 'Location', placeholder: 'Mumbai' },
      { key: 'description', label: 'Description', placeholder: 'What this group is for' },
      { key: 'authType', label: 'Authentication type',
        options: ['Local', 'Azure AD', 'RADIUS', 'LDAP', 'SAML', 'Google'] },
      { key: 'memberIds', label: 'Users', type: 'pick', resource: 'users',
        placeholder: 'Search by name, username or email',
        labelKey: 'username', hintKey: 'username',
        hint: 'Type to narrow. A native list of 1,821 names is not a control anybody can use.' },
      { key: 'twoFactor', label: 'Require two-factor', type: 'switch' },
      { key: 'deviceBinding', label: 'Bind members to their first device', type: 'switch' },
      { key: 'deviceChecks', label: 'Run device posture checks', type: 'switch' },
      { key: 'deviceUpdates', label: 'Push device updates', type: 'switch' },
      { key: 'geoBinding', label: 'Bind to a geography', type: 'switch' },
      { key: 'ipRestriction', label: 'Restrict by source IP', type: 'switch' },
      { key: 'autoSuspend', label: 'Auto-suspend idle members', type: 'switch' }
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

  /**
   * Gateways, with the licence quota velto enforces.
   *
   * Pressing Add on a tenant at its limit opens "Maximum Gateway limit
   * reached" with a contact link, not a form. That is better than it sounds:
   * a quota that only fails on save lets somebody fill in a form, press
   * Save, and be told the work was wasted. Saying so before the form opens
   * costs them one click instead.
   */
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

  /**
   * Shift schedules.
   *
   * `days` was in the data model and rendered in the table, and the form had
   * no control for it at all — so a schedule could be saved with no days,
   * after which it matched nothing, for ever, silently. Velto's form has a
   * toggle per day under "Schedule Days/Time", and that is what this is.
   *
   * One start and end for the whole schedule rather than per day: toggling a
   * day in velto reveals no extra time fields, despite the label implying it.
   * A window whose end precedes its start runs through midnight, which is how
   * a night shift is expressed.
   */
  '/time-schedules': {
    singular: 'shift schedule',
    formSubtitle: 'A window access rules can be limited to. Outside it, a rule naming this schedule does not match.',
    form: [
      { key: 'name', label: 'Name', required: true, placeholder: 'morning_shift' },
      { key: 'timezone', label: 'Timezone', required: true, options: TIMEZONES },
      /* `type="time"` rather than a text box.
         Typing a time into a plain input means guessing the format it wants
         and finding out on save; the native control accepts keyboard entry,
         offers a picker, respects the locale's 12- or 24-hour convention and
         will not let through 25:70. No dependency, and it is the one input
         every phone already knows how to render well. */
      { key: 'startTime', label: 'Start time', type: 'time', required: true },
      { key: 'endTime', label: 'End time', type: 'time', required: true,
        hint: 'An end before the start runs through midnight — which is what a night shift is.' },
      { key: 'days', label: 'Schedule days', type: 'days', required: true,
        hint: 'A schedule with no days selected matches nothing.' }
    ],
    title: 'Shift schedules',
    subtitle: 'Access windows. Referenced by access rules and enforced when one is evaluated.',
    resource: 'timeSchedules',
    primaryAction: 'Add schedule',
    searchFields: ['name', 'timezone'],
    emptyTitle: 'No shift schedules',
    emptyBody: 'Add one to limit an access rule to certain days and hours.',
    columns: [
      { key: 'name', label: 'Name', bold: true },
      /* Velto prints "Mon, Tue, Wed, Thu, Fri,". The previous format mapped
         onto SMTWTFS, where the two Ts and the two Ss are the same letter. */
      { key: 'days', label: 'Days',
        cell: (v) => (v || []).length
          ? [1, 2, 3, 4, 5, 6, 0].filter(d => v.includes(d))
              .map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')
          : 'none' },
      { key: 'startTime', label: 'Start time', mono: true },
      { key: 'endTime', label: 'End time', mono: true },
      { key: 'timezone', label: 'Timezone', dim: true }
    ]
  },

  '/geo-fences': {
    singular: 'geo-fence',
    formSubtitle: 'A circle on the map. A sign-in from outside it is evaluated against the action.',
    /* Velto's fields are Name, Radius (In Meters), Latitude and Longitude,
       with a location search and a "Want Map" button so nobody has to know
       their own office to two decimal places. The picker below is that,
       honestly scoped — see LocationPicker.vue. */
    /* Velto: Name, Radius (In Meters), Latitude, Longitude, with a Google Map
       behind "Want Map" showing the fence as a circle. Metres, not
       kilometres — this stored km, so every fence was a thousand times the
       size it claimed. */
    form: [
      { key: 'name', label: 'Fence name', required: true, placeholder: 'Pune office' },
      { key: 'radiusMetres', label: 'Radius in metres', type: 'number', required: true,
        placeholder: '500',
        hint: 'Drawn on the map above as you change it.' },
      { key: 'location', type: 'location', label: 'Location' },
      { key: 'lat', label: 'Latitude', required: true, placeholder: '18.52' },
      { key: 'lon', label: 'Longitude', required: true, placeholder: '73.86' },
      { key: 'city', label: 'City', placeholder: 'Filled in by the search' },
      { key: 'countryCode', label: 'Country code', placeholder: 'IN' },
      { key: 'action', label: 'Action', options: ['allow', 'deny'] },
      { key: 'enabled', label: 'Fence is enabled', type: 'switch' }
    ],
    title: 'Geo-fences',
    subtitle: 'Locations access is allowed from. A simulated client position is evaluated against these.',
    resource: 'geoFences',
    primaryAction: 'Add geo-fence',
    columns: [
      { key: 'name', label: 'Fence', bold: true },
      { key: 'lat', label: 'Latitude', mono: true },
      { key: 'lon', label: 'Longitude', mono: true },
      { key: 'radiusMetres', label: 'Fence radius (metres)', align: 'right', num: true },
      { key: 'city', label: 'City', dim: true },
      { key: 'action', label: 'Action', pill: (v) => v === 'deny' ? 'bad' : null },
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
  /**
   * Software packages — a read-only inventory, not a list you edit.
   *
   * Velto's columns are Name · Version · Platform · Publisher · Package ·
   * Status, and the toolbar has no Add, no CSV and no Delete: the catalogue
   * is supplied, not authored. The `Package` column is a winget-style
   * identifier (`RiotGames.LeagueOfLegends.KR`), which is what the agent
   * actually matches on, so it is the column the app blocker needs and the
   * one worth setting in mono.
   */
  '/software-packages': {
    title: 'Software packages',
    subtitle: 'What the agent has seen installed across the estate. Supplied, not authored — use App blocker to act on anything here.',
    resource: 'softwarePackages',
    searchFields: ['name', 'publisher', 'packageId'],
    emptyTitle: 'No packages inventoried',
    emptyBody: 'The catalogue fills in as agents report what is installed.',
    columns: [
      { key: 'name', label: 'Name', bold: true },
      { key: 'version', label: 'Version', mono: true },
      { key: 'platform', label: 'Platform' },
      { key: 'publisher', label: 'Publisher', dim: true },
      { key: 'packageId', label: 'Package', mono: true },
      { key: 'status', label: 'Status', pill: statusPill }
    ]
  },

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

  /**
   * Application groups.
   *
   * This had a name and a description and no way to put an application in
   * one, which made the screen a list of empty labels — and the thing an
   * access rule points at was therefore always empty.
   *
   * Velto's model: a group has a **type**, and it holds members of that type.
   * NET groups hold addresses and the services reachable on them; every other
   * type holds applications of that same type, chosen from a searchable list.
   * A group does not mix types, which is why the picker narrows by it.
   */
  '/application-groups': {
    singular: 'application group',
    formSubtitle: 'A group has a type and holds members of that type. One access rule pointing here covers all of them.',
    form: [
      { key: 'name', label: 'Group name', required: true, placeholder: 'Analytics-apps' },
      { key: 'type', label: 'Type', required: true,
        options: ['WEB', 'FQDN', 'RDP', 'SSH', 'VNC', 'DB', 'WFS', 'NET'],
        hint: 'Decides what the group can contain. NET holds addresses and ports; the rest hold applications of that kind.' },
      { key: 'memberIds', label: 'Applications', type: 'pick', resource: 'applications',
        placeholder: 'Search applications',
        labelKey: 'name', hintKey: 'host',
        /* Narrowed by the type chosen above: a WEB group offering an SSH
           host is an error the form should not let you make. NET groups hold
           addresses rather than applications, so the picker goes quiet. */
        filters: (form) => form.type && form.type !== 'NET'
          ? { type: String(form.type).toLowerCase() } : { type: '__none__' },
        hint: 'Only applications of the type chosen above belong in the group.' },
      { key: 'description', label: 'Description', placeholder: 'What this group is for' }
    ],
    title: 'Application groups',
    subtitle: 'A rule pointing at a group covers every application in it.',
    resource: 'appGroups',
    primaryAction: 'Add group',
    searchFields: ['name', 'type', 'description'],
    emptyTitle: 'No application groups',
    emptyBody: 'Group applications of one type so a single access rule can cover all of them.',
    columns: [
      { key: 'name', label: 'Group', bold: true },
      { key: 'type', label: 'Type' },
      { key: 'memberIds', label: 'Applications', align: 'right', num: true,
        cell: (v) => Array.isArray(v) ? v.length : 0 },
      { key: 'description', label: 'Description', dim: true },
      { key: 'createdAt', label: 'Created', cell: fmtDate, dim: true }
    ]
  },

  /**
   * Device policy.
   *
   * Velto's form is Name, Status, Description, OS and Type — and the Type
   * list depends on the OS: Windows offers Registry, Script, Config and
   * Command, while macOS and Linux offer the last three. Registry is a
   * Windows idea, and offering it beside macOS is offering something that
   * cannot work.
   *
   * This had four invented booleans instead, which described a posture check
   * rather than a policy. The value field below is the one velto implies and
   * does not label well: a Registry policy needs a key path, a Script needs a
   * script, a Command needs a command line. What it asks for changes with the
   * type, because otherwise it is a box called "value" that nobody can fill
   * in correctly.
   */
  '/device-policy': {
    singular: 'device policy',
    formSubtitle: 'Something the agent applies to a device: a registry key, a script, a config file or a command.',
    form: [
      { key: 'name', label: 'Policy name', required: true, placeholder: 'Contractor laptops' },
      { key: 'status', label: 'Status', options: ['Enabled', 'Disabled'] },
      { key: 'description', label: 'Description', placeholder: 'What this policy is for' },
      { key: 'os', label: 'Operating system', required: true,
        options: ['Windows', 'macOS', 'Linux'] },
      { key: 'type', label: 'Type', required: true,
        /* Registry only exists on Windows. */
        options: (form) => form.os === 'Windows'
          ? ['Registry', 'Script', 'Config', 'Command']
          : ['Script', 'Config', 'Command'],
        hint: 'Registry is Windows only. The field below changes with this.' },
      { key: 'value', label: 'Value', type: 'textarea',
        label2: true,
        placeholder: 'HKLM\\SOFTWARE\\Policies\\… or the script to run',
        hint: 'A registry path, a script, the contents of a config file, or a command line — whichever the type above names.' }
    ],
    title: 'Device policy',
    subtitle: 'Requirements a device has to meet before its user can connect.',
    resource: 'devicePolicies',
    primaryAction: 'Add policy',
    columns: [
      { key: 'name', label: 'Name', bold: true },
      { key: 'os', label: 'OS' },
      { key: 'type', label: 'Type' },
      { key: 'description', label: 'Description', dim: true },
      { key: 'status', label: 'Status', pill: statusPill }
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

  /**
   * Device updates — software push, not an agent version table.
   *
   * This was built as "which agent build each platform should run", which is
   * a reasonable guess at the name and not what the feature is. Velto pushes
   * a **file** to managed devices: upload it, give it arguments, say when it
   * installs, and then check afterwards that it actually did — by looking for
   * a registry key or a file that the installer should have left behind.
   *
   * That last part is the bit worth having. A push with no post-install check
   * reports success when the installer silently failed, which is how an
   * estate ends up believing it is patched.
   */
  '/device-updates': {
    singular: 'push',
    formSubtitle: 'A file pushed to managed devices, and the check that proves it installed.',
    form: [
      { key: 'name', label: 'Name', required: true, placeholder: 'Falcon sensor 7.20' },
      { key: 'fileName', label: 'Filename', required: true, placeholder: 'FalconSensor.msi' },
      { key: 'status', label: 'Status', options: ['Enabled', 'Disabled'] },
      { key: 'arguments', label: 'Arguments', placeholder: '/quiet /norestart',
        hint: 'Passed to the installer. Silent flags belong here or every device shows a dialog.' },
      { key: 'installSchedule', label: 'Install schedule', required: true,
        options: ['Immediate', 'After-Reboot', 'Uninstall'] },
      { key: 'validationCheck', label: 'Post validation check', required: true,
        options: ['Registry Key present', 'File present'],
        hint: 'Without this a push that silently failed still reports success.' },
      { key: 'checkValue', label: 'Post validation check value',
        placeholder: 'HKLM\SOFTWARE\CrowdStrike or C:\Program Files\CrowdStrike\CSFalconService.exe' }
    ],
    title: 'Device updates',
    subtitle: 'Software pushed to managed devices, with the check that proves it landed.',
    resource: 'deviceUpdates',
    primaryAction: 'Add push',
    searchFields: ['name', 'fileName'],
    emptyTitle: 'Nothing is being pushed',
    emptyBody: 'Add a package to install it across the devices your policy covers.',
    columns: [
      { key: 'name', label: 'Name', bold: true },
      { key: 'fileName', label: 'Filename', mono: true },
      { key: 'arguments', label: 'Arguments', mono: true, cell: (v) => v || dash },
      { key: 'installSchedule', label: 'Schedule' },
      { key: 'validationCheck', label: 'Validated by', dim: true },
      { key: 'status', label: 'Status', pill: statusPill }
    ]
  },

  /**
   * Risk profiles.
   *
   * This was invented: a weighted score built from posture, location and
   * time, with four numbers to tune and a maximum to compare against. It
   * reads plausibly and is not what the product does.
   *
   * Velto's model is simpler and better: a profile names some of twelve risk
   * events, and one action to take when any of them happens. No weights, no
   * threshold, nothing to tune — which matters, because a number like
   * "maximum allowed score: 60" means nothing to the person setting it and
   * cannot be explained to the person it locks out.
   */
  '/risk-profiles': {
    singular: 'risk profile',
    formSubtitle: 'Risk events to watch for, and what to do when one happens.',
    form: [
      { key: 'name', label: 'Name', required: true, placeholder: 'High-risk sign-ins' },
      { key: 'types', label: 'Types', type: 'pick', required: true,
        choices: RISK_TYPES.map(t => ({ value: t, label: t })),
        placeholder: 'Select risk types',
        hint: 'Any one of these triggers the action below — they are not scored or combined.' },
      { key: 'action', label: 'Action', required: true, options: RISK_ACTIONS,
        hint: 'Suspend and Disconnect are not the same: one ends the session, the other locks the account.' }
    ],
    title: 'Risk profiles',
    subtitle: 'What counts as risky, and what happens when it is seen.',
    resource: 'riskProfiles',
    primaryAction: 'Add profile',
    searchFields: ['name', 'action'],
    emptyTitle: 'No risk profiles',
    emptyBody: 'Add one to act automatically on a failed device check, an IP switch or a sign-in from a new location.',
    columns: [
      { key: 'name', label: 'Name', bold: true },
      { key: 'types', label: 'Types',
        cell: (v) => Array.isArray(v) ? (v.join(', ') || 'none') : (v || 'none') },
      { key: 'action', label: 'Action',
        /* Denying, suspending and disconnecting are interventions; mailing an
           admin is a notification. Only the first three take a mark. */
        pill: (v) => v && v !== 'Email Admin' ? 'bad' : null }
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
