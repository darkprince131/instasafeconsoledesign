# veno.instasafe.com — class-name & design-system audit

Read-only audit of `Downloads\capture` (502 HTML snapshots, 72 pages/areas, 4 stylesheets).
Nothing in the capture was modified. Sources: `capture-manifest.md`, `_assets/**`, all 502 `*.html`.

**Headline: this codebase is unusually friendly to an external override layer.** Zero
build-generated hash classes, 352 distinct class names in total, one app stylesheet of 324
selectors, and 1,294 inline `style` attributes that are almost entirely runtime toggles
rather than cosmetics. The real obstacles are selector depth (up to 7 classes) and 59
`!important` declarations, both enumerated in §6.

---

## 1. Scope parsed

| Input | Count | Notes |
|---|---|---|
| HTML snapshots | 502 | `_work/` excluded |
| `class` attributes | 161,585 | |
| class tokens (occurrences) | 230,301 | |
| **distinct class names** | **352** | the entire surface area |
| CSS files | 4 | `vendor.css` 262 KB, `fonts/all.min.css` 96 KB, `style.css` 31 KB, `pagescss.css` 7.7 KB |
| runtime-injected `<style>` blocks | 3 per page (+2 one-offs) | 274 / 272 / 446 bytes — all `3d-force-graph`; plus Google Maps (9 pages) and the 404 page |
| inline `style` attributes | 1,294 across 387 files | see §6.1 |

`style.css` loads on 496 pages. `pagescss.css` loads on **5 pages only** (`/signin`).
Load order on every page: `all.min.css` → `vendor.css` → `style.css`.

---

## 2. Class naming: human-authored vs build-generated

### Ratio

| Origin | Occurrences | Share | Distinct |
|---|---|---|---|
| App CSS (`style.css` / `pagescss.css`) | 77,306 | 33.6 % | 82 |
| Bootstrap / vendor only | 76,682 | 33.3 % | 164 |
| Font Awesome | 39,212 | 17.0 % | 16 |
| Both Bootstrap **and** overridden by app CSS | 31,858 | 13.8 % | 48 |
| In DOM, matched by no stylesheet (JS/state hooks, dead classes) | 5,243 | 2.3 % | 42 |
| **Build-generated hashes** | **0** | **0.0 %** | **0** |

**100 % of class names are human-authored and stable. 0 % are build-generated.**

Probed and confirmed absent across all 502 files:
`_ngcontent-*`, `_nghost-*`, `css-1a2b3c` (emotion), `jsx-9837421` (styled-jsx),
`sc-XxXxXx` (styled-components), `svelte-*`, `Mui*`, `tw-*`, and hashed
`data-v-xxxxxxxx` scoped-CSS attributes.

### Which framework produced them — and why there are no hashes

The app is **Vue 3** (`data-v-app` on 1,502 mount points, a `[v-cloak]` rule, `<!---->`
placeholder comments throughout). Vue 3 only emits `data-v-<hash>` attributes when a
component uses `<style scoped>`; this app does not — every style lives in two global
stylesheets. The only Vue-generated attribute present is the unhashed `data-v-app`.

Consequence: **every selector written against this DOM keeps matching across rebuilds.**
There is no hash to chase.

The 42 unmatched classes are the only naming risk, and they are semantic, not hashed:

- **JS/state hooks with no styling**: `theme-btn`, `modal-open`, `btn-outline`, `btn-o`,
  `header-left`, `header-right`, `form-group` (1,940 uses across 295 pages — **purely
  structural, zero CSS**), `treeview-menu-nested`, `main-page-form-section`,
  `mod-contact-sec`, `welcome-banner`, `navigation`, `application-card`, `bg-body-subtle`,
  `tr-right`, `col-xs-12` (Bootstrap 3 leftover, 120 uses — dead), `chart`, `chart-pie`,
  `scene-container`, `scene-nav-info`, `float-tooltip-kap`, `graph-info-msg`, `pac-card`,
  `grecaptcha-*`.
- **Unmaintained**: `one` … `fifteen` (15 classes, 1 use each, one page) — spelled-out
  ordinals with no CSS. Dead markup.

Convention is loose but readable: mostly flat kebab-case (`operation-btn`,
`container-heading`, `table-container`, `card-close-btn`, `pagination-btn`,
`status-indicator`, `readonly-field`), one BEM island imported from vue-multiselect
(`multiselect__option--highlight`), one `dp__`-prefixed island from the date picker, one
`is-` state class (`is-active`). No systematic block/element/modifier scheme of the app's
own.

