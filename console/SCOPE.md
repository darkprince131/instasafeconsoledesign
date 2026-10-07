# i365 self-serve demo — capability map

Everything the console does, what "working" means for each in a demo with no
backend, and build order. Derived from the 502 captured pages of `veno`, the
66 documented routes, and the JumpCloud / OpenVPN teardowns.

**Legend** — how real each thing is:

| | |
|---|---|
| **R** | Genuinely real. Actual crypto or logic runs. Provable to a sceptic. |
| **S** | Simulated, visibly. The flow is real, the far end is faked and says so. |
| **D** | Data-only. Seeded records, full CRUD, no external effect. |

---

## 1 · Identity and access

| Capability | Route | Real? | What works in the demo |
|---|---|---|---|
| Sign in | `/signin` | **R** | Seeded admin; session, timeout, sign-out |
| **TOTP MFA** | `/mfa-profile` | **R** | Real RFC 6238. QR scans into Google Authenticator, the 6-digit code is actually verified. Wrong code is rejected. |
| SMS OTP | — | **S** | Real send/verify flow; code appears in the Demo Inbox panel instead of a phone |
| Email OTP | — | **S** | Same, via Demo Inbox |
| Push approve | — | **S** | A pending push appears in Demo Inbox, approve or deny there |
| Passwordless | `/profile/passwordless` | **S** | Magic link lands in Demo Inbox and genuinely signs you in |
| Users | `/users` | **D** | Full CRUD, bulk ops, CSV in/out, activation states, suspend |
| User groups | `/usergroups` | **D** | CRUD, membership, inherited policy |
| Blocked users | `/limit-exceeders` | **D** | Auto-populated by failed-login simulation |
| Sub admins + roles | `/sub-admin/all`, `/roles` | **D** | 58 permission switches, and they actually gate the UI |

## 2 · Authentication profiles

Eight profile types, all with working add/edit/test.

| Profile | Route | Real? | Notes |
|---|---|---|---|
| Local | `/profile/local` | **R** | Password policy genuinely enforced on user create |
| **SAML 2.0** | `/profile/saml` | **S** | Real SAML redirect + POST assertion against a bundled mock IdP. XML is real and inspectable. |
| **OIDC / OpenID** | `/profile/openid` | **S** | Real authorization-code redirect dance, mock IdP, real JWT you can decode |
| OAuth 2.0 | `/profile/oauth` | **S** | Same mock provider |
| Active Directory | `/profile/active-directory` | **S** | "Test connection" runs against a seeded directory tree and returns real-looking results |
| LDAP / LDAPS | `/profile/ldap` | **S** | Same; TLS toggle changes the reported handshake |
| RADIUS | `/profile/radius` | **S** | Shared-secret test, seeded NAS clients |
| Azure AD / Google / SCIM | `/profile/azuread`, `/google`, `/scim-import` | **S** | SCIM import pulls a seeded user set, with a dry-run diff |

## 3 · Devices and endpoint control

| Capability | Route | Real? | Notes |
|---|---|---|---|
| Devices | `/devices` | **D** | 775 seeded pending — the real number from production |
| **Device binding** | `/auth-devices` | **R** | A real browser fingerprint is taken and bound; a second "device" is refused until approved |
| Device checks | `/device-checks` | **R** | Posture rules genuinely evaluate against an editable device payload — pass/fail is computed, not canned |
| Device policy | `/device-policy` | **D** | Policy objects, assignment |
| Geo-fences | `/geo-fences` | **S** | Map + radius; a simulated client location is evaluated against it |
| App blocker | `/app-blocker` | **D** | Blocklist, assignment |
| Device updates | `/device-updates` | **D** | Agent version matrix |
| **Windows logon** | — | **S** | Pre-logon flow walked through as a simulated agent session |

## 4 · Network and applications

| Capability | Route | Real? | Notes |
|---|---|---|---|
| Controllers | `/controllers` | **S** | Stop / Restart / Commit run a real state machine with timed transitions |
| Gateways | `/gateways` | **S** | Health, reachability, throughput — simulated but moving |
| Application services | `/application-services` | **D** | Protocol + port definitions |
| Applications | `/applications` | **D** | Web, **RDP**, **SSH**, VNC types with their per-type fields |
| **RDP / SSH launch** | — | **S** | Clicking Connect opens a convincing in-browser session surface with watermark, copy-paste block and session recording, matching the real option set |
| Application groups | `/application-groups` | **D** | Grouping and assignment |
| **Access rules** | `/access-rules` | **R** | The policy engine genuinely evaluates. Source × destination × action, and an explorer that answers "can this user reach that app, and why" |
| Filters | `/url-filter`, `/content-filter`, `/filetype-filter`, `/domainlists` | **R** | Rules genuinely match against test input |

## 5 · Monitoring

