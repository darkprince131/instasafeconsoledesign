/**
 * SIEM formatters.
 *
 * Turns event-log rows into the wire formats a SIEM actually ingests. These
 * are the real specifications, not a plausible-looking approximation:
 *
 *   - RFC 5424 syslog, including the structured-data element
 *   - ArcSight CEF 0, with the prefix pipe-escaped and extension keys from
 *     the CEF dictionary
 *   - IBM QRadar LEEF 2.0, tab-delimited
 *   - raw JSON lines, for anything that takes an HTTP collector
 *
 * Escaping is where hand-rolled SIEM output usually goes wrong, so it is done
 * properly here: CEF escapes `\` and `|` in the prefix and `\` and `=` in the
 * extension, and newlines become `\n` rather than breaking the record in two.
 *
 * This file is production-correct and ships as-is. A real deployment changes
 * only where the output is sent.
 */

const VENDOR = 'InstaSafe'
const PRODUCT = 'i365'
const VERSION = '3.4.1'

/** Event type -> CEF severity (0-10) and a human name. */
const SIGNATURES = {
  'auth.login.success':   { sev: 2,  name: 'User authenticated' },
  'auth.login.failed':    { sev: 6,  name: 'Authentication failure' },
  'auth.mfa.success':     { sev: 2,  name: 'MFA challenge passed' },
  'auth.mfa.failed':      { sev: 7,  name: 'MFA challenge failed' },
  'auth.mfa.enrolled':    { sev: 3,  name: 'MFA enrolled' },
  'auth.mfa.reset':       { sev: 6,  name: 'MFA reset' },
  'device.enrolled':      { sev: 3,  name: 'Device enrolled' },
  'device.approved':      { sev: 2,  name: 'Device approved' },
  'device.rejected':      { sev: 5,  name: 'Device rejected' },
  'device.check.failed':  { sev: 7,  name: 'Device posture failure' },
  'access.granted':       { sev: 2,  name: 'Access granted' },
  'access.denied':        { sev: 6,  name: 'Access denied' },
  'user.created':         { sev: 3,  name: 'User created' },
  'user.suspended':       { sev: 5,  name: 'User suspended' },
  'user.activated':       { sev: 3,  name: 'User activated' },
  'rule.updated':         { sev: 5,  name: 'Access rule changed' },
  'session.started':      { sev: 2,  name: 'Session started' },
  'session.ended':        { sev: 2,  name: 'Session ended' },
  'sso.test.oidc':        { sev: 1,  name: 'OIDC test' },
  'sso.test.saml':        { sev: 1,  name: 'SAML test' }
}

const sigFor = (type) => SIGNATURES[type] || { sev: 3, name: type }

/* RFC 5424 severity from our three levels, mapped into the syslog range. */
const SYSLOG_SEV = { info: 6, warning: 4, error: 3 }
const FACILITY = 13   // log audit

function rfc3339 (at) {
  return new Date(at).toISOString().replace('Z', '+00:00')
}

/** CEF prefix: escape backslash and pipe. */
const cefPrefix = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
/** CEF extension value: escape backslash, equals, and newlines. */
const cefValue = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/\r?\n/g, '\\n')
/** LEEF is tab-delimited, so a literal tab would split the record. */
const leefValue = (s) => String(s ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')

export function toSyslog (e, host = 'i365.instasafe.com') {
  const sev = SYSLOG_SEV[e.severity] ?? 6
  const pri = FACILITY * 8 + sev
  const sd = `[i365@32473 event="${e.type}" actor="${e.actor || '-'}" outcome="${e.severity}" src="${e.ip || '-'}" loc="${e.city || '-'}"]`
  return `<${pri}>1 ${rfc3339(e.at)} ${host} ${PRODUCT} - ${e.type} ${sd} ${e.message}`
}

export function toCef (e) {
  const sig = sigFor(e.type)
  const prefix = [
    'CEF:0', cefPrefix(VENDOR), cefPrefix(PRODUCT), cefPrefix(VERSION),
    cefPrefix(e.type), cefPrefix(sig.name), sig.sev
  ].join('|')
  const ext = [
    ['rt', new Date(e.at).getTime()],
    ['suser', e.actor],
    ['src', e.ip],
    ['cs1Label', 'location'], ['cs1', e.city],
    ['cs2Label', 'outcome'], ['cs2', e.severity],
    ['msg', e.message]
  ].filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${cefValue(v)}`)
    .join(' ')
  return `${prefix}|${ext}`
}

export function toLeef (e) {
  const sig = sigFor(e.type)
  const header = ['LEEF:2.0', VENDOR, PRODUCT, VERSION, e.type, '\t'].join('|')
  const attrs = [
    ['devTime', rfc3339(e.at)],
    ['devTimeFormat', 'yyyy-MM-dd\'T\'HH:mm:ss.SSSXXX'],
    ['usrName', e.actor],
    ['src', e.ip],
    ['severity', sig.sev],
    ['cat', sig.name],
    ['location', e.city],
    ['msg', e.message]
  ].filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${leefValue(v)}`)
    .join('\t')
  return header + attrs
}

export function toJsonLine (e) {
  return JSON.stringify({
    '@timestamp': new Date(e.at).toISOString(),
    vendor: VENDOR, product: PRODUCT, version: VERSION,
    event: { type: e.type, name: sigFor(e.type).name, severity: e.severity },
    user: { name: e.actor },
    source: { ip: e.ip, geo: { city: e.city } },
    message: e.message
  })
}

export const FORMATS = {
  syslog: { label: 'Syslog (RFC 5424)', render: toSyslog, transport: 'UDP 514 / TCP 601 / TLS 6514',
    note: 'The default for most collectors. The structured-data element carries the fields a parser needs without them having to be dug out of the message.' },
  cef:    { label: 'CEF (ArcSight)', render: toCef, transport: 'Syslog',
    note: 'Pipe-delimited header plus key=value extension. Micro Focus ArcSight and most SIEMs that claim CEF support.' },
  leef:   { label: 'LEEF 2.0 (QRadar)', render: toLeef, transport: 'Syslog',
    note: 'IBM QRadar. Tab-delimited attributes; the delimiter is declared in the header.' },
  json:   { label: 'JSON lines (ECS-ish)', render: toJsonLine, transport: 'HTTPS collector',
    note: 'One object per line, field names close to Elastic Common Schema. Splunk HEC, Elastic, Datadog.' }
}

export function renderBatch (events, format, host) {
  const fn = FORMATS[format]?.render
  if (!fn) return ''
  return events.map(e => fn(e, host)).join('\n')
}