---

## 3. CSS framework / UI kit

| Layer | Library | Version | Evidence |
|---|---|---|---|
| Grid, utilities, components | **Bootstrap** | **5.3.8** | banner comment in `vendor.css`; `--bs-*` tokens |
| Icons | **Font Awesome Free** | **7.0.1** | banner in `_assets/fonts/all.min.css`; `"Font Awesome 7 Free"` family; 4 × `.woff2` |
| Tag / multi-select | **vue-multiselect** | not stamped | 30 `.multiselect*` selectors incl. `multiselect__tags-wrap` |
| Date / range picker | **@vuepic/vue-datepicker** | not stamped | 242 `dp__*` selectors, `--dp-*` custom props |
| 3D relationship graph | **3d-force-graph** (Three.js) | not stamped | runtime-injected `.scene-container`, `.float-tooltip-kap`, `.graph-info-msg`; 95 files / 4 pages |
| Maps (geofences) | **Google Maps JS API** | n/a | `.gm-style`, `.pac-container` on 4 files |
| Bot check (sign-in) | **reCAPTCHA v3** | n/a | `.grecaptcha-badge`, `#g-recaptcha-response` |

**No Tailwind, no PrimeNG, no Angular Material, no bespoke framework.** It is stock
Bootstrap 5.3.8 with a thin bespoke skin on top (`style.css`, 324 selectors).

All vendor bundles are concatenated into one `vendor.css`. Bootstrap ships **449 distinct
`--bs-*` custom properties**, 117 of them on `:root`, plus 53 overrides under
`[data-bs-theme=dark]`. That is the single largest override lever available.

---

## 4. Current de-facto design system

App CSS (`style.css` + `pagescss.css`) contains **1,094 declarations**; vendor contains
6,443. Values below are from app CSS unless marked *(Bootstrap default)*.

### 4.1 Colour

App CSS uses **260 literal hex colours against only 73 `var(--…)` reads** — the token
layer exists but is bypassed roughly 3.5 : 1.

**Defined tokens — the whole theme contract:**

| Token | Light (`:root`) | Dark (`body.dark-theme`) |
|---|---|---|
| `--bg-color` | `#ffffff` | `#121212` |
| `--text-color` | `#121212` | `#ffffff` |
| `--text-secondary-color` | `#968ba0` | `#fff` |
| `--icon-color` | `rgba(101,97,149,.5)` | `rgba(255,255,255,.7)` |
| `--border-color` | `#e2dee6` | `rgba(255,255,255,.12)` |
| `--label-color` | `#493E54` | `#fff` |
| `--bs-body-color-rgb` | `33,37,41` | `222,226,230` |
| `--bs-border-color` | `#e2dee6` | `rgba(255,255,255,.12)` |

Eight tokens. Everything else is hard-coded.

**Distinct colours in app CSS: 92.** By frequency:

| Count | Value | Role as used |
|---|---|---|
| 70 | `#ffffff` | surfaces, inverted text |
| 21 | `rgba(255,255,255,.12)` | dark-mode border — every dark rule repeats the literal |
| 19 | `#121212` | body text (light), body background (dark) |
| 14 | **`#656195`** | brand purple — primary button, company name, KPI caption |
| 14 | **`#ef5137`** | brand orange-red — sidebar active, danger button, accent slash |
| 12 | `#493e54` | heading + form-label colour |
| 9 | `#e2dee6` | border |
| 8 | `#968ba0` | secondary text, `btn-royal` |
| 6 | `#555555` | scrollbar thumb hover |
| 5 | `#ffffffb3` | dark-mode placeholder / disabled text |
| 5 | `#1e1e1e` | dark modal surface |
| 4 | `rgba(101,97,149,.5)`, `rgba(255,255,255,.12)` | icons / borders — duplicated in two notations |
| 4 | `#000000`, `#e0e0e0` | shadows, progress track |
| 3 | `#343c45` | table cell text |
| 3 | **`#1db82f`** | success button |
| 3 | `#484848`, `#ea580c` | datepicker hover (dark), login input hover |
| 2 | `#ef5137cc`, `#c43e2d`, `#189628`, `#5b547d` | faded / pressed variants of the four brand colours |
| 2 | `#cccccc` `#888888` `#d0d0d0` `#aaaeb7` `#959595` `#212121` `#2d2d2d` `#3a383e` `#4d504f` `#005cb2` `#e53935` `#212529bf` `#00000033` `#0000001a` `#f97316` | one-offs |
| 1 | 44 further values | incl. `#fee2e2` `#b91c1c` `#d1fae5` `#047857` `#451a1a` `#f87171` `#1a361a` `#4ade80` `#337ab7` `#ff6600` `#fafbfc` `#61a8ea` `#9e9e9e` `#a9a9a9` `#0000004d` `#d1d5db` `#f1f1f1` `#979797` `#5a4b68` `#282828` `#6d6d6d` `#c2410c` `#9a3412` `#ff8c00` `#ffffff14` `#ffffff26` `#ffffff0d` `#ffffff59` `#ffffff73` `#ffffffcc` `#b0b0b0` `#3e3e3e` `#333333` `#737373` `#00701a` `#428f59` `#dee2e6` `rgba(79,77,192,.12/.18)` `rgba(246,92,128,.12/.18)` `rgba(226,222,230,.61)` |

