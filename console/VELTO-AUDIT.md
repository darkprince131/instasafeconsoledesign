# Velto audit — what the demo console gets wrong

Reference tenant: `velto.instasafe.com` (production scale: 1,321 users of 2,000
licensed). Captured 2026-10-07 from a logged-in session. Veno was the earlier
reference and is thinner — velto has real data in every screen, which is why
several of these differences were invisible before.

Status key: **FIXED** · **OPEN** · **BLOCKED** (needs another look at velto).

---

## 1. Blocked Users — the assumption was wrong — FIXED

| | |
|---|---|
| Route | `/limit-exceeders` |
| Velto columns | **IP · Username · Blocked At · Blocked Until** |
| Velto actions | **CSV · Unblock** (no Delete, no Add) |
| Velto rows | 0 |
| What I had built | `users`, filtered to `status: suspended`, showing Username · Email · Department · Last seen · Status, with a **Delete** bulk action |

It is not an account state. These are **source-address lockouts** written by
the rate limiter after repeated failed sign-ins, and they **expire by
themselves** — hence the route name `/limit-exceeders` and the `Blocked Until`
column. The only action is lifting one early.

Three things were wrong, not one:

- the wrong entity (account status instead of a lockout record)
- the wrong action (**Delete**, destructive, where **Unblock** belongs)
- the missing fact (no expiry shown, which is the only thing an admin needs
  in order to decide whether to intervene at all)

**Fixed.** New `lockouts` resource (`records` table, kind `lockout`), real
columns, and `ResourceList.vue` now takes a `bulkAction` descriptor so a screen
can name its own bulk action rather than every screen saying Delete. Expiry
renders as time remaining (`26 min left`, `expired`) instead of a raw timestamp,
because production prints the timestamp and leaves the admin to do the
arithmetic.

Two fields added beyond velto, both earned: **Failed attempts** (5 is a
fat-fingered password, 41 is someone spraying usernames — completely different
decisions, and velto shows neither) and a nullable **Username**, since a
lockout is keyed on the address and the commonest real case has no account to
name.

## 2. `records` seeding dropped every non-column field — FIXED

Found while seeding the lockouts. `seedTenant` took its column list from
`information_schema` and silently discarded anything without a column — so any
`records`-backed resource would seed with `id` and `name` and nothing else, with
a 200 and no error anywhere. The same class of bug as the filter that saved its
name and lost its pattern. `insertRow` already packed extras into `data`; the
seed path did not. Now it does, and stamps `kind`.

## 3. Production tenant names were baked into the demo — FIXED

`veno.instasafe.com` appeared in the dashboard subtitle, the sign-in screen and
a SAML ACS URL. A public self-serve demo should not name a real customer
tenant. Replaced with the demo's own host.

## 4. `/software-packages` did not exist — FIXED

A real route in velto's Devices group, absent from my nav entirely. Built
against the captured columns — see §11.

## 5. Dashboard — different shape, and missing real information — OPEN

Velto:

```
cards   1/3 ONLINE GATEWAYS · 2/1321 ONLINE USERS
        1321/2000 USER SUBSCRIPTION · 31st Mar 2027 SUBSCRIPTION RENEWAL
panels  Top Data Usages (in Kb) · Top Time Usages (in Minutes)
        Anomalies (by Types) · Top Blocked Services
        — each with Today / Week / Month
also    "Quick Start Guide" button
```

Mine: an attention band (Devices pending approval · Users without MFA ·
Gateways degraded) plus Devices by OS · Sessions today · Most denied users ·
Guided flows.

The attention band is a **sanctioned deviation** — colour spent on exceptions,
per the design contract — and the guided flows replace velto's Quick Start
Guide. Two genuine gaps remain:

- **Subscription and licence state is absent from my console entirely.** Velto
  devotes half its cards to it (1321/2000 seats, renewal date). An admin who
  cannot see how many seats are left cannot plan an onboarding.
- **Four real analytics panels are missing**, all four with a Today/Week/Month
  range: data usage, time usage, anomalies by type, top blocked services. I
  have the underlying data for all of them.

## 6. List toolbars — a shared vocabulary I do not have — OPEN

Every velto list page carries the same toolbar. Users: `Add · Bulk Ops · CSV ·
Advance User CSV · Delete · Graph`. Devices: `Add · Bulk Ops · CSV · Delete ·
Graph`. Blocked Users: `CSV · Unblock`.

Missing from mine: **Bulk Ops** and **Graph** on every list, and **Advance User
CSV** on users. `Graph` is also a top-level nav route (`/graph`), so the button
is a filtered entry into it.

## 7. Devices — columns right, surface incomplete — OPEN

Velto columns confirmed correct against what `device-catalog.js` already
records: `Name · Mac Address · OS · Serial Number · UUID · Registered On ·
Status`. Two additions:

- a trailing **Action** column whose only control is **View**
- `Status` renders as **`Pending-Approval`** — hyphenated, title-case

Velto **does** have `Add` on devices. An earlier note said it did not; that was
veno, which is thinner.

## 8. Filters are four routes, not one screen — OPEN (by choice)

Velto: `/url-filter`, `/content-filter`, `/filetype-filter`, `/domainlists` are
four separate screens. Mine is one `Filters.vue` behind all four routes with a
type selector. The consolidation is deliberate and the field sets match; worth
restating so it is not later mistaken for an oversight.

## 9. The filter cascades — captured — FIXED

Both were read off velto by driving the category select option by option and
reading the dependent select each time.

**File type.** The previous lists in `filter-catalog.js` were marked as
defaults pending confirmation. They were wrong:

| Category | Velto | What this file had |
|---|---|---|
| Executables | `.exe .bat .msi .com .scr` | 13 entries, no `.bat` |
| Media Files | `.mp4 .mp3 .avi .mov .mkv` | 13 entries |
| Documents | `.pdf .docx .pptx .xls .xlsx` | 13, including `.doc .docm .rtf` |
| Compressed Files | `.zip .rar .7z .tar .gz .xz` | 10, including `.iso` |
| Scripts | `.js .py .sh .rb .php` | 10, including `.bat .ps1 .cmd` |
| Images | `.jpg .png .svg .bmp .webp` | 10 |

Two things worth saying out loud. `.bat` is filed under **Executables**, not
Scripts — this file had it in the wrong place, and a rule written against the
wrong category would not have fired. And extensions are stored **with their
leading dot**, which the chips and the matcher now both honour; the matcher
had been stripping the dot from the subject while comparing against dotted
values, so every file-type test would have returned no match.

Also notable for what is **missing**: Documents offers no `.doc`, no `.rtf`
and no macro-enabled `.docm`/`.xlsm` — the formats carrying most of the actual
risk. Compressed Files offers no `.iso`. Both need Custom.

**Content — a whole cascade this console did not have.** The content filter is
not a six-way choice. The category only narrows which of **49 sub-categories**
a rule may name, and the sub-category is what a destination is matched
against. The list screen's third column is **Sub Categories**.

```
Adult / Mature Content        12   Security Risk                  7
Social / Lifestyle             8   General Interest - Business    6
General Interest - Personal    9   Potentially Liable / Illegal   7
```

Added: the cascade, the chips, the column, and the matcher, which had been
comparing categories. The test probe now offers all 49, grouped by category.

## 10. Velto's Custom file-type category cannot be filled in — NOT A BUG OF MINE

Picking **Custom** removes the extensions control and shows nothing in its
place — just Name, Category, Save and Reset. Yet a saved Custom record exists
in the list carrying `.psd, .pdf`, so the values get in somehow, but not
through this form.

This console lets Custom take typed extensions, which is what the category is
for. Worth raising with whoever owns the production form.

## 11. `/software-packages` — BUILT

Velto: `Name · Version · Platform · Publisher · Package · Status`, and the
toolbar has **no Add, no CSV, no Delete** — the catalogue is reported by
agents, not authored. `Package` is a winget-style identifier
(`RiotGames.LeagueOfLegends.KR`), which is what the agent matches on.

Velto's first page is Korean consumer software — 벅스, 네이버 웨일, League of
Legends KR — which is a useful reminder that this screen is an observation of
a real estate rather than a curated list. Seeded in that spirit: corporate
tooling plus the remote-access and torrent clients that actually turn up, four
of which carry a coral mark.

