/**
 * The policy engine, as pure functions.
 *
 * These were living inside the mock adapter, which meant that on the real
 * backend the access explorer fell through to the mock and evaluated against
 * IndexedDB — a completely separate copy of the data. The verdict looked
 * plausible and was answering a question about the wrong tenant.
 *
 * Pure functions over rows that are passed in. Each adapter fetches from its
 * own store and calls the same code, so the answer is the same in both and
 * neither can drift from the other.
 *
 * This file is production-correct. A Laravel implementation is a direct
 * translation; the ordering semantics below are the part that matters.
 */

/**
 * Posture evaluation.
 * @param {Array}  checks  device_checks rows
 * @param {Object} posture the payload an agent reported
 */
export function evaluatePosture (checks, posture) {
  const results = (checks || []).filter(c => c.enabled).map(c => {
    const key = c.postureKey || c.key
    const actual = posture?.[key]
    return {
      id: c.id, name: c.name, postureKey: key,
      expected: c.expect, actual, pass: actual === c.expect,
      severity: c.severity
    }
  })
  const failed = results.filter(r => !r.pass)
  const blocking = failed.filter(r => r.severity === 'critical')
  return {
    ok: true,
    results,
    passed: results.length - failed.length,
    failed: failed.length,
    verdict: blocking.length ? 'blocked' : failed.length ? 'warn' : 'pass',
    reason: blocking.length
      ? `${blocking.length} critical check${blocking.length > 1 ? 's' : ''} failed: ${blocking.map(b => b.name).join(', ')}`
      : failed.length
        ? `${failed.length} non-critical check${failed.length > 1 ? 's' : ''} failed`
        : 'All checks passed'
  }
}

/* A rule now names what it points at by id, and carries the names only so a
   table has something to print. Ids are matched first; the name comparison
   stays because rules seeded or imported before the change have no ids, and
   silently refusing to match them would turn a working policy into a deny. */
const hasId = (ids, want) =>
  Array.isArray(ids) && ids.length > 0 && (want || []).some(w => ids.includes(w))

/* Either side may be a list: the rule's `source` is a comma-joined display
   string or an array, and a user belongs to several groups. */
const nameIn = (field, name) => {
  const have = Array.isArray(field) ? field
    : String(field || '').split(',').map(x => x.trim()).filter(Boolean)
  const want = Array.isArray(name) ? name : [name]
  return have.some(h => want.includes(h))
}

/**
 * Access evaluation.
 *
 * Walks the rule table in priority order. The first rule whose source and
 * destination both match decides, and every rule after it that would also
 * have matched is shadowed — unreachable, and worth reporting, because a rule
 * nobody can see is still a rule somebody believes is protecting them.
 *
 * A critical posture failure overrides an allow. It cannot override a deny,
 * because nothing should be able to.
 */
/**
 * Does a schedule cover this moment?
 *
 * A rule can name a shift schedule, the access explorer prints "only during
 * Business hours" underneath it, and nothing ever checked — the engine did
 * not look at schedules at all, so a rule limited to office hours allowed at
 * three in the morning. The screen said one thing and the engine did another,
 * which is worse than not having the feature.
 *
 * Days are 0-6 from Sunday, matching Date#getDay. A window whose end is
 * before its start runs through midnight, which is what a night shift is.
 */
export function scheduleCovers (schedule, at = new Date()) {
  if (!schedule) return true                       // no schedule means always
  const days = schedule.days
  if (Array.isArray(days) && days.length && !days.includes(at.getDay())) return false

  const mins = (t) => {
    const [h, m] = String(t || '').split(':').map(Number)
    return Number.isFinite(h) ? h * 60 + (m || 0) : null
  }
  const from = mins(schedule.startTime)
  const to = mins(schedule.endTime)
  if (from === null || to === null) return true

  const now = at.getHours() * 60 + at.getMinutes()
  return from <= to ? (now >= from && now <= to) : (now >= from || now <= to)
}

export function evaluateAccess ({ user, application, groups, rules, schedules, postureVerdict, at }) {
  if (!user || !application) {
    return { ok: false, error: 'Pick a user and an application.' }
  }

  const userGroupNames = (groups || [])
    .filter(g => (user.groups || []).includes(g.id) || g.name === user.department)
    .map(g => g.name)

  const ordered = (rules || [])
    .filter(r => r.enabled !== false)
    .sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999))

  const considered = []
  let decision = null

  const byName = new Map((schedules || []).map(s => [s.name, s]))
  const when = at || new Date()

  for (const rule of ordered) {
    /* Rules written in this console point at ids; rules that predate that
       carry names only. Match ids first and fall back, because silently
       failing to match an older rule turns a working policy into a deny. */
    const sourceHit =
      (rule.sourceType === 'group' &&
        (hasId(rule.sourceIds, user.groups) || nameIn(rule.source, userGroupNames))) ||
      (rule.sourceType === 'user' &&
        (hasId(rule.sourceIds, [user.id]) || nameIn(rule.source, user.username)))

    const destHit =
      (rule.destType === 'application' || rule.destType === 'application-group') &&
      (hasId(rule.destIds, [application.id]) || nameIn(rule.dest, application.name))

    /* A rule outside its shift window is not a rule right now. It is reported
       as considered-but-out-of-hours rather than dropped, because "why did
       this not apply" is the question the explorer exists to answer. */
    const sched = rule.schedule && rule.schedule !== 'Always' ? byName.get(rule.schedule) : null
    const inWindow = scheduleCovers(sched, when)
    const matched = sourceHit && destHit && inWindow

    considered.push({
      ...rule,
      matched,
      outOfHours: sourceHit && destHit && !inWindow,
      skippedBy: matched && decision ? decision.id : null
    })
    if (matched && !decision) decision = rule
  }

  let outcome = decision ? decision.action : 'deny'
  let because = decision
    ? `Rule #${decision.priority} "${decision.name}" (${decision.action})`
    : 'No rule matched. Default policy is deny.'

  if (outcome === 'allow' && postureVerdict?.verdict === 'blocked') {
    outcome = 'deny'
    because = `Rule #${decision.priority} allows this, but the device failed posture: ${postureVerdict.reason}`
  }

  return {
    ok: true,
    outcome,
    because,
    user: {
      id: user.id,
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      groups: userGroupNames
    },
    application: { id: application.id, name: application.name, type: application.type },
    decidedBy: decision || null,
    considered,
    posture: postureVerdict || null,
    shadowed: considered.filter(c => c.matched && c.skippedBy)
  }
}

/**
 * A device fingerprint for this browser.
 * Stable across reloads, different between machines, and good enough to
 * demonstrate binding — which is the only claim being made for it.
 */
export async function browserFingerprint () {
  const parts = [
    navigator.platform, navigator.hardwareConcurrency,
    screen.width + 'x' + screen.height, screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language
  ].join('|')
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts))
  return Array.from(new Uint8Array(buf)).slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0')).join('')
}
