/**
 * The API. One Netlify Function serving the whole contract in src/api/index.js.
 *
 * Runs on Neon's HTTP driver rather than a TCP pool, because serverless
 * functions are short-lived and a connection pool in that environment is a
 * source of exhausted-connection bugs rather than a performance win. Each
 * query is one HTTPS request; Neon's compute resumes by itself if it has
 * suspended.
 *
 * Two things make this safe to run as a public demo:
 *
 *   1. Every statement is parameterised. No string interpolation reaches SQL.
 *   2. Every statement is scoped to the caller's tenant, which is derived
 *      server-side from a signed cookie rather than read from the request
 *      body. A visitor cannot address another visitor's rows even by asking.
 *
 * This file is also the reference for the Laravel routes. Each handler maps
 * to one controller action; the SQL maps to one Eloquent query.
 */

import { neon } from '@neondatabase/serverless'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

/* Two call styles, and they are not interchangeable in @neondatabase/serverless v1:
     sql`select ...`              tagged template, for static SQL
     sql.query('select ...', [])  function call, for SQL built at runtime
   The function-call form on `sql` itself was removed in v1 and throws. Every
   query below whose text is assembled at runtime - because the table or the
   sort column cannot be a bound parameter - uses sql.query. */
const sql = neon(process.env.DATABASE_URL)

/* Signing key for the tenant cookie. Set TENANT_SECRET in Netlify; the
   fallback keeps local dev working but gives no real integrity, which is
   fine because local dev has no other visitors to protect anyone from. */
const SECRET = process.env.TENANT_SECRET || 'dev-only-not-a-secret'

const DEMO_TTL_DAYS = 7

/* Every tenant-scoped table keyed on (tenant_id, id). `tenants` is excluded:
   its id really is global. event_log is excluded: its id is a bigserial and
   already unique on its own. */
const PK_TABLES = [
  'users', 'groups', 'devices', 'device_checks', 'applications', 'app_services',
  'access_rules', 'controllers', 'gateways', 'auth_profiles', 'time_schedules',
  'geo_fences', 'sessions', 'outbound'
]
const json = (body, status = 200, headers = {}) => new Response(
  JSON.stringify(body),
  { status, headers: { 'content-type': 'application/json', ...headers } }
)

// ----------------------------------------------------------- tenant cookie
function sign (value) {
  return createHmac('sha256', SECRET).update(value).digest('base64url')
}

function parseTenantCookie (req) {
  const raw = req.headers.get('cookie') || ''
  const hit = raw.split(';').map(s => s.trim()).find(s => s.startsWith('i365_t='))
  if (!hit) return null
  const [id, mac] = decodeURIComponent(hit.slice('i365_t='.length)).split('.')
  if (!id || !mac) return null
  // constant-time compare, so a wrong signature leaks no timing information
  const expected = Buffer.from(sign(id))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return id
}

function tenantCookie (id) {
  const value = encodeURIComponent(`${id}.${sign(id)}`)
  return `i365_t=${value}; Path=/; Max-Age=${DEMO_TTL_DAYS * 86400}; SameSite=Lax; Secure; HttpOnly`
}

// --------------------------------------------------------------- migration
/* The schema is entirely `create table if not exists`, so the API can ensure
   it on first call instead of needing a separate migration step that somebody
   has to remember to run. Guarded so it happens once per container. */
