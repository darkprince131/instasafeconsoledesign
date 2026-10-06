# Taking the redesign into i365

This is the bridge between the prototype and the shipping console.

`i365.css` is the design system as production classes. `users.html` is one real
screen built with them. Neither is a mockup — the routes, element ids and form
field names in `users.html` are the ones read out of the captured console, so the
request a form makes is unchanged.

---

## The rule that makes this cheap

**Nothing behind the markup moves.**

| Stays exactly as it is | Changes |
|---|---|
| Routes and controllers | The wrapper markup in Blade |
| API endpoints, request and response shapes | Class names on that markup |
| Form field `name` attributes | Where a control sits on screen |
| Element `id`s and ARIA attributes | |
| `v-model` bindings and Vue state | |
| Validation rules and error keys | |
| Permissions and middleware | |
| Bootstrap 5.3.8, Vue 3, Font Awesome | |

A migrated screen posts the same body to the same endpoint and fails validation
the same way. If a diff touches a controller, a request class, or a field name,
it has gone outside the brief.

This is not "no work". It is **mechanical** work with a known shape, done one
screen at a time, with no shared-state risk between screens.

---

## Why the classes are prefixed

Every class is `i-`. None of the 352 existing class names start with `i-`, and
neither does any Bootstrap class.

That means both stylesheets can load at once:

```blade
<link rel="stylesheet" href="{{ asset('dist/css/vendor.css') }}">   {{-- Bootstrap, stays --}}
<link rel="stylesheet" href="{{ asset('dist/css/style.css') }}">    {{-- legacy, stays --}}
<link rel="stylesheet" href="{{ asset('dist/css/i365.css') }}">     {{-- new --}}
```

A screen is migrated when its partial starts emitting `i-` markup. Until then it
renders exactly as it does today, byte for byte. There is no flag day, no
half-styled intermediate state, and no moment where both designs fight over the
same element — because they never share one.

The old stylesheet gets deleted when the last screen moves, not before.

Add the font once, in the layout:

```blade
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
```

Self-host both families if an outbound CDN call is not acceptable. Without the
tag the stack falls back to system sans and the layout still holds.

---

## Order of work

Sequenced by screens-per-unit-of-work, which is not the same as by effort.

### 1 · Shell — `layouts/app.blade.php`

Replaces `#Header` and `#SideBar` with `.i-rail` + `.i-topbar`. One file, and
every screen in the product inherits it.

The rail groups the 19 top-level entries under six labels — Overview,
Infrastructure, Identity, Security, Access, Monitoring, Administration. The
labels are not links and carry no icon. The entries, their order within a group
and their `href`s are unchanged; they are only sorted into bins. The topbar
carries a breadcrumb and session state, and does not repeat the brand.

**Effort: one file. Reach: all 66 screens.**

### 2 · List template — `partials/data-table.blade.php`

The single highest-leverage change in the product: **54 screens render through
one template**.

- The `.table-container` box is gone. Rows bleed to the page gutter and the
  rules between them separate.
- Rows are 52px.
- A header is `.i-table th`; add `aria-sort="none"` and it becomes sortable.
- Row actions live in `.i-rowbtn` and appear on hover or keyboard focus.
- Checkbox selection drives `.i-selnote`, and destructive actions live there
  rather than sitting permanently armed in the toolbar.

**Effort: one template plus its column definitions. Reach: 54 screens.**

### 3 · Page header — `partials/page-header.blade.php`

`.i-phead` — title at 25px / 450, one line of context beneath it, actions right.
Exactly one `.i-primary` button per screen.

**Effort: one partial. Reach: all 66 screens.**

### 4 · Side panel — `partials/sheet.blade.php`

`.i-sheet` replaces the slide-in card that pushed the table sideways. It is a
floating layer, so it is one of the few things that earns a shadow. The form
inside is unchanged: same fields, same names, same order, same `v-model`.

**Effort: one partial plus a show/hide binding. Reach: every add and edit flow.**

### 5 · Confirm dialog — `partials/confirm.blade.php`