Vendor adds **193 distinct colours** (Bootstrap's full palette plus the datepicker theme).
Bootstrap's semantic `:root` set is untouched at stock values: `--bs-primary:#0d6efd`,
`--bs-secondary:#6c757d`, `--bs-success:#198754`, `--bs-danger:#dc3545`,
`--bs-warning:#ffc107`, `--bs-info:#0dcaf0`, `--bs-link-color:#0d6efd`.

**The brand-vs-Bootstrap split is the most consequential finding here.** The app never
re-tokenises Bootstrap. It restyles buttons only when an app modifier class is also
present:

| Selector | Occurrences in DOM | Rendered colour |
|---|---|---|
| `.operation-btn.btn-primary` | 1,659 | `#656195` |
| `.nav-btn.btn-primary` | 623 | `#656195` |
| `.card-btn.btn-primary` | 26 | `#656195` |
| `.btn.btn-danger` **bare** | **39** | **`#dc3545`** *(Bootstrap default)* |
| `.btn.btn-primary` **bare** | **5** | **`#0d6efd`** *(Bootstrap default)* |

So the delete-confirm modal's **"Yes, Delete it!"** button — present in all 39
`*--delete-confirm.html` files — renders Bootstrap red `#dc3545`, while the table-toolbar
**Delete** that opened it renders brand `#ef5137`. **Two different reds for the same
destructive action, one click apart.** The 5 bare `btn-primary` are the sign-in page's
Next / Sign-in button at `#0d6efd` — Bootstrap blue, off-palette entirely.

Second collision: **`#ef5137` carries two meanings simultaneously** — brand accent (active
nav item, dashboard `/` separator, dark-mode card captions and modal headings) *and*
danger (`operation-btn.btn-danger`, `nav-btn.btn-danger`). A restyle cannot change one
without the other until they are split.

### 4.2 Type

`--bs-body-font-family` is stock Bootstrap's system stack. App CSS declares `font-family`
only 3 times: `inherit` (×3), `"Helvetica Neue",Helvetica,Arial,sans-serif` (×2, on the 404
page), and `Lato,sans-serif` (×1, on `.btn-royal` only — a single button family matching
nothing else). **No webfont is loaded** apart from Font Awesome's four icon `.woff2`.

**font-size — 21 distinct values in app CSS:**

| Count | Value | Role |
|---|---|---|
| 15 | `.875rem` | table cells, form labels, sidebar links, info icon |
| 11 | `.75rem` | `operation-btn`, `card-btn`, `btn-royal`, menu-title, KPI caption, last-login |
| 10 | **`14px`** | `.form-control`, `.form-select`, `.form-date`, `.btn-gradient` |
| 8 | `1rem` | modal message, `.card-close-btn` |
| 5 | `1.5rem` | `.btn-sidebar`, toast icon |
| 4 | `.9rem` | |
| 3 | `1.25rem` | `.container-heading>h2`, `.card-heading` |
| 2 | `1.2rem`, `.8rem` | |
| 1 each | `1.15rem` `1.375rem` `.85rem` `.6rem` `12px` `16px` `17px` `24px` `26px` `28px` `40px` `80px` | |

`14px` and `.875rem` are **the same rendered size expressed in two units** — 10 uses vs 15
uses, with no rule distinguishing them. Collapsing those alone removes a step from the
scale. Vendor adds 55 further `font-size` values.

**font-weight — 5 distinct:** `700` (13), `600` (9), `500` (4), `900` (1, `.menu-title`),
`bolder` (1, `.card-heading` — the only keyword weight). `400` is never declared; body
weight comes from Bootstrap's `--bs-body-font-weight:400`.

### 4.3 Spacing

Layout spacing is overwhelmingly **Bootstrap utilities in the markup**, which is good news
for a restyle — the geometry is already tokenised. Top utilities by occurrence:
`me-3` (15,882), `col-12` (4,057), `mb-2` (2,697), `mb-3` (1,115), `me-1` (1,090),
`px-3` (990), `gap-2` (495), `py-1` (495), `m-2` (473), `ms-2` (466), `p-1` (462).

App CSS declares spacing at **22 distinct values**:

| Count | Value |
|---|---|
| 42 | `0` |
| 10 | `15px`, `1rem` |
| 9 | `12px`, `.5rem` |
| 8 | `5px` |
| 5 | `6px` |
| 4 | `16px`, `4px`, `.25rem` |
| 3 | `10px`, `20px`, `25px` |
| 2 | `8px`, `-15px`, `.3rem` |
| 1 | `0%`, `2rem`, `26px`, `50px`, `62px`, `230px` |

`15px` / `25px` / `-15px` sit off any 4- or 8-px grid. `62px` (header height) and `230px`
(sidebar width) are the two structural constants. px and rem are mixed freely at the same
scale positions (`15px` vs `1rem`, `12px` vs `.75rem`).

### 4.4 Border radius — 11 distinct values for about 4 roles

| Count | Value | Where |
|---|---|---|
| 14 | `2px` | `.form-control`, `.form-select`, `.form-date`, `.operation-btn`, `.card-btn`, `.btn-royal`, in-table `.btn` |
| 9 | `10px` | `.toast`, scrollbar thumb / track |
| 8 | `15px` | sidebar active-item pill (top-left + bottom-left only) |
| 6 | `0` | resets |
| 3 | `25px` | `.pagination-btn` |
| 1 | `50%` | avatar / status dot |
| 1 | `6px` | `.btn-gradient` |
| 1 | `.375rem` (= 6px) | `.table-container` |
| 1 each | `20px`, `1rem`, `.75rem` | one-offs |

`6px` and `.375rem` are again the same value in two units on two different components.
Bootstrap's own scale (`--bs-border-radius:.375rem`, `-sm:.25rem`, `-lg:.5rem`, `-xl:1rem`,
`-pill:50rem`) is present but ignored by the app skin. **Four button types carry four
different radii: 2px, 6px, 25px, and Bootstrap's `.375rem`.**