Found building it: `statusPill` matched case-sensitively, so production's own
casing — `Active`, `Pending-Approval` — fell through to null and rendered
every state unmarked, including the ones the design spends colour on.

## 12. The end-user portal is a different product — and not the one I built

Velto's member area turned up at `/member/device-status`. `/member` itself
404s, so that page is effectively the whole thing.

```
"InstaSafe agent not detected — It may not be installed or running."
Sign Out · Retry · Admin Dashboard · Download for Windows
Other platforms: Linux (.deb) · Linux (.rpm) · macOS · iOS · Android
/storage/insta-check.exe · .deb · .rpm · .pkg + App Store / Play Store
```

It is **a gate, not an account area**. One question — is the agent installed
and running on the machine you are sitting at — and if not, the download. No
MFA page, no device list, no application list, no settings.

I had built it as a three-card self-service portal, which is what a ZTNA
end-user area sounds like it should be. Velto's instinct is better and the
reason is obvious once seen: if the agent is not running, nothing connects, so
nothing else on that page would matter.

**Where enrolment goes, then.** Not a settings page, because there isn't one.
It belongs in the sign-in flow: the administrator requires MFA, and the next
time the employee signs in they are asked to enrol before being let through.
That is now how it works.

**What the admin side kept:** require MFA, see enrolment state, reset it. No
enrol button — an administrator cannot scan a QR with a phone they are not
holding, and that absence is the correct behaviour rather than a gap.

The agent probe in our version is real: it tries the loopback port a desktop
agent would listen on and reports what actually happened. Nothing answers in
the demo, which is the state every machine without the agent is in. The
download buttons explain what they would do rather than serving a 404, since a
signed binary is not ours to ship.

## 13. Bulk Ops and Graph — captured, and both of my guesses were wrong

**Bulk Ops is a CSV wizard, not operations on ticked rows.** Pick an
operation, download a template, fill it in, upload it. The table selection is
never used — the uploaded file *is* the list. The two models fail differently,
which is the whole point: a selection acts on what you can see, a file acts on
names you cannot.

```
Bulk Operations for Users
1. Select the bulk operation   [ Add users | Delete users | Activate users | Suspend users ]
2. Make a list of users        CSV rules, which change with the operation
3. Download sample Template    [Download Sample CSV]
4. Upload the file             [Choose File]            [Upload]
```

