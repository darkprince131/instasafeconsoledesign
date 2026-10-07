/**
 * Guided tours.
 *
 * A self-serve demo has about ninety seconds before a visitor decides whether
 * it is worth their time, and a console with 67 screens does not explain
 * itself. These route people to the things that are genuinely real, because
 * that is the only claim worth making: anyone can mock a screenshot, and
 * nobody can mock a wrong TOTP code being rejected.
 *
 * Each step names a `to` route and optionally a `target` selector to
 * spotlight. A missing target is not an error — the step still runs, centred,
 * because a tour that breaks when a screen changes is worse than no tour.
 *
 * `act` runs before the step is shown, for steps that need to put the screen
 * into a particular state first.
 */

export const TOURS = [
  {
    id: 'mfa',
    title: 'Prove the MFA is real',
    minutes: 2,
    icon: 'fa-mobile-screen',
    blurb: 'Scan a QR with your own phone and watch a wrong code get rejected.',
    steps: [
      {
        to: '/mfa-profile',
        title: 'This is a real authenticator enrolment',
        body: 'RFC 6238 TOTP, computed with Web Crypto. Not a picture of a QR code — an actual otpauth:// URI.'
      },
      {
        to: '/mfa-profile', target: '.i-qr',
        title: 'Scan it with any authenticator',
        body: 'Google Authenticator, Authy, 1Password, Microsoft Authenticator. The code your phone shows is the code this page checks.'
      },
      {
        to: '/mfa-profile', target: '.i-otp',
        title: 'Try a wrong code first',
        body: 'Type 000000. It is rejected, because the verification is genuine rather than decorative. Then enter the real one.'
      },
      {
        to: '/mfa-profile', target: '.i-demo-note',
        title: 'No phone to hand?',
        body: 'The code your phone would be showing is printed here, computed with the same algorithm. Typing it proves the check is real rather than accepting anything.'
      }
    ]
  },

  {
    id: 'access',
    title: 'Answer “can this person reach that?”',
    minutes: 3,
    icon: 'fa-magnifying-glass-chart',
    blurb: 'The policy engine evaluates for real, and shows which rule decided.',
    steps: [
      {
        to: '/access-rules',
        title: 'Rules are evaluated in order',
        body: 'The first rule that matches decides and the rest never run. That is why priority is the first column and the default sort.'
      },
      {
        to: '/access-explorer',
        title: 'This is the screen the real console does not have',
        body: 'Pick a person and an application. The engine walks the rule table and reports the decision — and, more usefully, why.'
      },
      {
        to: '/access-explorer', target: '.i-verdict',
        title: 'The answer, and the rule behind it',
        body: 'Not just allow or deny. It names the rule that decided, lists every rule considered, and marks any that an earlier rule has made unreachable.'
      },
      {
        to: '/access-explorer', target: '.i-sw',
        title: 'Now break the device',
        body: 'Switch Jailbroken on. A rule that allows this pair still allows it — but the posture failure overrides the allow, and the explanation says so.'
      }
    ]
  },

  {
    id: 'devices',
    title: 'Clear the approval queue',
    minutes: 2,
    icon: 'fa-laptop-medical',
    blurb: '540 devices waiting. The real tenant had 775 and showed the number nowhere.',
    steps: [
      {
        to: '/devices',
        title: 'The queue leads, because it is the only thing needing a decision',
        body: 'In the production tenant 775 devices were pending and the console surfaced that nowhere — no count, no queue, no default filter.'
      },
      {
        to: '/devices', target: '.i-selnote, .i-table thead',
        title: 'Select a few and approve them',
        body: 'Destructive and bulk actions appear only once something is selected, instead of sitting permanently armed in the toolbar.'
      },
      {
        to: '/devices', target: '.i-acts',
        title: 'Enrol this browser as a device',
        body: 'It takes a real fingerprint — platform, screen, hardware, timezone — and hashes it. Press it twice and the second press recognises the same device instead of creating another.'
      },
      {
        to: '/device-checks',
        title: 'Posture checks genuinely evaluate',
        body: 'The panel on the right is an editable device payload. Flip a switch and the verdict recomputes, including whether the failure blocks or only warns.'
      }
    ]
  },

  {
    id: 'siem',
    title: 'See what your SIEM would receive',
    minutes: 2,
    icon: 'fa-shield-halved',
    blurb: 'Real syslog, CEF and LEEF rendered from this tenant’s own events.',
    steps: [
      {
        to: '/reports/event-logs',
        title: 'Everything you do here is logged',
        body: 'Every action in this demo writes a row. That is what makes the next screen worth looking at — it is formatting your events, not a sample file.'
      },
      {
        to: '/profile/export-log',
        title: 'The actual wire formats',
        body: 'RFC 5424 syslog with its structured-data element, ArcSight CEF, QRadar LEEF, JSON lines. Switch between them and the payload re-renders.'
      },
      {
        to: '/profile/export-log', target: '.i-session',
        title: 'Paste it into your parser',
        body: 'The escaping is done properly — CEF escapes different characters in the prefix than in the extension, which is where hand-rolled output usually breaks.'
      },
      {
        to: '/profile/export-log', target: '.i-hint',
        title: 'And what it will cost you',
        body: 'Daily volume in the chosen format, from this tenant’s actual event rate. The first thing a SIEM team asks and the last thing anyone tells them.'
      }
    ]
  },

  {
    id: 'onboard',
    title: 'Onboard someone end to end',
    minutes: 4,
    icon: 'fa-user-plus',
    blurb: 'User, group, rule, then prove the access works. 23 clicks in the real console.',
    steps: [
      {
        to: '/users', target: '.i-acts',
        title: 'Add a user',
        body: 'The username and email fill themselves in from the name. In the production console this flow takes 23 clicks across four separate navigation groups.'
      },
      {
        to: '/usergroups',
        title: 'Groups carry the policy',
        body: 'A user inherits every rule attached to every group they are in. Click a row to edit one — the whole table is clickable, as the real console is.'
      },
      {
        to: '/access-rules', target: '.i-acts',
        title: 'Give the group something to reach',
        body: 'New rules are appended rather than inserted, because inserting one higher silently changes what every rule below it does.'
      },
      {
        to: '/access-explorer',
        title: 'Now prove it worked',
        body: 'Pick the person and the application. If the answer is deny, the trace tells you which rule got there first — which beats asking them to try it and report back.'
      }
    ]
  }
]

export const findTour = (id) => TOURS.find(t => t.id === id)
