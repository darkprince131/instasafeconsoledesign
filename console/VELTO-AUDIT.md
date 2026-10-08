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

## Route coverage

67 of velto's 68 nav destinations were already present. The only absence,
`/software-packages`, is now built. Deliberate additions that velto has no
equivalent for:
`/access-explorer`, `/reports/session-recording`, `/sub-admin/all`,
`/sub-admin/roles`.
