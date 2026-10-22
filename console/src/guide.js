/**
 * What Pip says, and where.
 *
 * A guide is only worth having if it knows where you are. This is a map from
 * route to a short script: a line or two about what the screen is for, what
 * to try, and — where one exists — the guided flow that does the job properly.
 *
 * Three rules it follows, because guides usually break all three:
 *
 *   1. **It says something true about this screen.** Not "Welcome to the
 *      dashboard!" — what the screen is for and what to do on it.
 *   2. **It never blocks.** Every line can be dismissed, nothing modal, and
 *      dismissing is remembered per route so it does not re-introduce itself
 *      on every visit.
 *   3. **It hands over.** Where the console already has a guided flow that
 *      checks real work (`tours.js`), Pip points at that rather than being a
 *      second, worse version of it.
 *
 * `state` picks the pose. Keep it honest: `point` when it is pointing at
 * something on this screen, `run` when it is sending you elsewhere, `cheer`
 * only when something has actually been achieved.
 */

/** Longest prefix wins, so '/users/new' can differ from '/users'. */
export function scriptFor (path, scope) {
  const table = scope === 'portal' ? PORTAL : CONSOLE
  let best = null
  for (const entry of table) {
    if (path === entry.path || path.startsWith(entry.path + '/')) {
      if (!best || entry.path.length > best.path.length) best = entry
    }
  }
  return best || (scope === 'portal' ? PORTAL_FALLBACK : CONSOLE_FALLBACK)
}

const CONSOLE_FALLBACK = {
  path: '*',
  lines: [
    { state: 'idle', text: 'This is one of the 67 screens the console has. They all share one list template, so what you learn on one works on the rest.' }
  ]
}

const PORTAL_FALLBACK = {
  path: '*',
  lines: [
    { state: 'idle', text: 'This is your own access — the same product the administrators use, showing what you are allowed to do.' }
  ]
}

/* ------------------------------------------------------------- console */
const CONSOLE = [
  {
    path: '/dashboard',
    lines: [
      { state: 'point', text: "Hello. I'm Pip. This is the tenant at a glance — what needs attention is at the top, everything healthy is below it." },
      { state: 'point', text: 'The three red numbers are the only things asking for you. 772 devices are waiting for approval; that is the real production figure.' },
      { state: 'run', text: 'If you want the whole job end to end — a user, an application, a gateway, a policy, then proof it works — start the guided flow.', tour: 'onboard' }
    ]
  },
  {
    path: '/users',
    lines: [
      { state: 'point', text: 'Every list in this console is this same screen. Sort it, choose columns, select rows — none of which the live console can do.' },
      { state: 'idle', text: 'Click any row to edit it. There are no pencil icons anywhere, because the real console has none: the row is the control.' }
    ]
  },
  {
    path: '/devices',
    lines: [
      { state: 'point', text: '772 devices are pending. Select a few and approve them together — the destructive actions stay disabled until something is selected.' },
      { state: 'think', text: 'Nobody knows why so many are pending in the real tenant. It is one of the open questions this demo exists to ask.' }
    ]
  },
  {
    path: '/applications',
    lines: [
      { state: 'point', text: 'An application is the thing a person actually wants to reach. Each one sits behind a gateway and in front of a policy.' },
      { state: 'idle', text: 'Open one and you get a real session surface — RDP and SSH included.' }
    ]
  },
  {
    path: '/access-rules',
    lines: [
      { state: 'point', text: 'Rules are walked in priority order. The explorer next door will tell you which rule decided, and which were shadowed by it.' },
      { state: 'run', text: 'Try it: ask whether Finance can reach the Finance database, then jail-break the device and ask again.', to: '/access-explorer' }
    ]
  },
  {
    path: '/access-explorer',
    lines: [
      { state: 'point', text: 'Pick a person, a device and an application, and it tells you the answer and the reason — including the rules that lost.' },
      { state: 'think', text: 'Whether the real product can answer this is still an open question. Building it is how you find out what the endpoint has to return.' }
    ]
  },
  {
    path: '/downloads',
    lines: [
      { state: 'point', text: 'The Windows agent here is a real file — the working prototype, installer and tray and all. Download it and run it.' },
      { state: 'idle', text: 'Everything else writes a line to the event log instead of handing you a binary that does not exist.' }
    ]
  },
  {
    path: '/agent',
    lines: [
      { state: 'point', text: 'The desktop agent, screen by screen. The sign-in frame is the live portal page, not a drawing of it.' },
      { state: 'idle', text: 'Native or HTML is marked on every step, because that decides who builds it and how much it costs to change.' }
    ]
  },
  {
    path: '/event-log',
    lines: [
      { state: 'idle', text: 'Everything you do in here is written down. Add a user and it is at the top of this list a second later.' }
    ]
  }
]

/* -------------------------------------------------------------- portal */
const PORTAL = [
  {
    path: '/portal/signin',
    lines: [
      { state: 'point', text: "Hello. I'm Pip. Any password gets in — you cannot know a seeded account's password, so checking it would only lock you out." },
      { state: 'idle', text: 'The step after it is real, though. The authenticator code is verified against a genuine secret.' }
    ]
  },
  {
    path: '/portal/dashboard',
    lines: [
      { state: 'point', text: 'This is your access: what you can reach, from which devices, and what has happened on your account.' },
      { state: 'idle', text: 'Same product as the administrator console. Different seat — you see what you are allowed to do.' }
    ]
  },
  {
    path: '/portal/applications',
    lines: [
      { state: 'point', text: 'Everything you have been given. Open one and it connects through the gateway your administrator put it behind.' }
    ]
  },
  {
    path: '/portal/downloads',
    lines: [
      { state: 'point', text: 'The Windows build is a real executable. It is unsigned, so Windows will warn you about the publisher — that warning is correct.' },
      { state: 'idle', text: 'Run it and you get the installer, the tray icon, and the connection states.' }
    ]
  },
  {
    path: '/portal/mfa',
    lines: [
      { state: 'point', text: 'This is the genuine article: scan the code with any authenticator app and it will work, because the maths is real.' },
      { state: 'idle', text: 'Save the backup codes. They are the only way back if the phone goes missing.' }
    ]
  },
  {
    path: '/portal/profile',
    lines: [
      { state: 'idle', text: 'Your details, your devices, and the way out. Nothing here needs an administrator.' }
    ]
  },
  {
    path: '/portal/activate',
    lines: [
      { state: 'point', text: 'This is a new employee on their first morning. The password rules are enforced here and on the server, not just in the box.' }
    ]
  }
]
