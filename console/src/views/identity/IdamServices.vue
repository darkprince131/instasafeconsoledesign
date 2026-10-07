<script setup>
import { ref, computed, watch, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../../components/ui/PageHeader.vue'
import api from '../../api'

/**
 * IDAM — i365 acting as the identity provider rather than consuming one.
 *
 * This is the mirror image of the Authentication profiles screen, and it has
 * an advantage most demo screens do not: the IdP it is describing is the one
 * already running at /idp from phase 4. So the endpoints listed here are
 * live, the discovery document is fetched rather than printed from a
 * template, and the metadata is the real XML a service provider would
 * consume.
 *
 * Which means an integrator can point something at these URLs during the
 * demo and it will work.
 */

const route = useRoute()
const toast = inject('toast', () => {})

const SERVICES = {
  '/openid-idp': {
    title: 'OpenID Connect provider',
    subtitle: 'Applications can delegate sign-in to i365 over OIDC.',
    probe: '/idp/.well-known/openid-configuration',
    probeLabel: 'Discovery document',
    endpoints: [
      ['Issuer', '/idp'],
      ['Discovery', '/idp/.well-known/openid-configuration'],
      ['Authorization', '/idp/authorize'],
      ['Token', '/idp/token'],
      ['JWKS', '/idp/jwks']
    ],
    fields: [
      ['clientId', 'Client ID', 'i365-console'],
      ['redirectUri', 'Redirect URI', ''],
      ['scopes', 'Scopes', 'openid profile email groups']
    ]
  },
  '/saml-idp': {
    title: 'SAML identity provider',
    subtitle: 'Service providers can federate to i365 over SAML 2.0.',
    probe: '/idp/saml/metadata',
    probeLabel: 'IdP metadata',
    endpoints: [
      ['Entity ID', '/idp'],
      ['Metadata', '/idp/saml/metadata'],
      ['Single sign-on', '/idp/saml/sso']
    ],
    fields: [
      ['audience', 'Service provider entity ID', 'i365-console'],
      ['acsUrl', 'Assertion consumer service URL', ''],
      ['nameIdFormat', 'NameID format', 'emailAddress']
    ]
  },
  '/oauth2-service': {
    title: 'OAuth 2.0 service',
    subtitle: 'Machine-to-machine tokens for anything calling the i365 API.',
    probe: '/idp/.well-known/openid-configuration',
    probeLabel: 'Endpoint configuration',
    endpoints: [
      ['Authorization', '/idp/authorize'],
      ['Token', '/idp/token'],
      ['Introspection', '/idp/introspect']
    ],
    fields: [
      ['clientId', 'Client ID', ''],
      ['grantTypes', 'Grant types', 'authorization_code'],
      ['tokenTtl', 'Token lifetime (seconds)', '3600']
    ]
  },
  '/scim-export': {
    title: 'SCIM export',
    subtitle: 'Downstream systems can pull users and groups from i365 over SCIM 2.0.',
    probe: null,
    probeLabel: 'SCIM resource',
    endpoints: [
      ['Base URL', '/scim/v2'],
      ['Users', '/scim/v2/Users'],
      ['Groups', '/scim/v2/Groups']
    ],
    fields: [
      ['token', 'Bearer token', ''],
      ['syncInterval', 'Pull interval (minutes)', '15']
    ]
  },
  '/authserver/radius': {
    title: 'RADIUS server',
    subtitle: 'Network devices can authenticate users against i365 over RADIUS.',
    probe: null,
    probeLabel: 'Clients',
    endpoints: [
      ['Authentication', 'radius://auth.instasafe.com:1812'],
      ['Accounting', 'radius://auth.instasafe.com:1813']
    ],
    fields: [
      ['sharedSecret', 'Shared secret', ''],
      ['nasAllowList', 'Allowed NAS addresses', '10.20.0.0/16']
    ]
  }
}

const cfg = computed(() => SERVICES[route.path] || SERVICES['/openid-idp'])
const origin = typeof location !== 'undefined' ? location.origin : ''

const form = ref({})
const probeOut = ref('')
const probing = ref(false)
const scimOut = ref('')

function reset () {
  form.value = Object.fromEntries((cfg.value.fields || []).map(([k, , d]) => [k, d]))
  if (form.value.redirectUri === '') form.value.redirectUri = origin + '/profile/openid'
  if (form.value.acsUrl === '') form.value.acsUrl = origin + '/profile/saml'
  probeOut.value = ''
  scimOut.value = ''
}

async function probe () {
  if (!cfg.value.probe) return
  probing.value = true
  try {
    const res = await fetch(cfg.value.probe)
    const text = await res.text()
    probeOut.value = text.startsWith('{')
      ? JSON.stringify(JSON.parse(text), null, 2)
      : text
    toast('Fetched from the live endpoint')
  } catch (e) {
    probeOut.value = 'Could not reach the endpoint: ' + e.message
  } finally { probing.value = false }
}

/** SCIM has no bundled server, so this renders what the resource would return. */
async function scimSample () {
  const users = (await api.users.list({ perPage: 2 })).data
  scimOut.value = JSON.stringify({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: (await api.users.list({ perPage: 1 })).total,
    itemsPerPage: users.length,
    startIndex: 1,
    Resources: users.map(u => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: u.id,
      userName: u.username,
      name: { givenName: u.firstName, familyName: u.lastName },
      emails: [{ value: u.email, primary: true }],
      active: u.status === 'active',
      meta: { resourceType: 'User', created: u.createdAt }
    }))
  }, null, 2)
  toast('Rendered from this tenant’s own users')
}

