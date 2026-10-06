# i365 Console — Version B build handoff

**For:** Claude Code
**With:** the Version B case study — https://claude.ai/artifact/6DqsQkwEV2woMU98n7A7MF
**Design system:** https://claude.ai/artifact/RftQYw4arLiLZe3RJ7qJsC
**Status:** Version A (visual) is built. Version B (structural) is not started.

---

## 0. Read this first, in this order

1. This file, all of it, before writing any code.
2. The design system's `project/README.md` — read it with the Artifact tool's `read`
   action, not by guessing token values.
3. The case study, sections 5 (problems), 9 (user flows) and 14 (scope) for whichever
   wave you are building.

**Do not start at the code.** The console's problems are known and counted; re-auditing
wastes a session. Everything you need is in the two documents above.

---

## 1. The product

| | |
|---|---|
| Stack | Laravel Blade + Vue 3 + Bootstrap 5.3.8 + Font Awesome 7 |
| Pages | 66 destinations, 19 top-level nav entries, max depth 2 |
| List pages | **54, all rendering through one shared template** |
| App stylesheet | `style.css` — 324 selectors, 31 KB |
| Class names | 352, 100% human-authored, zero build-generated hashes |
| Themes | light + dark, both already shipping |
| Real tenant scale | 1,820 users · 775 devices · 794 event-log rows |

### The one fact that governs sequencing

**54 list pages share one template.** A change there lands on 54 screens at once. This is
why wave B0 exists and why it goes first: sort, filter tabs, column chooser and saved
views are built once and delivered everywhere. Nothing else in this plan has that ratio.

### Real selectors you must target

The production class names are stable and human-authored, so an override layer is viable.
Target these, not invented ones:

```
.operation-btn      .container-heading   .table-container    .card-close-btn
.pagination-btn     .no_data_p           .sidebar-menu       .treeview
.form-group         .info-icon           .status-indicator
```

---

## 2. Hard rules — do not violate without asking

1. **Do not restructure DOM outside the three permitted places** (§4). Everything else is
   CSS over existing markup.
2. **Never change `id`, `data-testid`, form field `name`, ARIA attributes or DOM order.**
   QA automation binds to these. This is the single rule that keeps Version B shippable.
3. **Do not rename or remove any of the 352 production class names.** Add classes; never
   replace.
4. **Do not introduce a CSS framework.** Bootstrap 5.3.8 stays. Its 449 `--bs-*` custom
   properties are all at stock values — re-tokenising those is the cheapest lever in the
   product and touches zero app selectors.
5. **Both themes, always.** Light and dark already ship. Dark is designed, not inverted:
   in dark, elevation is an inset border, not a drop shadow.
6. **No new runtime dependency** without flagging it first.
7. **Do not guess at anything in §8.** Those are open questions with real consequences.

---

## 3. Design contracts

Three rules decide most styling questions. They are in the design system README; repeated
here because violating them is how the earlier attempts failed.

### Elevation is earned
Only menus, popovers and modals cast a shadow. Anything in the page flow has **no shadow
and no container** — it is separated by a rule or by space. There are exactly two shadow
tokens and both are for floating layers.

> **Verification:** on a correctly built screen with nothing open,
> `document.querySelectorAll('*')` filtered to `getComputedStyle(e).boxShadow !== 'none'`
> returns **0**.

### Colour is spent on exceptions, not states
`Active`, `Approved`, `Passed` are plain muted text with **no pill**. Only `Suspended`,
`Pending`, `Failed` take a coral pill; only `Enrolled` takes a green one. A 40-row device
list should carry roughly 15 coloured marks, not 80.

### Two hues, two jobs
- **Violet** — interactive only: primary button, active nav, selected row, focus ring.
- **Coral** — attention only: pending, suspended, failed, the dashboard dot.
- Neither takes the other's role. Neither is used for structure, dividers or decoration.

### Monospace scoping
Mono is for **machine-generated strings scanned character by character**: IP addresses,
MAC addresses, device IDs, ports, record counts. Usernames, auth profile names and device
labels are read as words — sans, at `dim`. Setting `alen.joseph` in mono makes the
username column heavier than the name column beside it, which inverts the hierarchy.

---

## 4. The Track A / Track B boundary

**Track A (done):** CSS + copy over existing DOM. Rollback is one line.

**Track B (this build):** needs markup. Exactly three structural permissions are granted:

