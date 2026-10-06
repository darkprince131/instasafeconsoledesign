-- =====================================================================
-- i365 demo console — Postgres schema
-- =====================================================================
-- Written for Neon (free tier), but this is plain Postgres and runs on
-- anything. It is deliberately relational and deliberately boring, because
-- its real job is to be the thing your Laravel developers inherit: every
-- table here maps to one Eloquent model and one migration, near enough
-- line for line.
--
-- That is also why this is not MongoDB. A document schema would have to be
-- thrown away and redesigned the moment it met Eloquent.
--
-- ---------------------------------------------------------------------
-- MULTI-TENANCY, AND WHY THE DEMO NEEDS IT
--
-- A single shared database means one visitor deleting every user breaks
-- the demo for everyone after them. So each visitor gets their own tenant,
-- seeded on first arrival, and every row is scoped by tenant_id.
--
-- This is not a demo hack. i365 is a multi-tenant product — veno and velto
-- are tenants — so the demo is showing the real shape of the thing. The
-- scoping your developers write for production is the scoping here.
--
-- Demo tenants expire; a real one never would. That is the only difference.
--
-- Note the primary keys: every tenant-scoped table is keyed on
-- (tenant_id, id), not on id alone. Seeded ids are deterministic, so with a
-- global key the first tenant claims them and every later tenant's insert is
-- silently skipped. Ids are unique within a tenant, which is what
-- multi-tenancy means.
-- =====================================================================

-- ---------------------------------------------------------------- tenants
create table if not exists tenants (
  id            text primary key,              -- 'veno', or a demo visitor id
  name          text        not null,
  is_demo       boolean     not null default true,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  -- demo tenants are swept after a few days of silence; production is null
  expires_at    timestamptz
);

create index if not exists tenants_expiry_idx on tenants (expires_at)
  where expires_at is not null;

-- ------------------------------------------------------------------ users
create table if not exists users (
  id            text,
  tenant_id     text not null references tenants(id) on delete cascade,
  first_name    text not null,
  last_name     text,
  username      text not null,
  email         text not null,
  department    text,
  auth_profile  text not null default 'Local',
  status        text not null default 'pending'
                  check (status in ('active','pending','suspended')),
  country_code  text,
  mobile        text,
  location      text,

  -- MFA. The secret is a real base32 TOTP secret (RFC 6238).
  -- In production this column is encrypted at rest and never leaves the
  -- server; the demo's only concession is that it is not encrypted here.
  mfa_enrolled        boolean not null default false,
  mfa_secret          text,
  mfa_pending_secret  text,

  -- per-user policy, mirroring the switches on the production add form
  device_binding       boolean not null default true,
  device_check_enabled boolean not null default true,
  geo_fence_enabled    boolean not null default false,
  auto_suspend         boolean not null default false,

  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (tenant_id, username),
  unique (tenant_id, email)
);

create index if not exists users_tenant_idx on users (tenant_id);
create index if not exists users_status_idx on users (tenant_id, status);
create index if not exists users_mfa_idx    on users (tenant_id, mfa_enrolled);