Devices offers `Activate · Suspend · Delete` — no Add, because devices enrol
rather than being created. (Its dialog still heads step 2 "Make a list of
**users**", which is a copy-paste slip in production.)

The rules, as velto states them:

- **Add** takes `First Name, Last Name, Login Id, E-Mail Id, Mobile Number,
  Password`. Mandatory: First Name, Username, E-Mail ID. Authentication type
  is deemed "Password + Certificate"; activation is
  `immediately-on-provisioning` or `automatically-on-first-login`.
- **Delete, Activate, Suspend** take one column, `username`.
- **Locally created accounts only** — not ones imported from AD or LDAP.

Rebuilt to match, with one addition: velto uploads and hopes. A file naming
four hundred accounts to suspend is read back before it runs — every row
resolved against what is actually in the tenant, with a reason — and nothing
is written until that is confirmed.

**Graph is not a chart either.** It swaps the table for a 3D force-directed
scene in place, on black, and the button becomes **Table**. "Left-click:
rotate, Mouse-wheel/middle-click: zoom, Right-click: pan."

The interaction is right and is now copied exactly. The execution is not: ten
unlabelled dots floating in space answer no question anybody asked, and
rotating them in three dimensions answers it no better. Same toggle, same
button flip, but laid out as labelled clusters around a chosen field, every
node named and every cluster counted — and it says plainly when it is
plotting one page rather than the whole set.

**Also found:** `users.importCsv` has been in the API contract and in neither
adapter since it was written, so the Import CSV button did nothing at all.

## 14. Authentication profiles were one screen with a filter — FIXED

Each protocol is its own destination in velto, with its own columns, form and
toolbar. This console had one screen behind eight routes with a type chip.

| Route | Heading | Columns | Toolbar beyond Add/CSV/Delete |
|---|---|---|---|
| `local` | Local Profile | **none — it is a form** | Save · Cancel |
| `active-directory` | Active Directory Profile | Profile Name · Domain · Primary Server IP · Backup Server IP | **Sync Now** |
| `ldap` | OpenLDAP | the above + Port · Protocol | **Sync Now** |
| `radius` | RADIUS Profile | Name · RADIUS Server IP · Backup RADIUS Server IP · Port | — |
| `saml` | SAML | Name · Integration Type · IDP EntityId · IDP Sign-In URL | **Import IDP Metadata · Download SP MetaData** |
| `oauth` | OAuth2 | Name · Client Id · Redirect URI | — |
| `openid` | OpenID | Name · Client Id · Issuer URL | — |
| `passwordless` | Passwordless Profiles | Name · Primary Auth · Fallback Authn | — |

`/profile/local` is the one that gives the game away. It sits in the nav
beside SAML and RADIUS so it looks like it should be a list too, but there is
exactly one local directory per tenant — the screen is its **password
policy**: thirteen fields, Save and Cancel, no table.

```
Maximum / Minimum password length · Minimum numeric · uppercase · lowercase ·
special characters · Set of "special" characters · Force change on next login ·
Enable password expiry · Passwords expire after (days) · Prevent any reuse ·
Restrict recent reuse · Number of previous passwords to block
```

Velto greys the two number fields until their toggle is on, which is worth
copying — the number is meaningless while the feature is off.

One addition beyond velto: LDAP's **Protocol** column takes a coral mark on
`TCP`. Port 389 over TCP is a plaintext bind, and it is the only value on that
screen that is a security decision rather than a setting.

## 15. Membership could not be edited at all — FIXED

Neither "put a user in a group" nor "put an application in an application
group" existed. Application groups had a name and a description and nothing
else, so the screen was a list of empty labels and every access rule pointing
at one pointed at nothing.

Velto's model: **membership is a searchable multi-select inside the parent's
form** — `Select Users…`, `Select Applications…` — so a group and what is in
it are one object saved once, rather than a shell you then populate from
somewhere else.

**Application groups** also carry a **type**, and hold members of that type
only:

| Type | Holds |
|---|---|
| `NET` | IP address / network + Service-Port / Port Range, repeatable via **Add More** |
| `FQDN` `WEB` `RDP` `SSH` `VNC` `DB` `WFS` | applications of that same type, multi-select |

Toolbar is `Add · Bulk Add · CSV · Delete`. Columns are
`Name · Type · IP-Network & Service - Port / Port Range / Application`.

**User groups** columns: `Group · Auth-Type · Members · Access Rules · Two
Factor Authentication · Device Binding · Device Checks`. Form: Name, Location,
Description, SAML IDP Profile, **Users**, then thirteen policy switches — this
console had three of them.

Both rebuilt. The application picker narrows by the type chosen above it,
because a WEB group offering an SSH host is an error the form should not
permit. `groups` gained `member_ids` and the missing columns; without them the
field is dropped on save with a 200.

## 16. Long selects are not controls — FIXED

The access explorer put 1,821 users in a `<select>`. You cannot scan it, you
cannot type past the first letter, and reaching a name means dragging a
scrollbar. A native select is right for eight options and wrong for eight
hundred.

Replaced with a search-first picker used everywhere a choice comes from a real
collection: ranked so a prefix beats a substring, chips for what is selected,
a hint column to tell nine people called Priya apart, "add all matching" for
the tedious case, and arrow keys throughout.

## 17. Access rules could not express the commonest policy — FIXED

Source was a single-value select over group names and destination a single
application, so "these eight people may reach those two systems" had no form
at all.

Velto's model — both ends typed and multi-valued:

```
Source Type       User · User Group · Application
Destination Type  Application · Application Group · Custom Application ·
                  URL Filter · Content Filter · FileType Filter · Domain List
Action            Allow · Deny · Bypass
Columns           Name · Src Type · Source · Dst Type · Destination ·
                  Enable Schedule · Actions
Toolbar           Add · Bulk Add · CSV · Delete · Graph
```

Rebuilt to that. Rules now point at **ids** and keep the names only for
display; the policy engine matches ids first and falls back to names, because
rules written before the change have none and silently failing to match them
would turn a working policy into a deny.

## 18. Creating mid-sentence

Writing a rule means naming a user and an application. If either did not exist
the console sent you away to make it, losing the rule you were drafting —
which is how people stop writing rules.

A picker can now create. "Create «name»" opens the smallest form that makes a
valid record of that kind, over the one already in front of you, prefilled
with what was typed, and selects it on save. Users, user groups, applications
and application groups.

Not a wizard: a wizard earns its steps when their order matters, and "a user
needs a name and an email" has no order.

Verified end to end on the deployed backend: typed a name that did not exist,
created the user without leaving the half-written rule, saved a rule with two
sources — one existing, one just made — and the access explorer then resolved
that user correctly through their group.

## 19. The remaining form sweep

Six forms opened in velto. Two were materially wrong, two matched, two are
captured but not yet built.

**Applications — WRONG, now fixed.** One flat shape (name, host, port) for
every type. Wrong in both directions: it asked a web application for a port it
does not need, and never asked a database for its driver or a file share for
its share name, without which neither can be reached.

| Type | Fields |
|---|---|
| `FQDN` | domain name · ports (comma-separated, ranges allowed) |
| `WEB` | URL · landing page · Direct Access · Use Internal IP |
| `RDP` `SSH` `VNC` | IP address · port |
| `DB` | **driver** · host · port |
| `WFS` | host · **share** · **domain** |

The data controls vary with the type too: `Block Copy Paste`, `Insert
Watermark`, `Session Recording`, `Block Downloads`, plus a `Logo` upload. Each
type offers only the ones that mean something — recording a file share does
not.

Columns: `Name · Type · IP / FQDN / URL / Host · Port / Landing Page`.
Toolbar adds **Bulk Add**.

**Device updates — WRONG, now fixed.** Built as "which agent version each
platform should run". That is a guess at the name, not the feature. Velto
pushes a *file*:

```
Name · Filename · File to be Pushed (upload) · Status · Arguments ·
Install Schedule (Immediate | After-Reboot | Uninstall) ·
Post Validation Check (Registry Key present | File present) · Check Value
```

The post-install check is the part worth having: a push without one reports
success when the installer silently failed.

**Matched already:** app blocker (`Name · OS · App Name`, OS limited to
Microsoft Windows and Mac OS) and the geo-fence field set.

**Also captured — now built:**

- **Device policy** types depend on OS. Windows gets `Registry · Script ·
  Config · Command`, macOS and Linux get the last three, because Registry is
  a Windows idea. The shared form engine takes `options` as a function of the
  form now and clears a dependent choice the new parent no longer offers —
  otherwise a Registry policy saves against macOS. Added the value field velto
  implies and does not label: what it asks for changes with the type instead
  of being a box called "value".
- **Geo-fences** got a real map — on the second attempt. The first read the
  field labels and never pressed "Want Map", so it shipped a graticule with
  dots. Velto opens a **Google Map** with the fence drawn as a translucent
  circle, a draggable pin and a location search over the top. The circle is
  the point: a radius means nothing until you see what it covers.

  Two mistakes, both corrected. The other was the unit — velto's field is
  **Radius (In Meters)** and this stored kilometres, so every fence was a
  thousand times the size it claimed. `radius_metres` now sits beside the old
  `radius_km` rather than converting it; a silent unit change on live rows is
  how a 500m fence becomes 500km.

  Built on **Leaflet + OpenStreetMap**, not Google. The Google Maps JS API
  needs a key tied to a billing account, and that key ships in client-side
  JavaScript on a public demo where anyone can lift it. Leaflet is BSD, OSM
  tiles are free with attribution, neither needs a key, and `L.circle` takes
  metres. Geocoding is Nominatim — free, keyless, debounced to respect its
  rate policy. Loaded on demand, since Leaflet is ~150KB and one screen needs
  it.
- **Gateways** got the licence wall. Add at the limit opens *"Maximum gateway
  limit reached"* instead of a form. A quota that only fails on save lets
  somebody fill in the whole thing and then be told it was wasted; this costs
  one click. Declared in the resource config, so any screen can have one.

**Still unknown:** the gateway Add form itself — velto's quota modal replaces
it, so it could not be captured.

## 20. Shift schedules had no day control — and were never enforced

Velto's Add Shift Schedule: `Name · Timezone · Start Time · End Time`, then a
**toggle per day** under "Schedule Days/Time". Columns are `Name · Days ·
Start Time · End Time`, and it sits under User settings as *Shift Schedules*.

`days` was in this console's data model and rendered in its table, and the
form had **no control for it at all** — so a schedule could be saved with no
days and would then match nothing, for ever, silently.

One window for the whole schedule rather than per day: toggling a day in
velto reveals no extra time fields despite the label implying it. Timezones
are UTC offsets rather than IANA names, which is right for a dropdown —
"(UTC+05:30) Indian Standard Time" reads, "Asia/Kolkata" is a lookup.

Two worse things behind it:

- **Schedules were never enforced.** A rule could name one, the access
  explorer printed "only during Business hours" beneath it, and the engine
  did not look at schedules at all. A rule limited to office hours allowed at
  three in the morning. The screen said one thing and the engine did another,
  which is worse than not having the feature.
- **The mock adapter held a second copy of the matcher.** It imported
  `evaluateAccess` and never called it, so engine fixes reached the deployed
  Postgres path and not the local one and the two could disagree. One engine
  now.

Proved on the deployed backend rather than asserted: Rahul Hall (Finance) to
Payroll Web is **allowed** at 17:32 on a Friday under 09:00–18:30 Mon–Fri;
narrowing that schedule to 09:00–10:00 and re-evaluating the same pair returns
**denied**; restoring it returns **allowed**.

A window whose end precedes its start runs through midnight, which is what a
night shift is — the seed carries one, because that is the case a naive
`start <= now <= end` gets wrong.

## 21. Risk profiles were invented

I had built a weighted score: a maximum allowed value and three weights for
posture, location and time. It reads plausibly and is not what the product
does.

Velto: `Name · Types · Action`. A profile names some of **twelve risk events**
and **one action**. No weights, no threshold, nothing to tune — which is the
better design, because "maximum allowed score: 60" means nothing to the person
setting it and cannot be explained to the person it locks out, whereas "an IP
switch denies access" can.

```
Login Failure · Device Check Failure · Device Bind Failure · Browser Switch
IP Switch · Long Inactivity Login · MFA Failure · Suspicious Activity
User Access of Blocked Apps · Platform Switch · Geo Bind Failure
Login from Different Locations
```

Actions: `Email Admin · Deny Access · Suspend User · Disconnect User`.

Most of the twelve are a **change** rather than a failure — a different
browser, platform, IP, or a login from somewhere new. That is the shape of a
stolen credential, which is what they exist to catch.

Rebuilt, and seeded: the screen had no rows, so a feature deciding what the
console does about a stolen credential showed nothing at all. Only the three
actions that intervene take a mark in the table; mailing an admin is a
notification.

## 22. Controllers was the wrong screen entirely — FIXED

Four of its five columns were invented. The real list is Controller, Cloud
Server, Protocol/Port, Network, Status, Actions; mine had Region, IP address,
Version and Uptime, none of which the product holds. There was no selection, no
sort, no row click, no detail, no edit, and `Add controller` was a button with
no handler behind it.

Read off the live `/controllers` on velto and the captured add and edit forms:

| | |
|---|---|
| Columns | Controller · Cloud Server · Protocol/Port · Network · Status · Actions |
| Toolbar | Add · CSV · Commit · Delete — the last two operate on the checkbox selection |
| Row click | opens a **View Controller** panel, read-only, with an Edit button |
| Form | `controller_name` · `cloud_server` · `location` · `protocol` · `port` · `mgt_port` · `internal_network` · `net_mask` · `network_topology` |
| Locked on add | `mgt_port`, `network_topology` |
| Locked on edit | those two, plus `controller_name` and `cloud_server` |
| `net_mask` | a select, /16 to /28 — not a free number |
| `protocol` | TCP or UDP |

**The management port is arithmetic.** Velto's captured controller is port 1306
with management port 21306; the live one is 1309 / 21309. It is the data port
plus 20,000, which is why the field is disabled and why nobody could tell from
looking at it. The form now says so under the field.

Built with the shared DataTable, so this screen gains sort, a column chooser and
selection-gated actions along with the other 53. The form carries velto's own
`id` and `name` on every control so an implementer can map it one to one.

### Where this screen deliberately differs from velto
- **Commit and Delete are armed by a selection.** Velto's are live over an empty
  list; clicking Delete with nothing selected is a thing you can do there.
- **The delete confirmation names what it deletes**, singular or plural.
- **The four locked fields say why they are locked.** Production disables them
  and explains none, which reads as a broken form until you work out the
  arithmetic.
- **Commit over a selection reports what it did**, and skips controllers that
  were not holding changes rather than counting them as work.

### Two judgements worth flagging
- **A new controller starts `stopped` and holding its configuration.** It has
  never been committed, so it is not serving anything. Velto's behaviour on
  create was not captured — if it comes up running, change the two values in
  `save()`.
- **Row click opens a read panel, not the edit form.** This contradicts the
  house rule in `CLAUDE.md` that a row click opens the editable panel. It is not
  a drift: velto's Controllers genuinely has a View panel with an Edit button
  inside it, confirmed on the live tenant. The rule still holds everywhere else.

### A bug this screen found in the shared table
`DataTable` clears its selection whenever the rows array changes, and this
screen polled every two seconds to watch a restart settle. The two together made
Commit-on-a-selection impossible to click — the tick landed between the checkbox
and the button and emptied it. The poll now runs only while a controller is
actually restarting, and never while a selection or the panel is open.

### Not from the captured tenant
The `cloud_server` select's 24 options were captured with real names, five of
which identify a customer. Those five are replaced with further region names;
the shape, the id range and the inconsistent casing are kept. See §3.

## 23. Gateways had none of the fields a gateway actually has — FIXED

Read off **veno**: velto's tenant is licensed for four gateways and is running
four, so its Add form will not open at all — the licence wall opens instead.
That wall is itself the finding in §23.1 below.

The list is four columns, and the demo had none of them:

| | |
|---|---|
| Columns | Gateway Name · Backup Gateway Name · Location · Number of Networks |
| Toolbar | Add · **Bulk Add** · CSV · Delete |
| Row click | a **View Gateway** panel, as on Controllers, with Edit behind it |
| Form | `gw_name` · `backup_name` · `location` · `pro_net-0..n` |
| Locked on edit | `gw_name`, `backup_name` |
| `pro_net` | repeats, with a remove on each row and an **Add more** below |

What the demo had instead — region, public IP, agent version, sessions, Mbps,
latency, status — is the Live Gateways report, not this screen. Two things it
was missing are the ones a gateway is actually configured with:

- **A backup gateway.** Every gateway names the gateway that stands in for it.
  Velto's own bulk-upload modal states it as a rule: *every gateway must have
  backup gateway name*.
- **Protected networks, plural, in CIDR.** The captured gateway fronts
  192.168.0.0/24, 10.0.0.0/24 and 0.0.0.0/0. Three networks behind one name is
  the ordinary case, and "Number of Networks" is that count. A single address
  field could never have held it.

The operational fields stay on the record — the dashboard's gateway load, the
graph, the network test and Live Gateways all read them — they are simply not
columns here, because they are not columns there.

### 23.1 The licence wall is velto's, and it fires before the form
Velto stops you at *Maximum gateway limit reached* rather than letting you fill
in a form it will refuse. That is the better of the two behaviours and it is
kept, with the count named in the message.

### 23.2 Bulk Add — velto's modal, with the step it is missing
Velto's modal is three steps: make a CSV, download the sample, upload it. It
states two rules and then uploads anyway, so a file that repeats a name or
omits a backup fails somewhere inside the import.

This reuses the Bulk Ops CSV wizard already built for users and devices, which
resolves the file against the tenant first and shows what will happen before
anything is written. On gateways it checks velto's own two rules, plus the
licence:

- a name that already exists · skipped
- no backup gateway name · skipped
- a gateway named as its own backup · skipped
- a protected network that is not CIDR, or a prefix over /32 · skipped
- rows beyond the licence · skipped, counted as the plan is built rather than
  hit half-way through writing

**Assumption to confirm:** the sample CSV's columns. The real one is a download
and was not captured, so the template here is Gateway Name, Backup Gateway
Name, Location, Protected Networks, with several networks in one cell separated
by spaces — a comma would collide with the CSV itself. If velto's template
differs, only `GATEWAY_COLUMNS` in `ListTools.vue` changes.

### 23.3 A gateway created here has no address
Velto's form does not ask for an IP: the agent reports it when it first checks
in. So a gateway added through the form or the bulk upload has no `ip`, and the
network test printed `undefined` against it. It now says *awaiting first
check-in*, and the graph says the same. A created gateway also starts `down`
with no sessions, for the same reason.

## 24. Company details was five invented fields — FIXED

The real screen holds four things and the demo had one of them. Read off veno,
and the same screen on velto:

| | |
|---|---|
| Organisation | `name` · `url` (Secure Access custom URL) |
| Address | `lane-1` · `address-area` · `city` · `address` · `zipcode` |
| Branding | `logo` and `bg`, both file uploads, WEBP/JPG/PNG |
| Contacts | three tabs — Business, Tech, Renewal — each holding **several** contacts |
| Welcome banner | a switch and `banner_text` |

Each contact is `first_name` · `lastName` · `email` · `officeNum` · `mobile` ·
`designation`, with first name, email and office number mandatory. **Add
contact** appends another card with a remove on it, so a tenant with two
network engineers on call can say so. The demo had one name, one email and one
phone per kind, which cannot describe that.

The welcome banner was missing entirely. Its tooltip says what it is for:
*Display a Custom message to users in dashboard popup* — a welcome, or the
warning notice some regulators require before access. Switching it on with no
text is refused here rather than showing users an empty popup.

### 24.1 The repeated ids are production's, and are not copied
Velto gives every contact card the same `id` — `first_name`, `email`,
`officeNum` — however many cards are on the page, and across all three tabs.
Ids have to be unique, so a label points at whichever input the browser finds
first and clicking "Email ID" on the third card focuses the first card's email.
Here the id carries the type and index (`email-tech-1`) while the `name`
attribute stays velto's, so the QA surface is unchanged and the labels work.

### 24.2 Uploads are data URLs, and that is the one place this has to differ
There is no server, so an uploaded logo is read with `FileReader` and held as a
data URL in the same IndexedDB as everything else, capped at 1 MB so a phone
photograph does not go into the settings blob. A real backend takes the file
and stores a path. Nothing else about the screen changes.

Where a customer logo should appear — beside InstaSafe's in the rail, instead
of it, or on the end-user portal only — is still the open question in
`CLAUDE.md` §4, and the hint under the field says so rather than quietly
picking one.

## 25. Subscription details had none of velto's data — FIXED

The demo showed plan, licensed seats, renews-on and support tier. All four were
invented. The real screen is a table of **licence periods**, newest first:

```
Start Date · End Date · User Licences · Licenced Gateways · Type
```

Velto, live: 19-Sep-2026 → 31-Mar-2027, 2,000 licences, 3 gateways, Regular,
with 18-May-2026 → 18-Sep-2026 for 1,000 and 3 beneath it. Veno: a Trial of 5
then a Regular of 50. So a tenant carries its licence history on this screen,
and `Type` is Trial or Regular.

Below it, **Set Subscription expiry reminder**: an `emails` textarea taking
addresses separated by commas, and `Before [0–48] months of expiry`.

### 25.1 Licenced Gateways is where the gateway limit comes from
This is the number that made velto's Add gateway refuse — §23. The Gateways
screen now reads the gateway count from the period in force instead of holding
a constant, and the bulk upload counts against the same number. Two screens,
one fact.

### 25.2 What this does that velto does not
- **Marks the period in force.** Velto prints two rows that look identical and
  leaves you to compare the dates against today's. The row in force says so,
  and a band above says how many days are left.
- **Says when the reminder would send.** "Before [0] months of expiry" reads
  like a setting that is off. This resolves it: *2 recipients would be mailed
  on 31-Jan-2027, 2 months before this licence ends*, and says plainly that
  zero means the mail goes out the day the licence ends, too late to renew.
- **Checks the addresses.** A mistyped address in a comma-separated list is
  the whole point of failure for a renewal notice, so it is named before save.
- Velto's label reads "seperated"; it is spelled correctly here.

### 25.3 A date bug worth remembering
Both screens compared `new Date().toISOString().slice(0,10)` against the
period dates. `toISOString` is UTC, and this console is read in IST: until
05:30 every morning the UTC date is yesterday, which moves a licence out of
force a day early and dates the reminder a day short — it computed 30-Jan
where the contract says 31-Jan. Calendar dates are now built from local parts
on both screens.

## 26. SMS settings was a provider list; velto has no providers — FIXED

The demo offered Twilio, MessageBird, AWS SNS or Custom HTTP, a sender id, an
API key and a secret, then code length, validity and retry count. Velto has
none of it. Its SMS screen describes **an HTTP request**:

| Field | |
|---|---|
| HTTP Method* | Get or Post |
| URL* | the vendor endpoint |
| Custom Headers | optional — where an API key goes on most gateways |
| Parameters* | the fixed part of the request, as the vendor documents it |
| Message Attribute* | which parameter the code goes in |
| Phone Number attribute* | which parameter the number goes in |

That is a better design than the one I invented, and for a reason worth
keeping: a tenant in India or the Gulf already pays a regional SMS vendor, and
a provider dropdown cannot reach it. Describing the request reaches any of
them. The code length and validity I had invented belong to the MFA policy,
not to the transport.

The one addition: GET is offered because velto offers it, with a note that it
puts the parameters — including the code — in a query string that proxies log.

## 27. Email settings — six fields, and the password is not one of them — FIXED

Velto's section is **Email SMTP Settings**: `HostName`, `Port`, `Username`,
`Sender Email-ID`, `Sender Name`, `Require SSL`, all required. Beside Save and
Cancel sits **Change Password**, which opens *Change Email Password* with
`password` and `password_confirmation`.

Two things the demo had wrong beyond the field names:

- **The password was on the form.** It belongs behind the button, where a
  password that has been set is never shown again. That is velto's behaviour
  and it is the right one.
- **Require SSL is a Yes/No select, not a switch.** Kept as a select, because
  the control is velto's and the wording is the question being asked. The
  hint says what No actually means: credentials and message bodies in the
  clear.

### 27.1 Nothing stores the password
There is no SMTP relay in this demo to hand a password to, and a browser
database is no place to keep one. Saving records `passwordSet` and
`passwordUpdatedAt` only, and the screen says *Password set 13 Oct 2026. It is
not shown again.* The panel says so too, rather than implying a secret is
being held.

### 27.2 The test send now quotes the configuration
"Send a test email" and "Send a test SMS" write to the Demo Inbox, as before,
but the message is the request that would actually go out —
`POST https://… with sender=INSTSF&route=otp, the code in "text" and the
number in "to"` — so the test says whether the configuration is right rather
than only that a button works.

## 28. The Active Directory profile asked four questions; velto asks seventeen — FIXED

The demo's add form was profile name, domain, primary server IP, backup server
IP. A profile built from those four could never have authenticated anybody:
everything that makes a bind work was missing.

Velto's form, in its order, with its `name` attributes:

| Field | |
|---|---|
| `profile_name`* | locked once the profile exists |
| `domain`* | |
| `ads_ip`* · `bads_ip`* | primary and backup AD server — **both required** |
| `username_attribute`* | select: Username · User Principal Name (UPN) |
| `auth_type`* | select: Certificate · Password + Certs |
| `bind_user`* | the account the console reads the directory with |
| `base_dn`* | |
| `filter`* | which accounts may sign in at all |
| `ps_ip` · `backup_dns` | DNS, optional |
| `primary_wins` · `backup_wins` | WINS, optional |
| `port` | toggle — *Require SSL/TLS secure connection* |
| `kerberos_auth` | toggle — *Enable Kerberos Authentication* |

Velto requiring the **backup** server is worth keeping rather than softening:
a directory with one server is a single point of failure for every sign-in in
the tenant.

Changing Authentication Type reveals nothing — the Certificate and
Password + Certs captures are identical but for the metadata. Only Kerberos
changes the form.

### 28.1 The keytab, and why its filename looks greyed out
Switching Kerberos on reveals an upload. The behaviour is in the production
bundle, not guessed:

- a button triggers a hidden file input, and the drop zone takes a drag
- the only accepted extension is `.keytab`, and the rejection reads
  *Invalid file type. Allowed types: .keytab* — reproduced verbatim
- on success the file is read with `FileReader` to base64 into `filedata`,
  and `kerberos_filename` is set from `file.name`

So the filename box is not disabled because it is broken: **it is display-only
and filled from the file**, never typed. Reproduced as a read-only field
beside the upload, which is what it is.

### 28.2 Profile Name locks on edit, on every profile type
`profile_name` is `disabled` on all four captured edit forms — OAuth, OpenID,
SAML and Passwordless — and velto does the same on Active Directory. The name
is what access rules and sessions refer to, so renaming it would be a new
profile. All seven profile screens lock it now, and say that, where production
disables it silently.

OpenLDAP and RADIUS have no captured edit form, so the lock on those two is
inferred from the other five rather than observed. If either turns out to be
editable, remove `lockedOnEdit` from that entry alone.

### 28.3 Three things the shared list template gained
These are in `ResourceList.vue`, so the other 53 screens get them too:

- `lockedOnEdit` — a field that cannot be changed once the record exists, with
  the reason shown rather than a silently dead input
- `when` — a field that only exists once another is switched on, which is how
  the keytab appears
- `type: 'file'` — an upload with its accept list, storing the name in one
  field and the base64 in another, exactly as the real console does

Form controls also carry velto's `name` attribute now wherever a config gives
one, so an implementer can map a generated form to the real one.

### 28.4 A bug this found: a filtered list created records it could not show
Every authentication-profile screen is one `type` out of `authProfiles`,
selected by `baseFilter`. Creating a profile sent only the form fields, so the
new record had no `type`, failed the screen's own filter, and vanished — it
said "Created" and the list did not change. The create now stamps the record
with the filter that selects the screen. This affected all seven profile
screens, and any other list that shows a slice of a collection.

## 29. OpenLDAP and RADIUS — the inference in §28.2 checked, and both forms rebuilt

§28.2 locked `profile_name` on OpenLDAP and RADIUS by inference, because
neither had a captured edit form. Both have now been opened on the live velto
tenant, and both are confirmed:

| | Disabled on edit |
|---|---|
| **Edit Ldap Profile** | `profile_name` **and `protocol`** |
| **Edit Radius Profile** | `profile_name` |

Veno could not answer this: its OpenLDAP and RADIUS lists are both empty, so
there is no row to open. Velto has four LDAP profiles and three RADIUS ones.

### 29.1 OpenLDAP asked six questions; velto asks eleven
Velto's form: `profile_name`* · `domain`* · `ads_ip`* · `bads_ip`* ·
`bind_user`* · `auth_type`* (Certificate · Password + Certs) · `base_dn`* ·
`filter`* · `port`* · `protocol` · `username`* (UID).

Two things the demo had wrong beyond the missing fields:

- **Protocol was a TLS/TCP select.** It is `disabled` in the product — on the
  **add** form as well as on edit — carrying TCP. The console does not offer
  the choice, so the select offered something that does not exist.
- **The attention pill on TCP marked every row.** Since every profile is TCP
  by construction, a mark on all of them says nothing and only spends the
  colour budget. Removed.

`username` offers **UID alone** on OpenLDAP, where Active Directory offers
Username and UPN. Worth keeping as the two separate lists they are.

### 29.2 RADIUS is four fields, and the secret is not one of them
`profile_name`* · `port`* (1812) · `rs_ip`* · `brs_ip`*. The demo had the
shared secret as a password field on the form. Velto keeps it behind **Change
Client Secret** on the view panel — and OpenLDAP keeps its bind password
behind **Change Password** the same way.

Both are now built the way the SMTP password is (§27.1): the value is never
stored, only that one was set and when, and the panel says so. Verified by
reading the saved record back — it holds `bindPasswordSet` and
`bindPasswordUpdatedAt`, and no secret.

### 29.3 A locked field needs a default
A field the form never lets you fill still has to be saved with its value. The
first build of this created an LDAP profile with **no protocol at all**,
because the blank form filled every key with an empty string and Protocol is
disabled. Fields can now carry a `default`, which is also how RADIUS's port
arrives pre-filled at 1812, as velto's add form does.

### 29.4 Still unverified
Active Directory's **view** panel was not opened on a tenant with AD rows, so
whether it also carries a Change Password for the bind user is unconfirmed. It
very likely does — OpenLDAP and RADIUS both do, and AD has the same bind user
— but it is not built on a guess. One look at a velto AD profile settles it.

## 30. The remaining four profile types — SAML, OAuth2, OpenID, Passwordless

All four rebuilt against their captured add and edit forms, and Active
Directory given the Change Password it also has (§29.4 is now closed: velto
does carry it there).

### 30.1 SAML — three fields missing, and one of them is the trust
`profile_name`* (locks) · `sso_integration_type`* (SAML2.0, the only option) ·
`identity_provider`* · **`fingerprint`*** · `signin_url`* ·
**`signout_url`*** · **`name_id`*** (Username · Email).

`fingerprint` is a seven-row textarea holding the IdP's signing certificate in
PEM. It is the thing an assertion is verified against, and the demo did not
ask for it at all — a SAML profile without it cannot establish trust with
anything. The sign-out URL and the NameID attribute were missing too, and
NameID decides whether a sign-in resolves to a known user or an unknown one.

### 30.2 OAuth2 — the provider dropdown changes the form
`provider` is Generic · Google · Azure, and **Tenant ID appears for Azure
alone**. Confirmed against all three captured provider states: the Generic and
Google captures have no `tenant_id` field, the Azure one does. Azure issues
tokens per directory, so the tenant is part of the endpoint.

`redirect_uri` is `readonly` in velto and derived from the tenant's host. It is
not a choice — it is what the console will be called back on, shown so it can
be copied into the provider. It was an editable required field here.

### 30.3 OpenID — Scopes was missing, Redirect URI was absent
`profile_name`* (locks) · `client_id`* · **`scopes`*** · `issuer_url`* ·
`redirect_uri` (readonly **and** disabled in velto). Without scopes the
console asks for no claims, so nothing fills the username or the address.

### 30.4 Passwordless — both option lists were invented
The demo offered FIDO Key, Certificate, Push notification, Magic link as
primary and FIDO Key, Password, OTP, None as fallback. Velto offers:

| | |
|---|---|
| **Primary Auth** | Hardware Key · Digital Certificate · Kerberos |
| **Fallback Auth** | Password · Hardware Key · Digital Certificate |

The two lists are deliberately not the same. **Kerberos is a primary and never
a fallback** — it needs a domain-joined machine, which is the case where the
primary already worked. **Password is a fallback and never primary** — not
using it is the whole point of the screen. Neither constraint can be expressed
by one shared list, which is why it is two.

Selecting any of these reveals nothing further: unlike Active Directory's
Kerberos toggle, the Passwordless dropdowns only change the selection. Checked
against all six captured variants.

### 30.5 Secrets, consistently
Every profile type that holds one now keeps it behind its own button, and
never stores the value:

| Screen | Button |
|---|---|
| Active Directory, OpenLDAP | Change Password (bind password) |
| RADIUS | Change Client Secret |
| OAuth2, OpenID | Change Client Secret |

OAuth2 and OpenID had the client secret as an ordinary password field on the
form. Nothing is stored but the fact one was set and when, as with the SMTP
password in §27.1.

### 30.6 Two smaller corrections
- A select carrying a default no longer offers an empty "Select…" choice.
  Velto's required dropdowns are never empty, and offering nothing is not one
  of the choices.
- The seeded profiles were migrated per type. Any profile type whose marker
  field is missing reseeds the collection, because each type gained its own
  fields as its real form was read.

## 31. User providers are three screens, not one with a dropdown — FIXED

Built. The field lists below are from the captures; the three states that had
no capture — Google's edit form, Azure AD's view panel, and SCIM import on a
tenant that has a token — were read off velto directly, and are marked where
they changed the answer.

The demo has **one** config at `/profile/azuread` with a Provider dropdown
(Azure AD · Google Workspace · Okta · SCIM), aliased from `/profile/google`
and `/profile/scim-import`, so all three routes render the same invented
screen. Velto has three different screens, and the third is not a list at all.

### 31.1 Azure AD — `/profile/azuread`
Columns: **Name · Tenant-ID · Groups · Auth-Type**. Toolbar: Add · CSV ·
Sync Now · Delete.

| Field | |
|---|---|
| `profile_name`* | locked on edit, as every profile is |
| `domain`* | |
| `tenant_id`* | |
| `client_id`* | |
| `groups`* | *Multiple groups separated by comma* — placeholder "Mention AzureAD group names" |
| `auth_type`* | Certificate · Password + Certs |

Confirmed against the captured edit form: `profile_name` disabled, everything
else editable.

### 31.2 Google — `/profile/google`
Columns: **Profile Name · Domain**. Same toolbar.

`profile_name`* · `domain`* · **`bind_user`\*** (labelled *Admin User*) ·
`auth_type`* (Certificate · Password + Certs) · `groups`* (comma separated,
placeholder "Mention group names").

So Google carries an admin user and no tenant or client id, and Azure carries
tenant and client id and no admin user. One dropdown over one field set cannot
express that, which is why they are two screens.

**Confirmed on velto, where there was no capture:** the Google edit form does
disable `profile_name`, like every other profile type. Its view panel carries
one secret button, labelled **Update Credentials** — not Change Password, and
not Change Client Secret. Three different wordings for the same idea across
the product, kept as velto has them.

### 31.3 SCIM import — `/profile/scim-import` is not a list
No table, no Add, no columns. It is a panel of **five disabled fields** and one
button:

```
Base Url                 https://<tenant>/scim/v2
Service Provider Config  https://<tenant>/scim/v2/ServiceProviderConfig
User Schema              https://<tenant>/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User
Group Schema             https://<tenant>/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group
Bearer Token             Token starting with 'Th9zQw…' was generated at 2026-07-01 17:24:34 IST
[Regenerate Token]
```

Every value is read-only and generated by the console: these are the endpoints
*you give to the other system*, not settings you fill in. The bearer token is
never shown in full after generation — only its first characters and when it
was made, which is the same write-only pattern as the SMTP password and the
profile secrets (§27.1, §30.5).

It needs a copy-to-clipboard on each field, which is the entire job of the
screen, and a Regenerate that says what it breaks: regenerating invalidates the
token the IdP is currently using, so provisioning stops until the new one is
pasted there.

### 31.4 Azure AD carries two credentials, not one
**No capture showed this.** Velto's Azure AD view panel has *three* buttons:
Edit, **Change Client Secret** and **Set Password**. The application
registration has a client secret and the directory account has a password, and
they are separate things, so the screen offers both. Building this against the
captured edit form alone would have produced one secret button and been wrong.

`ResourceList` now takes a list of secret actions rather than one.

### 31.5 The collection was never seeded
`userProviders` has been in the store list since the beginning and nothing has
ever written to it, so both provider screens were empty whatever their config
said. Seeded now, and the migration treats a visitor's empty collection as the
thing to fill rather than a stale one to replace.

### 31.6 SCIM import — what the screen is for, and what it would not let you do
Read again on velto, where a token exists:

```
Bearer Token   Token starting with '3j8WQI...' was generated at 2026-08-17 02:41:51 IST
```

Five disabled fields and one button. Every value is generated by the console:
they are the endpoints you paste into the *other* system. The token is shown
only as its first characters and the date, which is right — it is write-only,
like the SMTP password and the profile secrets.

Two things added, both in the same spirit as the rest of this work:

- **The fields can be copied.** Production renders them as disabled inputs,
  which most browsers will not even let you select cleanly, and copying them
  into an IdP is the entire job of the screen. A Copy button per endpoint, and
  the new token goes to the clipboard the moment it is made, because that is
  the only moment it exists.
- **Regenerate says what it breaks.** It is a destructive action wearing an
  ordinary button: the token in use stops working immediately and provisioning
  fails — users not created, not changed, not deactivated — until the new one
  is pasted at the far end. That sentence is now in a confirmation.

The token is generated with the browser's own cryptographic random source and
only its first six characters are stored. Nothing else about it is kept.

## 32. Update Credentials is a file, not a password — FIXED

Google's Update Credentials takes the **service account key as a JSON file**,
with the filename shown beside it. It was built as two password boxes. It is
the same shape as the keytab on Active Directory: a button over a hidden file
input, `.json` only, and a read-only filename taken from the file.

Secret actions can be files now. The rejection reads *Invalid file type.
Allowed types: .json*, and the state line reads *sa-key.json uploaded 14 Oct
2026. Its contents are not shown again.*

## 33. The user form — velto's three tabs, and the fields that were missing

Velto splits Add User across **Profile · Options · Advanced**. The demo had
four headed sections and a field set that did not match on any of them. The
segregation is kept, because it is load-bearing: Profile is the person,
Options is what is checked when they sign in, Advanced is policy and
networking.

Read off veno's captures and then velto, which has four fields veno does not:

| Tab | Fields |
|---|---|
| **Profile** | `first_name`* · `last_name` · `username`* · `email`* · `country_code` + `phone`* · `location` · Authentication Type* · Activation Method* · **SAML IDP Profile** · `new_password`* · `confirm_password`* |
| **Options** | Member of Groups · Two Factor Authentication · Device Binding · Device checks · Device updates · Geo Binding · **IP Restriction** |
| **Advanced** | Device DLP · Shift Schedule · Geofencing · Block Apps · Risk Profile · Device Policy · **Twin Tunnel Support** · **Static IP** · Auto Suspend |

Bold are velto-only; veno has neither. **Static IP is `static_vpn_ip`, a text
field on Advanced** — the address the account is always given on the tunnel.
The demo had none of these, and had invented a Department field that the
product does not have.

### 33.1 What changes between add and edit
- `username` is **disabled on edit**. Sessions, devices and the audit trail
  all refer to the account by it.
- the password fields are **add-only**. Edit offers **Change Password**
  instead, which is what velto does, and the right split: a password that has
  been set should not be readable from a form.
- edit adds **Authentication Profile**, which add does not ask for.

### 33.2 Activation Method has a third state nothing collected
*On date time* is one of the three options and neither console asked for the
date. Choosing it now reveals the datetime field and refuses the save without
it, rather than creating an account that activates at an unset time.

### 33.3 User Details — the modal, and the question it does not answer
Velto's edit form has a **User Details** modal holding two tables: the devices
enrolled to the account and the ACLs that apply to it. Nothing on the form
says what is in either, so you open it to find out.

The counts are on the form now — *2 devices enrolled · 1 access rule applies*
— and the panel answers a question you already know you have. The ACL table
keeps velto's columns exactly (Acl Name, Source Type, Source, Destination
Type, Destination, Action) and the devices table drops the UUID: three
identifiers in one row is not something anybody reads across, and it is on the
device record.

