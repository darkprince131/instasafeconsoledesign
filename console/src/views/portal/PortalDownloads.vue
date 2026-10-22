<script setup>
import { ref, computed, inject } from 'vue'
import api from '../../api'

/**
 * Download the agent.
 *
 * Velto shows five equal tiles and leaves you to work out which one you need.
 * The browser already knows, so the tile for the machine you are sitting at
 * leads and the rest follow — a download button for the wrong operating
 * system is noise at best and a support ticket at worst.
 */

const toast = inject('toast', () => {})

const PLATFORMS = [
  /* A real file, not a logged intention. See the note in the admin
     console's Downloads screen. */
  { key: 'windows', label: 'Windows', icon: 'fa-brands fa-windows',
    file: 'InstaSafe-Agent-Prototype.exe', href: '/downloads/InstaSafe-Agent-Prototype.exe',
    note: 'Windows 10 and 11, 64-bit. The working prototype — installer, tray and all.' },
  { key: 'linux', label: 'Linux', icon: 'fa-brands fa-linux',
    file: 'instasafe-agent.deb',
    note: 'Debian and RPM builds, with a systemd unit.' },
  { key: 'macos', label: 'macOS', icon: 'fa-brands fa-apple',
    file: 'InstaSafe.dmg',
    note: 'Signed and notarised. Ventura or later.' },
  { key: 'ios', label: 'iOS', icon: 'fa-brands fa-app-store-ios',
    store: 'App Store',
    note: 'Installed from the App Store, not served from here.' },
  { key: 'android', label: 'Android', icon: 'fa-brands fa-android',
    store: 'Google Play',
    note: 'Installed from Google Play, not served from here.' }
]

const detected = computed(() => {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Mac OS X/i.test(ua)) return 'macos'
  if (/Linux/i.test(ua)) return 'linux'
  return 'windows'
})
const mine = computed(() => PLATFORMS.find(p => p.key === detected.value))
const others = computed(() => PLATFORMS.filter(p => p.key !== detected.value))

const said = ref('')

async function get (p) {
  await api.events.record({
    type: 'download.requested',
    message: `Agent for ${p.label} requested from the member portal`
  })
  said.value = p.label
  toast(`${p.label} — recorded in the event log.`)
}
</script>

<template>
  <div class="p-wide">
    <header class="p-ph">
      <h1>Get the InstaSafe agent</h1>
      <p>
        The agent is what connects this machine to your company's
        applications. Install it once; it starts with the machine after that.
      </p>
    </header>

    <!-- The one you almost certainly want. -->
    <section v-if="mine" class="p-card p-dlmine">
      <i class="p-dlbig" :class="mine.icon" aria-hidden="true" />
      <div>
        <p class="p-dlfor">Looks like you are on</p>
        <h2>{{ mine.label }}</h2>
        <p class="p-sub">{{ mine.note }}</p>
        <p v-if="mine.file" class="i-tech p-dlfile">{{ mine.file }}</p>
      </div>
      <!-- A real file is an <a download>; a logged intention is a button.
           They do different things and should not look like the same control
           with a different label. -->
      <a v-if="mine.href" class="p-btn" :href="mine.href" download @click="get(mine)">
        <i class="fa-solid fa-download" aria-hidden="true" /> Download
      </a>
      <button v-else class="p-btn" @click="get(mine)">
        <i class="fa-solid" :class="mine.store ? 'fa-arrow-up-right-from-square' : 'fa-download'" aria-hidden="true" />
        {{ mine.store || 'Download' }}
      </button>
    </section>

    <h2 class="p-sech">Other platforms</h2>
    <div class="p-dlgrid">
      <article v-for="p in others" :key="p.key" class="p-card p-dltile">
        <i class="p-dlic" :class="p.icon" aria-hidden="true" />
        <div class="p-dlbody">
          <h3>{{ p.label }}</h3>
          <p class="p-sub">{{ p.note }}</p>
          <p v-if="p.file" class="i-tech p-dlfile">{{ p.file }}</p>
        </div>
        <a v-if="p.href" class="p-btn p-ghost" :href="p.href" download @click="get(p)">
          <i class="fa-solid fa-download" aria-hidden="true" /> Download
        </a>
        <button v-else class="p-btn p-ghost" @click="get(p)">
          <i class="fa-solid" :class="p.store ? 'fa-arrow-up-right-from-square' : 'fa-download'" aria-hidden="true" />
          {{ p.store || 'Download' }}
        </button>
      </article>
    </div>

    <p v-if="said" class="p-note mt-3">
      <template v-if="said === 'Windows'">
        That is a real executable — the agent prototype, about four hundred
        kilobytes, unsigned. Windows will warn you about an unknown publisher,
        which is correct: it has no code-signing certificate. Run it and you
        get the installer, the tray icon and the connection states.
      </template>
      <template v-else>
        In production this serves the signed agent for {{ said }}, with iOS
        and Android going to their stores. Only the Windows build exists so
        far, so this request is written to the event log instead of handing
        you a broken file.
      </template>
    </p>

    <section class="p-card mt-4">
      <h2 class="p-cardh"><i class="fa-solid fa-circle-question" aria-hidden="true" /> After you install it</h2>
      <ol class="p-steps">
        <li>Start the agent. On Windows and macOS it starts on its own after the first run.</li>
        <li>Sign in with the same username you used here.</li>
        <li>Your device registers itself and appears on your dashboard.</li>
        <li>An administrator approves it — until then, network applications stay closed.</li>
      </ol>
    </section>
  </div>
</template>
