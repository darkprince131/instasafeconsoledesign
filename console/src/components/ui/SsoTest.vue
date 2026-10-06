<script setup>
import { ref, watch, computed, inject } from 'vue'
import api from '../../api'

/**
 * Runs a genuine SSO round trip against the bundled IdP and shows every step.
 *
 * This is the screen that answers "does your SAML actually work" without a
 * sales engineer and a customer's Okta tenant. For OIDC it performs the real
 * authorization-code flow — authorize, code, back-channel token exchange —
 * and decodes the JWT that comes back. For SAML it fetches a real SAML 2.0
 * Response and shows the XML.
 *
 * The honesty rule: anything the demo cannot do for real is labelled, not
 * glossed. The IdP's own limits are printed at the bottom.
 */

const props = defineProps({
  open: Boolean,
  profile: { type: Object, default: null }
})
const emit = defineEmits(['update:open'])
const toast = inject('toast', () => {})

const steps = ref([])
const busy = ref(false)
const tokens = ref(null)
const decoded = ref(null)
const samlXml = ref('')
const view = ref('steps')

const isSaml = computed(() => props.profile?.type === 'saml')
const kind = computed(() => isSaml.value ? 'SAML 2.0' : 'OpenID Connect')

function step (text, detail = null, state = 'ok') {
  steps.value.push({ text, detail, state })
}

function reset () {
  steps.value = []; tokens.value = null; decoded.value = null
  samlXml.value = ''; view.value = 'steps'
}

async function run () {
  reset()
  busy.value = true
  try {
    isSaml.value ? await runSaml() : await runOidc()
  } catch (err) {
    step('Failed: ' + err.message, null, 'bad')
  } finally {
    busy.value = false
  }
}

async function runOidc () {
  // 1 · discovery
  step('GET /idp/.well-known/openid-configuration')
  const disc = await (await fetch('/idp/.well-known/openid-configuration')).json()
  step('Discovery document received',
    `issuer ${disc.issuer} · signing ${disc.id_token_signing_alg_values_supported.join(', ')}`)

  // 2 · authorize. A real client redirects the browser; here the redirect is
  // followed in the background so the trip is visible without leaving the page.
  const redirectUri = location.origin + '/profile/openid'
  const state = Math.random().toString(36).slice(2)
  const authUrl = new URL(disc.authorization_endpoint)
  authUrl.searchParams.set('client_id', 'i365-console')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid profile email groups')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('login_hint', 'demo.admin@instasafe.com')
  step('GET ' + disc.authorization_endpoint, 'user approves at the IdP')

  // the consent page links back with the code; parse it rather than navigate
  const consent = await (await fetch(authUrl)).text()
  const back = consent.match(/href="([^"]*code=[^"]*)"/)?.[1]
  if (!back) throw new Error('IdP did not return an authorization code')
  const returned = new URL(back.replace(/&amp;/g, '&'))
  const code = returned.searchParams.get('code')

  if (returned.searchParams.get('state') !== state) {
    step('state parameter did not match — possible CSRF', null, 'bad')
    throw new Error('state mismatch')
  }
  step('Redirect back to ' + redirectUri, 'state verified · code ' + code.slice(0, 18) + '…')

  // 3 · back-channel exchange
  step('POST ' + disc.token_endpoint, 'authorization_code grant')
  const res = await fetch(disc.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code,
      client_id: 'i365-console', client_secret: 'demo-secret', redirect_uri: redirectUri
    })
  })
  const t = await res.json()
  if (t.error) throw new Error(t.error_description || t.error)
  tokens.value = t
  step('Tokens received', 'id_token and access_token, expires in ' + t.expires_in + 's')

  // 4 · verify the signature server-side
  const intro = await (await fetch('/idp/introspect', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: t.id_token })
  })).json()
  decoded.value = intro
  step(intro.valid ? 'Signature verified' : 'Signature did NOT verify',
    intro.valid ? 'HS256, not expired' : intro.error, intro.valid ? 'ok' : 'bad')

  await api.events.record({
    type: 'sso.test.oidc',
    message: 'OIDC round trip against the demo IdP — ' + (intro.valid ? 'succeeded' : 'failed'),
    severity: intro.valid ? 'info' : 'warning'
  })
  if (intro.valid) toast('OIDC round trip completed and the token verified')
}

async function runSaml () {
  step('GET /idp/saml/metadata')
  const meta = await (await fetch('/idp/saml/metadata')).text()
  const sso = meta.match(/Location="([^"]+)"/)?.[1]
  step('IdP metadata parsed', 'SSO endpoint ' + sso)

  const acs = location.origin + '/profile/saml'
  const url = new URL('/idp/saml/sso', location.origin)
  url.searchParams.set('acs', acs)
  url.searchParams.set('audience', props.profile?.audience || 'i365-console')
  url.searchParams.set('login_hint', 'demo.admin@instasafe.com')
  step('GET ' + url.pathname, 'HTTP-Redirect binding')

  const res = await (await fetch(url)).json()
  samlXml.value = res.xml
  view.value = 'saml'
  step('SAML Response received', 'base64, ' + res.samlResponse.length + ' bytes')

  // check the bits a service provider actually validates
  const nameId = res.xml.match(/<saml:NameID[^>]*>([^<]+)</)?.[1]
  const audience = res.xml.match(/<saml:Audience>([^<]+)</)?.[1]
  const notAfter = res.xml.match(/NotOnOrAfter="([^"]+)"/)?.[1]
  step('Assertion parsed', `NameID ${nameId} · Audience ${audience}`)
  step('Conditions checked',
    'NotOnOrAfter ' + new Date(notAfter).toLocaleTimeString() +
    (new Date(notAfter) > new Date() ? ' — still valid' : ' — expired'),
    new Date(notAfter) > new Date() ? 'ok' : 'bad')

  await api.events.record({
    type: 'sso.test.saml',
    message: 'SAML assertion issued by the demo IdP and parsed',
    severity: 'info'
  })
  toast('SAML assertion received and parsed')
}