**A bug this found.** Membership is stored as group **ids** and a rule names
its source **group**, so matching them raw found nothing — every user read as
*no rule reaches this account*, which is the one answer that must never be
wrong by accident. The ids are resolved to names before matching.

### 33.4 Two things kept as they were
- The MFA block stays exactly as built: enrolled or not, what that means, and
  Reset for a lost phone. An admin cannot enrol somebody else's authenticator,
  and this is the one MFA action an admin genuinely performs.
- Nothing stores a typed password, here or in Change Password. There is
  nothing to authenticate against and a browser database is no place for one,
  so what is kept is that it was set, and when — and the change is written to
  the event log either way.

### 33.5 The country code select
Velto's carries **216 options**. §16 already established that a list that long
is not a control, so the common codes are offered here. If the full list is
wanted it should be the searchable picker, not a longer select.

## 34. User groups — twelve switches, and the rule count that was always zero

A group carries the same policy set a user does, which is the point of it: set
it once rather than on every member. The form had seven switches and velto has
**twelve**. The five missing were Device DLP, Shift Schedule, Geofencing, Block
Apps, Risk Profile and Device Policy — exactly the set that already existed on
the user form's Advanced tab.

IP Restriction went the other way: it was on this form and is not velto's. It
is a user field only.

| | |
|---|---|
| Form | `grp_name`* (locks on edit) · `location` · `description` · `auth_profile` (edit only) · `users`* · twelve switches |
| Columns | Group · Auth-Type · Members · **Access Rules** · Two Factor Authentication · Device Binding · Device Checks |

