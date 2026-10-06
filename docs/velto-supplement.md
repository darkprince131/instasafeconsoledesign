# Velto supplement — what the two older captures add to the Veno audit

Read-only pass over two sources the Veno capture did not include. Nothing in either source
was modified; the zip was extracted to a scratch directory, the J: drive folder was read in
place.

| Source | Files | Tenant | Date | Format |
|---|---|---|---|---|
| `J:\Instasafe\UI htmls\i365 htmls` | 18 `.mhtml` | **Velto** | 2026-06-16 | Chrome MHTML, loose files |
| `C:\Users\Darkprince131\Downloads\i365 Admin HTMLS-…-3-001.zip` | 49 `.mhtml` + 5 design docs + ~50 sales files | **Velto** | 2026-03-23 (captures), 2026-03-24 (spec) | Chrome MHTML in numbered folders |

67 MHTML files total, all from **velto.instasafe.com** — a different, far larger tenant than
Veno. **This is the single most useful thing in these folders: Velto has real data where Veno
was empty.**

---

## 0. Headline: three open items close, one new surface appears, one document changes the plan

1. **The `zzcap-` test-record decision is moot. Do not create test data in veno.** Velto
   supplies populated tables for every page Veno showed at 0 records (§1), including the four
   auth/provider types that blocked the edit-state captures.
2. **Two findings in `ux-inventory.md` were wrong and are corrected** (§3, §4). Both have been
   struck through in that file with a pointer here.
3. **A whole surface was missing from the audit: the end-user (member) console** — 4 pages,
   `/member/*` (§6). It also happens to contain the *good* version of the pattern the admin
   console gets wrong 54 times.
4. **A design specification for exactly this project already exists, dated 2026-03-24**, with
   a palette, a type scale, component specs, a 5-phase plan and a working HTML prototype
   (§7). It is essentially Track A, already written. Read it before writing the prototype
   build prompt.

---

## 1. Populated tables — the gap that mattered most

`capture-manifest.md` recorded 21 Veno pages at 0 records and flagged missing edit views for
Active Directory, OpenLDAP, RADIUS and Google because the tenant had no rows. Velto row
counts, read from each page's own `N-N of N` counter:

| Page | Veno records | **Velto records** | Source |
|---|---|---|---|
| `/users` | 4 | **1,820** (J, June) / 297 (zip, March) | `All Users - Velto`, `06 - Users & Groups/All Users` |
| `/devices` | 5 | **775** | `Devices - Velto` |
| `/device-checks` | 2 | **150** | `Device Check - Velto` |
| `/usergroups` | 1 | **46** | `06 - Users & Groups/User Groups` |
| `/applications` | 6 | **53** | `10 - Applications/Applications` |
| `/application-services` | 31 | 33 | `10 - Applications/Application Service` |
| `/application-groups` | **0** | **10** | `10 - Applications/Application Group` |
| `/access-rules` | 5 | **57** | `11 - Access Rules/Access Rules` |
| `/profile/active-directory` | **0** | **9** | `Active Directory - Velto` (J) |
| `/profile/google` | **0** | **1** | `05 - User Providers/Google Profile` |
| `/profile/azuread` | 1 | 3 | `05 - User Providers/Azure Active Directory` |
| `/risk-profiles` | **0** | **3** | `07 - User Settings/Risk Profiles` |
| `/time-schedules` | 1 | 4 | `07 - User Settings/TimeSchedule` |
| `/geo-fences` | 1 | **10** | `Geo Fences - Velto` (J) |
| `/openid-idp` | **0** | **8** | `15 - IDAM/OPENID Provider` |
| `/saml-idp` | 1 | **8** | `15 - IDAM/SAML IDP Setting` |
| `/scim-export` | **0** | **5** | `15 - IDAM/SCIM Export` |
| `/profile/export-log` | **0** | **2** | `13 - Report Settings/Export Log Profile` |
| `/report-subscriptions` | **0** | **1** | `13 - Report Settings/Report Subscriptions` |
| `/reports/event-logs` | 4 | **794** | `12 - Logs & Reports/Event Logs` |
| `/reports/access-logs` | 35 | **246** | `12 - Logs & Reports/Access Logs` |
| `/reports/application-access-logs` | 7 | **184** | `12 - Logs & Reports/Application Access Logs` |
| `/reports/user-last-login` | 5 | **134** | `12 - Logs & Reports/User Last Login` |
| `/reports/network-test` | 1 | **56** | `12 - Logs & Reports/Network Test Report` |
| `/reports/anomaly-logs` | 6 | **34** | `12 - Logs & Reports/Risk Reports` |
| `/reports/session-log` | 402 | 24 | `12 - Logs & Reports/Session Log` |
| `/limit-exceeders`, `/content-filter`, `/domainlists`, `/filetype-filter`, `/url-filter`, `/tech-support` | 0 | **still 0** | — |

