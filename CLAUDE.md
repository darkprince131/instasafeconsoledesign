# InstaSafe i365 — console redesign

**The code is a git repo at `repo/`, pushed to
https://github.com/darkprince131/instasafeconsoledesign — two branches:**

| Branch | Version | What it is |
|---|---|---|
| `main` | **A** | Visual rebuild. Navigation, flows and field sets unchanged from the live console. |
| `enhanced-ux` | **B** | Structural. Approval queue, onboarding wizard, access explorer, import dry-run, first-run checklist. |

`repo/` is the source of truth for the console. Edit `repo/assets/css/console.css`,
`repo/assets/js/console.js` or `repo/index.html`, commit on the right branch, push.
`git diff main..enhanced-ux` shows exactly what the structural work changes.

The single-file copies in `prototypes/` are the **artifact publishing format** only — they
exist so the published claude.ai links keep working. The repo is canonical; if you stop
using the artifact links, delete `prototypes/`.

**Do not re-audit the console.** It has been captured, measured and written up. Every count
below is extracted from the DOM of 502 snapshots, not estimated. Start from these documents.

---

## 1. The product

| | |
|---|---|
| Stack | Laravel Blade + Vue 3 + Bootstrap 5.3.8 + Font Awesome 7 |
| Pages | 66 destinations, 19 top-level nav entries, max depth 2 |
| List pages | **54, all rendering through one shared template** |
| App stylesheet | `style.css` — 324 selectors, 31 KB |
| Class names | 352, 100 % human-authored, **zero build-generated hashes** |
| Themes | light + dark, both already shipping |
| Production scale | 1,820 users · 775 devices · 794 event-log rows |
| Tenants captured | `veno` (demo, thin) and `velto` (production scale) |

**The fact that governs sequencing:** 54 list pages share one template, so a change there
lands on 54 screens at once. Nothing else in this project has that ratio.

---

## 2. Live artifacts

| What | URL |
|---|---|
| **Version A** — visual reskin, UX unchanged | https://claude.ai/artifact/7zA7s1xXftsYUkjaJtKgS9 |
| **Version B** — structural | https://claude.ai/artifact/1b3yzeq5pAkX21q6zHvfGr |
| **Design system** (tokens, brand book) | https://claude.ai/artifact/RftQYw4arLiLZe3RJ7qJsC |
| **Direction G** — the visual reference both prototypes follow | https://claude.ai/artifact/KTij8YNu8FpapjTZQP78fP |
| **Version B case study** | https://claude.ai/artifact/6DqsQkwEV2woMU98n7A7MF |
| **Red Pen on i365** — 30 annotated findings | https://claude.ai/artifact/VU1e5hsNu1U84eXPxpdCRV |
| **Competitor teardown** — JumpCloud + OpenVPN | https://claude.ai/artifact/5tyP5Spe3pbYCoFiHBvsjL |

To change a prototype: edit `prototypes/version-a.html` or `version-b.html`, then publish
with the Artifact tool passing that artifact's `url` so it updates in place rather than
creating a new one. Both declare `capabilities: {db: {}}` — carried forward automatically
unless you pass `capabilities` explicitly.

Read the design system with the Artifact tool's `read` action on
`project/README.md` and `project/tokens.json`. **Never guess token values.**

---

## 3. Design contracts — violating these is how earlier attempts failed

**Unboxed.** The workspace is white and content sits directly on it. No cards, panes or
shells. Separation is rules and space. Tint lives in the chrome — nav rail, filter strip —
never under a table or a chart.

**Elevation is earned.** Only menus, popovers, modals and sheets cast a shadow. Anything in
the page flow has no shadow and no container. On a correct screen with nothing open, the
shadow count is zero.

**Colour is spent on exceptions, not states.** `Active`, `Approved`, `Passed` are plain
muted text with no pill. Only `Suspended`, `Pending`, `Failed` take a coral pill. A 40-row
list should carry ~15 coloured marks, not 80.

**Two hues, two jobs.** Violet is interactive only — primary button, active nav, selected
row, focus ring. Coral is attention only — pending, suspended, failed, the dashboard dot.
Neither ever takes the other's role; neither is used for structure or decoration.