### 4.5 Box shadow — 7 distinct values in app CSS

| Count | Value | Where |
|---|---|---|
| 8 | `none` | focus-ring suppression on `.form-control`, `.form-select`, `.form-check-input`, `.btn-primary` |
| 1 | `0 3px 6px #0003` | `.btn-gradient` rest |
| 1 | `0 5px 10px #0000004d` | `.btn-gradient` hover |
| 1 | `0 2px 4px #0000001a` | |
| 1 | `0 20px 25px -5px #0000001a,0 10px 10px -5px #0000000a` | Tailwind's `shadow-xl`, copied literally |
| 1 | `inset 0 0 6px #ffffff0d` | glass card (login) |
| 1 | `0 5px 15px #0003` | |

Bootstrap contributes `shadow-sm` (504 uses, 495 pages) and `shadow` (37 uses) from
`--bs-box-shadow-sm:0 .125rem .25rem rgba(0,0,0,.075)` and
`--bs-box-shadow:0 .5rem 1rem rgba(0,0,0,.15)`. **There is no elevation system** — shadows
are ad-hoc per component, and one value is imported from a framework this app does not use.

**Accessibility finding worth carrying into the redesign:** `box-shadow:none` on
`.form-control:focus`, `.form-select:focus` and `.form-check-input:focus` is paired with
`border-color:var(--bs-border-color)` — i.e. **focus on text inputs, selects and checkboxes
is visually indistinguishable from rest state.** That is a keyboard-navigation defect
across all 60 pages with form fields, not a styling preference.

### 4.6 z-index — 8 values, no scale

`10000` (sidebar), `1200` (`#toast-container`, ×2), `1040` (`.header`), `1000`, `2`, `1`,
`0`, `-1`. Bootstrap's own layers sit at 1030–1080, so `.header` at 1040 lands *inside*
Bootstrap's range while `.sidebar` at 10000 sits far above the modal backdrop.