Velto asks for the Authentication Profile when **editing** and not when
creating, because the profile follows from where the members came from. Fields
can be declared `editOnly` or `addOnly` now.

### 34.1 Access Rules was seeded as zero on every group
The column existed, and every row read 0, while the access-rules screen listed
a dozen rules pointed straight at those groups. Nothing counted them. The count
is taken from the rules now — Administrators 2, Engineering 6, Finance 3 — and
the rules have to be built before the groups are written, or the count is zero
again.

This is the second time a join between groups and rules has been silently
empty; §33.3 was the other. Both read on screen as "this group grants nothing",
which is the one answer that must never be wrong by accident.

### 34.2 View Acls
The group's panel has a **View Acls** button opening every rule whose source is
that group — the answer to what putting somebody in it actually gave them.
Built, and reachable one click from the form, with the count on the form so the
button answers a question you already have.

Velto writes the destination as a sentence in a single cell:

```
Ip Address: 172.31.13.231   Service Name: ANY   Protocol: ANY
```

That is three facts in one column. They are three columns here. A group with
no rules gets a line saying membership on its own reaches nothing, and a link
to write one, rather than an empty table.

### 34.3 Left alone
Adding users from the group's side was already right — the searchable picker,
not a native list of 1,821 names — so it is unchanged.

