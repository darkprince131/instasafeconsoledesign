# Backend

The demo currently runs on IndexedDB. This folder is what replaces it with a
real database, and what your Laravel developers inherit.

## The decision, and why

**Neon Postgres (free) + Netlify Functions.** Not MongoDB.

| | Neon free | Supabase free | MongoDB Atlas free |
|---|---|---|---|
| Idle | suspends 5 min, **resumes automatically** | **pauses after 7 days, manual restore** | always on |
| Storage | 0.5 GB × up to 100 projects | 500 MB × 2 projects | 512 MB |
| Maps to Laravel | directly — Postgres → Eloquent | directly | **no** |

Two things decided it.

**Mongo is out because of the handoff.** Your developers are on Laravel and
Eloquent, which is relational. A document schema would be designed here and
then thrown away and redesigned the moment it met a migration. The whole
point of this demo is that the work transfers.

**Supabase is out because of the pause.** A free Supabase project stops after
seven days of inactivity and needs a human to click restore in a dashboard. A
demo linked from the marketing site that is dark on a quiet Monday is a
product failure. Neon suspends too, but resumes by itself in milliseconds on
the next query.

Netlify Functions come free with the site you already have, and writing the
API by hand is not a cost here — it is the deliverable. It is the reference
your developers write the Laravel routes from.

## What you need to do

1. Sign up at [neon.tech](https://neon.tech) — free, no card.
2. Create a project. Any region near your users.
3. Copy the connection string (it looks like
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
4. In Netlify → `instasafe-console-demo` → Site configuration → Environment
   variables, add `DATABASE_URL` with that value.

**Do not paste the connection string into chat, a commit, or a file.** It is a
live credential. The Netlify environment variable is the only place it goes.

Tell me once it is set and I will run the schema and wire the HTTP adapter.

## What switching looks like in the app

One line.

```js
// src/api/index.js
import { mockAdapter } from './adapters/mock.js'
const adapter = mockAdapter

// becomes
import { httpAdapter } from './adapters/http.js'
const adapter = httpAdapter({ baseURL: '/api' })
```

No component changes. No route changes. Nothing else in the app knows which
adapter is underneath, because everything only ever calls `api.users.list()`.
That indirection was built in from the first commit for exactly this moment.

## Multi-tenancy is not a demo hack

Every table is scoped by `tenant_id`, and each visitor gets their own tenant,
seeded on arrival.

Without it, one visitor selecting all users and pressing Delete breaks the
demo for everyone who arrives afterwards. With it, they can do their worst
inside their own sandbox.

It also happens to be the real shape of the product — `veno` and `velto` are
tenants — so the scoping written here is the scoping production needs rather
than something to unpick later. Demo tenants carry an `expires_at` and get
swept; a real tenant's is null. That is the only difference.

## Files

| | |
|---|---|
| `schema.sql` | The whole schema. Plain Postgres, one table per Eloquent model. |
| `functions/` | Netlify Functions implementing the API contract *(next)* |
| `seed.sql` | Tenant seeding, generated from `src/api/seed.js` *(next)* |

## For the Laravel developers

`schema.sql` is written to be read as a migration plan. Each `create table`
becomes one migration and one model. The notes worth carrying over:

- **`users.mfa_secret` must be encrypted at rest** and must never be sent to
  the client. The demo stores it in plaintext; production must not. It is a
  real RFC 6238 TOTP secret — `src/lib/totp.js` is production-correct and can
  ship as-is, only the storage changes.
- **`access_rules.priority` is unique per tenant** because order *is* the
  semantics — the first matching rule wins. Reordering is a transaction, not
  an update.
- **`devices.posture` is `jsonb`** rather than twenty boolean columns, because
  the device-check set is configurable per tenant and will grow.
- **`event_log` is append-only.** Nothing updates or deletes a row.
- **`outbound` is the send queue.** In the demo it is read by the Demo Inbox;
  in production it is drained by the SMS and email workers. Same table.