---

## 5. Repeated-component inventory

Counted by regex across all 502 files. "pages" = distinct module/page identities out of 72.

### Chrome — present on essentially every page

| Component | Selector | Files | Pages |
|---|---|---|---|
| Sidebar shell | `.sidebar-wrapper > .sidebar > .sidebar-menu` | 496 | 70 |
| Nav item | `li > a.link > span.menu-title` | 496 | 70 |
| Nav group (collapsible) | `li.treeview > a + ul.treeview-menu` | 496 | 70 |
| Active nav item | `li.is-active > .link` | 492 | 68 |
| Nav expand / collapse icon | `.fas.fa-plus-circle` / `.fa-minus-circle` | 496 | 70 |
| Header bar | `header.header#Header` | 495 | 70 |
| Header avatar + user menu | `.profile-img` + `.dropdown-menu.dropdown-menu-end` | 495 | 70 |
| Theme toggle | `.theme-btn > .checkbox + .checkbox-label > .ball` | 495 | 70 |
| Session timer | `.timer-green[data-remaining-time]` | 495 | 70 |
| Page heading | `.container-heading > h2` | 495 | 70 |
| Info tooltip | `a.info-icon[data-bs-toggle="tooltip"] > i.fas.fa-info-circle` | 483 | 64 |
| Bootstrap tooltip host | `[data-bs-original-title]` | 483 | 64 |

### List / table pattern — the dominant screen type

| Component | Selector | Files | Pages |
|---|---|---|---|
| Toolbar button | `button.operation-btn.btn.btn-{primary\|success\|danger}` | 466 | 54 |
| Table shell | `.container-separator .table-responsive.table-container` | 462 | 55 |
| Data table | `table.table.table-hover.table-borderless.align-middle.text-nowrap` | 463 | 55 |
| Table head | `thead.border-bottom.table-light` | 463 | 55 |
| Select-all checkbox | `input#selectAll[type=checkbox]` | 434 | 42 |
| Selected row | `tr.table-active` | 84 | 18 |
| Status dot | `a.rounded-circle.status-indicator.bg-{success\|warning\|danger}` | 25 | 1 |
| Status badge | `span.badge.rounded-pill.bg-{success\|warning\|danger}` | 96 | 5 |
| Pagination | `button.btn.pagination-btn > i.fas.fa-chevron-{left\|right}` | 466 | 54 |
| Page-size select | `select#pageselect.form-select.pagination-select` | 466 | 54 |
| Empty state | `.no_data_p` + `i.fa-frown` | 470 | 57 |

### Add / edit pattern

| Component | Selector | Files | Pages |
|---|---|---|---|
| Slide-in card | `.container-separator > .card.show > .card-body` | 282 | 39 |
| Card close | `button.btn.card-close-btn.float-end` (literal `X`, `color:red`) | 301 | 44 |
| Form group | `.form-group > label.form-label` + `<br>` + `input.form-control` | 294 | 48 |
| Text input | `input.form-control` | 481 | 60 |
| Native select | `select.form-select` | 479 | 60 |
| Required marker | `label.form-label > span.text-danger` (`*`) | 266 | 42 |
| Toggle switch | `.form-check.form-switch > .form-check-input.check-sm` | 98 | 10 |
| Multiselect | `.multiselect > .multiselect__tags` + `.multiselect__content-wrapper` | 77 | 7 |
| Date picker | `.dp__main .dp__input_wrap > .dp__input` | 7 | 3 |
| Readonly field | `.readonly-field` | 20 | 18 |
| Tabs (inside card) | `nav > .nav.nav-tabs > button.nav-link` | 24 | 2 |
| Custom tabs | `.nav-custom > li > a.nav-link` | 4 | 1 |
| Bulk-add / CSV upload | `.upload-file-card > .btn-royal` | 35 | 4 |

### Overlays & feedback

| Component | Selector | Files | Pages |
|---|---|---|---|
| Confirm modal | `#dynamicAlertModal .modal-content > .custom-modal-body` (`.model-icon`, `.modal-title`, `.modal-message`, `.modal-buttons`) | 39 | 39 |
| Generic modal | `.modal.fade.show > .modal-dialog.modal-dialog-centered` | 83 | 44 |
| Modal backdrop | `.modal-backdrop.fade.show` | 51 | 42 |
| Toast | `#toast-container .toast > .toast-body` + `.progress-bar-container` | 5 | 2 |

### Page-specific

