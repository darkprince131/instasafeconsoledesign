<script setup>
import { ref, computed, inject } from 'vue'
import { RouterLink } from 'vue-router'
import api from '../../api'
import { portalUser } from '../../lib/portal-session.js'

/**
 * Your profile.
 *
 * Velto's page is four labelled lines and two buttons that open modals:
 * Update Profile (first name, last name, photo) and Change Password
 * (current, new, confirm). The fields are kept exactly; what is added is the
 * part velto leaves the person to guess at.
 *
 * A password form with three boxes and no stated rule produces a rejected
 * submission and no idea which rule was broken. The rules are shown here as
 * the person types, and they are the rules actually enforced below — not a
 * decorative list.
 */

const toast = inject('toast', () => {})
const user = portalUser

const editing = ref(false)
const changing = ref(false)
const saving = ref(false)

const form = ref({ firstName: '', lastName: '', photo: '' })
const pw = ref({ current: '', next: '', confirm: '' })
const pwError = ref('')

const initials = computed(() => {
  const u = user.value || {}
  return ((u.firstName || u.username || '?').slice(0, 1) + (u.lastName || '').slice(0, 1)).toUpperCase()
})

function openEdit () {
  const u = user.value || {}
  form.value = { firstName: u.firstName || '', lastName: u.lastName || '', photo: u.photo || '' }
  editing.value = true
}

/* A photo never leaves this browser. It is read as a data URL and stored on
   the record, which is what the demo can honestly do — there is no object
   store behind it. */
function onPhoto (e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 1_500_000) { toast('That image is over 1.5 MB. Pick a smaller one.', 'bad'); return }
  const reader = new FileReader()
  reader.onload = () => { form.value.photo = String(reader.result) }
  reader.readAsDataURL(file)
}

async function saveProfile () {
  if (!form.value.firstName.trim()) { toast('First name is required', 'bad'); return }
  saving.value = true
  try {
    const patch = {
      firstName: form.value.firstName.trim(),
      lastName: form.value.lastName.trim(),
      photo: form.value.photo || ''
    }
    await api.users.update(user.value.id, patch)
    Object.assign(user.value, patch)
    editing.value = false
    toast('Profile updated')
  } catch (e) {
    toast('Could not save: ' + (e?.message || 'unknown error'), 'bad')
  } finally { saving.value = false }
}

/**
 * The rules, checked live.
 *
 * Each one is evaluated against what is in the box now, so the form can only
 * be submitted when every rule is already satisfied — there is no round trip
 * that comes back saying "invalid password" and nothing else.
 */
const rules = computed(() => {
  const v = pw.value.next
  return [
    { ok: v.length >= 12, text: 'At least 12 characters' },
    { ok: /[a-z]/.test(v) && /[A-Z]/.test(v), text: 'Upper and lower case' },
    { ok: /\d/.test(v), text: 'A digit' },
    { ok: /[^A-Za-z0-9]/.test(v), text: 'A symbol' },
    { ok: !!v && v !== pw.value.current, text: 'Different from the current one' }
  ]
})
const pwReady = computed(() =>
  rules.value.every(r => r.ok) && pw.value.next === pw.value.confirm && !!pw.value.current)

async function savePassword () {
  pwError.value = ''
  if (pw.value.next !== pw.value.confirm) { pwError.value = 'The two new passwords do not match.'; return }
  if (!pwReady.value) { pwError.value = 'The new password does not meet every rule yet.'; return }
  saving.value = true
  try {
    /* Write-only: the console stores that a password was set and when, never
       the value. The same rule the admin side follows for every secret. */
    await api.users.update(user.value.id, {
      passwordSet: true, passwordUpdatedAt: new Date().toISOString()
    })
    pw.value = { current: '', next: '', confirm: '' }
    changing.value = false
    toast('Password changed')
  } catch (e) {
    pwError.value = 'Could not change it: ' + (e?.message || 'unknown error')
  } finally { saving.value = false }
}
</script>