Still empty in both tenants: the four Filters pages, Blocked Users, Tech Support.

### 1.1 What the data actually reveals

**Pagination at real scale.** `/users` at 1,820 rows with a max page size of 50 is **37
pages**, navigable only by prev/next chevrons — no page numbers, no jump. `/reports/event-logs`
at 794 rows is 16 pages. This confirms §7.3 of the inventory with real numbers rather than
Veno's 402.

**The Users list is still 4 columns at 1,820 rows** — Name, Username, Auth Profile, Status.
Sample rows: `andcheck Fatima / andcheck / local / Active`, `upnfat / upnfat / ad / Suspended`.
No group, no last login, no device count, no MFA state. At 4 records that is thin; at 1,820
with only keyword search and no sort it is the primary scaling failure in the product.

**Access Rules packs multi-value cells into `text-nowrap` columns.** Real row:

```
aaweb1 | user | akash , sridns , web1 , winand | applications | webbw3new , newwebs , internalnewsri | Allow
```

Source and Destination are comma-joined lists inside single cells on a table carrying
`text-nowrap`. At 57 rules this forces horizontal scroll. Veno's 5 single-value rules hid
this entirely.

**Event Log is 794 rows of unparsed free text, with a string-concatenation bug.** Three
columns only — Time, Username, Log. Real values:

```
2026-03-23 23:37:21 | InstaSafe Scheduler | Active Directory Profilemfamfa auto sync failed
2026-03-23 23:30:11 | InstaSafe Scheduler | Scim Export Profile databricksbhu auto sync success
2026-03-23 23:30:09 | InstaSafe Scheduler | Scim Export Profile Pravinexport auto sync failed
```

`Active Directory Profilemfamfa` is missing a space between the literal "Profile" and the
profile name. There is no severity column, no event-type column, and no separation between
system events (`InstaSafe Scheduler`) and admin actions — so "show me failures" is a keyword
search over free text.

---

## 2. Device approval — a flow the Veno capture could not show

`/devices` in Velto: **775 devices, and 6 of the 10 rows on page 1 have
`Status = Pending-Approval`** (the other 4 split Enabled / Suspended).

The toolbar is unchanged from Veno: `Add`, `Bulk Ops`, `CSV`, `Delete`, `Graph`. **There is
no Approve action in the toolbar and no status filter on the page.**

The approval control lives in the per-row panel. `List Item Devices - Velto` shows
`View Device` with buttons **`Edit`** and **`Activate`** — i.e. approval is one device at a
time, reached by: row click → read-only panel → `Activate`. Three clicks per device, 10 rows
per page, no way to filter to pending.

Veno had 5 devices, all already enabled, so neither the `Activate` button nor the
`Pending-Approval` status existed in that capture.

**`View Device` also carries 12 fields in Velto, not 3**: Name, OS, Mac Address, Serial
Number, UUID, Registered On, **Manufacturer, Model, Hostname, MotherBoard-ID, CPUID, DiskID**.
The Veno panel showed 3 because those Veno devices have no hardware inventory data.

---

## 3. CORRECTION — Asset Inventory and Graph are not empty pages

`ux-inventory.md` §1.5 and §5.2 listed both as "no list, no form, no create action". That was
read off a 5-device tenant. Correcting:

