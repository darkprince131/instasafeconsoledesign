# veno.instasafe.com — UX inventory (extraction only)

Read-only pass over `Downloads\capture` — 502 HTML snapshots, 72 pages/areas, captured
2026-09-19 from tenant Veno. Nothing was modified, created or deleted.

Counts are measured from the DOM of the named files, not estimated. **No redesigns are
proposed here.** Where a finding needs confirmation against the live console (because the
capture cannot show it), it is marked *needs-live-check*.

Conventions used below:

- **Click** = one deliberate pointer action (nav item, button, tab, dropdown open,
  option pick). Typing into a field is not counted as a click.
- **Clicks from login** = clicks after the sign-in page lands the admin on `/dashboard`.
  Sign-in itself is 2 submits (§1.1).
- **Controls** = `input` / `select` / `textarea` that are not hidden or submit.

---

## 1. NAVIGATION MAP

### 1.1 Entry

`/signin` (`login/login--signin--default.html`) presents **one field** (`#username`,
required) and one submit. The password step is a second screen — not captured, because the
capture used a non-existent user and the server returned "Invalid Credentials"
(`login--signin--after-next-1s.html`, `--after-next-3s.html`). Sign-in is therefore
**2 submits minimum**, landing on `/dashboard`.

Header (`global/global--header--user-menu.html`) offers, left to right: hamburger (`☰`),
logo → `/dashboard`, company name "Veno" → `/dashboard`, **FAQ → `instasafe.com/resources/faqs/`
(external)**, **Help → `support.instasafe.com` (external)**, session countdown
(`.timer-green[data-remaining-time]`), light/dark toggle, avatar → menu of exactly 3 items:
`Profile` (`/profile`), `MFA` (`/mfa-profile`), `Sign out`.

### 1.2 Tree

The left nav is **exactly 2 levels deep**. 19 top-level entries: **5 direct pages** and
**14 collapsible groups** containing **61 pages**. Total navigable pages: **66**.

Source: `global/global--nav--expanded.html`.

| # | Top-level entry | Type | Children | Routes |
|---|---|---|---|---|
| 1 | Dashboard | page | — | `/dashboard` |
| 2 | Asset Inventory | page | — | `/asset-inventory` |
| 3 | Graph | page | — | `/graph` |
| 4 | Controllers & Gateways | group | 2 | `/controllers`, `/gateways` |
| 5 | General Settings | group | 4 | `/settings/company-details`, `/settings/subscription-details`, `/sms-settings`, `/email-settings` |
| 6 | Authentication Profiles | group | 8 | `/profile/local`, `/profile/active-directory`, `/profile/ldap`, `/profile/radius`, `/profile/saml`, `/profile/oauth`, `/profile/openid`, `/profile/passwordless` |
| 7 | User Providers | group | 3 | `/profile/azuread`, `/profile/google`, `/profile/scim-import` |
| 8 | Users & Groups | group | 3 | `/users`, `/usergroups`, `/limit-exceeders` |
| 9 | User Settings | group | 4 | `/user-settings`, `/time-schedules`, `/risk-profiles`, `/settings/dns-wins` |
| 10 | Devices & Checks | group | 7 | `/devices`, `/auth-devices`, `/device-policy`, `/device-checks`, `/geo-fences`, `/app-blocker`, `/device-updates` |
| 11 | Filters | group | 4 | `/url-filter`, `/content-filter`, `/filetype-filter`, `/domainlists` |
| 12 | Applications | group | 3 | `/application-services`, `/applications`, `/application-groups` |
| 13 | Access Rules | page | — | `/access-rules` |
| 14 | Logs & Reports | group | 12 | `/reports/live`, `/reports/gateway`, `/reports/user-last-login`, `/reports/data-uses-log`, `/reports/time-uses-log`, `/reports/network-test`, `/reports/anomaly-logs`, `/reports/session-recording`, `/reports/session-log`, `/reports/access-logs`, `/reports/application-access-logs`, `/reports/event-logs` |
| 15 | Report Settings | group | 2 | `/profile/export-log`, `/report-subscriptions` |
| 16 | Downloads | group | 2 | `/downloads/user-agents`, `/downloads/gateway-agents` |
| 17 | Sub Admins & Roles | group | 2 | `/sub-admin/all`, `/sub-admin/roles` |
| 18 | IDAM | group | 5 | `/scim-export`, `/oauth2-service`, `/openid-idp`, `/saml-idp`, `/authserver/radius` |
| 19 | Tech Support | page | — | `/tech-support` |

### 1.3 Group expansion behaviour

Measured across snapshots:

| File | Groups | Expanded |
|---|---|---|
| `dashboard/dashboard--dashboard--default.html` | 14 | **0** |
| `access-rules/access-rules--access-rules--default.html` | 14 | **0** |
| `users-groups/users-groups--users--default.html` | 14 | 1 (`Users & Groups`) |
| `global/global--nav--group-open.html` | 14 | 1 (`User Providers`) |
| `global/global--nav--expanded.html` | 14 | 14 (all, manually) |

Default state is **all 14 groups collapsed**; only the group containing the current page
auto-expands. Groups are not accordion-exclusive — they stack when opened manually.

### 1.4 Clicks from login to every page

| Destination class | Pages | Clicks from `/dashboard` | Clicks from sign-in submit |
|---|---|---|---|
| `/dashboard` (landing) | 1 | 0 | 0 |
| Direct L1 pages (Asset Inventory, Graph, Access Rules, Tech Support) | 4 | **1** | 1 |
| L2 pages inside a collapsed group | 61 | **2** (expand group + page) | 2 |
| `/profile`, `/mfa-profile` | 2 | **2** (avatar + item) | 2 |
| `/signin` | 1 | 2 (avatar + Sign out) | — |

**Every page in the console is reachable in 2 clicks or fewer.** Depth is not the problem;
breadth is — 19 top-level entries and one group (Logs & Reports) with 12 children.

### 1.5 Nav observations, factual

- **No search over the nav.** The only search input in the product is the per-list keyword
  box (§7).
- **No breadcrumb anywhere.** `.container-heading > h2` carries a single page title
  (495 files); the parent group name is never shown in the content area.
- **No group landing pages.** All 14 group headers are `<a href="">` — they toggle only.
  An admin clicking "Devices & Checks" gets a list of 7 links, no overview.
- ~~**Two nav entries lead to pages with no list and no create action**:
  `/asset-inventory` … and `/graph` …~~ **CORRECTED — see `velto-supplement.md` §3.**
  Both pages render substantial content when the tenant has device data. In Veno
  (5 devices) they appear empty; in Velto (775 devices) `/asset-inventory` renders 6 charts
  and `/graph` renders a filter panel plus the force-graph canvas. The Veno snapshots show
  a data-starved state, not a broken page.