## 35. User settings — three controls missing, and one section invented

Checked field by field against the capture. Velto's six sections are all
present now; three controls were absent and one section was not velto's.

**Missing, now added:**
- *Notify sub-admins on device approval*. With 775 devices waiting, this is
  the difference between a queue somebody works and a queue nobody knows
  about.
- *Notify users on device check failure*. A failed posture check looks like a
  broken product to the person it happens to unless they are told what failed.
- *Whitelisted URLs* — reachable even where direct access is otherwise closed.

**Inactive Users was invented.** Velto offers three switches — Warning,
Suspend, Delete — and asks for no interval anywhere on the screen. Three
day-count fields had been invented here instead. The switches are what the
product has.

*Open question:* where the inactivity period is actually set. It is not on
this screen, so it is either fixed, or a tenant-level value InstaSafe holds.
Worth asking before an implementer has to guess.

**Elevated access was its own section** here and is one switch inside Access
Controls in velto. Merged.

Velto's bounds and defaults are kept rather than the invented ones: force
disconnect 0–24 hours defaulting to 0, agent idle 0–60 with a Minutes/Hours
unit defaulting to 0, portal timeout 0–600 defaulting to **180**. Zero means
no cap in the first two, which is worth saying on the field rather than
leaving as a number that looks unset.

