# Installer and agent — research, then decisions

Written before the redesign rather than after it, so the choices can be
argued with.

## What the research says

**Eleken, *Wizard UI pattern explained*.** The useful parts, and they are
specific:

- Use a wizard for setup and onboarding; a single page is faster for anything
  short. **3–7 steps**, the fewest that keep each screen simple.
- **Always show progress** — numbered steps, a bar, or section titles — and
  make it clear how many remain.
- **Back, Next and Finish visible and consistently placed** on every step.
  Going back must not lose what was entered.
- **Validate inline, at the step where the error is.** Specific messages that
  say what is wrong *and how to fix it*; never "Invalid input".
- One focused task per step. Cut non-essential steps and fields.
- Named pitfalls: too many steps, unlabelled navigation, no progress
  indicator, vague errors, errors held back until submit.

**UI Design Daily, *Installer Wizard* (day 166).** The page itself is a
thumbnail and a .psd — no description to quote. Its two tags are
`progress bar` and `status`, which is the whole point of the reference: in a
well-made installer the progress *is* the design.

**InstallAnywhere's "Installer Steps"** does the same thing in a shipping
product: the steps are a configurable list with text and icons, displayed
beside the content as a sidebar. Not a fashion — a pattern with a decade of
use.

**A dissenting note worth keeping.** A gamedev critique argues classic
wizards are padded with licence, advert and "you're done" screens until
people click Continue without reading. That is exactly what our shipped
installer does: it prints a log nobody reads and asks for the workspace URL
on a page headed "Installation Complete".