- **`/profile` and `/mfa-profile` are nav orphans** — reachable only from the avatar menu,
  absent from the left nav.
- **Both help affordances leave the product** (FAQ, Help → external domains). There is no
  in-product help surface.
- Group label wrapping is hard-coded with `<br>` in 3 labels: `Controllers &<br>Gateways`,
  `Authentication<br>Profiles`, `Users &amp; Groups `.

---

## 2. TASK PATHS

Click counts start at `/dashboard`. "Fields" = controls the admin must touch; required
counts are from `required` attributes and `span.text-danger` markers.

### 2.1 Create a user

Files: `users-groups--users--default.html` → `--add.html` → `--add-tab-options.html` →
`--add-tab-advanced.html`, validation in `--add-validation.html`.

| Step | Screen | Click | Controls |
|---|---|---|---|
| 1 | expand `Users & Groups` | 1 | — |
| 2 | `/users` | 1 | — |
| 3 | `Add` → slide-in card `.card.show` | 1 | — |
| 4 | tab **Profile** | (default) | 11 controls, 10 labels, **8 required** |
| 5 | tab **Options** | 1 | 6 controls (1 multiselect + **5 switches**) |
| 6 | tab **Advanced** | 1 | 7 controls (**7 switches**) |
| 7 | `Save` | 1 | — |

**Minimum: 4 clicks, 8 required fields** (all on Profile — Options/Advanced are optional).
**Full pass: 6 clicks, 24 controls across 3 tabs, 12 of them switches.**

Required on Profile: First Name, Username, Email, Mobile Number, Authentication Type,
Activation Method, Password, Confirm Password. `Authentication Type` offers Certificate /
Password + Certs; `Activation Method` offers immediately-on-provisioning /
automatically-on-first-login / on-date-time (3 captured variants).

**Leave-the-flow points: 3.**
- `Member of Groups` (Options) lists existing groups only — a new group must be created at
  `/usergroups` first. No inline create (§2.8).
- `Shift Schedule`, `Risk Profile`, `Device Policy`, `Block Apps`, `Geofencing` (Advanced)
  all reference objects created on 5 other pages across 2 other nav groups.
- `Authentication Type` presumes an auth profile exists — created under
  `Authentication Profiles` (8 pages).

### 2.2 Create an application (and its prerequisite)

Files: `applications--application-services--add.html`, `applications--applications--add.html`
and 7 `--add-type-*.html` variants.

Application Services (prerequisite):

| Step | Screen | Click | Controls |
|---|---|---|---|
| 1–2 | expand `Applications` → `/application-services` | 2 | — |
| 3 | `Add` | 1 | 3 controls, **3 required** (Name, Protocol, Port) |
| 4 | `Save` | 1 | — |

Protocol options: UDP, TCP, ICMP, ANY.

Application:

| Step | Screen | Click | Controls |
|---|---|---|---|
| 1–2 | `/applications` (same group, already expanded) | 1 | — |
| 3 | `Add` | 1 | — |
| 4 | pick `Type` | 1 | 7 types |
| 5 | fill type-specific fields | — | 4–10 controls, see table |
| 6 | `Save` | 1 | — |

Field count **varies 4× by type** — the form reshapes after step 4:

| Type | Controls | Labels |
|---|---|---|
| FQDN | 4 | Name*, Type*, Fully Qualified domain name*, Port* |
| DB | 6 | + Driver*, Host*, Logo |
| WFS | 7 | Name*, Type*, Host*, Share*, Domain, Block Downloads*, Logo |
| RDP / SSH / VNC | 8 each | + IP Address*, Block Copy Paste*, Insert Watermark*, Session Recording*, Logo |
| WEB | 10 | + URL*, Direct Access*, Use Internal IP*, Landing Page, Block Copy Paste*, Insert Watermark*, Block Downloads*, Logo |

**Minimum: 4 clicks / 4 fields (FQDN). Maximum: 4 clicks / 10 fields (WEB).**

Application Groups (`applications--application-groups--add.html`) requires **three
prerequisites at once**: `Applications*` (from `/applications`),
`IP Address/Network*`, and `Service - Port / Port Range*` (from `/application-services`).

### 2.3 Create an access rule

Files: `access-rules--access-rules--add.html` plus 10 `--add-source-type-*` /
`--add-destination-type-*` variants and 13 `--edit-form-*` variants.

| Step | Screen | Click | Controls |
|---|---|---|---|
| 1 | `/access-rules` (L1, no group) | 1 | — |
| 2 | `Add` | 1 | — |
| 3 | `Name` | — | 1 required text |
| 4 | `Source Type` | 1 | 3 options: User, User Group, Application |
| 5 | `Source` | 1+ | vue-multiselect over existing objects |
| 6 | `Destination Type` | 1 | 7 options: Custom Application, Application, URL Filter, Content Filter, FileType Filter, Domain List, Application Group |
| 7 | `Destination` | 1+ | vue-multiselect over existing objects |
| 8 | `Enable Schedule` | (switch) | 1 switch |
| 9 | `Action` | 1 | 3 options: Allow, Deny, Bypass |
| 10 | `Save` | 1 | — |

**Minimum: 8 clicks, 6 controls, all 6 required** (`add.html`: 6 controls, 4 `required` +
2 `text-danger`, 1 switch).

Controls by type combination:

| Variant | Controls | Extra fields appearing |
|---|---|---|
| source = User / User Group | 6 | — |
| source = **Application** | 7 | + `IP address/Network*`, `Service*` |
| dest = Application Group | 6 | — |
| dest = Application / URL / Content / FileType / Domain List | 7 | — |
| dest = **Custom Application** | 8 | + `IP address/Network*`, `Service*` |

**Leave-the-flow points: up to 2 per rule, in different nav groups.** Source must already
exist as a User (`/users`, group 8), User Group (`/usergroups`, group 8) or Application
(`/applications`, group 12). Destination must already exist as an Application or
Application Group (group 12), or a URL / Content / FileType / Domain filter
(`/url-filter`, `/content-filter`, `/filetype-filter`, `/domainlists`, group 11).
Only **`Custom Application`** lets the admin type an IP/Network inline — 1 of 7 destination
types avoids the round trip.

### 2.4 Create a device check

File: `devices-checks--device-checks--add.html` + 24 `--add-check-*` variants.