function copy (text) {
  navigator.clipboard?.writeText(text)
  toast('Copied')
}

watch(() => props.open, (o) => { if (o) run(); else reset() })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="i-scrim" @click="emit('update:open', false)" />
    <aside v-if="open" class="i-sheet" style="width:min(760px,100vw)" role="dialog" aria-modal="true">
      <div class="i-sheeth">
        <div>
          <h2>{{ kind }} round trip</h2>
          <p class="i-sub">
            Against the bundled demo IdP. This is the real protocol, not a mock-up of one.
          </p>
        </div>
        <button class="i-x" @click="emit('update:open', false)" aria-label="Close">
          <i class="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>

      <div class="i-sheetb">
        <div class="i-ftabs mb-3">
          <button class="i-chip" :class="{ 'is-on': view === 'steps' }" @click="view = 'steps'">
            Steps
          </button>
          <button
            v-if="tokens" class="i-chip" :class="{ 'is-on': view === 'token' }"
            @click="view = 'token'"
          >Token</button>
          <button
            v-if="samlXml" class="i-chip" :class="{ 'is-on': view === 'saml' }"
            @click="view = 'saml'"
          >Assertion</button>
        </div>

        <!-- the trace -->
        <template v-if="view === 'steps'">
          <div v-for="(s, i) in steps" :key="i" class="i-checkrow">
            <span class="i-checkicon">
              <i
                class="fa-solid" aria-hidden="true"
                :class="s.state === 'bad' ? 'fa-circle-xmark' : 'fa-circle-check'"
                :style="{ color: s.state === 'bad' ? 'var(--i-bad)' : 'var(--i-ok)' }"
              />
            </span>
            <div style="flex:1;min-width:0">
              <div style="font-size:12.5px" class="i-tech">{{ s.text }}</div>
              <div v-if="s.detail" style="font-size:11.5px;color:var(--i-mute)">{{ s.detail }}</div>
            </div>
          </div>
          <div v-if="busy" class="i-checkrow">
            <span class="i-checkicon"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true" /></span>
            <span style="font-size:12.5px;color:var(--i-mute)">working…</span>
          </div>
        </template>

        <!-- the decoded token -->
        <template v-else-if="view === 'token' && decoded">
          <div class="i-verdict mb-3" :class="decoded.valid ? 'is-pass' : 'is-block'">
            <h3>
              <i class="fa-solid me-2" :class="decoded.valid ? 'fa-circle-check' : 'fa-circle-xmark'" aria-hidden="true" />
              {{ decoded.valid ? 'Signature verifies' : 'Signature does not verify' }}
            </h3>
            <p>{{ decoded.valid ? 'Checked by the IdP that issued it.' : decoded.error }}</p>
          </div>

          <h3 style="font-size:13px;font-weight:500;margin:0 0 6px">Claims</h3>
          <div class="i-session mb-3">
            <div class="i-session-body" style="min-height:0">{{ JSON.stringify(decoded.payload, null, 2) }}</div>
          </div>

          <h3 style="font-size:13px;font-weight:500;margin:0 0 6px">Raw id_token</h3>
          <div class="i-secret" style="font-size:11px">{{ tokens.id_token }}</div>
          <button class="i-btn i-sm mt-2" @click="copy(tokens.id_token)">
            <i class="fa-regular fa-copy" aria-hidden="true" /> Copy
          </button>
          <p class="i-hint">Paste it into jwt.io — it decodes, because it is a real JWT.</p>
        </template>

        <!-- the assertion -->
        <template v-else-if="view === 'saml'">
          <h3 style="font-size:13px;font-weight:500;margin:0 0 6px">SAML Response</h3>
          <div class="i-session">
            <div class="i-session-body" style="min-height:0;font-size:11px">{{ samlXml }}</div>
          </div>
          <button class="i-btn i-sm mt-2" @click="copy(samlXml)">
            <i class="fa-regular fa-copy" aria-hidden="true" /> Copy XML
          </button>
        </template>

        <!-- what is and is not real -->
        <div class="i-demo-note mt-4">
          <strong style="color:var(--i-ink)">What is real here.</strong>
          The endpoints, the redirect, the authorization code, the back-channel
          exchange, the claim set and the assertion structure. The id_token is a
          genuine JWT and verifies.
          <br><br>
          <strong style="color:var(--i-ink)">What is not.</strong>
          The IdP has no user directory — it issues a token for whoever the demo
          names. Tokens are HS256 rather than RS256, because a serverless function
          has nowhere stable to keep a private key and one regenerated per
          container would fail verification at random. The SAML Response carries a
          real digest but not a full XML-DSig over a canonicalised document.
        </div>
      </div>

      <div class="i-sheetf">
        <button class="i-btn i-quiet" @click="emit('update:open', false)">Close</button>
        <div class="i-right">
          <button class="i-btn i-primary" :disabled="busy" @click="run">
            {{ busy ? 'Running…' : 'Run again' }}
          </button>
        </div>
      </div>
    </aside>
  </Teleport>
</template>
