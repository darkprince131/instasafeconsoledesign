# InstaSafe i365 — console redesign

Two working prototypes of the i365 ZTNA administrator console, as static sites. No build
step, no dependencies — open `index.html`.

| Branch | What it is |
|---|---|
| **`main`** | **Version A** — visual rebuild. Same navigation, same flows, same field sets as the live console. Presentation and copy only. |
| **`enhanced-ux`** | **Version B** — structural. Approval queue, onboarding wizard, access explorer, import dry-run, first-run checklist. |

Diff the branches to see exactly what the structural work changes:
```
git diff main..enhanced-ux -- assets/js/console.js
```

## Running it

Open `index.html` in any browser. Both builds carry a **States** panel, bottom right:
theme, navigation rail, palette, screen, data state and overlays. That is the fastest way
to see every state without clicking through.

Records you create are kept in `localStorage`. Nothing is sent anywhere.

## Layout

```
index.html              the console
assets/css/console.css  all styling, tokens first
assets/js/console.js    data, rendering, flows
assets/img/             mark and lockup, extracted from the brand source
brand/                  logo source and derived assets
docs/                   the audits every count in this project comes from
```

## Design contracts

The visual language is deliberate and documented in `docs/`. In short:

- **Unboxed.** Content sits on the canvas. No cards. Separation is rules and space.
- **Elevation is earned.** Only menus, modals and sheets cast a shadow — zero on a page at rest.
- **Colour marks exceptions, not states.** `Active` and `Passed` are plain text; only
  `Pending`, `Suspended` and `Failed` take a pill.
- **Two hues, two jobs.** Violet is interactive, coral is attention. Never swapped.
- **Monospace** is for machine strings only — IPs, MACs, ports, counts.

An `ember` palette is included as a toggle, carrying the InstaSafe house `--db-*` tokens, so
the two directions can be compared on the same screens.

## Verification

`docs/VERSION-B-HANDOFF.md` §7 defines the checks. Last run on `enhanced-ux`:
shadows in page flow **0**, unresolved fills **0**, pill-to-row ratio **0.30** on Users and
**0.50** on the approval queue.

## Not in this repo

The 502-snapshot capture of the live tenant is excluded by `.gitignore` — it is 149 MB of
production console data and does not belong in a public repository.

---

## `production/` — taking this into the real console

The prototype at `/` shows where the console should land. `production/` is how it
gets there without rebuilding the app.

| File | What it is |
|---|---|
| `production/i365.css` | The design system as shippable classes, all prefixed `i-` |
| `production/users.html` | The Users screen built with them — real routes, real ids, real form field names |
| `production/MIGRATION.md` | Order of work, class map, design contracts, verification |

Nothing behind the markup moves: routes, controllers, API payloads, form field
`name` attributes, element `id`s, `v-model` bindings and validation are all
unchanged. The `i-` prefix means `i365.css` and the existing `style.css` load
side by side, so screens migrate one at a time with no flag day.

Start with `MIGRATION.md`.