All 39 delete confirmations currently say "Are You Sure?" over an 80px red trash
glyph and name nothing. `.i-modal` names the object, states the consequence, and
labels the button with the action:

```
Delete 2 users?
Marcus Hall and Demo Fresh lose access immediately and their active
sessions end. Their audit history is kept. This cannot be undone.
                                        [ Cancel ]  [ Delete 2 users ]
```

The component takes the object name and the consequence line as parameters, so
each call site passes two strings. No controller changes.

**Effort: one partial, 39 call sites each passing two strings.**

### 6 · Forms — `.i-field`, `.i-frow`, `.i-formsec`

44 forms ship with **zero** field-level help. `.i-field` has a `.i-hint` slot
built in, so adding help is one line of Blade rather than a layout decision.
`.i-formsec` groups fields under a heading — the add-user form currently has 23
controls in one undifferentiated run.

`.i-sw` replaces a checkbox labelled "Enable …" with a switch that reads its own
state. The `name` and `id` do not change, so the posted value does not either.

**Effort: per form. Do these as each screen comes up, not as a batch.**

### 7 · Charts

The four dashboard pies are drawn into `<canvas>` by `companyadmin.js`, in a blue
that is in no palette, with no legend and no empty state — and in the captured
tenant each is a single 100% slice. `.i-barrow` replaces them with a labelled,
sortable bar list that reads at a glance and needs no canvas.

**This is the one item that is JS, not markup.** It is small, but it is not free.

---

## Class map

Old class on the left is what to look for; it is not renamed, the markup around
it is replaced.

| Legacy | New | Note |
|---|---|---|
| `#Header` | `.i-topbar` | 62px → 50px, breadcrumb replaces repeated brand |
| `#SideBar` `.sidebar-menu` | `.i-rail` `.i-navwrap` | grouped under `.i-navsec` labels |
| `.sidebar-menu .is-active .link` | `.i-navitem[aria-current="page"]` | violet, not `#ef5137` coral |
| `.content-wrapper .container-fluid` | `.i-page` | gutter 1rem → 34px |
| `.container-heading > h2` | `.i-phead h1` | 1.25rem/700 → 25px/450 |
| `.container-separator .table-container` | *removed* | the box goes; rules separate |
| `.table` `.table-responsive` | `.i-table` | 52px rows, sortable headers |
| `.no_data_p` | `.i-zero` | empty and filtered-empty say different things |
| `.pagination-btn` `.pagination-select` | `.i-pbtn` `.i-tfoot` | 25px radius → 6px |
| `.operation-btn` `.card-btn` `.nav-btn` `.btn-royal` `.btn-gradient` | `.i-btn` | 5 systems, 4 radii → one scale |
| `.operation-btn.btn-primary` | `.i-btn.i-primary` | one per screen |
| `.operation-btn.btn-danger` | `.i-btn.i-danger` | text until the confirm step |
| `.nav-btn.btn-danger` (Reset) | `.i-btn.i-quiet` | Reset destroys nothing; it leaves red |
| `.nav-btn.btn-success` (Save) | `.i-btn.i-primary` | Save is a commit, Export is not |
| `.card` + `.card-close-btn` | `.i-sheet` + `.i-x` | panel, not a card; `color:red` X goes |
| `.custom-modal-body` `.model-icon` | `.i-modal` | no 80px glyph; the object is named |
| `.badge.rounded-pill.bg-success` | `.i-pill` | healthy states carry no pill |
| `.badge.rounded-pill.bg-warning` | `.i-pill.i-att` | coral, exceptions only |
| `.status-indicator` (15px) | `.i-dot` (6px) | |
| `.toast` `.bg-toast` | `.i-toast` | opaque; `#212529bf` let text read through |
| `.form-label` `.form-control` `.form-group` | `.i-field label` `.i-ctl` `.i-frow` | `.i-hint` slot added |
| checkbox + "Enable …" label | `.i-sw` | same `name`, same posted value |
| `.chart.chart-pie` (canvas) | `.i-barrow` | the only JS change |

---

## The contracts

These are what the design is, not preferences. Breaking one is how earlier
attempts drifted back into looking generic.