-- ----------------------------------------------------------------- groups
create table if not exists groups (
  id             text,
  tenant_id      text not null references tenants(id) on delete cascade,
  name           text not null,
  auth_type      text not null default 'Local',
  two_factor     boolean not null default true,
  device_binding boolean not null default true,
  device_checks  boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists group_members (
  tenant_id  text not null references tenants(id) on delete cascade,
  group_id   text not null references groups(id)  on delete cascade,
  user_id    text not null references users(id)   on delete cascade,
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on group_members (user_id);

-- ---------------------------------------------------------------- devices
create table if not exists devices (
  id            text,
  tenant_id     text not null references tenants(id) on delete cascade,
  user_id       text references users(id) on delete set null,
  name          text not null,
  os            text,
  os_family     text,
  agent_version text,
  mac_address   text,
  ip_address    inet,
  fingerprint   text,                          -- real browser fingerprint hash
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  bound         boolean not null default false,
  city          text,
  country_code  text,
  lat           double precision,
  lon           double precision,
  -- posture as reported by the agent. jsonb rather than 20 boolean columns
  -- because the check set is configurable per tenant and will grow.
  posture       jsonb not null default '{}'::jsonb,
  last_seen_at  timestamptz,
  enrolled_at   timestamptz not null default now(),
  unique (tenant_id, fingerprint)
);

create index if not exists devices_tenant_idx on devices (tenant_id);
create index if not exists devices_status_idx on devices (tenant_id, status);
create index if not exists devices_user_idx   on devices (user_id);

-- ---------------------------------------------------------- device checks
create table if not exists device_checks (
  id          text,
  tenant_id   text not null references tenants(id) on delete cascade,
  name        text not null,
  posture_key text not null,                   -- the key inside devices.posture
  expect      boolean not null,
  severity    text not null default 'medium'
                check (severity in ('low','medium','high','critical')),
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------- applications
create table if not exists applications (
  id         text,
  tenant_id  text not null references tenants(id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('web','rdp','ssh','vnc')),
  host       text not null,
  port       integer not null,
  owner      text,
  status     text not null default 'active' check (status in ('active','disabled')),

  -- the session controls. These are the differentiated part of the product,
  -- so they are first-class columns rather than a settings blob.
  session_recording boolean not null default false,
  block_copy_paste  boolean not null default false,
  watermark         boolean not null default false,

  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists app_services (
  id         text,
  tenant_id  text not null references tenants(id) on delete cascade,
  name       text not null,
  protocol   text not null default 'tcp',
  port       integer not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------- access rules
-- Order is the semantics: the first matching rule wins and the rest never
-- run. priority is therefore not decoration, and the unique constraint keeps
-- two rules from claiming the same slot.
create table if not exists access_rules (
  id          text,
  tenant_id   text not null references tenants(id) on delete cascade,
  name        text not null,
  priority    integer not null,
  source_type text not null check (source_type in ('user','group','application')),
  source      text not null,
  dest_type   text not null check (dest_type in ('application','url','content','filetype','domainlist')),
  dest        text not null,
  action      text not null check (action in ('allow','deny','bypass')),
  schedule_id text,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (tenant_id, priority)
);

create index if not exists access_rules_eval_idx
  on access_rules (tenant_id, enabled, priority);

create table if not exists time_schedules (
  id         text,
  tenant_id  text not null references tenants(id) on delete cascade,
  name       text not null,
  days       integer[] not null default '{1,2,3,4,5}',
  start_time time not null default '09:00',
  end_time   time not null default '18:00',
  timezone   text not null default 'UTC',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------ controllers + gateways
create table if not exists controllers (
  id             text,
  tenant_id      text not null references tenants(id) on delete cascade,
  name           text not null,
  region         text,
  ip             inet,
  version        text,
  status         text not null default 'running'
                   check (status in ('running','restarting','stopped')),
  pending_commit boolean not null default false,
  uptime_days    integer not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists gateways (
  id              text,
  tenant_id       text not null references tenants(id) on delete cascade,
  name            text not null,
  region          text,
  ip              inet,
  version         text,
  status          text not null default 'up' check (status in ('up','degraded','down')),
  sessions        integer not null default 0,
  throughput_mbps integer not null default 0,
  latency_ms      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------- sessions
create table if not exists sessions (
  id             text,
  tenant_id      text not null references tenants(id) on delete cascade,
  user_id        text references users(id) on delete set null,
  application_id text references applications(id) on delete set null,
  gateway        text,
  city           text,
  status         text not null default 'active' check (status in ('active','ended')),
  bytes_in       bigint not null default 0,
  bytes_out      bigint not null default 0,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz
);

create index if not exists sessions_live_idx on sessions (tenant_id, status);

-- ------------------------------------------------------------ event log
-- Append-only. Every meaningful action writes one row, which is what makes
-- the demo provably wired rather than a set of screenshots.
create table if not exists event_log (
  id         bigserial primary key,
  tenant_id  text not null references tenants(id) on delete cascade,
  type       text not null,
  severity   text not null default 'info'
               check (severity in ('info','warning','error')),
  actor      text,
  message    text not null,
  ip         inet,
  city       text,
  meta       jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now()
);

create index if not exists event_log_recent_idx on event_log (tenant_id, at desc);
create index if not exists event_log_type_idx   on event_log (tenant_id, type);

-- ------------------------------------------------------------- outbound
-- The Demo Inbox. Everything that would leave the system in production —
-- SMS, email, push, SIEM payloads — lands here instead. In production this
-- table is the send queue, which is the same shape.
create table if not exists outbound (
  id         text,
  tenant_id  text not null references tenants(id) on delete cascade,
  kind       text not null check (kind in ('sms','email','push','webhook','siem','report')),
  subject    text,
  body       text,
  meta       jsonb not null default '{}'::jsonb,
  read       boolean not null default false,
  at         timestamptz not null default now()
);

create index if not exists outbound_recent_idx on outbound (tenant_id, at desc);

-- -------------------------------------------------------------- settings
create table if not exists settings (
  tenant_id text not null references tenants(id) on delete cascade,
  key       text not null,
  value     jsonb not null,
  primary key (tenant_id, key)
);

-- =====================================================================
-- Sweeping expired demo tenants.
-- Run from a scheduled Netlify function, daily. Cascades do the rest.
-- =====================================================================
-- delete from tenants where is_demo and expires_at < now();