let migrated = false
async function ensureSchema () {
  if (migrated) return
  await sql`
    create table if not exists tenants (
      id text primary key,
      name text not null,
      is_demo boolean not null default true,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      expires_at timestamptz
    )`
  await sql`
    create table if not exists users (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      first_name text not null, last_name text,
      username text not null, email text not null,
      department text, auth_profile text not null default 'Local',
      status text not null default 'pending',
      country_code text, mobile text, location text,
      is_admin boolean not null default false,
      -- group membership as an array rather than a join table: the demo only
      -- ever reads it whole, and a join table here would buy nothing
      groups text[] not null default '{}',
      mfa_enrolled boolean not null default false,
      mfa_secret text, mfa_pending_secret text,
      device_binding boolean not null default true,
      device_check_enabled boolean not null default true,
      geo_fence_enabled boolean not null default false,
      auto_suspend boolean not null default false,
      last_seen_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (tenant_id, username)
    )`
  await sql`create index if not exists users_tenant_idx on users (tenant_id)`
  await sql`
    create table if not exists groups (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      name text not null, auth_type text not null default 'Local',
      members integer not null default 0,
      two_factor boolean not null default true,
      device_binding boolean not null default true,
      device_checks boolean not null default false,
      access_rules integer not null default 0,
      created_at timestamptz not null default now()
    )`
  await sql`
    create table if not exists devices (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      user_id text, username text, name text not null,
      os text, os_family text, agent_version text,
      mac_address text, ip_address text, fingerprint text,
      status text not null default 'pending',
      bound boolean not null default false,
      city text, country_code text,
      lat double precision, lon double precision,
      posture jsonb not null default '{}'::jsonb,
      last_seen_at timestamptz,
      enrolled_at timestamptz not null default now()
    )`
  await sql`create index if not exists devices_status_idx on devices (tenant_id, status)`
  await sql`
    create table if not exists device_checks (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      name text not null, posture_key text not null,
      expect boolean not null, severity text not null default 'medium',
      enabled boolean not null default true,
      created_at timestamptz not null default now()
    )`
  await sql`
    create table if not exists applications (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      name text not null, type text not null,
      host text not null, port integer not null, owner text,
      status text not null default 'active',
      session_recording boolean not null default false,
      block_copy_paste boolean not null default false,
      watermark boolean not null default false,
      created_at timestamptz not null default now()
    )`
  await sql`
    create table if not exists app_services (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      name text not null, protocol text not null default 'tcp',
      port integer not null, created_at timestamptz not null default now()
    )`
  await sql`
    create table if not exists access_rules (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      name text not null, priority integer not null,
      source_type text not null, source text not null,
      dest_type text not null, dest text not null,
      action text not null, schedule text default 'Always',
      enabled boolean not null default true,
      created_at timestamptz not null default now()
    )`
  await sql`create index if not exists access_rules_eval_idx on access_rules (tenant_id, enabled, priority)`
  await sql`
    create table if not exists controllers (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      name text not null, region text, ip text, version text,
      status text not null default 'running',
      pending_commit boolean not null default false,
      uptime_days integer not null default 0,
      created_at timestamptz not null default now()
    )`
  await sql`
    create table if not exists gateways (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      name text not null, region text, ip text, version text,
      status text not null default 'up',
      sessions integer not null default 0,
      throughput_mbps integer not null default 0,
      latency_ms integer not null default 0,
      created_at timestamptz not null default now()
    )`
  await sql`
    create table if not exists auth_profiles (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      name text not null, type text not null,
      status text not null default 'configured',
      users integer not null default 0,
      host text, port integer, tls boolean not null default false,
      created_at timestamptz not null default now()
    )`
  await sql`
    create table if not exists time_schedules (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      name text not null, days integer[] not null default '{1,2,3,4,5}',
      start_time text not null default '09:00',
      end_time text not null default '18:00',
      timezone text not null default 'UTC',
      created_at timestamptz not null default now()
    )`
  await sql`
    create table if not exists geo_fences (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      name text not null, city text, country_code text,
      lat double precision, lon double precision,
      radius_km integer not null default 25,
      action text not null default 'allow',
      enabled boolean not null default true,
      created_at timestamptz not null default now()
    )`
  await sql`
    create table if not exists sessions (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      user_id text, username text,
      application_id text, application text, type text,
      gateway text, city text,
      status text not null default 'active',
      bytes_in bigint not null default 0,
      bytes_out bigint not null default 0,
      started_at timestamptz not null default now(),
      ended_at timestamptz
    )`
  await sql`
    create table if not exists event_log (
      id bigserial primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      type text not null, severity text not null default 'info',
      actor text, message text not null, ip text, city text,
      meta jsonb not null default '{}'::jsonb,
      at timestamptz not null default now()
    )`
  await sql`create index if not exists event_log_recent_idx on event_log (tenant_id, at desc)`
  await sql`
    create table if not exists outbound (
      id text primary key,
      tenant_id text not null references tenants(id) on delete cascade,
      kind text not null, subject text, body text,
      meta jsonb not null default '{}'::jsonb,
      read boolean not null default false,
      at timestamptz not null default now()
    )`
  await sql`
    create table if not exists settings (
      tenant_id text not null references tenants(id) on delete cascade,
      key text not null, value jsonb not null,
      primary key (tenant_id, key)
    )`

  /* `create table if not exists` does nothing to a table that already exists,
     so columns added after a table has shipped need their own statement.
     `add column if not exists` is idempotent, which keeps this safe to run on
     every cold start. Append here rather than editing the create above —
     editing it only helps databases that have not been created yet. */
  await sql`alter table users add column if not exists is_admin boolean not null default false`
  await sql`alter table users add column if not exists groups text[] not null default '{}'`

  /* The seed generates deterministic ids - usr_00001, app_0001, dc_0001 - so
     every tenant produces the same set. With `id` as a global primary key the
     first tenant claims them and every later tenant's insert is silently
     dropped by ON CONFLICT DO NOTHING, which is exactly as bad as it sounds:
     the second visitor gets an empty console and no error anywhere.

     The key is the pair. Ids are only ever unique within a tenant, which is
     what multi-tenancy means and what the production schema needs too. */
  for (const t of PK_TABLES) {
    await sql.query(`
      do $$
      begin
        if exists (
          select 1 from pg_constraint
          where conname = '${t}_pkey'
            and (select count(*) from unnest(conkey)) = 1
        ) then
          alter table ${t} drop constraint ${t}_pkey;
          alter table ${t} add primary key (tenant_id, id);
        end if;
      end $$;`)
  }

  migrated = true
}