**Monospace is scoped** to machine-generated strings read character by character: IP and MAC
addresses, device IDs, ports, counts, timestamps. Usernames, profile names and device labels
are words — sans, at `dim`.

**Page titles are 25px / weight 450.** The heaviest thing in the interface is a page title
and it is not bold. Rows 52px, bleeding to a 34px gutter. Controls 6px radius, floating
things 8px. Never 12–16px radius — that is the generated-dashboard look.

---

## 4. Brand

Measured from `brand/instasafe-logo-source.png`:

- Orange `#FF6600` · Purple `#660099` · Sphere centre `#6b58e4`
- The sphere colour is **essentially the design system's `--v500` (#7265e0)** — the
  interactive violet is lifted from the mark, not invented near it. This partly answers
  open question §8.6 in the handoff.
- **The brand purple is ~2:1 on the dark rail.** The wordmark PNG is therefore not used in
  the rail: the mark keeps its own colours and "InstaSafe" is set live in Inter at
  `--rail-ink`. The full official lockup, unaltered, is used on the sign-in screen only.
- Still needed from brand: an official **white / knockout lockup** for dark surfaces. The
  file supplied as the knockout variant was empty.

Brand appears in exactly three places: the rail, the sign-in screen, and the empty-tenant
state. Not in the topbar, not on page headers, not as a watermark.

**Open product question:** Company settings has a customer logo upload. Decide whether the
customer's logo replaces InstaSafe's in the rail, sits beside it, or appears only on the
end-user portal. Most ZTNA vendors do the last.

---

## 5. Track A / Track B

**Track A (built).** CSS and copy over existing DOM. Rollback is one line.

**Track B (built as prototype).** Needs markup. Exactly three structural permissions were
granted — dashboard attention band, unified page header, removing the list container.
Anything beyond those three: **stop and ask**, do not expand the list unilaterally.

### Hard rules for production implementation
1. Never change `id`, `data-testid`, form field `name`, ARIA attributes or DOM order. QA
   automation binds to these.
2. Do not rename or remove any of the 352 production class names. Add, never replace.
3. No CSS framework. Bootstrap 5.3.8 stays; its 449 `--bs-*` properties are at stock values
   and re-tokenising them touches zero app selectors — the cheapest lever in the product.
4. `style.css` is hostile: 165 of 324 selectors are 3+ classes deep, 59 `!important`,
   22 of those on the sidebar. Use prefix selectors (`html[data-v2] .operation-btn`) or
   `@layer`, never more `!important`. The sidebar's 22 need `@layer` or a targeted edit.
5. Both themes always. Dark is designed, not inverted — elevation there is an inset ring.

### Real selectors to target
```
.operation-btn   .container-heading   .table-container   .card-close-btn
.pagination-btn  .no_data_p           .sidebar-menu      .treeview
.form-group      .info-icon           .status-indicator
```

---

## 6. Verification protocol — run before declaring any change done

```js
// 1 · elevation: zero shadows in page flow (exclude [data-proto] prototype chrome)
[...document.querySelectorAll('*')]
  .filter(e => getComputedStyle(e).boxShadow !== 'none' && !e.closest('[data-proto]')).length  // 0

// 2 · no unresolved custom properties rendering as black
[...document.querySelectorAll('svg rect, svg polygon')]
  .filter(r => getComputedStyle(r).fill === 'rgb(0, 0, 0)').length   // 0

// 3 · colour budget
document.querySelectorAll('tbody .pill').length /
  document.querySelectorAll('tbody tr').length                       // < 0.6

// 4 · QA surface untouched — diff before/after
[...document.querySelectorAll('[id],[data-testid],[name]')]
  .map(e => e.id+'|'+(e.dataset.testid||'')+'|'+(e.name||'')).sort()
```

Last run on Version B: shadows 0 · black fills 0 · pill ratio 0.300 (users) / 0.500
(approvals) · QA nodes 54–60.

Also: both themes at 1440 / 1024 / 768, every list at 2,000 rows, focus visible everywhere,
text 4.5:1 in both themes.