## 36. The shift window is one fact, so it is one control

Two time inputs side by side are correct and say nothing. You cannot see from
them that 22:00–06:00 runs through midnight, that a window is eleven hours
long, or that somebody has typed a window of fifteen minutes. Velto's is worse
again: a **date-picker component asked to pick a time**, calendar icon and
all, with `inputmode="none"` so it cannot be typed into at all.

The window is drawn on a 24-hour track now, with the hours written under it:

- the filled span is the window, and one that runs past midnight draws as
  **two segments**, because that is what it is
- the length is said in words — *8 hours, through midnight*
- the native time inputs stay underneath, so it can still be typed and still
  works from the keyboard
- three presets — Business hours, Night shift, Round the clock — because those
  are most of what anybody sets

A window of zero says so in the open: *No window — nothing matches this
schedule.*

The control is a field type in the shared template, so any screen with a start
and an end can use it by naming the two keys.

## 37. The nav count read as part of the label

"Devices & che… 775" — the group label truncated and the count pressed against
it, with a caret after that. Three things competing for one row, and the number
reading as the end of a word.

Two causes, both fixed: the count had no reserved space of its own, and the
**group carried the same number as its child**, so an open group printed 775
twice, a line apart, either side of a caret. The group shows the count only
while it is shut; open, the child carries it, right-aligned with the label
giving way first.