**`/asset-inventory`** (`Asset Inventory - Velto`, J drive) renders **6 `<canvas>` charts**
with totals, plus a manufacturer breakdown list:

| Panel | Total |
|---|---|
| Device Category | 15 |
| Asset Aging | 17 |
| Assets by Region | 14 |
| BitLocker | 17 |
| Device Status | 775 |
| Operating System | 774 |
| Manufacturer | 765 |

Manufacturer detail, verbatim: `Dell Inc. 219`, `HP 143`, `Apple 134`, `LENOVO 56`,
`ASUSTeK COMPUTER INC. 50`, `realme 33`, `vivo 33`, `Nothing 29`, `innotek GmbH 23`,
`Xiaomi 12`, `OPPO 8`, `motorola 8`, `samsung 4`, `Acer 3`, `Hewlett-Packard 1`,
`Microsoft Corporation 1`, `OnePlus 1`, `HLBS TECH PVT LTD 1`.

**`/graph`** (`Graph - Velto`, J drive) has heading **"Analytical Dashboard"** — not "Graph",
as the nav label claims — and carries `Select Filters`, `Live User` and `Live Nodes` controls
plus the force-graph canvas and the hint text *"Left-click: rotate, Mouse-wheel/middle-click:
zoom, Right-click: pan"*. Veno's snapshot showed only `Update Graph` because the tenant has
almost no nodes to filter.

**Net effect on the audit:** both pages are data-dependent dashboards, and the finding
becomes a different one — *the nav label "Graph" does not match the page heading "Analytical
Dashboard"*, and both pages degrade to visually blank rather than to an explanatory empty
state when the tenant is small.

---

## 4. RESOLVED — the empty `Edit` panels were a Veno-specific failure

`ux-inventory.md` §5.3 flagged `/devices` and `/device-checks` as rendering an empty panel
after clicking `Edit`, marked *needs-live-check*. Velto renders both correctly:

| Panel | Veno | Velto |
|---|---|---|
| `/device-checks` edit | `device-checks--edit-form.html` — **0 controls, 641 B** | `Edit Device Check` — **4 fields** (Rule Name*, OS*, Check*, Check Value*) + `Save` / `Cancel` |
| `/devices` view | `devices--edit.html` — 3 controls | `View Device` — **12 fields** + `Edit` / `Activate` |

So the empty Veno panel is a **render or state failure**, not a designed state. Worth
reproducing on veno and filing as a bug rather than carrying as a UX finding.

Note the button pair: Device Check edit uses **`Save` / `Cancel`**, while User and User Group
forms use **`Save` / `Reset`**. That is a fourth dismissal idiom, alongside the `X`, `Reset`
and `Cancel` already listed in §5.7 of the inventory.

---

## 5. Additional panels and fields Veno could not produce

| Object | Panel | Fields / notes |
|---|---|---|
| Active Directory | `View AD Profile` (J) | 15 fields — Profile Name, Domain, Primary/Backup AD Server IP, Username Attribute, Authentication Type, Bind User, Base DN, Filter, Primary/Secondary DNS Server IP, Primary/Secondary WINS Server IP, Require SSL/TLS, Enable Kerberos. Buttons: `X`, **`Edit`**, **`Change Password`** — a third action on a view panel that no other object has. |
| Google Profile | `Add Google Profile` | 5 fields — Profile Name*, Domain*, Admin User*, Authentication Type*, `Groups * (Multiple groups seperated by Comma)*`. **The required asterisk is printed twice in one label**, and "seperated" is misspelled — the third occurrence of that same typo (5 more are on `/user-settings`). |
| Geofence | `Edit Geo Fence` (J) | 4 fields + a **`Want Map` button** — the Google Map is opt-in and hidden by default on the edit panel, so the admin edits raw lat/long unless they ask for the map. |
| Export Log Profile | `Add Log Profile` | 8 fields — Profile Name*, Log Server Format*, Log to be Exported*, Time Zone*, Server Ip*, Backup Server Ip, Protocol*, Port. |
| Risk Profile | `Add Risk Profile` | 3 fields, confirms the Veno reading. |
| SCIM Export | `Add SCIM Export` | 2 fields, confirms the Veno reading. |