| # | Where | What changes |
|---|---|---|
| S1 | Dashboard | The attention block becomes a band with a rule beneath it, not a card around it |
| S2 | Page header | Title, subtitle and actions become one header region across all 66 pages |
| S3 | List template | The table's wrapping container element is removed; the table bleeds to the page gutter |

Anything beyond S1–S3 that seems to need markup: **stop and ask.** Do not expand this
list on your own judgement.

---

## 5. Build waves

Build in this order. Each wave ships independently.

### B0 · List template — do this first
Sort controls, status filter tabs with counts, column chooser, saved views, typeahead
replacing the 2,393-option `<select>`.

**Why first:** one template, 54 screens. Also unblocks B2's inline create.

**Acceptance**
- [ ] Every column header in the shared template is sortable; sort state survives reload
- [ ] Status filter tabs render with live counts and set a URL parameter
- [ ] Column chooser persists per user per list
- [ ] Saved views: create, name, set default, share within tenant
- [ ] No `<select>` in the product carries more than 50 options; the rest are typeahead
- [ ] A 2,000-row list scrolls at 60fps with a sticky header
- [ ] **Zero changes** to existing `id` / `data-testid` / field `name` attributes

### B1 · Device approval queue
New destination under a new **Work** nav group. Opens filtered to pending, sorted oldest
first. Bulk approve. Posture shown inline. Posture failures separated from plain waits.

**Why:** 775 devices are pending right now, and the dashboard has shown that count the
whole time the backlog grew. A number is not a queue.

**Acceptance**
- [ ] `Work → Device approvals` opens pre-filtered, oldest first, with wait time per row
- [ ] Failing-posture devices are a separate group, not mixed into the pending list
- [ ] Bulk approve works on select-all-visible and reports per-row outcome
- [ ] The dashboard attention band links here, not to the unfiltered device list

### B2 · Onboard-user wizard
Named, resumable, four steps: Identity → Access → Review → Done. Inline creation of
groups and applications. Field-level help on all 44 forms.

**Why:** 23 clicks across 4 nav groups is P1's core task and the worst number in the audit.

**Acceptance**
- [ ] Onboarding a user end to end is **≤ 8 clicks**, measured
- [ ] Progress survives navigation away and browser reload
- [ ] Groups and applications are creatable without leaving the step
- [ ] Review step renders a plain-language sentence; the access rule is **generated** from
      it, not hand-built — the 10-type source dropdown must not appear in this path
- [ ] Every required field across all 44 forms has one line of help text
- [ ] Confirmation states what the user can now reach, by name

### B3 · Access explorer + rule impact
One screen answering "what can this user reach, and why not the rest". Rule builder with
sentence preview and an impact count before save.

**Why:** highest engineering cost and the biggest differentiator. The impact count is the
only thing in the product that would tell an admin what a policy does before it does it.

**Blocked on:** open question §8.4 — whether a policy-evaluation endpoint exists. **Do not
start B3 until that is answered.**

**Acceptance**
- [ ] Given a user, the screen lists reachable destinations and the rule granting each
- [ ] Blocked destinations show a reason: posture failed / no rule / device pending /
      account suspended
- [ ] Each reason deep-links to the object that would fix it
- [ ] Rule builder shows "affects N users, M devices" before save, computed live

### B4 · Entitlement export and offboard
Access explorer in list mode grouped by application, saved view per reviewer, signed
export. Offboard action listing everything attached to a user.

**Why:** P2 and BFSI procurement checklists. Depends on B3.

### B5 · First-run checklist
State-aware setup checklist replacing the dashboard on an empty tenant.

**Acceptance**
- [ ] Reads live tenant state, not stored progress — survives a second admin finishing the
      job, or InstaSafe staff configuring on the customer's behalf
- [ ] Target: first protected application in **under 15 minutes** (competitor benchmark)

### Cross-cutting, do alongside whichever wave touches them
- [ ] All 39 delete modals name the object being deleted
- [ ] Delete is disabled until a selection exists
- [ ] All 54 empty states are distinct and carry a primary action

---

## 6. CSS strategy

`style.css` is hostile: **165 of 324 selectors are 3+ classes deep**, many prefixed
`.content-wrapper .container-fluid`, and there are **59 `!important` declarations, 22 of
them on the sidebar**.

Do not fight this with more `!important`. Use one of:

1. **Prefix selectors** — `html[data-v2] .operation-btn` beats `.operation-btn` on
   specificity with no `!important`. This was proven on the prototype: a whole direction
   layer overrode the base sheet using nothing but prefixes.
2. **`@layer`** — if the build pipeline supports it, put the app sheet in a lower layer.

For the 22 sidebar `!important` rules specifically, prefix specificity alone will not win.
Those need either the `@layer` route or a targeted edit to `style.css` — flag which you
picked.

Write new styling as a layer loaded **after** `style.css`. Rollback stays one line.

---

## 7. Verification protocol

Run these before declaring any wave done. They catch what review by eye misses — each one
caught a real bug during the design phase.

```js
// 1. Elevation contract: zero shadows on a page with nothing open
[...document.querySelectorAll('*')]
  .filter(e => getComputedStyle(e).boxShadow !== 'none').length   // expect 0

// 2. No unresolved CSS custom properties (renders as black or transparent)
[...document.querySelectorAll('svg rect, svg polygon')]
  .filter(r => getComputedStyle(r).fill === 'rgb(0, 0, 0)').length  // expect 0

// 3. Colour budget: coloured pills must be a minority of rows
document.querySelectorAll('tbody .pill').length /
  document.querySelectorAll('tbody tr').length                    // expect < 0.6

// 4. QA surface untouched — diff before/after
[...document.querySelectorAll('[id],[data-testid],[name]')]
  .map(e => e.id + '|' + (e.dataset.testid||'') + '|' + (e.name||'')).sort()
```

Also, every wave:
- [ ] Both themes screenshotted at 1440 / 1024 / 768
- [ ] Every list tested at **2,000 rows**, not sample data
- [ ] Focus visible on every interactive element; never suppressed
- [ ] Text 4.5:1 in both themes (3:1 at 24px+ and for control borders)
- [ ] Existing QA suite green

---

## 8. Do not guess — open questions

These have real consequences. If a decision depends on one, **stop and ask DJ**.

1. **Is a typical tenant run by a solo IT admin (P1) or a security engineer (P2)?**
   Decides whether B2 (wizard) or B3 (rule builder) goes first.
2. **Why have 775 devices been left pending?** If approval is deliberately batched or
   handled by InstaSafe rather than the customer, B1's queue changes shape entirely.
3. **What do support tickets actually say?** Would replace most of the persona reasoning
   in case study §4 with evidence.
4. **Does a policy-evaluation endpoint exist, or must one be built?** This moves B3
   between "a screen" and "a quarter". **B3 is blocked until answered.**
5. **How many tenants are configured by the customer vs by InstaSafe?** If mostly
   internal, B5 is an internal efficiency tool and drops down the order.
6. **Does `--violet-600` (`#5b4fd1`) clear brand guidelines?** It is the logo purple with
   chroma raised to pass AA as a button fill. Not the logo value itself.

---

## 9. Anti-patterns — what was rejected, and why

Three design iterations were rejected before the current direction landed. Reproducing any
of these wastes a cycle.

**Do not put content in cards.** Every region becoming the same rounded surface — same
fill, same border, same radius, same shadow — was the specific complaint. The workspace is
white and content sits directly on it.

**Do not add a decorative accent bar** to the top of tiles or panels. It encodes nothing.

**Do not build a uniform grid of equal-weight tiles.** A dashboard has one primary thing
and several secondary things. Hierarchy comes from what is actually wrong, not from DOM
position — the attention state gets the large numerals, not the first child.

**Do not use one radius, one shadow and one border everywhere.** Three radii, two shadows,
and most surfaces have neither.

**Do not reach for 12–16px radius.** That is the default generated-dashboard look. Controls
are 6px, floating things are 8px.

**Do not set headings bold.** Page titles are 25px at weight 450. The heaviest thing in the
interface is a page title and it is not bold.

**Do not put brand colour on structure.** Dividers, headers, borders and section labels are
neutral. Always.

---

## 10. Definition of done, per PR

- [ ] Acceptance criteria for the wave item are all checked
- [ ] §7 verification run, output pasted into the PR
- [ ] Both themes screenshotted at three widths
- [ ] Tested at 2,000 rows
- [ ] No new `!important`
- [ ] No change to `id` / `data-testid` / field `name` / ARIA / DOM order outside S1–S3
- [ ] Existing QA suite green
- [ ] Rollback is removing one stylesheet import, or the PR says why it is not