// ------------------------------------------------------------ table access
/* Only these tables are reachable, and only by exact name. The table name is
   the one part of a query that cannot be parameterised, so it is matched
   against a fixed list rather than interpolated from the request. */
const TABLES = new Set([
  'users', 'groups', 'devices', 'device_checks', 'applications', 'app_services',
  'access_rules', 'controllers', 'gateways', 'auth_profiles', 'time_schedules',
  'geo_fences', 'sessions', 'event_log', 'outbound'
])

/* camelCase on the wire, snake_case in the database — the app keeps the
   JavaScript convention and Postgres keeps its own. */
const toSnake = (s) => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
const rowOut = (row) => row && Object.fromEntries(
  Object.entries(row).map(([k, v]) => [toCamel(k), v]))

const RESOURCE_TABLE = {
  users: 'users', groups: 'groups', devices: 'devices',
  deviceChecks: 'device_checks', applications: 'applications',
  appServices: 'app_services', accessRules: 'access_rules',
  controllers: 'controllers', gateways: 'gateways',
  authProfiles: 'auth_profiles', timeSchedules: 'time_schedules',
  geoFences: 'geo_fences', sessions: 'sessions',
  eventLog: 'event_log', inbox: 'outbound'
}

// ------------------------------------------------------------- the handler
export default async (req, context) => {
  if (!process.env.DATABASE_URL) {
    return json({
      error: 'DATABASE_URL is not set',
      hint: 'Netlify → Site configuration → Environment variables. See console/backend/README.md.'
    }, 503)
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\/?/, '')
  let setCookie = null

  try {
    await ensureSchema()

    /* Every request is bound to a tenant, but the row is only written when
       the caller actually needs one. /health is reachable by uptime checks
       and crawlers, and creating a tenant per cookieless hit would fill a
       0.5 GB database with rows nobody asked for. */
    let tenant = parseTenantCookie(req)
    const anonymous = !tenant
    if (anonymous) {
      tenant = 't_' + randomUUID().replace(/-/g, '').slice(0, 16)
      setCookie = tenantCookie(tenant)
    }
    if (!anonymous) {
      await sql`update tenants set last_seen_at = now() where id = ${tenant}`
    } else if (path !== 'health') {
      await sql`
        insert into tenants (id, name, is_demo, expires_at)
        values (${tenant}, 'Demo tenant', true, now() + interval '7 days')
        on conflict (id) do nothing`
    }

    const body = req.method === 'GET' ? {} : await req.json().catch(() => ({}))
    const result = await route(path, req.method, body, url.searchParams, tenant)
    return json(result, 200, setCookie ? { 'set-cookie': setCookie } : {})
  } catch (err) {
    // the message is useful in a demo; a production build would log and
    // return something opaque
    return json({ error: err.message, path }, 500, setCookie ? { 'set-cookie': setCookie } : {})
  }
}

