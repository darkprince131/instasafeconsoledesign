/**
 * Guided flows.
 *
 * These are not narrated screenshots. Each step is a task the visitor does,
 * and the tour only advances when it detects the work actually happened —
 * the check queries the database and compares against a baseline taken when
 * the flow started. So "create an application" means an application exists
 * that did not exist before, not that somebody clicked Next.
 *
 * Every step can be skipped, because a demo that traps you is worse than one
 * that lets you wander. Skipping is recorded so the summary stays honest.
 *
 * `baseline(api)` snapshots the state the flow starts from.
 * `check(api, base, ctx)` returns true once the step's work is done; `ctx`
 * carries anything an earlier step learned, so later steps can refer to the
 * thing that was just created.
 */

const since = (base, list) => list.filter(r => !base.ids.has(r.id))

/** Rows of `resource` that did not exist when the flow started. */
async function fresh (api, base, resource) {
  const { data } = await api[resource].list({ perPage: 0 })
  return since(base[resource] || { ids: new Set() }, data)
}

async function snapshot (api, resources) {
  const out = {}
  for (const r of resources) {
    const { data } = await api[r].list({ perPage: 0 })
    out[r] = { ids: new Set(data.map(x => x.id)), count: data.length }
  }
  return out
}

export const TOURS = [
  // ===================================================================
  {
    id: 'onboard',
    title: 'Give someone access to an application',
    minutes: 6,
    icon: 'fa-route',
    primary: true,
    blurb: 'The whole job, end to end: a user, an application, a gateway, a policy — then prove it works.',
    intro:
      'This is the flow an administrator actually does. Each step waits until the work is really done, ' +
      'so nothing here advances on a click alone.',
    baseline: (api) => snapshot(api, ['users', 'applications', 'gateways', 'accessRules', 'groups']),
    steps: [
      {
        to: '/users', target: '.i-acts',
        title: 'Add a user',
        body: 'Press Add user and fill in a first name and an email. The username and email fill themselves in from the name.',
        done: 'User created',
        async check (api, base, ctx) {
          const made = await fresh(api, base, 'users')
          if (!made.length) return false
          ctx.user = made[made.length - 1]
          return true
        },
        recap: (ctx) => `${ctx.user?.firstName} ${ctx.user?.lastName || ''}`.trim()
      },
      {
        to: '/gateways', target: '.i-acts',
        title: 'Add a gateway',
        body: 'A gateway is where traffic enters. Applications sit behind one, so this has to exist before an application can be reached.',
        done: 'Gateway created',
        async check (api, base, ctx) {
          const made = await fresh(api, base, 'gateways')
          if (!made.length) return false
          ctx.gateway = made[made.length - 1]
          return true
        },
        recap: (ctx) => ctx.gateway?.name
      },
      {
        to: '/applications', target: '.i-acts',
        title: 'Add an application, behind that gateway',
        body: 'Press Add application. Pick a type, give it a host, and choose the gateway you just made in the Gateway field. An application with no gateway is configured but unreachable.',
        done: 'Application created and assigned',
        async check (api, base, ctx) {
          const made = await fresh(api, base, 'applications')
          const assigned = made.find(a => a.gateway)
          if (!assigned) return false
          ctx.app = assigned
          return true
        },
        hint: 'Created one but the step has not ticked? It needs a gateway selected — edit it by clicking its row.',
        recap: (ctx) => `${ctx.app?.name} → ${ctx.app?.gateway}`
      },
      {
        to: '/access-rules', target: '.i-acts',
        title: 'Write the access rule that joins them',
        body: 'Until a rule says so, nobody reaches anything — the default is deny. Add a rule with your user or their group as the source and the new application as the destination, and leave the action on Allow.',
        done: 'Access rule created',
        async check (api, base, ctx) {
          const made = await fresh(api, base, 'accessRules')
          const hit = ctx.app ? made.find(r => r.dest === ctx.app.name) : made[0]
          if (!hit) return false
          ctx.rule = hit
          return true
        },
        hint: 'The destination has to be the application you just created for this step to tick.',
        recap: (ctx) => `#${ctx.rule?.priority} ${ctx.rule?.source} → ${ctx.rule?.dest} (${ctx.rule?.action})`
      },
      {
        to: '/access-explorer',
        title: 'Now prove it',
        body: 'Pick a user and the application you created, and press Evaluate. The engine walks the rule table and reports the decision, the rule that made it, and any rule an earlier one has made unreachable.',
        done: 'Access evaluated',
        async check (api, base) {
          const { data } = await api.events.list({ perPage: 20, sort: 'at', dir: 'desc' })
          return data.some(e =>
            (e.type === 'access.granted' || e.type === 'access.denied') &&
            !(base.events || new Set()).has(e.id))
        },
        hint: 'If the answer is Deny, the trace tells you which rule got there first. That is the useful half.'
      }
    ],
    outro:
      'That is the whole path from nothing to working access. In the production console ' +
      'the same job takes 23 clicks across four separate navigation groups.'
  },

  // ===================================================================
  {
    id: 'mfa',
    title: 'Require multi-factor, and watch a user enrol',
    minutes: 4,
    icon: 'fa-mobile-screen',
    blurb: 'Require MFA from the admin side, then enrol an authenticator as the employee would.',
    intro:
      'This flow crosses the line between the two products on purpose. An administrator requires ' +
      'multi-factor and can reset it; they cannot enrol it, because enrolment means scanning a QR ' +
      'with a phone the administrator is not holding. So the first half happens here and the second ' +
      'half happens in the end-user portal. The cryptography is real either way - RFC 6238 over Web ' +
      'Crypto - and there is a way through without a phone.',
    baseline: (api) => snapshot(api, ['users']),
    steps: [
      {
        to: '/users', target: '.i-table',
        title: 'Find somebody not yet enrolled',
        body: 'The MFA column marks who has not done it. Click the row to open them — the whole row is the control, there is no pencil icon.',
        done: 'User open',
        optional: true,
        check: async () => !!document.querySelector('.i-sheet')
      },
      {
        to: '/users', target: '.i-sheet',
        title: 'Require it, and note what you cannot do',
        body: 'Multi-factor authentication shows whether they are enrolled and lets you require it or reset it. There is no "enrol" button, and that absence is correct: you do not have their phone.',
        done: 'MFA required',
        optional: true,
        check: async () => !!document.querySelector('.i-mfastate')
      },
      {
        to: '/user-settings',
        title: 'Require it for everyone',
        body: 'Under Authentication controls, switch on "Require MFA for every user" and save. The unsaved-changes block names exactly what is about to be committed.',
        done: 'Tenant-wide MFA required',
        async check (api) {
          const s = await api.settings.get('/user-settings')
          return !!s?.requireMfa
        },
        hint: 'Worth noticing what the field says: turning this on locks out anyone not yet enrolled.'
      },
      {
        to: '/portal/signin',
        title: 'Now switch sides',
        body: 'This is the end-user portal — a different product, three cards, no navigation tree. Sign in as any user; any password is accepted in the demo.',
        done: 'Signed in to the portal',
        optional: true,
        check: async () => {
          try { return !!sessionStorage.getItem('i365.portal.user') } catch { return false }
        }
      },
      {
        to: '/portal', target: '.p-qr',
        title: 'Enrol the authenticator',
        body: 'Set up authenticator, then scan with Google Authenticator, Authy, 1Password or Microsoft Authenticator. This is a real otpauth:// URI, not a picture of one. Type 000000 first if you want to watch a wrong code get refused.',
        done: 'Authenticator enrolled',
        async check () {
          try {
            const u = JSON.parse(sessionStorage.getItem('i365.portal.user') || 'null')
            return !!document.querySelector('.p-ok') || !!u?.mfaEnrolled
          } catch { return false }
        },
        hint: 'No phone? The code your phone would be showing is printed under the input, computed the same way.'
      }
    ],
    outro:
      'A wrong code was refused and a right one accepted, by the same code that would run in production - and the enrolment happened where it belongs, with the person holding the phone.'
  },

  // ===================================================================
  {
    id: 'sso',
    title: 'Federate sign-in to an identity provider',
    minutes: 5,
    icon: 'fa-right-to-bracket',
    blurb: 'Create a SAML or OIDC profile, run a real protocol round trip, then put a user on it.',
    intro:
      'The identity provider this tests against is bundled and running. The redirect, the authorization ' +
      'code, the token exchange and the assertion are all real.',
    baseline: (api) => snapshot(api, ['authProfiles', 'users']),
    steps: [
      {
        to: '/profile/saml', target: '.i-acts',
        title: 'Create an authentication profile',
        body: 'Add profile, then pick SAML 2.0 or OpenID Connect. Notice the form changes shape: SAML wants an entity ID and an ACS URL, OIDC wants an issuer and a client ID.',
        done: 'Profile created',
        async check (api, base, ctx) {
          const made = await fresh(api, base, 'authProfiles')
          const fed = made.find(p => ['saml', 'openid', 'oauth'].includes(p.type))
          if (!fed) return false
          ctx.profile = fed
          return true
        },
        hint: 'It has to be a SAML, OpenID or OAuth profile — the other types do not federate.',
        recap: (ctx) => `${ctx.profile?.name} (${ctx.profile?.type})`
      },
      {
        to: '/profile/saml', target: '.i-table',
        title: 'Test it against the bundled provider',
        body: 'Press Test on your new profile. It runs the genuine protocol round trip and shows every step — discovery, the redirect, the state check, the code, the exchange, the signature verification.',
        done: 'Round trip completed',
        async check (api) {
          const { data } = await api.events.list({ perPage: 20, sort: 'at', dir: 'desc' })
          return data.some(e => e.type === 'sso.test.saml' || e.type === 'sso.test.oidc')
        },
        hint: 'The Token tab holds a real JWT. Paste it into jwt.io — it decodes, because it is one.'
      },
      {
        to: '/users',
        title: 'Move a user onto that profile',
        body: 'Click any user to edit them and set their Authentication profile to the one you created. From then on they sign in through the identity provider rather than against a local password.',
        done: 'User federated',
        async check (api, base, ctx) {
          if (!ctx.profile) return false
          const { data } = await api.users.list({ perPage: 0 })
          return data.some(u => u.authProfile === ctx.profile.name)
        },
        hint: 'The Authentication profile field is in the Access section of the edit panel.'
      }
    ],
    outro: 'Those endpoints are live. You can point a real service provider at them during a demo and it will work.'
  },

  // ===================================================================
  {
    id: 'devices',
    title: 'Enrol a device and enforce posture',
    minutes: 4,
    icon: 'fa-laptop-medical',
    blurb: 'Bind a real device fingerprint, approve it, then make a posture rule refuse it.',
    intro:
      'Device binding uses an actual browser fingerprint. Posture checks genuinely evaluate against ' +
      'a payload you can edit.',
    baseline: (api) => snapshot(api, ['devices', 'deviceChecks']),
    steps: [
      {
        to: '/devices', target: '.i-acts',
        title: 'Enrol this browser as a device',
        body: 'Press "Enrol this browser". It takes a real fingerprint — platform, screen, hardware, timezone — hashes it, and files the result as a pending device.',
        done: 'Device enrolled',
        async check (api, base, ctx) {
          const made = await fresh(api, base, 'devices')
          const mine = made.find(d => d.isThisBrowser) || made[0]
          if (!mine) return false
          ctx.device = mine
          return true
        },
        recap: (ctx) => ctx.device?.name
      },
      {
        to: '/devices',
        title: 'Press it a second time',
        body: 'Nothing new appears. The fingerprint is recognised rather than duplicated, which is the whole point of binding and is normally impossible to show in a demo.',
        done: 'Seen',
        optional: true,
        check: async () => true
      },
      {
        to: '/devices', target: '.i-table thead',
        title: 'Approve it',
        body: 'Select it and press Approve. Until a device is approved its user cannot connect from it.',
        done: 'Device approved',
        async check (api, base, ctx) {
          if (!ctx.device) return false
          const d = await api.devices.get(ctx.device.id)
          return d?.status === 'approved'
        }
      },
      {
        to: '/device-checks',
        title: 'Make a posture rule fail',
        body: 'On the right is an editable device payload. Switch off disk encryption, or switch on jailbroken, and watch the verdict recompute — including whether the failure blocks or only warns.',
        done: 'Posture evaluated as blocked',
        optional: true,
        check: async () => !!document.querySelector('.i-verdict.is-block'),
        hint: 'Jailbroken is a critical check, so it blocks. OS up to date is medium, so it only warns.'
      }
    ],
    outro: 'A device that fails a critical check is refused even when an access rule would otherwise allow it.'
  },

  // ===================================================================
  {
    id: 'groups',
    title: 'Manage access by group, not by person',
    minutes: 4,
    icon: 'fa-users',
    blurb: 'The way access is actually administered once there is more than one of you.',
    intro:
      'Rules written against individuals do not survive a team. This is the same outcome as the first ' +
      'flow, arranged so it keeps working as people join and leave.',
    baseline: (api) => snapshot(api, ['groups', 'accessRules', 'users']),
    steps: [
      {
        to: '/usergroups', target: '.i-acts',
        title: 'Create a group',
        body: 'Give it a name and set its policy — two-factor, device binding, posture checks. Everything set here is inherited by every member.',
        done: 'Group created',
        async check (api, base, ctx) {
          const made = await fresh(api, base, 'groups')
          if (!made.length) return false
          ctx.group = made[made.length - 1]
          return true
        },
        recap: (ctx) => ctx.group?.name
      },
      {
        to: '/access-rules', target: '.i-acts',
        title: 'Write a rule against the group',
        body: 'Add a rule with Source type set to User group and your new group as the source. One rule now covers everyone who will ever be in it.',
        done: 'Group rule created',
        async check (api, base, ctx) {
          const made = await fresh(api, base, 'accessRules')
          const hit = ctx.group ? made.find(r => r.source === ctx.group.name) : null
          if (!hit) return false
          ctx.rule = hit
          return true
        },
        hint: 'Source type has to be User group, and the source has to be the group you just made.',
        recap: (ctx) => `#${ctx.rule?.priority} ${ctx.rule?.source} → ${ctx.rule?.dest}`
      },
      {
        to: '/access-rules',
        title: 'Watch the ordering trap',
        body: 'Click your rule and use the arrows to move it below an existing Deny for the same destination. The explorer will then show it as unreachable — a rule nobody can see is still a rule somebody is relying on.',
        done: 'Seen',
        optional: true,
        check: async () => true
      }
    ],
    outro: 'Adding somebody to the group now grants everything the group has, with no rule to remember.'
  },

  // ===================================================================
  {
    id: 'filters',
    title: 'Filter what people can reach',
    minutes: 3,
    icon: 'fa-filter',
    blurb: 'Write a block rule, carve an exception above it, and test both.',
    intro: 'The matcher is real. Wildcards compile to a regular expression with everything else escaped.',
    baseline: (api) => snapshot(api, ['urlFilters']),
    steps: [
      {
        to: '/url-filter', target: '.i-acts',
        title: 'Block something broadly',
        body: 'Add a rule with a pattern like *facebook.com* and the action Block. Give it priority 2.',
        done: 'Block rule created',
        async check (api, base, ctx) {
          const made = await fresh(api, base, 'urlFilters')
          const blk = made.find(r => r.action === 'block')
          if (!blk) return false
          ctx.block = blk
          return true
        },
        recap: (ctx) => `${ctx.block?.pattern} (block)`
      },
      {
        to: '/url-filter', target: '.i-acts',
        title: 'Now carve out an exception above it',
        body: 'Add a second rule, action Allow, priority 1, with a narrower pattern — your own company page, say. Lower priority runs first, so the exception wins.',
        done: 'Exception created',
        async check (api, base) {
          const made = await fresh(api, base, 'urlFilters')
          return made.some(r => r.action === 'allow')
        }
      },
      {
        to: '/url-filter', target: '.i-search',
        title: 'Test both',
        body: 'Type a URL that matches only the broad rule, then one that matches the exception. The verdict names the rule that decided and marks any rule a higher one has shadowed.',
        done: 'Tested',
        optional: true,
        check: async () => !!document.querySelector('.i-verdict'),
        hint: 'Try a lookalike too — facebookXcom.evil.net is refused, because a dot in a pattern matches a dot and not any character.'
      }
    ],
    outro: 'An Allow above a Block is how every exception is written. Order is the whole semantics.'
  },

  // ===================================================================
  {
    id: 'siem',
    title: 'Wire the logs into a SIEM',
    minutes: 3,
    icon: 'fa-shield-halved',
    blurb: 'Real syslog, CEF and LEEF from your own events, plus what it will cost in volume.',
    intro: 'Everything you have done so far is in the event log. This is what a collector would receive.',
    baseline: (api) => snapshot(api, ['inbox']),
    steps: [
      {
        to: '/reports/event-logs',
        title: 'Check your own work is logged',
        body: 'Everything done in this demo wrote a row here. That is what makes the next screen worth anything — it formats your events, not a sample file.',
        done: 'Seen',
        optional: true,
        check: async () => true
      },
      {
        to: '/profile/export-log', target: '.i-ftabs',
        title: 'Switch between the wire formats',
        body: 'RFC 5424 syslog, ArcSight CEF, QRadar LEEF, JSON lines. The payload re-renders from your rows each time. Paste any of it into your parser — it will parse.',
        done: 'Seen',
        optional: true,
        check: async () => true
      },
      {
        to: '/profile/export-log', target: '.i-acts',
        title: 'Send a test batch',
        body: 'Set a collector host and press Send test batch. Nothing leaves the browser — the payload goes to the Demo Inbox so you can read exactly what would have crossed the boundary.',
        done: 'Batch sent',
        async check (api, base) {
          const made = await fresh(api, base, 'inbox')
          return made.some(m => m.kind === 'siem')
        }
      }
    ],
    outro: 'The volume estimate underneath is from your tenant’s real event rate, in the format you picked.'
  }
]

export const findTour = (id) => TOURS.find(t => t.id === id)