**Confirmed identical between tenants** (so the Veno readings hold): Add Controller 9 fields,
Add Gateway 5, Add User 23–26, Add User Group 15, Add Access Rule 7, Add Application 4,
Add Application Service 3, Add Application Group 4, Add SAML IDP 8, Add OpenId Provider 3,
Add Report Subscription 7, Add Tech Support Access 2, all four Filters add forms 2–3.

*Caveat on the MHTML parse:* several panels report extra buttons (`Scrape Table 1 · 10 rows ×`,
`Copy to Clipboard`, `⣿`, `×`). Those are **browser-extension DOM injected into the MHTML at
save time**, not product UI, and are excluded from every count above.

---

## 6. NEW SURFACE — the end-user (member) console

4 pages in `i365 Admin HTMLS/EndUser Console/`, entirely absent from the Veno capture, which
was admin-only.

| File | Route |
|---|---|
| `Dashboard _ Member.mhtml` | `/member/dashboard/popup` |
| `Applications _ Member.mhtml` | `/member/applications` |
| `Mfa _ Member.mhtml` | `/member/mfa-profile` |
| `agents _ Member.mhtml` | `/member/agent-download` |

Nav is 3 items: `Dashboard`, `Downloads`, `Applications`. Header matches the admin console
(hamburger, logo, FAQ, Help, countdown, avatar → Profile / MFA / Sign out) **plus two things
the admin header does not have**: `Last portal logout on 24-03-2026 02:34:35 IST` and
`Current timezone: Asia/Kolkata`.

### 6.1 The member console already has the patterns the admin console lacks

**Real empty states.** The member dashboard alone carries four distinct, human-readable ones:

> `No devices found.` · `No web based applications assigned.` ·
> `No network based applications assigned.` · `No access logs found.`

and `/member/applications` reads **`There are no Applications configured`**.

Against that, the admin console uses **`No results found`** on all 54 list pages, including
the 21 that are genuinely empty (§5.1 of the inventory). **The better copy pattern already
ships in this product, on the other side of the login.**

**A type facet.** `/member/applications` has **`Filter by Type` — WEB / RDP / SSH / VNC / DB /
WFS**. The admin `/applications` list has a `Type` column showing exactly those 7 values and
**no filter for it**. Same data, facet on the member side only.

### 6.2 Member dashboard content

Welcome + name + username + public IP + country; four status chips (`MFA`, `Device Binding`,
`Shift Schedule`, `Geo Binding`); `Agent — Not Connected / Agent not connected.`;
`Current Session` and `Previous Session` blocks (login time, IP, platform, browser, country);
`Registered Devices`; `Web Based Applications`; `Network Based Applications`; `Apps Accessed`;
a `Network Diagnostics` panel with a **`Run Test`** button and live results (`48.8 Mbps` down,
`53.8 Mbps` up, `25.3` latency, `2.6` jitter, `0.00%` packet loss, ISP
`Reliance Jio Infocomm Limited (AS55836)`, `Mumbai`); and a dismissible
`Welcome Banner — Welcome to SVPNPA`.

### 6.3 `/mfa-profile` and `/member/mfa-profile` are the same page

Byte-comparable content, 6 methods on both: Google Authenticator, FIDO Keys, Instasafe
Authenticator, Digital Certificate, Backup Codes, InstaSafe OS MFA. One component serving
two consoles — a duplication to note, not two surfaces to audit.

---

## 7. The design specification that already exists

`i365 Admin HTMLS/i365_Admin_Design_Specification.docx` (and an identical `(1).docx` — 435
paragraphs, 10,468 characters each, same content).

> **"DESIGN SPECIFICATION — InstaSafe i365 Admin Console — UI Polish & Visual Refinement
> Guide … Version 1.0, Date: March 24, 2026"**
>
> *"This is NOT a redesign. We are polishing the existing admin console."*

