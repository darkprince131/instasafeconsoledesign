# Two audiences, one build

This console serves two people who want opposite things from it, and the
difference is not cosmetic.

| | **The engineer** | **The visitor** |
|---|---|---|
| Comes from | an internal link, a PR, a review session | the website, a sales call, a conference stand |
| Wants | to judge whether this is buildable, and what it would cost | to find out what the product feels like |
| Needs | the admin console, the field sets, the gaps named | one short path that ends in something they understand |
| Tolerates | 1,820 seeded users and a wall of controls | about ninety seconds before leaving |
| Leaves with | a decision about scope | a feeling about the product |

Shipping one experience to both is how demos fail. An engineer dropped into a
guided tour cannot inspect anything; a visitor dropped into a console with
2,140 devices closes the tab.

---

## 1 · The engineer

**Entry:** `/dashboard` — straight in, no gate. This is already how the
deployed site behaves and it is right for this audience: an internal reviewer
should not have to sign in to look at a prototype.

**The three things they need, in order:**

1. **Every screen, reachable.** All 68 of velto's navigation destinations
   resolve. Nothing is a stub; the four that this console adds are marked in
   `NAMING.md` so a reviewer is never unsure whether a screen is velto's or
   ours.
2. **Every divergence, named.** `VELTO-AUDIT.md` is the spine of the review:
   58 numbered entries, each saying what velto does, what this does, and
   *why*. A reviewer disagreeing with a decision can find the reasoning and
   argue with it rather than guessing at intent.
3. **The honesty line.** What is genuinely implemented, and what is a drawing:

   | Real | Drawn |
   |---|---|
   | TOTP (RFC 6238, Web Crypto) | push notifications |
   | WebAuthn registration and assertion | device certificates |
   | PBKDF2 password hashing | OS-level MFA |
   | The policy engine, with shadowed-rule reporting | SMS and email delivery |
   | Device fingerprinting and binding | agent connectivity on this machine |
   | The audit trail | — |
   | Four SIEM wire formats | — |

   Each drawn thing says so on its own screen. None of them mimes success
   while pretending otherwise.

**Where they go to judge integration cost:** `src/api/index.js` is the whole
contract, one method per endpoint, each annotated with the HTTP call a real
backend would serve. Swapping `adapters/mock.js` for `adapters/http.js` is one
import line. That file *is* the integration estimate.

**What to show them first:** the admin console at `/dashboard`, then
`/portal` from the account menu, then `VELTO-AUDIT.md`. In that order,
because the question "did you keep our fields" is answered by the first two
and the question "why did you change that" by the third.

---

## 2 · The visitor

**Entry:** `/portal/signin`. Not the admin console — a stranger has no
business starting in a screen built for somebody who administers a network
for a living.

**The path, and why it is this one:**

```
/portal/signin
   email  →  password  →  choose a factor  →  the factor  →  /portal
```

Four screens, one decision each. The decision that matters is the third: six
second factors, and the visitor picks. That is the whole demo, because it is
the one moment where a person *feels* what the product does rather than
reading about it.

**The simulator is the demo.** Ported from the marketing site's React one,
which remains the best explanation of MFA anybody here has built: it does not
describe the six methods, it makes you do one.

- **Push** shows the request — device, IP, location — with Approve and
  Reject side by side. **Reject is a real outcome**: it blocks the sign-in
  and says nothing was signed in. Most demos only model success, and that is
  precisely the wrong half, because the reason to want push is the day
  somebody else has your password.
- **Hardware keys**: three offered, two fail. A FIDO2 YubiKey works; an OTP
  dongle and a legacy smart card do not, each with the reason. This is the
  answer to "we already have tokens".
- **Biometric** is press-and-hold, and letting go early fails. A reader that
  accepts a tap has read nothing.
- **Authenticator** is real TOTP against the visitor's own enrolled secret —
  unless the demo widget is in teaching mode, which shows the code so
  somebody without a phone can still try it, and says that is what it is
  doing.
- **SMS and email** are there because they are what most people have met
  before. A demo that omits the familiar one teaches nobody the difference.

**After sign-in:** the member portal, which is a small, quiet product — five
screens, no tables of two thousand rows. A visitor can look at all of it
without being lost.

**Two tenants, one click each.** The widget leads with them, because
somebody presenting needs one click rather than nine:

| | What it shows |
|---|---|
| **New tenant** | Nothing set up. No applications, no devices, no history, agent missing. The visitor does it all: set a password, enrol a factor, find out what is still needed. |
| **Running tenant** | A company already using it — applications assigned, devices registered, recording and shift schedule in force. What an engineer wants to see. |

**The demo-states widget** is what turns one tenant into many. Nine switches
— applications, devices, history, agent, recording, shift schedule, geo
binding, MFA required, teaching mode — so a presenter can show the first-day
state, the agent-down state, or the fully-provisioned state without touching
the database. Nothing is faked downstream: "none" runs the same empty branch
a genuinely empty tenant would.

---

## 3 · How they share one build

Nothing is forked. The two audiences are separated by **where they enter**
and **which switches are set**, not by two codebases.

| | Engineer | Visitor |
|---|---|---|
| Enters at | `/dashboard` | `/portal/signin` |
| Sign-in | none | three steps |
| Data | full seed — 1,820 users, 2,140 devices | the same tenant, one employee's slice of it |
| Demo widget | available, ignored | the presenter's control surface |
| Tours | `/flows`, five guided paths | not offered |

Each console links to the other from the account menu, so neither audience is
trapped. An engineer wanting to see what an employee sees is two clicks away;
a visitor curious about the administrator's side is one.

**Both run on one database per visitor.** IndexedDB locally, a per-cookie
tenant on the deployed site. Nobody can break anybody else's demo, and
*Reset demo* in the account menu puts a tenant back.

---

## 4 · Sign-in, for whoever is reading this

| | Where | Who |
|---|---|---|
| Administrator console | `/signin` | `admin` / `demo` |
| Member portal | `/portal/signin` | any account the console has created |

A seeded account has never had a password, so the portal sends it to
activation on first sign-in rather than refusing one it never issued. That is
also the new-starter flow, which is the one worth demonstrating.

---

## 5 · What is still missing

Named here rather than discovered in a demo:

- **No sign-in gate on the admin console.** Deliberate for the engineer, and
  wrong for a public deployment. One line to wire; `SignIn.vue` works.
- **The application session surface is Apache Guacamole**, not an InstaSafe
  design — `window.Guacamole`, `guaccss.css`, canvas layers. The toolbar and
  the connection states are themeable; the session pixels are not. See
  `VELTO-AUDIT.md` §55.
- **No SVG animation per MFA method yet.** The simulator has motion where it
  teaches — the shake, the ring, the fill — but no per-method illustration.
- **The HTTP adapter is verified screen by screen, not end to end.** Anything
  touching `adapters/http.js` or `netlify/functions/` has to be checked on the
  deployed site, because the mock adapter forgives what the database will not.