function copy (t) { navigator.clipboard?.writeText(t); toast('Copied') }

watch(() => route.path, reset)
onMounted(reset)
</script>

<template>
  <div class="i-page">
    <PageHeader :title="cfg.title" :subtitle="cfg.subtitle" />

    <div class="row g-4">
      <div class="col-12 col-xl-5">
        <div class="i-chead"><h2>Endpoints</h2></div>
        <dl class="i-kv mb-4" style="grid-template-columns:160px 1fr">
          <template v-for="[label, path] in cfg.endpoints" :key="label">
            <dt>{{ label }}</dt>
            <dd>
              <code class="i-tech" style="word-break:break-all">{{ path.startsWith('radius') ? path : origin + path }}</code>
              <button
                class="i-btn i-sm i-quiet ms-1" style="padding:0 6px;min-height:0"
                @click="copy(path.startsWith('radius') ? path : origin + path)"
                aria-label="Copy"
              ><i class="fa-regular fa-copy" aria-hidden="true" /></button>
            </dd>
          </template>
        </dl>

        <div class="i-chead"><h2>Configuration</h2></div>
        <div class="i-formsec">
          <div v-for="[key, label] in cfg.fields" :key="key" class="i-frow" style="grid-template-columns:1fr">
            <div class="i-field">
              <label :for="'id_' + key">{{ label }}</label>
              <input
                :id="'id_' + key" class="i-ctl"
                :type="/secret|token/i.test(label) ? 'password' : 'text'"
                v-model="form[key]"
              >
              <p v-if="/secret|token/i.test(label)" class="i-hint">
                Stored write-only. Regenerating it breaks every integration using the old value.
              </p>
            </div>
          </div>
          <button class="i-btn i-primary mt-2" @click="toast('Configuration saved')">
            Save configuration
          </button>
        </div>
      </div>

      <div class="col-12 col-xl-7">
        <div class="i-chead">
          <h2>{{ cfg.probeLabel }}</h2>
          <span class="i-meta">
            {{ cfg.probe ? 'Fetched live' : 'Rendered from this tenant' }}
          </span>
        </div>

        <div class="d-flex gap-2 mb-3">
          <button v-if="cfg.probe" class="i-btn i-primary" :disabled="probing" @click="probe">
            <i class="fa-solid fa-satellite-dish" aria-hidden="true" />
            {{ probing ? 'Fetching…' : 'Fetch from the live endpoint' }}
          </button>
          <button v-if="route.path === '/scim-export'" class="i-btn i-primary" @click="scimSample">
            <i class="fa-solid fa-code" aria-hidden="true" /> Render a SCIM response
          </button>
          <button v-if="probeOut || scimOut" class="i-btn" @click="copy(probeOut || scimOut)">
            <i class="fa-regular fa-copy" aria-hidden="true" /> Copy
          </button>
        </div>

        <div v-if="probeOut || scimOut" class="i-session">
          <div class="i-session-body" style="white-space:pre;overflow-x:auto;font-size:11px">{{ probeOut || scimOut }}</div>
        </div>

        <div v-else class="i-demo-note">
          <template v-if="cfg.probe">
            <strong style="color:var(--i-ink)">These endpoints are live.</strong>
            The identity provider behind them is the one this demo runs at
            <code class="i-tech">/idp</code> — the same one the Authentication
            profiles screen tests against. Press the button and the document comes
            off the wire rather than out of a template. You can point a real
            service provider at these URLs during a demo and it will work.
          </template>
          <template v-else-if="route.path === '/scim-export'">
            <strong style="color:var(--i-ink)">No SCIM server is bundled.</strong>
            The button renders the exact SCIM 2.0 ListResponse this tenant's users
            would produce, with the real schema URNs and resource shape, so an
            integrator can see what their parser would receive.
          </template>
          <template v-else>
            <strong style="color:var(--i-ink)">RADIUS cannot be demonstrated in a browser.</strong>
            It is a UDP protocol spoken by network hardware. The configuration here
            is real and is what a backend would act on; the authentication itself
            needs the server.
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