**Unboxed.** The workspace is white and content sits on it. No cards, panes or
shells. Separation is rules and space. Tint lives in the chrome — the rail, the
filter strip — never under a table or a chart.

**Elevation is earned.** Only `.i-menu`, `.i-sheet`, `.i-modal` and `.i-toast`
cast a shadow. On a screen with nothing open, the shadow count is zero.

**Colour marks exceptions, not states.** `Active`, `Approved`, `Passed`,
`Enrolled` are plain text with no pill. Only `Suspended`, `Pending`, `Failed`
take coral. A 40-row list should carry about 15 coloured marks, not 80.

**Two hues, two jobs.** Violet is interactive and nothing else — primary button,
active nav, selected row, focus ring. Coral is attention and nothing else.
Neither takes the other's role; neither is used for structure or decoration.

**Monospace is scoped** to machine strings read character by character: IP and
MAC addresses, device ids, ports, hashes, ports. Usernames, profile names,
device labels and relative times are words, and stay in sans.

**Page titles are 25px / 450.** The heaviest thing in the interface is a page
title and it is not bold. Rows 52px, bleeding to a 34px gutter. Controls 6px
radius, floating things 8px. Never 12–16px — that is the generated-dashboard
look.

**Both themes, always.** Dark is designed, not inverted: elevation there is a
ring, because a drop shadow does nothing on a dark ground. `data-i-theme="dark"`
on `<html>`. The rail can be dark while the workspace stays light, via
`data-i-rail="dark"`.

---

## Check before calling a screen done

Paste into the console on the migrated screen.

```js
// 1 · elevation: nothing in page flow casts a shadow
[...document.querySelectorAll('.i-main *')].filter(e => {
  const s = getComputedStyle(e).boxShadow;
  return s !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(s)
    && !e.closest('.i-sheet,.i-modal,.i-menu,.i-toast');
}).length                                                    // expect 0

// 2 · colour budget
document.querySelectorAll('.i-table tbody .i-att,.i-table tbody .i-bad').length
  / document.querySelectorAll('.i-table tbody tr').length     // expect < 0.6
// multi-status tables: divide by (rows x status columns), not rows

// 3 · one primary
document.querySelectorAll('.i-btn.i-primary').length          // expect 1

// 4 · the QA surface has not moved — run on old and new, compare
[...document.querySelectorAll('[id],[data-testid],[name]')]
  .map(e => `${e.id}|${e.dataset.testid||''}|${e.name||''}`).sort().join()
```

Check 4 is the one that matters for regression risk. It is a list of every id,
test id and form field name on the page; it must be **identical** before and
after. If it is, no selector that automation binds to has moved.

Also: both themes at 1440 / 1024 / 768, every list at 2,000 rows, focus visible
on every control, text at 4.5:1 in both themes.

---

## Measured

From the captured console, not estimated.

| | |
|---|---|
| Clicks to onboard one user | 23, across 4 nav groups |
| Forms with any field-level help | 0 of 44 |
| List pages with sort, column chooser or saved view | 0 of 54 |
| Delete modals naming the object | 0 of 39 |
| Inline-create controls anywhere | 0 |
| Largest single `<select>` | 2,393 options |
| Identical "No results found" empty states | 54 (21 genuinely empty) |
| Devices pending approval | 775 |
| Focus rings on inputs, selects, checkboxes | suppressed via `box-shadow:none` |
| Reset styled the same red as Delete | yes |

The focus one is worth stating plainly, because it is a one-line fix with an
accessibility consequence. `style.css` ships:

```css
.form-check-input:focus,.form-control:focus,.form-select:focus{
  box-shadow:none;border-color:var(--bs-border-color)
}
```

Bootstrap's focus ring *is* a box-shadow, and the border is set back to its
resting colour, so keyboard focus is invisible on every input in the product.

---

## Structural work not in this layer

The approval queue for the 775 pending devices, the onboarding wizard that
collapses the 23 clicks, the access explorer, the import dry-run, saved views —
those need new screens and new endpoints, and they are the `enhanced-ux` branch.
This layer is everything that does not.