| Step | Screen | Click | Controls |
|---|---|---|---|
| 1–2 | expand `Devices & Checks` → `/device-checks` | 2 | — |
| 3 | `Add` | 1 | — |
| 4 | `Rule Name` | — | required text |
| 5 | **`OS`** | 1 | **native `<select>` with 2,393 options** |
| 6 | `Check` | 1 | native `<select>`, 26 options (25 check types + placeholder) |
| 7 | `Check Value` | — | required text, **free-form for all 24 captured check types** |
| 8 | `Save` | 1 | — |

**Minimum: 6 clicks, 4 fields, all 4 required.**

The `OS` control (`select#os_id`) carries **2,393 options** in 58 files. It is a plain
native select — no type-ahead, no grouping. Sample sequence from the DOM: `11`,
`AlmaLinux`, `AlmaLinux 10.2 (Lavender Lion)`, `Amazon Linux`, `Amazon Linux 2`,
`Amazon Linux 2023`, `Android`, `Android 10`, `Android 10 211033MI`, `Android 10 AC2001`,
`Android 10 Acer One 8 T4 82L`, … — i.e. exact device-model strings mixed with OS families
at the same level.

Check types (25): AntiSpyWare, AntiSpywareStatus, Antivirus, AntiVirusLastUpdate,
AntiVirusStatus, BitLocker, BrowserID, DomainName, FileExists, FileNotExists, Firewall,
FirewallStatus, Hotfix, and 12 more (see the 24 `--add-check-*` files).
`Check Value` remains a **single free-text input regardless of which check is selected** —
the form does not adapt to the check type, unlike Applications (§2.2) and Access Rules
(§2.3) which do.

### 2.5 Assign a policy

There is no single "assign policy" screen. The 12 policy controls are switches that appear
on **both** the user record and the group record:

| Switch | Users (Options/Advanced) | User Groups (flat form) |
|---|---|---|
| Two Factor Authentication | ✓ | ✓ |
| Device Binding | ✓ | ✓ |
| Device checks | ✓ | ✓ |
| Device updates | ✓ | ✓ |
| Geo Binding | ✓ | ✓ |
| Device DLP | ✓ | ✓ |
| Shift Schedule | ✓ | ✓ |
| Geofencing | ✓ | ✓ |
| Block Apps | ✓ | ✓ |
| Risk Profile | ✓ | ✓ |
| Device Policy | ✓ | ✓ |
| Auto Suspend | ✓ (`Auto Suspend`) | ✓ (`Auto Suspend Users`) |

Files: `users-groups--users--add.html` (tabs `nav-profile` = 5 switches, `nav-contact` =
7 switches), `users-groups--user-groups--add.html` (16 controls, **12 switches, no tabs**).

Per-user path: 4 clicks to open + 1–2 tab clicks. Per-group path: 3 clicks to open, all 12
switches on one screen. **The capture cannot show which record wins when user and group
disagree** — no precedence indicator, no inherited-value styling, no "overridden by group"
text appears in either form. *needs-live-check*.

### 2.6 View logs

| Step | Screen | Click |
|---|---|---|
| 1–2 | expand `Logs & Reports` → pick 1 of 12 | 2 |
| 3 | change time range (unlabelled select, default `today`) | 1 |
| 4 | `Date Range` → date picker | 1+ |

**Minimum: 2 clicks to any log page.** 9 of the 12 log pages carry an **unlabelled**
`<select>` with `Hour / Today / Last 24 Hours / Week / Month / Date Range`, **default
`today`** (§7.3). `Live Users`, `Live Gateways` and `User Last Login` have no time control
at all. No log page has a facet filter except `Event Log` (1 multiselect,
`logs-reports--event-log--filter-1-open.html`). Row-level drill-in does not exist on any
log page: no `Actions` column, no row link (§7.2).

### 2.7 Onboard one user end to end (working app access)

This is the composite path. Object dependencies are read off the required fields of each
add form.

```
  Auth profile          Application Service        (prerequisites, any order)
  /profile/<type>       /application-services
        │                        │
        │                        ▼
        │                  Application
        │                  /applications
        │                        │
        ▼                        ▼
      User  ──────────────►  Access Rule  ◄────── (optional) Application Group
      /users                /access-rules          /application-groups
        │
        ▼
   (optional) User Group ── policy switches ── /usergroups
```

Minimum click count, starting at `/dashboard`, assuming nothing exists yet and the
simplest choice at every branch:

| # | Object | Nav group | Clicks | Required fields |
|---|---|---|---|---|
| 1 | Auth profile (e.g. Local is preconfigured; AD = 15 controls) | 6 | 3 | 0–9 |
| 2 | Application Service | 12 | 4 | 3 |
| 3 | Application (FQDN) | 12 | 4 | 4 |
| 4 | User | 8 | 4 | 8 |
| 5 | Access Rule | — (L1) | 8 | 6 |
| | **Total** | **4 nav groups** | **23 clicks** | **21 required fields** |

With Active Directory as the auth profile (`auth-profiles--active-directory--add.html`,
15 controls / 9 required) and a WEB application (10 controls), the same path is
**23 clicks / 36 fields**.

**The admin crosses 4 nav groups and 5 pages, and cannot create any prerequisite from
inside the screen that needs it** (§2.8).

### 2.8 Inline-create: absent everywhere

Scanned all 502 files for `Add new` / `Create new` / `+ Add` inside any
`.multiselect__content` list: **0 hits**. Every `<select>` and every vue-multiselect in
every add/edit form offers existing records only. There is no "create and return" path
anywhere in the product.

---

## 3. FORM COMPLEXITY

### 3.1 Add / edit forms, measured

Scope: `div.card.show` (the slide-in panel) or the page form. `req` counts `required`
attributes plus `span.text-danger` label markers.

