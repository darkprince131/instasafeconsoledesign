# The agent, as a real executable

A Windows program you can run, so the parts that only exist on a desktop can
actually be judged: a tray icon at 16 pixels, a panel that opens above the
clock, a toast that slides in over whatever you were doing. None of that can
be assessed in a browser mock-up, which is why this exists alongside the
`/agent` prototype in the console.

```
build.cmd                      → InstaSafe-Agent-Prototype.exe
```

**24 KB, no dependencies, nothing to install.** It compiles with the C#
compiler already inside Windows (`csc.exe`, part of .NET Framework 4), so a
clean Windows 10 or 11 machine builds and runs it with no SDK and no package
manager. That was a deliberate constraint: a prototype nobody can run without
being handed a toolchain first does not get looked at.

## Running it

Double-click the exe. The sign-in window opens and an icon appears in the
tray.

- **Any email address** is accepted.
- **A password of 8 characters or more** signs in; anything shorter shows the
  error state, which is the point of it — the shipped agent's card reserves no
  space for an error, so one shoves the button down the screen.
- After signing in it connects over about three seconds, then sits connected.

**Left-click the tray icon** for the panel. **Right-click** for a short menu
that can drop you into any state — connected, connecting, dropped, signed out
— so each one can be sat in for as long as you like, including the three the
shipped agent never draws.

## What it is demonstrating

Each decision here answers something found in the shipped agent.

| | Shipped agent | Here |
|---|---|---|
| Tray state | hover the icon for a four-line tooltip; the menu infers it from which item is greyed | a panel that says it in words, first thing |
| Tray icons | one icon | four states that differ in **silhouette**, not only colour, so they survive 16px and colour blindness |
| Notification | titled `InstaSafe-Agent.exe`, generic blue glyph, no actions | product name, own mark, **Open / Disconnect** |
| Errors | nowhere to put one | reserved space, so nothing moves when it appears |
| Red | used for the About box | failure only |
| Exit | one click, next to About | says what it costs you first |
| DPI | not declared, so Windows stretches it | per-monitor aware |

## What it is not

It connects to nothing. There is no tunnel, no server, no credential check —
every state is driven from the tray menu. It is a prototype of the *design*,
and the states are reachable on demand precisely because that is what makes a
design reviewable.

## The three build fixes it also demonstrates

These are not design work and need no designer. They are missing lines in the
shipped build, and each one is visible to every customer:

1. **A version resource.** `InstaSafe-Agent.exe` carries no FileVersion,
   CompanyName or ProductName, which is why Windows titles its notification
   with the filename and why Add/Remove Programs shows a blank publisher.
2. **An AppUserModelID.** Without one, toasts get Windows' generic glyph and
   cannot carry buttons.
3. **DPI awareness in the manifest.** Its absence is the entire reason the
   shipped agent looks soft beside other applications.

And one that is neither: About says `v3.06`, the manifest says `3.0.5.0`, and
Add/Remove says `3.0`. Three answers to "which build is this?" makes every
support call longer.

## Files

| | |
|---|---|
| `Agent.cs` | theme, drawing, the shared controls, the frameless window |
| `App.cs` | tray, panel, sign-in, toasts, About, exit confirmation |
| `icons.py` | the same four tray states as PNGs, if they are wanted as assets |
| `build.cmd` | one command, no toolchain |