| Component | Selector | Files | Pages |
|---|---|---|---|
| KPI card | `.card.shadow.h-100.dashboard > .card-body.text-center > .card-title > .slash` | 8 | 3 |
| Chart | `.chart` / `.chart-pie` (canvas saved as PNG in the capture) | 8 | 3 |
| 3D force graph | `.scene-container` + `.graph-info-msg` + `.float-tooltip-kap` | 95 | 4 |
| Google Map | `.map-container` + `.pac-container` | 4 | 1 |
| Glass card (sign-in) | `.glass-card` + `.background-container` | 5 | 1 |
| Quick-start banner | `.welcome-banner` (no CSS — unstyled) | 4 | 1 |

**Four separate button systems exist for what is functionally one control:**

- `.operation-btn` — 2px radius, 25px tall, 12px font, `scale(1.05)` hover
- `.card-btn` — **byte-for-byte identical declarations** to `.operation-btn`, 12 duplicated rules
- `.nav-btn` — colour only, inherits Bootstrap geometry
- `.btn-royal` — Lato, 2px radius, outline
- `.btn-gradient` — 6px radius, linear gradient, `translateY(-2px)` hover

`.card-btn` and `.operation-btn` are a free consolidation. Likewise there are **two
table-cell text rules** (`.table-responsive th,td` at `.875rem` / `#343c45`) and **six
near-identical dark-mode `--bs-table-bg` blocks** (see §6.5).

---

## 6. What resists an external override layer

### 6.1 Inline `style` attributes — 1,294 across 387 files, and mostly harmless

| Count | Property | Origin |
|---|---|---|
| 1,020 | `display` | Vue `v-show` / Bootstrap modal show-hide |
| 366 | `width` | vue-multiselect dropdown sizing, progress bars |
| 295 | `position` | multiselect / datepicker popper |
| 256 | `height` | as above |
| 104 | `padding` | |
| 95 | `left` | popper |
| 95 | `touch-action` | datepicker |
| 56 | `overflow` | `modal-open` body lock |
| 51 | `padding-right` | modal scrollbar compensation |
| 26 | `box-sizing` | |
| 8 | `max-height` | |
| 6 | `margin` | |
| **5 each** | **`box-shadow`, `border-radius`, `border`** | **the only cosmetic inline styles in the entire capture** |
| 5 each | `transition`, `bottom`, `right`, `resize` | |
| 4 | `--progress-duration` | toast progress — a custom property, so overridable |
| 3 | `transition-duration` | |
| 1 each | `inset`, `transform` | |

**Verdict: inline styles are not an obstacle.** About 99 % are runtime layout/visibility set
by Vue, Bootstrap's modal JS, popper and the datepicker. Fifteen declarations in total
(`box-shadow` / `border-radius` / `border`) are cosmetic and would need `!important` or a
DOM change. The densest files carry 14 attributes
(`access-rules--access-rules--edit-form-dropdown-*`) — all multiselect popper geometry.

### 6.2 `!important` — 59 declarations in app CSS, 1,715 in vendor

`pagescss.css` (10, sign-in only): `.btn-primary:focus/:active/.active` →
`background-color`, `border-color`, `box-shadow:none`; `.btn-primary:disabled` →
`background-color`, `border-color`, `cursor`, `transform`;
`.form-control:-webkit-autofill` → `-webkit-box-shadow`, `-webkit-text-fill-color`,
`background-color`.

`style.css` (49). The blocking cluster is the **sidebar**, where colour *and* geometry are
locked:

| Selector | `!important` declarations |
|---|---|
| `.sidebar-menu .is-active .link` | `background-color:#ef5137`, `color:#fff` |
| `.sidebar-menu .is-active .link .menu-title` | `color:#fff` |
| `.sidebar-menu > li > a:hover, :focus` | `background-color:#ef5137`, `color:#fff`, `padding-left:15px` |
| `.sidebar-menu > li > a:hover .menu-title, :focus .menu-title` | `color:#fff` |
| `.sidebar-menu .treeview-menu > li > a:hover, :focus` | `background-color:#ef5137`, `color:#fff`, `padding-left:15px` |
| `.sidebar-menu .treeview-menu > li.is-active > .link` | `background-color:#ef5137`, `color:#fff`, `padding-left:15px` |
| `.sidebar-menu > li > a:hover .fas, :focus .fas` | `color:#fff` |
| `.sidebar a` | `color:#343c45`, `font-size:.875rem` |
| `.sidebar-menu > li > .treeview-menu a` | `font-size:.875rem` |
| `.sidebar-menu` | `margin:0` |