Its guiding rules are Track A almost word for word: same layout, same navigation, same page
structure; improve typography, cards, sidebar, charts, empty states; add CSS variables; *"All
changes are CSS + minor HTML tweaks — no backend changes needed."* It even names the empty-state
problem: *"Improve empty states (helpful messages instead of just 'No results')."*

### 7.1 What it specifies

**Palette** — a full token block for `style.css`: `--primary #2563eb`, `--primary-dark #1d4ed8`,
`--teal #0d9488`, `--cyan #06b6d4`, `--amber #f59e0b`, `--green #10b981`, `--red #ef4444`,
`--purple #8b5cf6`, a 10-step gray ramp `--gray-50 #f8fafc` → `--gray-900 #0f172a`, radii
`--radius-sm 6px / -md 10px / -lg 14px`, two shadows, one transition.

**Note this is a different palette from the one in production.** It drops the existing brand
`#ef5137` and `#656195` entirely and moves to a blue/teal system. That is a brand decision,
not a CSS decision — worth confirming with whoever owns the brand before Track A starts.

**Typography** — switch to **Inter** from Google Fonts, with a 7-row type scale (Page Title
22/700/-0.02em, Section Label 10/600/0.08em uppercase, Chart Title 15/600, Stat Label
12/600/0.04em uppercase, Stat Value 26/700/-0.02em, Body 14/400, Sidebar Item 13/500).

**Component specs** — current-vs-new tables for header (60px fixed, `backdrop-filter: blur(12px)`,
green pill session timer), sidebar (260px fixed, Font Awesome icon per menu item with a full
17-row icon mapping, chevron that rotates 90°, 42px submenu indent), stat cards (CSS Grid,
14px radius, 3px gradient top accent, icon badge, subtext, `translateY(-2px)` hover), chart
cards (donut with `cutout: 60%`, center label, inline right-hand legend), and page shell
(`--gray-50` body background, 24px content padding).

**IA hint for Track B** — the spec groups the 19 nav entries under **five section labels:
INFRASTRUCTURE, IDENTITY, SECURITY, ACCESS, MONITORING**. The prototype implements six
(`Infrastructure`, `Identity`, `Security`, `Access`, `Monitoring`, `More`). That is a first cut
at the nav-breadth problem, already drafted.

**Plan** — 5 phases, each independently deployable: Foundation (1–2 d) → Header & Sidebar
(2–3 d) → Dashboard Cards (1–2 d) → Charts (1–2 d) → Rollout to other pages (3–5 d).
**9–14 days total**, and it names the files to touch: `style.css`, Dashboard / Sidebar /
Header Blade templates, *"vendor.css — No changes needed."*

**Explicit non-goals** — navigation structure, menu order, URLs, routing, backend APIs,
existing JavaScript, Bootstrap responsive utilities, the dark-mode toggle mechanism.

### 7.2 The prototype, and one caveat about it

`i365_Dashboard_Prototype.html.zip` → `i365_Dashboard_Prototype.html`, 41,640 bytes,
self-contained, titled *"Dashboard - Velto | InstaSafe i365"*. Two external references only:
Font Awesome 6.5.1 from cdnjs and Inter from Google Fonts. Charts are **inline SVG donuts, not
Chart.js**. It carries the full `:root` token block plus `--sidebar-width: 260px` and
`--header-height: 60px`.

**Caveat worth knowing before it is treated as a drop-in:** the prototype uses **new class
names, not the production ones** — `menu-link`, `menu-icon`, `sidebar-section-label`,
`sidebar-submenu`, `stat-card`, `stat-label`, `stat-value`, `stat-subtext`, `chart-card`,
`chart-header`, `chart-select`, `chart-body`, `chart-legend`, `chart-center-label`,
`expand-icon`, `header-btn`. Production uses `link`, `menu-title`, `treeview-menu`,
`card shadow h-100 dashboard`, `card-title`, `card-text`, `usage-title`, `sidebar-menu`.