async function route (path, method, body, params, tenant) {
  // ---- health -----------------------------------------------------------
  if (path === 'health') {
    const [{ now }] = await sql`select now()`
    const [{ count }] = await sql`select count(*)::int from tenants`
    return { ok: true, now, tenants: count, tenant }
  }

  // ---- seeded? ----------------------------------------------------------
  if (path === 'seeded') {
    const [{ count }] = await sql`select count(*)::int from users where tenant_id = ${tenant}`
    return { seeded: count > 0, users: count }
  }

  // ---- bulk seed --------------------------------------------------------
  // The client generates the data (src/api/seed.js) and posts it, so the
  // seeding logic lives in one place rather than being written twice.
  if (path === 'seed' && method === 'POST') {
    return seedTenant(tenant, body)
  }

  if (path === 'reset' && method === 'POST') {
    for (const t of TABLES) await sql.query(`delete from ${t} where tenant_id = $1`, [tenant])
    return { ok: true }
  }

  // ---- stats ------------------------------------------------------------
  if (path === 'stats') {
    const [u] = await sql`
      select count(*)::int total,
             count(*) filter (where status = 'active')::int active,
             count(*) filter (where status = 'suspended')::int suspended,
             count(*) filter (where not mfa_enrolled)::int no_mfa
      from users where tenant_id = ${tenant}`
    const [d] = await sql`
      select count(*)::int total,
             count(*) filter (where status = 'pending')::int pending
      from devices where tenant_id = ${tenant}`
    const [g] = await sql`
      select count(*)::int total, count(*) filter (where status = 'up')::int up
      from gateways where tenant_id = ${tenant}`
    const [s] = await sql`select count(*)::int live from sessions where tenant_id = ${tenant} and status = 'active'`
    const [r] = await sql`select count(*)::int total from access_rules where tenant_id = ${tenant}`
    const [a] = await sql`select count(*)::int total from applications where tenant_id = ${tenant}`
    return {
      users: u.total, usersActive: u.active, usersSuspended: u.suspended,
      usersWithoutMfa: u.no_mfa,
      devices: d.total, devicesPending: d.pending,
      gateways: g.total, gatewaysUp: g.up,
      sessionsLive: s.live, rules: r.total, applications: a.total,
      licences: { used: u.total, total: 2000 }
    }
  }

  // ---- generic resource CRUD -------------------------------------------
  // /api/<resource>            GET list · POST create
  // /api/<resource>/<id>       GET one  · PUT update · DELETE remove
  const [resource, id] = path.split('/')
  const table = RESOURCE_TABLE[resource]
  if (!table || !TABLES.has(table)) {
    return { error: `Unknown resource "${resource}"` }
  }

  if (method === 'GET' && !id) return listRows(table, tenant, params)
  if (method === 'GET' && id) {
    const rows = await sql.query(`select * from ${table} where tenant_id = $1 and id = $2`, [tenant, id])
    return rowOut(rows[0]) || null
  }
  if (method === 'POST' && !id) return insertRow(table, tenant, body)
  if (method === 'PUT' && id) return updateRow(table, tenant, id, body)
  if (method === 'DELETE' && id) {
    await sql.query(`delete from ${table} where tenant_id = $1 and id = $2`, [tenant, id])
    return { ok: true }
  }
  if (method === 'POST' && id === 'bulk-delete') {
    await sql.query(`delete from ${table} where tenant_id = $1 and id = any($2)`, [tenant, body.ids || []])
    return { ok: true, count: (body.ids || []).length }
  }

  return { error: `No route for ${method} /${path}` }
}

// --------------------------------------------------------------- queries
async function listRows (table, tenant, params) {
  const page = Math.max(1, Number(params.get('page') || 1))
  const perPage = Math.min(500, Number(params.get('perPage') || 25))
  const search = params.get('search') || ''
  const sort = params.get('sort') || ''
  const dir = params.get('dir') === 'desc' ? 'desc' : 'asc'

  // the sort column is validated against the table's real columns rather
  // than interpolated, because an ORDER BY cannot be parameterised
  const cols = await sql.query(
    `select column_name from information_schema.columns where table_name = $1`, [table])
  const valid = new Set(cols.map(c => c.column_name))
  const sortCol = valid.has(toSnake(sort)) ? toSnake(sort) : null

  const where = ['tenant_id = $1']
  const args = [tenant]

  if (search) {
    const textCols = cols
      .filter(c => valid.has(c.column_name))
      .map(c => c.column_name)
      .filter(c => !['posture', 'meta', 'days'].includes(c))
    const parts = textCols.map(c => {
      args.push(`%${search}%`)
      return `${c}::text ilike $${args.length}`
    })
    if (parts.length) where.push(`(${parts.join(' or ')})`)
  }

  // simple equality filters: ?f.status=pending
  for (const [k, v] of params.entries()) {
    if (!k.startsWith('f.')) continue
    const col = toSnake(k.slice(2))
    if (!valid.has(col) || v === '' || v === 'all') continue
    args.push(v === 'true' ? true : v === 'false' ? false : v)
    where.push(`${col} = $${args.length}`)
  }

  const whereSql = where.join(' and ')
  const [{ count }] = await sql.query(
    `select count(*)::int from ${table} where ${whereSql}`, args)

  const order = sortCol ? `order by ${sortCol} ${dir}` : ''
  args.push(perPage, (page - 1) * perPage)
  const rows = await sql.query(
    `select * from ${table} where ${whereSql} ${order} limit $${args.length - 1} offset $${args.length}`,
    args)

  return {
    data: rows.map(rowOut), total: count, page, perPage,
    pages: Math.ceil(count / perPage)
  }
}