**How to render and verify locally** — headless Chrome reads MHTML natively and screenshots
any local file:
```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1500,1000 --virtual-time-budget=7000 \
  --screenshot="out.png" "file:///C:/InstaSafe ConsoleDesign/prototypes/version-b.html"
```
To force a starting state, write a one-line redirect file that sets `localStorage`
(`i365va:` for Version A, `i365vb:` for Version B) then `location.replace()` to the prototype.

---

## 7. Counted findings — the evidence, do not re-derive

| Finding | Value |
|---|---|
| Clicks to onboard one user (production) | **23**, across 4 nav groups |
| Forms with any field-level help text | **0 of 44** |
| List pages with sort, column chooser or saved view | **0 of 54** |
| Delete modals naming the object | **0 of 39** |
| Inline-create controls anywhere | **0** |
| Largest single `<select>` | **2,393 options** |
| Identical "No results found" empty states | **54** (21 genuinely empty) |
| Devices pending approval | **775** |
| Focus rings on inputs / selects / checkboxes | suppressed via `box-shadow:none` |
| Reset button styled the same red as Delete | yes |

---

## 8. Open questions — do not guess

1. Is a typical tenant run by a solo IT admin (P1) or a security engineer (P2)? Decides
   whether the wizard or the rule builder leads. Answerable from the customer list.
2. Why have 775 devices been left pending? If approval is batched or done by InstaSafe,
   the queue changes shape.
3. What do support tickets actually say? Would replace most persona reasoning with evidence.
4. **Does a policy-evaluation endpoint exist?** Moves the Access explorer between "a screen"
   and "a quarter". The prototype builds it anyway and states the dependency on-screen.
5. How many tenants are configured by the customer vs by InstaSafe?
6. Does `--violet-600` clear brand guidelines? See §4 — it is the mark's sphere colour.

---

## 9. Decisions already taken, with reasons

- **MFA pill inverted.** The design system says only `Enrolled` gets a green pill, but 49 of
  60 users are enrolled, which fails the verification protocol's own < 0.6 pill ratio.
  `Not enrolled` carries the mark instead. The two rules contradicted; the check broke the tie.
- **Access explorer built despite being blocked** on the endpoint question. A prototype is
  how you find out what the endpoint must return.
- **Wizard before rule builder**, pending question 1. P1 is the likelier default and 23
  clicks is the worst measured number.
- **House `--db-*` tokens were not used** for the final direction. The March 2026 spec's
  blue/teal palette was also rejected — it drops the brand entirely. Direction G's
  violet/coral won. The ember palette is retained in both prototypes as a toggle for
  comparison.

---

## 10. Where things are

```
repo/           THE CODE — git, 2 branches, pushed to GitHub
                  index.html · assets/css · assets/js · assets/img · docs/ · brand/
prototypes/     single-file copies in artifact-publish format (not canonical)
reports/        red-pen-on-i365.html · competitor-teardown.html · shots/ · rshots/
audits/         audit.md · ux-inventory.md · velto-supplement.md ·
                design-system-brief.md · capture-manifest.md
handoff/        VERSION-B-HANDOFF.md
evidence/       capture/ — 502 DOM snapshots + 502 screenshots of the live veno tenant
brand/          logo source + extracted mark and lockup
```

**Deliberately not in the GitHub repo** (`.gitignore`): `evidence/` — 502 snapshots of a
production tenant, 149 MB, and the repo is public. The reports in `reports/` are also held
back: every screenshot in them shows the live veno console. Say the word to include either.

**Not copied into this folder at all, because of size:**
- `C:\Users\Darkprince131\Downloads\Jumpcloud` — 149 MHTML, 978 MB
- `C:\Users\Darkprince131\Downloads\OpenVPN` — 79 MHTML, 39 MB
- `C:\Instasafe Webdesign` — the marketing site, source of the `--db-*` house tokens
  (`app/globals.css`) and the console components in `components/console/`

Both competitor sets are fully analysed in `reports/competitor-teardown.html`; the raw
MHTML is only needed to re-render a screen.