That is 22 of the 49, all on the left nav.

Remainder: `.header .header-center .user-last-login{font-size}`,
`.header .dropdown-menu{margin-top:10px}`,
`.content-wrapper .container-fluid .btn-check{position:fixed}`,
`.btn-gradient{color:#fff}`, `.nav-custom>li>a{font-size, color:#337ab7}`,
`.nav-custom>li>.nav-link.active/:hover/:focus{color:#493e54}`, `.check-md{width:3em}`,
`.check-sm{width:2em}`, `.form-width{width:4rem}`,
`.content-wrapper--full{margin-left:0, margin-top:0}`, `.btn-royal{font-size:.75rem}`,
`.page-btn{margin-left:8px}`, `.mw-120/130/150/160/220/230/300{min-width}`,
`.medium-width{width:600px}`, `.tooltip-arrow{border-top-color:#3a383e}`,
`#dynamicModal{padding:0}`, `.banner>p{font-size:1rem}`, `[v-cloak]{display:none}`, plus
five dark-mode `border-bottom` / `color` / `background-color` locks.

**Every one of these is beatable from a stylesheet loaded after `style.css`**, since
`!important` ties resolve by source order. No inline `!important` exists anywhere in the
capture, so nothing is unreachable.

### 6.3 Specificity depth — the real friction

`style.css`: 324 selectors, of which 3 use an `#id`.

| Class count in selector | Selectors |
|---|---|
| 0 | 9 |
| 1 | 88 |
| 2 | 62 |
| **3** | **80** |
| **4** | **58** |
| **5** | **16** |
| **6** | **9** |
| **7** | **2** |

**165 selectors (51 %) are 3 classes deep or more.** The recurring prefix is
`.content-wrapper .container-fluid …` — a two-class tax on roughly 90 rules that carries no
meaning. Deepest:

```
body.dark-theme .content-wrapper .container-fluid .dashboard>.card-body>.card-title>.slash                       [7]
body.dark-theme .content-wrapper .container-fluid .container-separator .table-container .table .border-bottom    [7]  + !important
body.dark-theme .content-wrapper .container-fluid .nav-tabs .nav-link.active                                     [6]  + !important
body.dark-theme .content-wrapper .container-fluid .container-separator .table-container .table-light             [6]
```

An override layer must either mirror `.content-wrapper .container-fluid`, use `:where()` at
zero specificity, or rely on `@layer` ordering. `pagescss.css` is flat by comparison (max 2
classes, sign-in only).

### 6.4 Three parallel, desyncable theme flags

Theme is signalled three ways at once:

1. `<html data-bs-theme="light|dark">` — drives Bootstrap's 53 dark overrides
2. `<body class="dark-theme">` — drives all 60+ app dark rules
3. `<header data-theme="light|dark">` — drives nothing in CSS; header-local only

Observed combinations across 502 files:

| Files | `html[data-bs-theme]` | `body.class` | `header[data-theme]` |
|---|---|---|---|
| 403 | light | *(empty)* | light |
| 51 | light | `modal-open` | light |
| 25 | dark | `dark-theme` | dark |
| **15** | **dark** | **`dark-theme`** | **light** ← desynced |
| **1** | **light** | *(empty)* | **dark** ← desynced |
| 6 | — | — | — (404 / fragments) |

The 16 desynced snapshots are `access-rules--access-rules--edit-form-*--dark-theme` (13),
`devices-checks--blocked-apps--edit-form--dark-theme`, `dashboard--dashboard--dark`, and
`auth-profiles--saml--edit-form`. **The header's theme flag does not follow the page's** when
the theme is toggled while a slide-in edit form is open. Reproducible, and worth fixing in
the redesign rather than re-implementing.

Also: **`body.light-theme` is never applied.** Light values come from `:root`, so the entire
`body.light-theme` block is dead CSS — and it is duplicated in both `style.css` and
`pagescss.css`.

### 6.5 Broken / invalid CSS shipped to production

**Six rules ship an unresolved Sass variable as a CSS value:**

