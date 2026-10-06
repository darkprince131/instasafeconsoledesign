# i365 console redesign — design system brief

**Purpose of this document.** Hand this to a fresh Claude chat to work on the *visual design system* for the InstaSafe i365 admin console, with references. Everything needed to start is in here; no prior conversation is required.

**What is being asked for:** a design system — tokens, type, structure, component vocabulary — that does **not** look like generic AI-generated dashboard design. A working prototype exists and its information design is sound, but its visual treatment is templated. That is the problem to solve.

---

## 1. The product

**InstaSafe i365** — a multi-tenant ZTNA (zero-trust network access) admin console. Security administrators use it to provision users, register devices, enforce posture checks, define access rules between sources and destinations, and read audit logs.

| | |
|---|---|
| Stack | Laravel Blade + **Vue 3** + **Bootstrap 5.3.8** + Font Awesome 7 |
| Pages | 66 destinations under 19 top-level nav entries, max depth 2 |
| List pages | 54, all rendering through **one shared template** |
| Class names | 352 distinct, **100% human-authored, zero build-generated hashes** |
| App stylesheet | `style.css`, 324 selectors, 31 KB |
| Themes | light + dark, already shipping |
| Real tenant scale | 1,820 users · 775 devices · 794 event-log rows |

The 54-pages-one-template fact is the most important constraint in this document. A change to the list template lands on 54 screens at once. That leverage is rare and it is what makes a visual redesign affordable.

---

## 2. What already exists

Four analysis documents and one prototype. All are complete; none need redoing.

| Artefact | What it is |
|---|---|
| `audit.md` | CSS and class-name analysis. The override-layer feasibility study. |
| `ux-inventory.md` | Full flow, form and IA inventory. Every count in §4 comes from here. |
| `velto-supplement.md` | Findings that only appear at production data scale. |
| **Red Pen on i365** | 8 annotated screenshots, 30 findings against named UX laws. |
| **What JumpCloud and OpenVPN Do Instead** | Annotated competitive teardown, 9 rendered competitor screens. |
| **i365 Console — Version A** | Working reskin prototype. Live, with persistence and a state switcher. |

Version A is the subject of the critique in §6.

---

## 3. Two tracks — keep them separate

| | Scope | Cost | QA exposure |
|---|---|---|---|
| **Track A** | CSS + copy override layer. No DOM structure, routes, APIs or JS behaviour change. | Days | Near zero — rollback is one line |
| **Track B** | Flow and IA: wizards, status filter tabs, column choosers, saved views | Weeks, priced per change | Real |

**The design system being briefed here is Track A.** It must be expressible as a stylesheet loaded after `style.css`, plus copy changes. Ship A first; do not let B block it.

---

## 4. The evidence base — counted, not estimated

From 502 captured DOM snapshots. These are the problems the design system has to solve.

**Visual / Track A:**
- Dashboard renders **three pie charts with no legend, no labels, no values**. A ranking ("Top Data Usages") drawn as a pie.
- Stat cards put the **value in `#979797` (≈2.8:1 contrast, below the 4.5:1 AA floor)** and the label in brand purple. Hierarchy inverted.
- **`box-shadow: none` on `.form-control:focus`, `.form-select:focus`, `.form-check-input:focus`** — focus is visually identical to rest on every input in the product.
- **54 identical empty states**, all reading `No results found`, including the 21 pages that are genuinely empty. Zero inline actions.
- **`Reset` is styled in the same red as `Delete`.** The loudest colour in the interface sits on the least consequential control.
- Toolbar buttons are **25px tall, 75px min-width** — below the 44px AA target. Delete sits fifth of six, same size and shape as Export.
- **Four separate button systems** (`.operation-btn`, `.card-btn`, `.nav-btn`, `.btn-royal`, `.btn-gradient`) with four different corner radii: 2px, 6px, 25px, `.375rem`.
- **11 border-radius values for ~4 roles. 92 distinct colours. 21 font sizes.** `14px` and `.875rem` both used for the same thing.
- Nav: **19 uppercase text-only entries, no icons, no grouping.**
- Broken avatar image in the header on **495 of 502 pages** (confirmed broken in the live app, not a capture artifact).

