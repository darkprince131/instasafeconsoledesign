<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader.vue'
import ConfirmModal from '../../components/ui/ConfirmModal.vue'

/**
 * SCIM import.
 *
 * Not a list, which is why it is not a config in resources.js. Velto's screen
 * is five disabled fields and one button, and every value on it is generated
 * by the console: these are the endpoints you paste into the *other* system,
 * not settings you fill in here.
 *
 * Read off the live tenant:
 *
 *   Base Url                 https://<tenant>/scim/v2
 *   Service Provider Config  .../scim/v2/ServiceProviderConfig
 *   User Schema              .../scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User
 *   Group Schema             .../scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group
 *   Bearer Token             Token starting with '3j8WQI...' was generated at <date>
 *   [Regenerate Token]
 *
 * The token is never shown in full after it is made — only its first
 * characters and when. That is the same write-only handling as the SMTP
 * password and the profile secrets, and it is right.
 *
 * What this adds: the fields can be copied. Production renders them as
 * disabled inputs, which in most browsers you cannot even select cleanly, and
 * copying them into an IdP is the entire job of the screen. Regenerate also
 * says what it breaks before it does it, because it silently stops
 * provisioning until the new token is pasted at the other end.
 */

const toast = inject('toast', () => {})

const KEY = '/profile/scim-import'

const token = ref(null)          // { prefix, at } — never the token itself
const confirmOpen = ref(false)
const copied = ref('')

/* The tenant's own host. In production this is the customer's portal
   hostname, which is exactly what has to be registered at the IdP. */
const base = computed(() => `${window.location.origin}/scim/v2`)

const endpoints = computed(() => [
  ['Base Url', base.value],
  ['Service Provider Config', `${base.value}/ServiceProviderConfig`],
  ['User Schema', `${base.value}/Schemas/urn:ietf:params:scim:schemas:core:2.0:User`],
  ['Group Schema', `${base.value}/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group`]
])

const tokenLine = computed(() => {
  if (!token.value) return 'No token has been generated yet.'
  const when = new Date(token.value.at)
  return `Token starting with '${token.value.prefix}…' was generated at ` +
    when.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    })
})

async function load () {
  token.value = (await api.settings.get(KEY))?.token || null
}

async function copy (label, value) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = label
    setTimeout(() => { if (copied.value === label) copied.value = '' }, 2000)
  } catch {
    toast('The browser would not allow a copy. Select the text instead.', 'bad')
  }
}

/**
 * A new token invalidates the old one the moment it exists, so this is
 * confirmed and the confirmation says what stops.
 */
async function regenerate () {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(40))
  const full = [...bytes].map(b => alphabet[b % alphabet.length]).join('')
  /* Only the prefix is kept. The whole token is shown once, here, and then
     it is gone — there is nowhere it could be read back from. */
  token.value = { prefix: full.slice(0, 6), at: new Date().toISOString() }
  await api.settings.set(KEY, { token: token.value })
  await api.events.record({
    type: 'scim.token.regenerated',
    message: 'SCIM bearer token regenerated',
    severity: 'warning'
  })
  confirmOpen.value = false
  await copy('Bearer Token', full)
  toast('New token copied to the clipboard. It is not shown again.')
}

onMounted(load)
</script>

<template>
  <div class="i-page">
    <PageHeader
      title="SCIM Import"
      subtitle="The endpoints an identity provider provisions users into. Everything here is generated — copy it into the other system."
    />

    <div style="max-width:860px">
      <div class="i-formsec">
        <h3>Endpoints</h3>
        <p class="i-secsub">
          Register these at the identity provider. The base URL is what most
          providers ask for; the schema URLs are there for the ones that check
          them.
        </p>

        <div v-for="[label, value] in endpoints" :key="label" class="i-field">
          <label :for="'scim_' + label">{{ label }}</label>
          <div class="d-flex align-items-center gap-2">
            <input
              :id="'scim_' + label" class="i-ctl i-tech" type="text"
              :value="value" readonly
              @focus="$event.target.select()"
            >
            <button class="i-btn i-sm" @click="copy(label, value)">
              <i class="fa-solid fa-copy" aria-hidden="true" />
              {{ copied === label ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </div>
      </div>

      <div class="i-formsec">
        <h3>Bearer token</h3>
        <p class="i-secsub">
          The provider authenticates with this. It is shown once, when it is
          generated, and never again.
        </p>

        <div class="i-field">
          <label for="scim_token">Bearer Token</label>
          <input id="scim_token" class="i-ctl" type="text" :value="tokenLine" readonly>
          <p class="i-hint">
            Only the first characters are kept, so a token that has been lost
            has to be replaced rather than looked up.
          </p>
        </div>

        <button class="i-btn" @click="confirmOpen = true">
          <i class="fa-solid fa-rotate me-1" aria-hidden="true" />
          {{ token ? 'Regenerate Token' : 'Generate Token' }}
        </button>
      </div>

      <p class="i-demo-note">
        This demo has no SCIM endpoint behind these URLs — provisioning is the
        one part of this screen a browser cannot stand in for. The token is
        generated here with the browser's own cryptographic random source, and
        only its first six characters are stored.
      </p>
    </div>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="token ? 'Regenerate the SCIM token?' : 'Generate a SCIM token?'"
      :confirm-label="token ? 'Regenerate' : 'Generate'"
      @confirm="regenerate"
    >
      <template v-if="token">
        The token in use now stops working immediately. Any identity provider
        provisioning into this tenant will fail — users will not be created,
        changed or deactivated — until the new token is pasted at that end.
        The new token is shown once and copied to your clipboard.
      </template>
      <template v-else>
        The token is shown once and copied to your clipboard. It cannot be
        read back afterwards, so paste it into the identity provider before
        leaving this screen.
      </template>
    </ConfirmModal>
  </div>
</template>