## 38. Devices — Add, Bulk Ops, and a verb that depends on the state

### 38.1 There was no way to add a device
Velto has **Add Device**: Name*, OS*, Mac Address, Serial Number, UUID. Devices
normally enrol themselves, which is why this screen leads with "Enrol this
browser", but a machine being staged before it is handed over cannot enrol
itself and there was nothing for it.

Its OS select carries **76 entries** — every string an agent has ever reported,
from "11" to "AlmaLinux 10.2 (Lavender Lion)". The families are offered here;
the exact build is what the agent sends on first check-in.

All three identifiers are optional in velto, which allows a device row that
names no hardware at all and can never be matched to a machine. At least one is
required here, and the reason is on the field: a device is matched on MAC,
serial and UUID together, because any one of them can be spoofed, reused after
a board swap, or simply absent.

### 38.2 Activate and Suspend
Velto's device actions depend on the state: a device that is not active can be
activated, and an active one can be suspended. This screen had only Approve and
Reject, so there was no way to take a working device out of service without
rejecting it — which reads as a decision about enrolment rather than about the
machine.

The panel's verb now follows the state: pending offers Approve and Reject,
approved offers Suspend, and anything else offers Activate. The same four are
on the selection bar.

### 38.3 Registered On
Velto prints the second: `2026-06-26 15:56:58`. The list shows relative time,
which is what a list wants, and the record now shows the timestamp, which is
what a record wants — including for a device added by hand, where it is the
only time the device has.

### 38.4 Bulk Ops was missing from the toolbar
The CSV wizard was built and reachable from users but not from devices, though
velto offers it on both. It is on the toolbar now, with the operations velto
gives devices: Activate, Suspend, Delete — and no Add, because devices enrol.

### 38.5 Still to confirm
Which fields lock when editing an existing device. There is no captured edit
form for this screen, and the natural answer — MAC, serial, UUID and OS are
reported by the agent and should not be typed over, while the name is a label a
person chose — is a judgement rather than an observation. One look at a velto
device edit panel settles it.

## 39. Device policy is a three-level cascade, and the screen was empty

Read off a live velto policy, because no capture goes past the Type select.

| | |
|---|---|
| Columns | Name · OS · Type · Status |
| Form | `name`* (locks on edit) · Status · `description` · OS* · Type* |
| OS | Windows · macOS · Linux |
| Type | **Registry** · Script · Config · Command — Registry on Windows only |

Velto disables the Type select until an OS is chosen, for the same reason the
Registry option is Windows-only: the Windows registry does not exist on the
other two.

### 39.1 Config is not a payload, it is a list of templates
The other three types take one thing — a registry path, a script, a command —
and the demo had a single textarea for all four. Config does not work that way.
It opens a **Config Template** select, and each template asks for its own
fields:

| Template | Asks for |
|---|---|
| Wallpaper | a file to be pushed |
| Screensaver | a file to be pushed |
| WiFi | SSID and password |
| Disk Encryption | status — Enable or Disable |
| Set BIOS Password | a password |
| Device Inventory | **nothing** |

All six sampled on the live form. Device Inventory asking for nothing is worth
saying on screen rather than leaving a gap where every other template has a
control — the agent collects the inventory and reports it on check-in.

So the form is OS → Type → Template → the template's own field, three levels,
and a single textarea could never have expressed a WiFi SSID and password or a
wallpaper image.

### 39.2 Name locks on edit
Confirmed on the live form: `name` is disabled on an existing policy. Agents
already carrying it refer to it by name, so a renamed policy is a new one and
the old one keeps applying until it is removed.

### 39.3 The collection was never seeded
`devicePolicies` has been in the store list from the start with nothing ever
writing to it, so this screen was empty whatever its config said. That is the
**third** collection found this way, after `userProviders` (§31.5) and the
group rule counts (§34.1). Seeded now, with the shape velto's own rows have —
mostly Windows config policies, which is what the templates are for.

## 40. Short fields were taking a full-width row each

A latitude is six characters. It was getting the same full-width row as a
filter expression, and so was a longitude, a city, a country code and a radius
— so a geo-fence, which is one circle and four numbers, scrolled like a long
form.

Fields can be marked `half` now, and two consecutive halves share a row. The
geo-fence form went from nine rows to five:

```
Fence name          Radius in metres
[ the map ]
Latitude            Longitude
City                Country code
Action              Fence is enabled
```

The same applies wherever a form asks for a pair that belongs together, so the
IP couples on the authentication profiles are paired too — primary and backup
server, primary and secondary DNS, primary and secondary WINS. Active Directory
is sixteen fields in thirteen rows now, and the two addresses that have to
agree sit beside each other instead of one scrolling past the other.

Anything that needs the width keeps it: the map, the LDAP filter, a picker, a
textarea.

## 41. The empty state's own button did nothing

Every list screen offers its create action twice: once in the toolbar and once
in the middle of the empty state, which is the one somebody actually reaches
for when a screen has nothing on it. The second one was wired to `null`:

```js
@action="search ? (search = '') : null"
```

Clearing a search worked. Adding the first record of anything did not — the
button was there, it looked like the way in, and it did nothing at all. This
is the worst place in the product for a dead control, because it is the only
control on the screen.

One word. Every list screen driven by the shared template had it.

## 42. Six more collections that were never written to

The same miss as §31.5 and §39.3, six more times. In the store list, never
seeded, so the screens were permanently empty whatever their config said:

| Screen | Seeded with |
|---|---|
| Blocked apps | uTorrent, BitTorrent, TeamViewer, AnyDesk, Steam, Tor Browser |
| Device updates | A sensor push, an agent upgrade, two uninstalls — with the post-install check each one proves itself by |
| URL filter | Exact, wildcard and regex rules, so all three match types are visible |
| Content filter | Rules across four of velto's six categories |
| File type filter | Executables, scripts, archives, documents |
| Domain lists | Sanctioned SaaS, finance systems, known bad, personal cloud storage |

Every row uses the field set the screen's own form asks for, so opening one
shows a filled form rather than a half-empty one.

**Cleared since:** `subAdmins` (five administrators), `roles` (the four the
sub-admin form offers, with what each may actually do) and
`reportSubscriptions` (four schedules, one of them off).

`authDevices` was a false positive — that screen reads `devices` with a filter,
so it was never empty. `exportProfiles` has no screen reading it at all; the
store exists and nothing points at it, which is worth removing rather than
filling.

## 43. Seeded for one adapter and not the other

Everything added to the seed went into the mock adapter only. `npm run dev`
uses the mock; Netlify sets `VITE_BACKEND=http`. So filters, device policies,
blocked apps, device updates, sub-admins and report subscriptions were full
locally and empty on the deployed console — and every local check passed.

CLAUDE.md warns about this split in as many words, and it still happened,
because adding a collection touches two files that look nothing alike: a
`putMany` in the mock adapter and an entry in a batch array in the HTTP one.

The backend already stored all of them as kinded records; only the batch list
was missing them.

**A tenant seeded before a collection existed never gets it**, because seeding
runs once per tenant. Each new collection is now topped up on load if it is
still empty, which costs one count per collection on the first call of a
session and avoids resetting a tenant that somebody has been using.

Verified on the deployed site, not locally: URL filter 1-5 of 5, and device
policy showing the Registry row.

## Route coverage

67 of velto's 68 nav destinations were already present. The only absence,
`/software-packages`, is now built. Deliberate additions that velto has no
equivalent for:
`/access-explorer`, `/reports/session-recording`, `/sub-admin/all`,
`/sub-admin/roles`.