So despite the spec's *"CSS + minor HTML tweaks"* framing, **the prototype is a visual mock
built on rewritten markup, not an override layer over the real DOM.** Reconciling the two is
real work: either the prototype's selectors get remapped onto the 352 production class names
(the `audit.md` inventory is exactly the mapping table for that), or the Blade templates get
new class names — which moves part of Track A into Track B's QA exposure.

### 7.3 Other design documents in the zip

| File | Size | Note |
|---|---|---|
| `i365_Dashboard_Prototype.docx` | 654 KB | Screenshot-heavy companion to the prototype |
| `docs_Introduction_Prototype.docx` | 657 KB | Not yet read |
| `MFA_Page_Content_Rewrite.docx`, `MFA_Page_Improved_Preview.docx` | 669 / 663 KB | Marketing-page copy, not console UI |

The remaining ~50 files in the zip are sales and marketing assets (pitch decks, battlecards,
competitor comparisons, `sales-v2-*.jpg`) with no bearing on the console audit.

---

## 8. What is still missing after both folders

**The zip is part 3 of a multi-part Google Drive export** (`…-3-001.zip`) and its numbered
folders skip two:

| Present | Missing |
|---|---|
| 01 Dashboard & Graph, 02 Controllers & Gateways, 03 General Settings, 05 User Providers, 06 Users & Groups, 07 User Settings, 09 Filters, 10 Applications, 11 Access Rules, 12 Logs & Reports, 13 Report Settings, 14 Downloads, 15 IDAM, 16 Tech Support, EndUser Console | **04 — Authentication Profiles** (8 pages), **08 — Devices & Checks** (7 pages) |

The J: drive folder covers part of the gap with loose files (`Active Directory`, `Devices`,
`Device Check`, `Geo Fences`) but not OpenLDAP, RADIUS, SAML, OAuth, OpenID, Passwordless,
Local, Authenticator Devices, Device Policies, Blocked Apps or Device Updates.

**If parts 1 and 2 of that export exist, they are worth locating** — folders 04 and 08 are the
two largest nav groups and the ones where Veno was thinnest (OpenLDAP, RADIUS and Google all
had 0 records in Veno; only Google is covered here).

Still unanswered by any capture:

- **The password step of sign-in.** Both tenants' captures stop at the username screen.
- **Graph / force-graph rendered.** MHTML does not serialise `<canvas>` pixels any more than
  the Veno serializer did. `/asset-inventory`'s 6 canvases and `/graph`'s 1 canvas are present
  as empty elements in the MHTML. **The manual five-minute pass with the tab in front is still
  the only way to get these.** It is now more clearly worth doing: §3 shows there are 7 chart
  panels on `/asset-inventory` plus 3 on `/dashboard` that nobody has seen rendered.
- **Policy precedence between user and group** for the 12 shared switches. Neither tenant's
  markup shows an inherited-value or overridden indicator.
- **What `Delete` does with nothing selected.** No capture can show a click outcome.
- **Unsaved-changes guard** on the slide-in card.
- **Whether `Bulk Ops` on `/devices` contains a bulk-approve.** Velto has 775 devices and no
  `Bulk Ops` panel state was captured on either tenant.

---

## 9. Net changes to the earlier deliverables

| Document | Change |
|---|---|
| `ux-inventory.md` §1.5 | Asset Inventory / Graph bullet **struck through**, corrected, pointer to §3 here |
| `ux-inventory.md` §5.2 | Both pages **removed** from the no-content list, pointer to §3 here |
| `ux-inventory.md` §5.3 | Empty-Edit-panel finding **resolved** to a Veno-specific render bug, pointer to §4 here |
| `audit.md` | No changes. It is a CSS/class analysis of Veno's `_assets`; the MHTML files carry Velto's stylesheets as `cid:` parts and would need a separate pass to compare, which nothing in the current plan requires. |
| Earlier open item "create `zzcap-` records" | **Withdrawn** — §1 supplies the populated states |
| Earlier open item "graph/chart manual pass" | **Still open, and now higher value** — §8 |
| New scope to decide on | The member console (§6) — 4 pages, currently outside the audit |
| New input to the prototype build prompt | The March design spec and prototype (§7), including the palette-change question |