| File | Controls | Req | Opt | Tabs | Help texts | Switches | Unlabelled controls |
|---|---|---|---|---|---|---|---|
| `sub-admins--sub-admin-roles--add` | **59** | 1 | 58 | 0 | 0 | **58** | 1 |
| `users-groups--users--add` | 24 | 8 | 16 | **3** | 0 | 12 | 3 |
| `users-groups--users--edit-form` | 22 | 7 | 15 | 3 | 0 | 12 | 2 |
| `users-groups--user-groups--edit-form` | 17 | 3 | 14 | 0 | 0 | 12 | 0 |
| `users-groups--user-groups--add` | 16 | 2 | 14 | 0 | 0 | 12 | 0 |
| `auth-profiles--active-directory--add` | 15 | 9 | 6 | 0 | 0 | 2 | 0 |
| `auth-profiles--openldap--add` | 11 | 11 | 0 | 0 | 0 | 0 | 0 |
| `user-settings--shift-schedules--add` | 11 | 4 | 7 | 0 | 0 | 7 | **10** |
| `user-settings--shift-schedules--edit-form` | 11 | 4 | 7 | 0 | 0 | 7 | **10** |
| `controllers-gateways--controllers--add` / `--edit-form` | 9 | 8 | 1 | 0 | 0 | 0 | 0 |
| `devices-checks--device-updates--add` | 8 | 5 | 3 | 0 | 0 | 0 | 1 |
| `idam--saml-idp--add` / `--edit-form` | 8 | 6 | 2 | 0 | 0 | 0 | 0 |
| `report-settings--export-log--add` | 8 | 7 | 1 | 0 | 0 | 0 | 0 |
| `access-rules--access-rules--edit-form` | 7 | 4 | 3 | 0 | 0 | 1 | 2 |
| `auth-profiles--saml--add` / `--edit-form` | 7 | 7 | 0 | 0 | 0 | 0 | 0 |
| `report-settings--report-subscriptions--add` | 7 | 6 | 1 | 0 | 0 | 0 | 0 |
| `access-rules--access-rules--add` | 6 | 4 | 2 | 0 | 0 | 1 | 1 |
| `user-providers--azure-ad--add` / `--edit-form` | 6 | 6 | 0 | 0 | 0 | 0 | 0 |
| `controllers-gateways--gateways--edit-form` | 6 | 6 | 0 | 0 | 0 | 0 | **3** |
| `auth-profiles--oauth--add` / `--edit-form` | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| `auth-profiles--openid--add` / `--edit-form` | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| `user-providers--google--add` | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| `devices-checks--devices--add` | 5 | 2 | 3 | 0 | 0 | 0 | 0 |
| `devices-checks--geofences--add` / `--edit-form` | 5 | 4 | 1 | 0 | 0 | 0 | 1 |
| `devices-checks--device-policies--add` | 5 | 3 | 2 | 0 | 0 | 0 | **3** |
| `applications--applications--add` / `--edit-form` | 4 | 3 | 1 | 0 | 0 | 0 | 1 |
| `applications--application-groups--add` | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| `auth-profiles--radius--add` | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| `devices-checks--device-checks--add` | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| `controllers-gateways--gateways--add` | 4 | 4 | 0 | 0 | 0 | 0 | 1 |
| `applications--application-services--add` | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| `auth-profiles--passwordless--add` / `--edit-form` | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| `devices-checks--blocked-apps--add` / `--edit-form` | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| `user-settings--risk-profiles--add` | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| `sub-admins--sub-admins--add` | 3 | 3 | 0 | 0 | 0 | 0 | **3** |
| `idam--oauth2-service--add`, `--openid-provider--add` | 3 | 2 | 1 | 0 | 0 | 0 | 2 |
| `filters--url--add` | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| `filters--content--add`, `--file-type--add`, `--domain-lists--add` | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| `idam--radius-service--add`, `--scim-export--add` | 2 | 2 | 0 | 0 | 0 | 0 | 0–1 |
| `applications--application-services--edit-form` | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| `tech-support--tech-support--add` | 2 | 2 | 0 | 0 | 0 | 0 | 1 |
| `devices-checks--devices--edit-form` | **0** | 0 | 0 | 0 | 0 | 0 | — |
| `devices-checks--device-checks--edit-form` | **0** | 0 | 0 | 0 | 0 | 0 | — |

### 3.2 Help text: zero

**`class="form-text"` — Bootstrap's field-help hook — appears 16 times across 3 files in the
whole capture, and 0 times inside any add/edit form.** Every one of the 44 forms above has
**0 field-level help texts.**

The only explanatory affordance is a **page-level** tooltip: `a.info-icon` with
`data-bs-original-title`, present in 483 files / 64 pages, exactly **one per page heading**.
Example (`users-groups--users--default.html`): *"A person that is provisioned in Secure
Access through any of the authentication profiles"*. It explains the page, not any field.

Both other help routes are external (§1.1). There is no in-product field documentation.

### 3.3 Validation

`add-validation` states exist for 24 forms. `capture-manifest.md` records that validation is
the **browser's native `required` bubble** — browser chrome, not DOM. The capture preserved
the messages as `data-vcap-invalid`; all observed values are the generic
**"Please fill out this field."** (91 occurrences).

Consequences visible in the capture:
- No inline error text under any field.
- No error summary at the top of any form.
- Native bubbles show **one field at a time**, so a form with 11 required fields
  (`auth-profiles--openldap--add`) surfaces 1 error per submit attempt.
- Server-side errors arrive as a Bootstrap toast, bottom-left, auto-dismissing on a
  ~3 s timer (`.progress-bar-container`, `--progress-duration`). Captured twice:
  `users-groups--users--toast-danger.html`, `--toast-dark.html`. A toast that dismisses
  itself is the only channel for messages like *"The email must be a valid email address"*
  (recorded in `capture-manifest.md`).
- `users-groups--users--add-validation-error.html` is the only captured in-form server error.

### 3.4 Labels that are product-internal rather than plain language

Taken verbatim from `<label>` and `<th>` text.

| Term | Where | Note |
|---|---|---|
| `Acls` | `users--add-tab-advanced.html` (User Details panel, table heading) | same object the nav calls **Access Rules** and the Groups list calls **Access Rules** — 3 names |
| `Acl Name` | same panel | |
| `Geo Binding` vs `Geofencing` | both on `users--add` (Options and Advanced) and `user-groups--add` | two switches, adjacent, no text distinguishing them |
| `Device Binding` | `users--add`, `user-groups--add` | |
| `Device DLP` | `users--add-tab-advanced`, `user-groups--add` | unexpanded acronym |
| `Device checks` / `Device updates` / `Device Policy` | all three on the same two forms | three distinct objects, near-identical labels |
| `Username Attribute` → `User Principal Name (UPN)` | `active-directory--add` | |
| `Bind User`, `Base DN`, `Filter` | `active-directory--add` | LDAP-internal, no help text |
| `Auth-Type` / `Auth Profile` / `Authentication Profile` / `Authentication Type` | `azure-ad` list `<th>`, `users` list `<th>`, `user-groups--add` label, `users--add` label | 4 spellings of 2 concepts |
| `No of rights given` | `sub-admin-roles--default.html` `<th>` | |
| `ISA IP` | `session-log--default.html` `<th>` | undefined abbreviation |
| `NAS IP` | `session-log`, `live-users`, `live-gateways` `<th>` | RADIUS-internal |
| `WFS` | `applications--add` Type option | unexpanded |
| `Secure Access custom URL` | `company-details--default.html` | product name mid-sentence |
| `Bypass` | `access-rules--add` Action option | vs Allow/Deny; meaning not stated anywhere |
| `Set of "special" characters` | `auth-profiles--local--default.html` | quotes inside label |
| `multiple IP addresses seperated by comma` | 5 labels on `/user-settings` | misspelling, repeated 5× |