**Structural / Track B — context only, not this brief:**
- 0 of 44 forms have any field-level help text.
- 0 of 54 list pages have a sort control, column chooser or saved view.
- Delete is never disabled; 39 delete modals never name the object.
- 23 clicks and 4 nav groups to onboard one user. Zero inline-create controls anywhere.
- One `<select>` with **2,393 options**.

---

## 5. The house design system that already exists

`C:\Instasafe Webdesign` is the InstaSafe Next.js marketing site. It already contains a console token system in `app/globals.css` — the `--db-*` namespace, used by every simulator and interactive console on the marketing site.

**Use these. They are the brand's own answer and they are good.** Verbatim:

```css
/* dark (default) */
--db-bg:        #0a0b0d;
--db-sidebar:   #0e0f12;
--db-surface:   #121417;
--db-surface-2: #171a1e;
--db-border:    rgba(255,255,255,.08);
--db-text:      #f1f1f3;
--db-text-dim:  #a1a1aa;
--db-text-mute: #61626b;
--db-accent:    #ff6a2c;
--db-accent-2:  #ffa07a;
--db-success:   #46d38a;
--db-warning:   #f59e0b;
--db-danger:    #ff5c72;
--db-shadow:    0 24px 60px -20px rgba(0,0,0,.7);

/* light */
--db-bg:        #f2f1ec;
--db-sidebar:   #ffffff;
--db-surface:   #ffffff;
--db-surface-2: #f6f5f1;
--db-border:    rgba(20,18,12,.11);
--db-text:      #1b1a17;
--db-text-dim:  #5c594f;
--db-text-mute: #7a766e;
--db-accent:    #f2480a;
--db-accent-2:  #c2410c;
--db-success:   #178a51;
--db-warning:   #b45309;
--db-danger:    #c32f46;
--db-shadow:    0 24px 50px -24px rgba(40,30,10,.22);
```

The file's own comment explains the reasoning:

> *"Surfaces were navy; they are now the neutral dark of iz-system.css so a console reads as native in either design system. Accent is the brand orange. Success/warning/danger stay semantic — they carry meaning, not brand, so they are aligned to the allow/deny values rather than recoloured away."*

Also in that repo: `components/console/SidebarNav.tsx` already maps i365's nav groups to Phosphor icons. `components/console/charts.tsx`, `DeviceTableViz.tsx`, `AssetInventoryViz.tsx` are existing console component treatments. Typeface is **Inter**.

### A palette decision that has already been made — and reversed

A separate document, `i365_Admin_Design_Specification.docx` (24 March 2026), proposes a **blue/teal** palette: `--primary: #2563eb`, `--teal: #0d9488`, with Inter and a 5-phase plan. It drops the brand orange `#ef5137` and purple `#656195` entirely.

**That was not adopted.** The `--db-*` house tokens were used instead, because they fix the contrast and neutrality problems *while keeping the brand*. The March spec is still worth reading for its component tables, 17-item sidebar icon mapping and five nav section labels (`INFRASTRUCTURE · IDENTITY · SECURITY · ACCESS · MONITORING`) — but not for its colours.

---

## 6. What is wrong with the current prototype — the actual brief

Version A's **information design is right**. Hierarchy is fixed, empty states are differentiated, charts match their data types, contrast passes, focus rings are back, destructive actions are properly weighted. Keep all of that.

Its **visual design is templated.** It is recognisably the default look a language model produces for a dashboard, and it needs replacing. Specifically:

### The tells

1. **Everything is a rounded card.** Every region — KPI tile, chart panel, table, form panel, empty state — is the same white/surface rectangle with the same `14px` radius and the same soft shadow. Border, fill, radius and shadow each say *"separate object"*; spending all four on every block flattens the hierarchy instead of creating it. Nothing on the screen is louder or quieter than anything else.

2. **The accent bar on top of the card.** A 3px gradient/solid rule across the top edge of each KPI tile. This is one of the most recognisable AI-dashboard motifs in existence. It also encodes nothing — the colour is decorative, not semantic.

3. **Uniform grid of equal tiles.** Four KPIs in a row, all identical weight; then a row of chart cards, all identical weight. Real dashboards have a primary thing and secondary things. This has neither.