| Capability | Route | Real? | Notes |
|---|---|---|---|
| Dashboard | `/dashboard` | **D** | Live counts off the local DB, attention band |
| Live sessions | `/reports/live` | **S** | Sessions tick and change state |
| Access / application logs | `/reports/access-logs`, `/application-access-logs` | **D** | Generated from actual demo actions — what you do shows up |
| Event log | `/reports/event-logs` | **D** | Every action you take is written here. This is the proof the demo is wired. |
| Anomaly logs | `/reports/anomaly-logs` | **S** | Seeded + triggered by impossible-travel simulation |
| Session recording | `/reports/session-recording` | **S** | Playback surface over a recorded RDP/SSH demo session |
| Data / time usage | `/reports/data-uses-log`, `/time-uses-log` | **D** | Charts, replacing the four single-slice pies |
| Network test | `/reports/network-test` | **S** | Runs and reports |
| **SIEM export** | `/profile/export-log` | **S** | Syslog / CEF / LEEF payloads generated and shown exactly as they would ship |
| Report subscriptions | `/report-subscriptions` | **D** | Schedules; the mail lands in Demo Inbox |

## 6 · IDAM — InstaSafe as the identity provider

| Capability | Route | Real? | Notes |
|---|---|---|---|
| SAML IdP | `/saml-idp` | **S** | Issues a real signed-looking assertion to a bundled sample SP |
| OpenID IdP | `/openid-idp` | **S** | Real discovery doc, JWKS, token endpoint |
| OAuth2 service | `/oauth2-service` | **S** | Client registration, real code exchange |
| RADIUS server | `/authserver/radius` | **S** | Client list, shared secrets, simulated auth log |
| SCIM export | `/scim-export` | **S** | Real SCIM 2.0 JSON over a token |

## 7 · Settings

| Capability | Route | Real? |
|---|---|---|
| Company details | `/settings/company-details` | **D** — 29 fields, 3 contact tabs |
| Subscription | `/settings/subscription-details` | **D** — seats, expiry, usage |
| SMS / Email settings | `/sms-settings`, `/email-settings` | **S** — test send lands in Demo Inbox |
| User settings | `/user-settings` | **D** — 19 controls, 8 sections |
| Time schedules | `/time-schedules` | **R** — genuinely enforced at access evaluation |
| Risk profiles | `/risk-profiles` | **R** — score computed from device + geo + time |
| DNS / WINS | `/settings/dns-wins` | **D** |
| Downloads | `/downloads/*` | **D** — agent matrix |
| Asset inventory | `/asset-inventory` | **D** |
| Graph | `/graph` | **D** — topology view |

---

## Backend

Live on **Neon Postgres**, not IndexedDB. `VITE_BACKEND=http` selects the
adapter at build time; unset it and the whole app falls back to the browser
store with no code change. Every table is scoped by `tenant_id` and keyed on
`(tenant_id, id)`, and each visitor gets their own seeded tenant.

See `backend/README.md` for the decision and `backend/schema.sql` for the
schema as a migration plan.

## The Demo Inbox

One drawer, reachable from anywhere, holding everything that would leave the
system in production: SMS, email, push approvals, magic links, SIEM payloads,
webhook posts, scheduled reports.

It is what makes **S** honest. The flow runs for real right up to the boundary,
and then you can see exactly what crossed it. A visitor gets to watch an OTP be
generated, read it, type it in, and be let through — without us owning an SMS
gateway.

---

## Build order

Each phase is shippable on its own and goes live as it lands.

| Phase | What | Why this order |
|---|---|---|
| **0** ✅ | Shell, design system, router, DB, API layer, seed, event log, Demo Inbox | Everything else sits on it |
| **1** ✅ | Sign-in, **real TOTP**, users, groups | The spine, and the single best live demo |
| **2** ✅ | Devices, binding, posture checks | Completes the ZTNA story |
| **3** ✅ | Applications, **RDP/SSH surface**, access rules + explorer | The differentiated part |
| **4** ✅ | Auth profiles ×8, **SAML/OIDC with mock IdP** | The integration story |
| **5** ✅ | Reports, logs, **SIEM export**, session recording, anomalies | Proof it is observable |
| **6** | IDAM, filters, settings, remaining screens | Completeness |
| **7** | Guided tours over the top | The self-serve layer |

---

## Handing it to developers

The point of the API layer is that this is not throwaway.

```
src/api/index.js          the contract — every endpoint the console needs
src/api/adapters/mock.js  what ships here: IndexedDB
src/api/adapters/http.js  the stub devs fill in: axios → Laravel
```

Swapping backends is changing one import. Components never know which adapter
is underneath, because they only ever call `api.users.list()`.

The Vue components are plain SFCs on Bootstrap 5.3.8 markup, so they drop into
Blade views as-is — Blade is the server shell that mounts Vue, which is already
how the console is built.

**What devs replace:** the adapter, real Postgres/MySQL, a real SMS gateway, real
IdP connections, real agent telemetry.
**What they keep:** every component, every route, the design system, the flows.