### 3.5 Unlabelled controls

`shift-schedules--add` and `--edit-form`: **10 of 11 controls have no `<label>`** (the
7 day-of-week switches plus 3 others). `sub-admins--add`: all 3 controls unlabelled (the
labels read `Select User`, `Select Type`, `Select Role` — placeholder text used as label).
`device-policies--add`: 3 unlabelled. `gateways--edit-form`: 3 unlabelled.
The time-range select on 9 log pages: unlabelled (§7.3).

### 3.6 Large native selects

| Options | Control | Files | Page |
|---|---|---|---|
| **2,393** | `select#os_id` | 58 | `/device-checks` add |
| **216** | `select#country_code` | 14 | `/users` add — country dial codes, e.g. `Algeria (+213)` |
| **37** | `select#timezone` | 8 | `/time-schedules` add, `/profile/export-log` add |

All three are plain native `<select>` — no search, no grouping. `capture-manifest.md` notes
the OS popup is drawn by the operating system, so it cannot be styled or filtered.

### 3.7 Single-page settings forms

| Page | Controls | Switches | Sections (h2–h6) | Save buttons |
|---|---|---|---|---|
| `/user-settings` | 19 | 9 | **8** (Settings, Email Settings, Inactive Users, Authentication Controls, Access Controls, Force User Disconnect, Agent Idle Timeout, Portal Session Timeout) | 1 |
| `/settings/company-details` | **29** | 1 | 6 | **5** |
| `/profile/local` | 13 | 4 | 1 | 1 |
| `/email-settings` | 6 | 0 | 1 | 1 (+ `Change Password`) |
| `/sms-settings` | 6 | 0 | 1 | 1 |
| `/profile/scim-import` | 5 | 0 | 1 | 0 (`Regenerate Token` only) |
| `/settings/dns-wins` | 4 | 0 | 2 | 1 |

`/settings/company-details` carries **5 separate `Save` buttons** on one page — one for the
company block and one for each of 3 contact tabs (Business / Tech / Renewal), plus
`Add contact`. The 3 contact forms are **identical 6-field forms** (First Name*, Last Name,
Email ID*, Office Number*, Mobile Number, Designation) repeated 3×.

`/profile` (`account--profile--default.html`) renders **0 controls** — the heading
"Profile page" and two buttons (`Update Profile`, `Change Password`) that open modals.

---

## 4. DUPLICATION

### 4.1 Same 12 policy settings on two objects

Enumerated in §2.5. Same labels, same switch control, two screens:
`users-groups--users--add.html` (split across 2 tabs) and
`users-groups--user-groups--add.html` (flat, 1 screen, no tabs). Identical settings
presented in two different layouts. Precedence is not shown in either. 

### 4.2 DNS and WINS in two places

| Setting | `/settings/dns-wins` | `/profile/active-directory` add |
|---|---|---|
| Primary DNS | `Primary DNS` | `Primary DNS Server IP` |
| Secondary DNS | `Secondary DNS` | `Secondary DNS Server IP` |
| Primary WINS | `Primary WINS` | `Primary WINS Server IP` |
| Secondary WINS | `Secondary WINS` | `Secondary WINS Server IP` |

Files: `user-settings--dns-wins--default.html`, `auth-profiles--active-directory--add.html`.
Neither screen references the other.

### 4.3 Two different "Email Settings"

- `General Settings > Email Settings` = `/email-settings`, heading **"Email SMTP Settings"**,
  6 fields (HostName, Port, Username, Sender Email-ID, Sender Name, Require SSL).
- `User Settings > User Settings` = `/user-settings`, section heading **"Email Settings"**,
  4 switches (welcome emails to AD users, welcome emails to bulk local users, notify
  sub-admins on device approval, notify users on device check failure).

Same label in the nav-adjacent sense, unrelated content.

### 4.4 Suspension configured in two places

`Auto Suspend` switch on `users--add-tab-advanced.html`; `Auto Suspend Users` switch on
`user-groups--add.html`; and `Inactive Users > Warning / Suspend / Delete` (3 numeric
fields) on `/user-settings`. Three surfaces, one behaviour.

### 4.5 Access rules readable from the user record, editable only at `/access-rules`

`users--add-tab-advanced.html` embeds a read-only `User Details` panel containing a
**Devices** table (Device Name, Device OS, Device Serial No, Mac Address, UUID, Status,
Action) and an **Acls** table (Acl Name, Source Type, Source, Destination Type, Destination,
Action). Both are views of objects owned by `/devices` and `/access-rules`. No edit path
from the panel.

### 4.6 Near-identical pages differing only in fields

Four groups of pages share one template with different field sets:

| Group | Pages | Toolbar | Differing content |
|---|---|---|---|
| Authentication Profiles | 7 list pages (`active-directory`, `ldap`, `radius`, `saml`, `oauth`, `openid`, `passwordless`) | `Add, CSV, [Sync Now], Delete` | 3–7 columns, 3–15 fields |
| User Providers | 2 (`azuread`, `google`) | `Add, CSV, Sync Now, Delete` | 3 vs 5 columns |
| IDAM | 5 (`scim-export`, `oauth2-service`, `openid-idp`, `saml-idp`, `authserver/radius`) | `Add, CSV, Delete` | 3–5 columns |
| Filters | 4 (`url`, `content`, `filetype`, `domainlists`) | `Add, CSV, Delete` | 3–4 columns, 2–3 fields |

`idam--oauth2-service--default.html` and `idam--openid-provider--default.html` have the
**same 4 column headers** (`Name`, `Client Id`, `Redirect Uri`) and the same 3-field add
form. `auth-profiles--oauth` also lists `Name, Client Id, Redirect URI` — same three
columns, different casing (`Redirect URI` vs `Redirect Uri`).

SAML appears **twice as a top-level concept**: `Authentication Profiles > SAML`
(`/profile/saml`, consume an IdP) and `IDAM > SAML IDP` (`/saml-idp`, be an IdP). Likewise
OAuth (`/profile/oauth` vs `/oauth2-service`), OpenID (`/profile/openid` vs `/openid-idp`),
RADIUS (`/profile/radius` vs `/authserver/radius`). Four protocol names each appear in two
nav groups; the nav labels do not say which direction is which.

---

## 5. DEAD ENDS

### 5.1 Every empty state is the same string, with no action

All **54 list pages** render the identical empty state: `i.fa-frown` +
`p.no_data_p` containing **"No results found"**. Across all 54 `--empty.html` files and all
21 genuinely-zero `--default.html` files:

- **0 inline buttons or links inside the empty state.** The only way forward is the toolbar
  above the table.