```
body.dark-theme .content-wrapper .container-fluid .container-separator .table-container .table       { --bs-table-bg: $background-color-dark }
body.dark-theme .content-wrapper .container-fluid .container-separator .table-container .table-light { --bs-table-bg: $background-color-dark }
body.dark-theme .content-wrapper .container-fluid .table                                            { --bs-table-bg: $background-color-dark }
body.dark-theme .content-wrapper .container-fluid .table-light                                      { --bs-table-bg: $background-color-dark }
body.dark-theme .modal-content .table                                                               { --bs-table-bg: $background-color-dark }
body.dark-theme .modal-content .table-light                                                         { --bs-table-bg: $background-color-dark }
```

`$background-color-dark` was never compiled. Custom properties accept any token, so this is
syntactically valid and silently wrong: `--bs-table-bg` becomes the literal string
`$background-color-dark`, Bootstrap's `background-color:var(--bs-table-bg)` is then invalid
at computed-value time, and dark-mode tables fall back to transparent. **That is why dark
tables take their background from `body` rather than from the table.** Cross-check the
`*--dark-theme.html` screenshots against their light twins before designing the dark table.

Also `body.dark-theme … .accordion { --bs-accordion-bg: 222, 226, 230 }` — an RGB triplet
assigned to a property Bootstrap consumes as a colour. Same class of bug.

### 6.6 Other override hazards

- **`.form-group` has no CSS at all** (1,940 uses, 295 pages) yet it is the canonical
  label + input wrapper. A free hook — nothing to override, safe to own.
- **Forms use `<br>` between label and input** in every form group. The gap between label
  and control is a line break in the DOM, not a stylable margin.
- **`.card-close-btn` is a literal `X` character** with `color:red` — not an icon, not
  `btn-close`. Cannot be re-skinned without changing markup.
- **The 404 page is a styling island.** `global--404--default.html` carries a 6,364-byte
  inline `<style>` with its own `:root`, `body`, `::selection` and `.background-container`
  rules, and loads no app stylesheet. It will not inherit any override layer.
- **`pagescss.css` declares `:root` twice.** The second block sets `--text-color:#e0e0e0`,
  `--button-bg-color:#f97316`, `--link-color:#ff8c00` and 13 more glass/orange login tokens
  at global `:root` scope, overriding `--text-color:#121212` from the first block. Contained
  to the 5 sign-in pages today, but any future import of `pagescss.css` elsewhere silently
  repaints the app.
- **Runtime-injected `<style>` from `3d-force-graph`** (3 blocks, 496 pages) is appended to
  `<head>` at runtime, so it lands *after* any static override stylesheet. It only touches
  `.scene-container`, `.scene-nav-info`, `.graph-info-msg` and `.float-tooltip-kap`, but
  those four need `!important` or a later-injected layer.
- **`col-xs-12`** (120 uses, 5 pages) is Bootstrap 3 syntax with no Bootstrap 5 equivalent
  loaded — those columns are currently unstyled and full-width by accident.
- **`.sidebar` z-index 10000** sits above Bootstrap's modal stack (1050 / 1055). Any
  redesign that keeps a modal must keep that number or the sidebar will overlap the dialog.

---

## 7. Practical read for the prototype

Favourable:

- 352 stable, human-authored class names; zero hashes; nothing to chase across rebuilds.
- 449 Bootstrap `--bs-*` custom properties, all at stock values — a full semantic
  re-tokenisation is available without touching a single app selector.
- 8 app tokens already exist (`--bg-color`, `--text-color`, `--text-secondary-color`,
  `--icon-color`, `--border-color`, `--label-color`, plus 2 `--bs-*`) and are the natural
  seam for a light/dark contract.
- Layout is Bootstrap utilities in markup, so geometry survives a restyle.
- Only 15 cosmetic inline declarations across 502 files.

Costs to price in:

- 165 selectors at 3+ classes; plan on `@layer` or a `.content-wrapper .container-fluid`
  mirror rather than flat class overrides.
- 59 app `!important`, 22 of them on the sidebar — the sidebar is effectively a rewrite
  rather than a re-skin.
- Four duplicate button systems, two of them (`.operation-btn` / `.card-btn`) identical, to
  collapse into one.
- Semantic collisions to resolve before any palette work: `#ef5137` = brand *and* danger;
  `#dc3545` vs `#ef5137` both = danger; `#0d6efd` on the sign-in CTA.
- Six broken `--bs-table-bg` rules and one broken `--bs-accordion-bg` — dark tables are not
  currently doing what the CSS says.
- Focus rings are suppressed on every input, select and checkbox. Restoring them is a
  redesign requirement, not an option.
- `14px` vs `.875rem` and `6px` vs `.375rem` — unit duplication to normalise before building
  a scale.