Sources:
[Eleken](https://www.eleken.co/blog-posts/wizard-ui-pattern-explained) ·
[UI Design Daily](https://www.uidesigndaily.com/posts/photoshop-installer-wizard-day-166) ·
[InstallAnywhere](https://docs.revenera.com/installanywhere/Content/helplibrary/iarefdb_installersteps.htm) ·
[Microsoft, MSI wizard behaviour](https://learn.microsoft.com/en-au/windows/win32/msi/user-interface-wizard-behavior) ·
[gamedev critique](https://gamedev.net/blogs/entry/1072103-installer-client-gui-1-the-state-of-play)

## The decisions, and why

**The real product's steps, in the real product's order.** The shipped
installer is NSIS with the stock pages — Licence Agreement, Installing,
Installation Complete — and then the agent itself asks for the workspace
address and a sign-in, outside the wizard, with no progress shown at all. So
the wizard is:

    Welcome · Licence · Installing · Workspace · Done

Five, inside the 3–7 the research supports. An earlier pass dropped the
licence step on the argument that a screen whose only job is to be dismissed
teaches people to dismiss screens. That argument is sound and it was still
the wrong call: the product has a licence page, people have been clicking
through it for years, and removing it makes this a different installer rather
than a better one. It stays, and the fix is to make it readable — real type,
a real scroll, and a blurb pointing at section 2, which is the part that
actually affects the machine.

There is no components step, because there are no components to choose.

**A left rail carrying the steps.** InstallAnywhere's pattern and the
UI Design Daily concept both put progress beside the content rather than
under it. It answers "how much longer" without being asked, and it gives the
brand somewhere to live that is not on top of the content — which is what
goes wrong in the shipped installer, where the logo sits in a white band
because it is a light-background raster.

**Light, as asked.** The console is dark-first; an installer is not. It runs
once, on a desktop, usually in an office, next to other installers that are
all light. Dark here would read as a different product.

**Rounded.** 10px on the window, 8px on cards and inputs, 6px on buttons —
the console's own progression, so the two feel related without the installer
pretending to be the console.

**Progress has a state, not just a bar.** Each step in the rail is pending,
current or done, and the install step names what it is doing in words —
"Adding the network adapter", not `tapinstall cumulative status: 0`.

**The install log is kept, and demoted.** The shipped installer's whole screen
is a list box of `Extract: libpkcs11-helper-1.dll... 100%`. That log is
genuinely useful — to the one person in a thousand whose install fails — and
useless to everyone else, so it sits behind *Show details* under the plain
line. The lines in it are the real ones, read off a real run.

**Validation lives on the workspace step.** The address is checked when it is
entered, and a wrong one says what to do: *"That workspace did not answer.
Check the address with your IT team."* Not "Invalid input".

## The mark, and why it is parsed rather than redrawn or pasted

The brand mark is nine broken orange elements — eight concentric rings and a
wedge — around a purple sphere. Three consequences for software:

1. **The artwork itself is used, not an approximation of it.** An earlier pass
   rebuilt the rings from measured proportions, which looked close and was
   wrong: a logo is a file, not a description. `SvgPath.cs` parses the path
   data out of `brand/instasafe-mark-color.svg` and GDI+ fills it. The strings
   in `Brand.cs` are copied from that file verbatim, so re-exporting the brand
   file is a copy-paste, not a redraw.

2. **It is parsed, not rasterised.** A PNG would be the shipped agent's problem
   all over again: one fixed size, soft at every scale factor that is not
   100%, and carrying its own white background. Parsed curves fill a 16px tray
   icon and a 160px installer header from the same geometry.

3. **It is never reduced.** Seven of the nine orange elements are hairlines —
   twelve units out of 918 — so at tray size they blur into each other, and
   that is accepted. A reduced mark was built and thrown away: it was crisper,
   and it made the agent the one place in the product where the logo is not
   the logo. Blurring is a rendering limit; substituting a simplified drawing
   is a change to the mark. Where the mark has to be small, it is small.
   `src/components/ui/Mark.vue` and `public/favicon.svg` follow the same rule.

The six supplied SVGs are in `brand/`, and in `console/public/brand/`, and are
the source of truth. The white lockup is the one for dark surfaces — the
shipped sign-in screen uses the light-background version on a near-black card,
which is why its strapline is almost invisible.

## Tray states

Four, differing in **silhouette** so they read without colour:

| State | Mark | Badge |
|---|---|---|
| Connected | full colour | green tick, bottom-right |
| Connecting | full colour, dimmed | amber dot |
| Dropped | full colour, dimmed | coral cross |
| Signed out | grey, no fill | none |

A badge rather than recolouring the whole mark, because recolouring a logo to
mean "error" is how a brand ends up with a red version of itself in people's
heads.

**The mark sits on a white disc.** The notification area is on the taskbar,
which is near-black by default and takes the wallpaper's colour when it is
translucent. An orange ring on that is a smudge. On a disc the mark carries
its own background, which is what every tray icon that survives a dark
taskbar does.

## The tray menu

Dark, because it hangs over the taskbar and a white menu there is a slab of
light at the bottom of the screen every time you right-click. 10px on the
menu, 6px on the hovered row, 32px rows, and the hover carries the violet
that means "interactive" everywhere else in this product — which on a dark
surface reads as blue.

`ToolStripProfessionalRenderer` cannot round a row or a drop-down, so
`DarkMenu` subclasses `ToolStripRenderer` outright rather than feeding a
colour table to a renderer that will square the corners anyway.

The four states used to be four sibling rows in the top level, which made the
menu look like a debug switchboard. They are one row now — **Connection**,
showing the current state, with the four as a submenu, and the current one
greyed because changing to the state you are already in is not an action.

## The sign-in

The shipped agent opens an embedded WebView2 on a page that looks nothing
like the console: different logo treatment, different field style, an orange
button where the console uses violet. Two sign-ins for one product is two
products as far as anybody using it is concerned.

This one mirrors `console/src/views/SignIn.vue` step for step — lockup, large
light title, both credentials at once, full-width primary, then the six-digit
second factor in one wide monospace box rather than six little ones (paste
breaks on six, backspace is ambiguous, and a screen reader announces six
unlabelled fields).

It also keeps going after the password. Signing in and connecting are two
different things, and the agent is the only place you can watch the second one
happen, so it shows its three steps — checking the device, opening the tunnel,
assigning an address — instead of vanishing and leaving a tray icon to change
colour on its own. The window is a different height at each stage, because one
box tall enough for the longest stage leaves a third of it empty on the other
two, which reads as a form that has lost something.