- **0 pages vary the copy** by object type.
- **A genuinely empty list and a search that matched nothing are indistinguishable.**
  `filters--url--default.html` (0 records, no filter applied, counter reads `0-0 of 0`)
  and `users-groups--users--empty.html` (4 records, search `zzqx-no-match`, counter reads
  `0-0 of 0`) render the same table area text: *`Name URL URL Type No results found`* /
  *`Name Username Auth Profile Status No results found`*.
- 21 of the 54 list pages were in the true-zero state at capture time and all said
  "No results found".

Empty states with **no create action available at all** (toolbar has no `Add`):
`devices-checks--authenticator-devices--empty` (`CSV, Delete`),
`users-groups--blocked-users--empty` (`CSV, Unblock`),
`logs-reports--live-users--empty` / `--live-gateways--empty` (`CSV, Disconnect`),
`logs-reports--session-recording--empty` (**no toolbar buttons at all**),
and the 10 remaining log pages (`CSV` only).

### 5.2 Pages with no list, no form and no create action

- `downloads--user-agents--default.html` — no table headers, no toolbar.
- `account--profile--default.html` — 0 controls, 2 buttons.

~~`asset-inventory--asset-inventory--default.html`~~ and ~~`graph--graph--default.html`~~
were listed here in the first draft. **Both are corrected** — they are data-dependent, not
empty. See `velto-supplement.md` §3.

### 5.3 `Edit` opens an empty panel on two pages

| Page | View panel | After clicking `Edit` |
|---|---|---|
| `/devices` | `devices--edit.html` — 3 controls, 3,371 B, title *"View Device"* | `devices--edit-form.html` — **0 controls, 633 B**, title still *"View Device"* |
| `/device-checks` | `device-checks--edit.html` — 2 controls, 1,691 B, title *"View Device Check"* | `device-checks--edit-form.html` — **0 controls, 641 B**, title *"View Device Check"* |

Both post-Edit panels contain only the close `X` and the heading. Every other page's
`--edit-form` has 2–22 controls.

**RESOLVED — see `velto-supplement.md` §4.** In tenant Velto the same panel renders
correctly: `Edit Device Check` carries all 4 fields (Rule Name*, OS*, Check*, Check Value*)
plus `Save` / `Cancel`, and `View Device` carries 12 fields plus `Edit` / `Activate`. The
empty Veno panels are therefore a **render/state failure specific to that capture or that
tenant's data**, not a designed state. Still worth reproducing on veno before filing.

### 5.4 Two-step view-then-edit on all 18 editable objects

Row click opens a read-only `View <Object>` panel with an `Edit` button; `Edit` swaps it for
the form. Files: 18 `--edit.html` (view) + 18 `--edit-form.html` (form). This adds **1 click
to every edit** and the panel title stays `View <Object>` after entering edit mode on all 18
(e.g. `users--edit.html` → `users--edit-form.html`, both headed `View User`).

### 5.5 `Delete` is always enabled, including with nothing selected

| File | Delete button state |
|---|---|
| `users-groups--users--default.html` (0 rows selected) | **enabled** |
| `users-groups--users--row-selected.html` (1 row selected) | enabled |
| `access-rules--access-rules--default.html` (0 selected) | **enabled** |
| `access-rules--access-rules--row-selected.html` (1 selected) | enabled |

Same for `Bulk Ops`, `Graph`, `CSV`, `Unblock`, `Disconnect`. No toolbar button anywhere
carries `disabled` in the default state, so nothing signals that a selection is required
first. What happens on click with an empty selection is not observable from the snapshot —
*needs-live-check*.

### 5.6 Delete confirmation never names the object