async function insertRow (table, tenant, body) {
  const cols = await sql.query(
    `select column_name from information_schema.columns where table_name = $1`, [table])
  const valid = new Set(cols.map(c => c.column_name))

  const record = { ...body, tenant_id: tenant }
  // event_log.id is a bigserial the database assigns; a client-supplied
  // text id is a type error rather than an override
  if (table === 'event_log') delete record.id
  const keys = [], values = []
  for (const [k, v] of Object.entries(record)) {
    const col = k === 'tenant_id' ? k : toSnake(k)
    if (!valid.has(col)) continue
    keys.push(col)
    values.push(v && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v)
  }
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await sql.query(
    `insert into ${table} (${keys.join(', ')}) values (${placeholders})
     on conflict do nothing returning *`, values)
  return rowOut(rows[0]) || record
}

async function updateRow (table, tenant, id, body) {
  const cols = await sql.query(
    `select column_name from information_schema.columns where table_name = $1`, [table])
  const valid = new Set(cols.map(c => c.column_name))

  const sets = [], args = []
  for (const [k, v] of Object.entries(body)) {
    const col = toSnake(k)
    if (!valid.has(col) || col === 'id' || col === 'tenant_id') continue
    args.push(v && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v)
    sets.push(`${col} = $${args.length}`)
  }
  if (!sets.length) return { ok: true }
  args.push(tenant, id)
  const rows = await sql.query(
    `update ${table} set ${sets.join(', ')}
     where tenant_id = $${args.length - 1} and id = $${args.length} returning *`, args)
  return rowOut(rows[0])
}

/**
 * Bulk insert for first-visit seeding.
 *
 * One multi-row INSERT per chunk rather than one per row. Seeding a tenant
 * touches several thousand rows, and on Neon's HTTP driver every statement is
 * its own HTTPS request — row-by-row would be thousands of round trips and
 * take minutes. Chunked at 200 rows, which keeps each statement well inside
 * Postgres's 65,535 bound-parameter ceiling.
 */
async function seedTenant (tenant, body) {
  const counts = {}
  for (const [resource, rows] of Object.entries(body)) {
    const table = RESOURCE_TABLE[resource]
    if (!table || !Array.isArray(rows) || !rows.length) continue

    const cols = await sql.query(
      `select column_name from information_schema.columns where table_name = $1`, [table])
    const valid = new Set(cols.map(c => c.column_name))

    // the column set is taken from the first row and reused, so every row in
    // a chunk binds the same shape
    let keys = Object.keys(rows[0]).map(toSnake).filter(c => valid.has(c))
    if (table === 'event_log') keys = keys.filter(k => k !== 'id')
    if (!keys.includes('tenant_id')) keys.push('tenant_id')

    const CHUNK = 200
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      const args = []
      const tuples = slice.map(row => {
        const camel = Object.fromEntries(
          Object.entries(row).map(([k, v]) => [toSnake(k), v]))
        camel.tenant_id = tenant
        const ph = keys.map(k => {
          let v = camel[k]
          if (v && typeof v === 'object' && !Array.isArray(v)) v = JSON.stringify(v)
          if (v === undefined) v = null
          args.push(v)
          return `$${args.length}`
        })
        return `(${ph.join(',')})`
      })
      await sql.query(
        `insert into ${table} (${keys.join(',')}) values ${tuples.join(',')}
         on conflict do nothing`, args)
    }
    counts[resource] = rows.length
  }
  return { ok: true, seeded: counts }
}

export const config = { path: '/api/*' }