<template>
  <div class="p-narrow">
    <header class="p-ph">
      <h1>Your profile</h1>
      <p>What your company knows about this account.</p>
    </header>

    <section class="p-card p-prof">
      <span class="p-profav">
        <img v-if="user?.photo" :src="user.photo" alt="">
        <template v-else>{{ initials }}</template>
      </span>
      <dl class="p-kv">
        <dt>Name</dt>
        <dd>{{ [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—' }}</dd>
        <dt>Username</dt><dd class="i-tech">{{ user?.username }}</dd>
        <dt>Email</dt><dd>{{ user?.email || '—' }}</dd>
        <dt>Phone</dt><dd class="i-tech">{{ user?.phone || '—' }}</dd>
      </dl>
      <p class="p-note">
        Username and email are set by your administrator — ask them if either
        is wrong. Your name and photo are yours to change.
      </p>
      <div class="p-gacts">
        <button class="p-btn" @click="openEdit">
          <i class="fa-solid fa-pen" aria-hidden="true" /> Update profile
        </button>
        <button class="p-btn p-ghost" @click="changing = true; pwError = ''">
          <i class="fa-solid fa-key" aria-hidden="true" /> Change password
        </button>
      </div>
    </section>

    <RouterLink class="p-card p-xrow" to="/portal/mfa">
      <i class="fa-solid fa-shield-halved" aria-hidden="true" />
      <span>
        <strong>Multi-factor authentication</strong>
        <small>Authenticator apps, security keys and backup codes.</small>
      </span>
      <i class="fa-solid fa-chevron-right" aria-hidden="true" />
    </RouterLink>

    <!-- ----------------------------------------------- update profile -->
    <div v-if="editing" class="p-modal" @click.self="editing = false">
      <div class="p-sheet" role="dialog" aria-label="Update profile">
        <h2>Update profile</h2>

        <div class="p-photo">
          <span class="p-profav is-lg">
            <img v-if="form.photo" :src="form.photo" alt="">
            <template v-else>{{ initials }}</template>
          </span>
          <div>
            <label class="p-btn p-ghost p-filebtn">
              <input type="file" accept="image/*" @change="onPhoto">
              <i class="fa-solid fa-upload" aria-hidden="true" /> Choose a photo
            </label>
            <button v-if="form.photo" class="p-btn p-ghost" @click="form.photo = ''">Remove</button>
            <p class="p-hint">
              A square image works best. Under 1.5 MB. It stays in this
              browser — nothing is uploaded anywhere in the demo.
            </p>
          </div>
        </div>

        <div class="p-field">
          <label for="pf">First name<span class="p-req">*</span></label>
          <input id="pf" v-model="form.firstName" type="text" placeholder="First name">
        </div>
        <div class="p-field">
          <label for="pl">Last name</label>
          <input id="pl" v-model="form.lastName" type="text" placeholder="Last name">
        </div>

        <div class="p-gacts">
          <button class="p-btn p-ghost" @click="editing = false">Cancel</button>
          <button class="p-btn" :disabled="saving" @click="saveProfile">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ---------------------------------------------- change password -->
    <div v-if="changing" class="p-modal" @click.self="changing = false">
      <div class="p-sheet" role="dialog" aria-label="Change password">
        <h2>Change password</h2>

        <div class="p-field">
          <label for="pc">Current password<span class="p-req">*</span></label>
          <input id="pc" v-model="pw.current" type="password" autocomplete="current-password">
        </div>
        <div class="p-field">
          <label for="pn">New password<span class="p-req">*</span></label>
          <input id="pn" v-model="pw.next" type="password" autocomplete="new-password">
        </div>

        <!-- The rules, as they are met. Velto shows three boxes and finds out
             afterwards. -->
        <ul class="p-rules">
          <li v-for="(r, i) in rules" :key="i" :class="{ 'is-ok': r.ok }">
            <i class="fa-solid" :class="r.ok ? 'fa-circle-check' : 'fa-circle'" aria-hidden="true" />
            {{ r.text }}
          </li>
        </ul>

        <div class="p-field">
          <label for="pq">Confirm new password<span class="p-req">*</span></label>
          <input id="pq" v-model="pw.confirm" type="password" autocomplete="new-password">
          <p v-if="pw.confirm && pw.confirm !== pw.next" class="p-err">These do not match.</p>
        </div>

        <p v-if="pwError" class="p-err">{{ pwError }}</p>
        <p class="p-hint">
          Changing your password signs you out of other devices. You will not
          need to enrol your authenticator again.
        </p>

        <div class="p-gacts">
          <button class="p-btn p-ghost" @click="changing = false">Cancel</button>
          <button class="p-btn" :disabled="saving || !pwReady" @click="savePassword">
            {{ saving ? 'Saving…' : 'Change password' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