All 39 `--delete-confirm.html` files use the same modal (`#dynamicAlertModal`), same title
**"Are You Sure?"**, same button order (`Cancel`, then `Yes, Delete it!`), and a message
that names the **type** but never the **instance**: *"Do you want to delete the user?"*,
*"Do you want to delete the group?"*, *"Do you want to delete the access rule?"*. For a
multi-row selection the message is still singular in most cases (exceptions: *"the selected
controller(s)"*, *"selected apps"*, *"selected Risk Profiles"*, *"selected Schedule"*). The
admin cannot verify from the modal what is about to be deleted, or how many.

### 5.7 Cancel / close behaviour

The slide-in card's only dismissal is `button.btn.card-close-btn` — a literal **`X`
character** styled `color:red`, top-right, present in 301 files. Forms additionally carry
`Reset` next to `Save` (`users--add`, `user-groups--add`, `access-rules--add`). Settings
pages use `Save` + `Cancel` instead (`/user-settings`, `/email-settings`, `/sms-settings`,
`/settings/dns-wins`, `/profile/local`). **Three different dismissal idioms across the
product**: `X`, `Reset`, `Cancel`. No unsaved-changes guard is present in any snapshot —
*needs-live-check*.

---

## 6. CONSISTENCY BREAKS

### 6.1 Same action, different names

| Concept | Name A | Name B |
|---|---|---|
| Bulk import from CSV | **`Bulk Add`** — `/applications`, `/application-services`, `/application-groups`, `/gateways`, `/access-rules` | **`Bulk Ops`** — `/users`, `/usergroups`, `/devices` |
| CSV export | `CSV` — 47 pages | `Advance User CSV` — `/users` only (alongside `CSV`) |
| Access rule | `Access Rules` (nav, `/access-rules`, Groups column) | `Acls` / `Acl Name` (`users--add-tab-advanced`) |
| Auth profile | `Auth Profile` (`/users` column) | `Auth-Type` (`/usergroups`, `/profile/azuread` columns) / `Authentication Profile` (`user-groups--add` label) |
| Geofence | `Geofences` (nav, `/geo-fences`) | `the fence` (delete modal), `Geofencing` (switch), `Geo Binding` (different switch) |
| Blocked apps | `Blocked Apps` (nav, `/app-blocker`) | `Block Apps` (switch on users/groups), `selected apps` (delete modal) |
| Group | `User Groups` (nav) | `Groups` (page heading on `/usergroups`) |
| Export log | `Export Log` (nav) | `Log Profile` (page heading on `/profile/export-log`) |
| Sign-in page | `Signin` (h-text) | `SignIn` (`<title>`) |

### 6.2 `Actions` column means two different things

Only 2 of 54 list pages have an `Actions` column, and they disagree:

| Page | `Actions` cell contains |
|---|---|
| `access-rules--access-rules--default.html` | **a data value** — `span.badge.rounded-pill.bg-success` reading `Allow` (the rule verdict) |
| `controllers-gateways--controllers--default.html` | **action buttons** — `Stop`, `Restart`, `Commit` (`a.btn.btn-outline-danger / -warning / -success`) |

The other 52 list pages have no per-row action affordance at all; every operation is
selection + toolbar.

### 6.3 Button styling varies by context for the same semantic

From the same capture (see also `audit.md` §4.1): the toolbar `Delete` is
`.operation-btn.btn-danger` at `#ef5137`; the confirm modal's `Yes, Delete it!` is bare
`.btn.btn-danger` at Bootstrap `#dc3545`. Four different button classes exist
(`operation-btn`, `card-btn`, `nav-btn`, `btn-royal`, `btn-gradient`) with three different
corner radii.

### 6.4 Modal button order is consistent; modal copy is not

All 39 delete modals: `Cancel` then `Yes, Delete it!` — **no break**. But the 39 messages
follow no template:

- article present/absent: *"delete **the** user?"* vs *"delete profile?"*
- capitalisation: *"delete active directory profile?"* vs *"delete SAML profile?"* vs
  *"delete URL Filter?"*
- spacing: *"delete selected Risk Profiles **?**"*, *"delete selected Schedule **?**"*
  (space before the question mark)
- compression: *"delete domainlist?"* for the page called **Domain Lists**
- object renamed: *"delete the fence?"* for **Geofences**

### 6.5 Add-form layout differs for equivalent objects

| Object | Layout |
|---|---|
| User (`users--add`) | **3 tabs** (Profile / Options / Advanced), 24 controls |
| User Group (`user-groups--add`) | **flat, no tabs**, 16 controls including the same 12 switches |
| Company contacts (`company-details`) | **3 tabs** (Business / Tech / Renewal), 3 identical 6-field forms, 3 separate Saves |
| Sub Admin Role (`sub-admin-roles--add`) | **flat**, 59 controls / 58 switches, no tabs, no grouping |

### 6.6 Progressive disclosure is applied inconsistently

| Form | Type selector reshapes the form? |
|---|---|
| `applications--add` | **yes** — 4 → 10 controls across 7 types |
| `access-rules--add` | **yes** — 6 → 8 controls by source/destination type |
| `auth-profiles--active-directory--add` | **yes** — `Authentication Type` → Certificate / Password+Certs variants |
| `auth-profiles--passwordless--add` | **yes** — 7 captured primary/fallback auth variants |
| `devices-checks--device-checks--add` | **no** — `Check Value` stays one free-text input for all 25 check types |
| `user-settings--risk-profiles--add` | **no** — `Action` (Email Admin / Deny Access / Suspend User / Disconnect User) adds no fields |
| `devices-checks--device-updates--add` | **yes** — install-schedule and post-validation variants |

### 6.7 Required-field marking

Two mechanisms coexist: the `required` HTML attribute (1,186 occurrences) and a
`span.text-danger` asterisk in the label (266 occurrences, 42 pages). They do not always
agree — `user-groups--add` has 16 controls, 2 marked required; `users--add` has 24 controls,
8 marked. `shift-schedules--add` marks 4 of 11 but 10 of 11 controls have no label at all to
carry a marker.

### 6.8 List-page column patterns

Measured across 54 list pages:

| Pattern | Pages |
|---|---|
| First column is a select-all checkbox | **42** |
| No checkbox column (log/report pages) | 12 |
| `Name` as the identifying column | 24 |
| `Profile Name` instead of `Name` for the same role | 5 (`active-directory`, `openldap`, `google`, `export-log`, plus `oauth`/`openid` use `Name`) |
| Column count 2–3 | 8 |
| Column count 4–5 | 33 |
| Column count 6–8 | 11 |
| Column count 9–10 | 2 (`session-log` 9, `network-test` 10) |
| Has an `Actions` column | **2** |
| Has a `Status` column | 4 (`controllers`, `devices`, `device-policies`, `device-updates`, `tech-support` uses `Status` too) |

---

## 7. INFORMATION SCENT

### 7.1 Columns per list page, and whether a row is identifiable without opening it

"Identifiable" = the columns shown carry enough to distinguish one row from another of the
same kind and to know what it does.

| Page | Columns shown | Verdict |
|---|---|---|
| `/users` | Name, Username, Auth Profile, Status | **Thin** — no group membership, no last login, no device count, no MFA state, no created date. The record carries 24 fields; 4 are listed. |
| `/usergroups` | Group, Auth-Type, Members, Access Rules, Two Factor Authentication, Device Binding, Device Checks | **Good** — 3 of 12 policy switches surfaced, plus counts |
| `/access-rules` | Name, Src Type, Source, Dst Type, Destination, Actions(=verdict) | **Good** — the whole rule is on one line |
| `/applications` | Name, Type, IP / FQDN / URL / Host, Port / Landing Page | **Adequate** — but 3 of 4 headers are slash-lists because the column means something different per type |
| `/application-services` | Name, Protocol, Port / Port range | Adequate |
| `/application-groups` | Name, Type, IP/Network & Service - Port / Port Range / Application | **Poor header** — one column header containing 4 alternatives |
| `/devices` | Name, Mac Address, OS, Serial Number, UUID, Registered On, Status | **Good** (8 cols) — though `UUID` and `Serial Number` are both shown in full |
| `/device-checks` | Rule Name, OS, Check, Check Value | Adequate |
| `/device-policies` | Name, OS, Type, Status | Adequate |
| `/device-updates` | Name, Filename, Arguments, Status | Adequate |
| `/auth-devices` | UserName, Phone, Registered On | Adequate |
| `/geo-fences` | Name, Latitude, Longitude, Fence Radius (metres) | **Thin for the task** — raw lat/long, no place name; the add form has a map (`.map-container`) but the list does not resolve coordinates |
| `/app-blocker` | Name, OS, AppName | Adequate |
| `/url-filter` | Name, URL, URL Type | Adequate |
| `/content-filter` | Name, Category, Sub Categories | Adequate |
| `/filetype-filter` | Name, Category, Extensions | Adequate |
| `/domainlists` | Name, Domain List | **Thin** — 2 columns; no count of domains |
| `/controllers` | Controller, Cloud Server, Protocol/Port, Network, Status, Actions | **Good** |
| `/gateways` | Gateway Name, Backup Gateway Name, Location, Number of Networks | Adequate |
| `/profile/active-directory` | Profile Name, Domain, Primary Server IP, Backup Server IP | Adequate |
| `/profile/ldap` | Profile Name, Domain, Primary Server IP, Backup Server IP, Port, Protocol | Good |
| `/profile/radius` | Name, RADIUS Server IP, Backup RADIUS Server IP, Port | Adequate |
| `/profile/saml` | Name, Integration Type, IDP EntityId, IDP Sign-In URL | Adequate — long URLs, `text-nowrap` on the table |
| `/profile/oauth` | Name, Client Id, Redirect URI | **Thin** — no provider column, although the add form's `Provider` is Generic/Google/Azure |
| `/profile/openid` | Name, Client Id, Issuer URL | Adequate |
| `/profile/passwordless` | Name, Primary Auth, Fallback Authn | Adequate (note `Authn` abbreviation) |
| `/profile/azuread` | Name, Tenant-ID, Groups, Auth-Type | Adequate |
| `/profile/google` | Profile Name, Domain | **Thin** — 2 columns |
| `/saml-idp` | Name, SP Entity ID, SP ACS URL, SP TYPE | Adequate |
| `/scim-export` | Application Name, Description | **Thin** — 2 columns, no status/token info |
| `/oauth2-service`, `/openid-idp` | Name, Client Id, Redirect Uri | Identical headers on two different pages |
| `/authserver/radius` | Name, Client IP | **Thin** — 2 columns |
| `/risk-profiles` | Name, Types, Action | Adequate |
| `/time-schedules` | Name, Days, Start Time, End Time | Adequate — no timezone column although the form has a 37-option timezone select |
| `/limit-exceeders` | IP, Username, Blocked At, Blocked Until | Good |
| `/sub-admin/all` | Username, Name, Type, Created | Adequate |
| `/sub-admin/roles` | Name, **No of rights given**, Created | **Thin** — a count of 58 possible rights tells the admin nothing about which |
| `/profile/export-log` | Profile Name, Server Type, Server Ip, Protocol, Port | Good |
| `/report-subscriptions` | Name, Email, Reports, Schedule, Email to CC | Good |
| `/tech-support` | #, Email, Expiring at, Status | Adequate |
| `/downloads/gateway-agents` | Gateway Name, Type, Location, Downloads | Adequate |
| `/reports/live` | User login Id, Login Time, Public IP, Country, VPN IP, NAS IP | Good |
| `/reports/gateway` | Gateway Name, Login Time, Public IP, VPN IP, NAS IP | Good |
| `/reports/user-last-login` | User name, Last Login | **Thin** — 2 columns |
| `/reports/data-uses-log` | Login ID, Data received (In MB), Data transmitted (In MB) | **Thin** — no date column on a log |
| `/reports/time-uses-log` | Login ID, Session Time(Minutes) | **Thin** — 2 columns, no date |
| `/reports/network-test` | Tested At, Username, IP, ISP, City, Upload, Download, Latency, Jitter, Packet Loss | Good (10 cols) |
| `/reports/anomaly-logs` | Detected At, Username, Message, Additional Informations | Adequate (note plural `Informations`) |
| `/reports/session-recording` | When, Username, Application, Video | Adequate |
| `/reports/session-log` | Username, Login Time, Logout Time, Public IP, Country, ISA IP, Upload Data (Bytes), Download Data (Bytes), NAS IP | Good (9 cols); `Bytes` not humanised |
| `/reports/access-logs` | User, Log Activity, When | **Thin** — 3 columns for 35 records |
| `/reports/application-access-logs` | Access Date, Username, Public IP, Country, Destination, Port, Action | Good |
| `/reports/event-logs` | Time, Username, Log | **Thin** — 3 columns, free-text `Log` |

Summary: **13 of 54 list pages carry 2–3 columns**, and 8 of those are logs or reports where
the missing column is a date or a count. **No list page has a column chooser, a sort
control, or a column-resize affordance** in any snapshot.

### 7.2 Row drill-in

Row click opens the `View <Object>` panel on 18 object types (§5.4). On the **12 log and
report pages there is no drill-in at all** — no `Actions` column, no row link, no `--edit`
state captured. An admin who sees a suspicious line in `/reports/session-log` (402 records)
cannot click through to the user, the device or the rule.

The table is styled `cursor:pointer` on **all 54 pages** (`.table-responsive{cursor:pointer}`),
including the 12 where clicking does nothing.

### 7.3 Filters and result counts

Uniform across all 54 list pages:

| Control | Present |
|---|---|
| Keyword search `input[type=search]`, placeholder **"Type keyword and enter to search"** | **54 / 54** — one per page |
| Search submit button | **0** — Enter only |
| Search clear button | **0** (browser-native `type=search` clear only) |
| Result counter (`1-10 of 402`) | **54 / 54** |
| Page-size select (`10 / 30 / 50`) | **54 / 54** |
| Prev/next chevrons | **54 / 54** |
| Page numbers or jump-to-page | **0 / 54** |
| Facet filter | **1** — `Event Log` (1 multiselect) |
| Time-range select (`Hour / Today / Last 24 Hours / Week / Month / Date Range`) | **9 / 12 log pages**, default `today`, **unlabelled** |
| Time range on `Live Users`, `Live Gateways`, `User Last Login` | none |
| Sort control | **0 / 54** |

At 50 rows per page maximum, `/reports/session-log` (402 records) is **9 pages deep** with
prev/next only, and defaults to showing `today`.

---

## 8. Counted summary

| Measure | Value |
|---|---|
| Navigable pages in left nav | 66 |
| Top-level nav entries | 19 (5 pages, 14 groups) |
| Max nav depth | 2 |
| Max clicks from `/dashboard` to any page | 2 |
| Nav orphans (`/profile`, `/mfa-profile`) | 2 |
| List pages | 54 |
| List pages with an `Actions` column | 2 |
| List pages with 2–3 columns | 13 |
| List pages with a sort control | 0 |
| Add/edit forms measured | 44 |
| Forms with field-level help text | **0** |
| Field-level help texts in the whole capture | **0** |
| Page-level tooltips | 1 per page, 64 pages |
| Largest form | `sub-admin-roles--add` — 59 controls, 58 switches |
| Largest native select | `select#os_id` — 2,393 options |
| Forms where a type change reshapes the form | 5 of 7 checked |
| Empty states | 54, all reading "No results found", **0 with an inline action** |
| Pages where genuine-zero and no-search-match look identical | 21 |
| Objects with a 2-step view-then-edit | 18 |
| `Edit` panels that render empty | 2 (`/devices`, `/device-checks`) |
| Toolbar buttons disabled when no row is selected | **0** |
| Delete confirmations naming the specific object | **0 of 39** |
| Distinct names for "bulk import" | 2 (`Bulk Add`, `Bulk Ops`) |
| Distinct names for "access rule" | 2 (`Access Rules`, `Acls`) |
| Distinct spellings around auth profile/type | 4 |
| Nav groups crossed to onboard one user end to end | 4 |
| Clicks to onboard one user end to end (nothing pre-existing) | **23** |
| Required fields on that path | **21** (36 with AD + WEB app) |
| Screens offering inline creation of a prerequisite | **0** |