4. **One shadow, one radius, one border, everywhere.** `--db-shadow-sm` on every surface. No elevation system, no sense that some things sit above others.

5. **Generic spacing rhythm.** Everything at 14–16px gaps. No compression, no breathing room, no deliberate density contrast between a dense table and a spacious empty state.

6. **No product-specific visual language.** Nothing about the look says *security console*. It would work unchanged for a CRM, an analytics tool or a billing dashboard. The subject's own world — posture, trust, allow/deny, sessions, risk, network topology — contributes nothing to the visual identity.

7. **Decorative structure.** Section labels, dividers and the accent bars are applied evenly rather than encoding anything true about the content.

### What "not templated" would mean here

Not maximalism, and not novelty for its own sake. An enterprise security console is scanned and operated for hours a day; it has to stay calm and legible. The goal is a system where:

- **Elevation is earned.** Most surfaces are flat and separated by rules or spacing alone; a shadow means something is genuinely floating (panel, modal, menu).
- **The primary thing is visibly primary.** A dashboard has one answer to *"is anything wrong right now?"* and it should dominate.
- **Density is deliberate and varies by role.** Tables tight, forms measured, zero-states open.
- **Colour is almost entirely absent** until it carries meaning. Orange means brand/active. Green/amber/red mean allow/attention/deny. Everything else is neutral.
- **The security domain shows up** somewhere in the type, the rules, the state indicators or the way trust and risk are drawn.

---

## 7. What to bring back

A design system spec that can be applied to the existing prototype. Useful shape:

1. **Type** — typeface(s), scale with roles, weights, tracking, numerals. Inter is the incumbent; a considered pairing is welcome if argued.
2. **Surface and elevation model** — how many levels exist, what distinguishes them (rule vs fill vs shadow), when each is used.
3. **Density scale** — what tight/default/loose mean in numbers, and which components take which.
4. **Component vocabulary** — table row, form field, panel, toolbar, tile, pill, empty state. What each looks like and, more importantly, **what makes them different from each other**.
5. **The colour contract** — which values are decorative (ideally none) and which are semantic.
6. **Two or three reference directions**, with the reasoning for the chosen one.
7. **Anything the security domain contributes** to the visual language.

References are welcome and will be used directly — screenshots, product URLs, or a named aesthetic direction.

---

## 8. Constraints that cannot move

- **Track A only.** The result must be expressible as CSS layered over the existing DOM, plus copy. No markup restructuring.
- **352 production class names are fixed.** Selectors must target the real ones: `.operation-btn`, `.container-heading`, `.table-container`, `.card-close-btn`, `.pagination-btn`, `.no_data_p`, `.sidebar-menu`, `.treeview`, `.form-group`, `.info-icon`, `.status-indicator`. The inventory is in `audit.md`.
- **Specificity is hostile.** 165 of 324 app selectors are 3+ classes deep, many prefixed `.content-wrapper .container-fluid`. 59 `!important` declarations, 22 of them on the sidebar. Plan for `@layer` or a matching prefix.
- **Both themes are required.** Light and dark already ship and the toggle mechanism must not change.
- **Brand orange stays.** `--db-accent` is the brand. Semantic colours stay semantic.
- **Bootstrap 5.3.8 stays**, with its 449 `--bs-*` custom properties — all at stock values and available for re-tokenisation without touching a single app selector. This is the cheapest lever in the product.
- **Both light and dark must be designed**, not one inverted into the other.

---

## 9. Open questions worth an opinion

1. Inter, or a pairing? A security console can carry a more characterful face than the default.
2. Is the sidebar dark in both themes (common in consoles, and the house `--db-sidebar` supports it), or does it follow the theme?
3. How much of the marketing site's visual identity should the console inherit, and where should it deliberately diverge?
4. Should data density be a user preference, or one opinionated default?
5. Does the console get an illustration or iconography language of its own for zero-states, or stay purely typographic?

---

## 10. After this

Version A gets re-skinned against the new system. Then **Version B** — the real redesign — takes on the structural work: named resumable wizards, status filter tabs with counts, column choosers, saved views, inline creation of prerequisites, and the device approval queue. Version B is where the 23-click onboarding path and the 775 pending devices get fixed.
