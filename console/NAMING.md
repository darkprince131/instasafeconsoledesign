# Velto's names, and this console's

Every screen in this console answers to a velto screen. Where the wording
differs, this is the map — so nothing is lost, and so a reviewer who knows
velto can find the same screen here without learning a second vocabulary.

**The rule from here on:** the navigation says what velto says. Where this
console does more, the improvement is on the screen — a subtitle, a count, a
band — not in a renamed menu entry. A different name in the menu is a tax paid
by everyone who already knows the product, for no functional gain.

---

## Logs & Reports — where most of the renaming was

| Velto | Was called here | Route | Now |
|---|---|---|---|
| Live Users | Live sessions | `/reports/live` | **Live Users** |
| Live Gateways | Gateway report | `/reports/gateway` | **Live Gateways** |
| User Last Login Report | User last login | `/reports/user-last-login` | **User Last Login Report** |
| Data Usage Report | Data usage | `/reports/data-uses-log` | **Data Usage Report** |
| Time Usage Report | Time usage | `/reports/time-uses-log` | **Time Usage Report** |
| Network Test Report | Network test | `/reports/network-test` | **Network Test Report** |
| **Risk Report** | **Anomaly logs** | `/reports/anomaly-logs` | **Risk Report** |
| Session Recording | Session recording | `/reports/session-recording` | unchanged |
| Session Log | Session log | `/reports/session-log` | unchanged |
| Access Log | Access logs | `/reports/access-logs` | **Access Log** |
| Application Access Log | Application access | `/reports/application-access-logs` | **Application Access Log** |
| Event Log | Event logs | `/reports/event-logs` | **Event Log** |
| Export Log | SIEM / export log | `/profile/export-log` | **Export Log** |
| Report Subscriptions | Report subscriptions | `/report-subscriptions` | unchanged |

Two of these were not spelling changes:

- **Risk Report → Anomaly logs** renamed the *concept*. Somebody looking for
  the risk report would not have found it. Back to Risk Report.
- **Live Users → Live sessions** is arguably more accurate — one user can hold
  several sessions — but accuracy nobody asked for is not worth a name nobody
  recognises. The screen still says what it holds in its subtitle.

## Elsewhere

| Velto | Here | Note |
|---|---|---|
| OpenLDAP | LDAP | Back to **OpenLDAP** — it is the product's name for the screen |
| SCIM Import | SCIM import | Capitalisation only |
| SAML IDP | SAML IdP | Capitalisation only |
| OpenID Provider | OpenID IdP | Capitalisation only |
| Device Policies | Device policy | Capitalisation only |
| Blocked Apps / Users | Blocked apps / users | Capitalisation only |

Sentence case across the navigation is deliberate and is kept: it is a
typographic choice, not a rename, and the words are velto's.

## Screens this console adds

| Screen | Why it exists |
|---|---|
| **Access explorer** | Answers "can this user reach that application, and why". Velto has no equivalent; the policy engine behind it is real. |
| **Demo Inbox** | Where a test mail or SMS lands, because there is no mail server. |
| **Flows** | The guided tours. Demo scaffolding, not a product screen. |

Nothing else in the navigation is an invention: every other entry is a velto
screen at velto's route.

---

## Where the data comes from, and where it does not

| Screen | Data |
|---|---|
| Live Users | 2,662 seeded sessions |
| Application Access Log | 372 seeded connection attempts — **added**, see below |
| Event Log | 794 rows, and every action in the console appends to it |
| Access Log | the event log filtered to allow/deny decisions |
| User Last Login / Data Usage / Time Usage | computed from the 1,821 users and their sessions |
| Live Gateways / Network Test Report | the four gateways, measured live where a browser can measure |
| Session Recording | real playback of a recorded session surface |
| **Risk Report** | **empty until Scan is pressed.** The detector is real and runs on demand; nothing is pre-seeded. |

**Application Access Log was the gap.** The route rendered a usage *chart*,
not a list — the one screen that answers "what did this person actually try to
reach, and was it allowed" did not exist. It is now velto's seven columns:
Access Date, Username, Public IP, Country, Destination, Port, Action, with
Blocked carrying the mark and Allowed staying plain.

**`accessLog` is a dead store.** It is in the store list, nothing writes to it
and nothing reads it — the Access Log screen reads the event log instead. It
should be removed rather than filled.
