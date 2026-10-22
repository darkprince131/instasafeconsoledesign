<script setup>
import { ref, computed } from 'vue'
import AgentStage from '../../components/agent/AgentStage.vue'

/**
 * The desktop agent, redesigned.
 *
 * The agent a person actually installs is three products wearing one name: an
 * NSIS installer from 2005, a tray built with raw Win32, and a sign-in screen
 * that is a web page in an embedded Chromium. Nothing is shared between them
 * — not the palette, not the type, not the corner radius — so somebody
 * installs in one era, signs in in another and lives in a third.
 *
 * This walks the whole arc in one language: install, first run, sign in,
 * connected, and the three states nobody designed — connecting, dropped, and
 * failed. It is a prototype of the *design*, not of the plumbing.
 *
 * **What is directly shippable and what is a specification.** The sign-in
 * window is already HTML rendered by WebView2, so those screens are not a
 * mock-up of a desktop app — they are the markup, and they can be pointed at.
 * The tray, the menu, the toasts and the dialogs are native Win32 and cannot
 * be HTML; those screens here are a specification an engineer builds against.
 * Each step says which of the two it is, because the distinction decides how
 * much work it represents.
 */

const STEPS = [
  { key: 'welcome', label: 'Welcome', kind: 'native',
    note: 'Today there is no welcome step at all — the installer opens on a finished install. One screen that says what is about to happen costs nothing and removes the surprise of a network driver appearing.' },
  { key: 'installing', label: 'Installing', kind: 'native',
    note: 'Today this is a raw log: “tapinstall cumulative status: 0”. Three named steps, in words, with the detail behind a disclosure for whoever needs it.' },
  { key: 'server', label: 'Workspace', kind: 'native',
    note: 'Today this page is headed “Installation Complete” while asking for input, calls one field three names, and commits with a button labelled Close.' },
  { key: 'signin', label: 'Sign in', kind: 'web',
    note: 'Already HTML in WebView2 — this is the portal’s own sign-in at agent size. Same components, same tokens, one design to maintain.' },
  { key: 'mfa', label: 'Second factor', kind: 'web',
    note: 'The portal’s method chooser, narrowed. The agent currently hands this to the same web view, so it comes for free.' },
  { key: 'connecting', label: 'Connecting', kind: 'native',
    note: 'A state with no screen today. The window closes and you wait, with the tray icon as the only signal.' },
  { key: 'connected', label: 'Connected', kind: 'native',
    note: 'The tray panel replaces a four-item menu that never says whether you are connected.' },
  { key: 'dropped', label: 'Dropped', kind: 'native',
    note: 'No surface exists for this. The icon changes and nothing says why, which is the single most common support call for any VPN client.' },
  { key: 'failed', label: 'Sign-in failed', kind: 'web',
    note: 'The card reserves no space for an error today, so one shoves the button down. Every error says what happened, why, and what to do next.' }
]

const step = ref(0)
const current = computed(() => STEPS[step.value])
const theme = ref('dark')

function go (i) { step.value = Math.max(0, Math.min(STEPS.length - 1, i)) }
</script>

<template>
  <div class="i-page">
    <header class="i-phead">
      <div>
        <h1>Desktop agent</h1>
        <p class="i-sub">
          The whole arc, in one design language: install, first run, sign in,
          connect, and the three states nobody drew. Walk it with the steps
          below.
        </p>
      </div>
      <div class="i-right">
        <button class="i-btn i-sm" @click="theme = theme === 'dark' ? 'light' : 'dark'">
          <i class="fa-solid" :class="theme === 'dark' ? 'fa-sun' : 'fa-moon'" aria-hidden="true" />
          {{ theme === 'dark' ? 'Light' : 'Dark' }} desktop
        </button>
      </div>
    </header>

    <!-- the steps, named, so the arc is legible before you walk it -->
    <ol class="ag-steps">
      <li v-for="(s, i) in STEPS" :key="s.key">
        <button class="ag-step" :class="{ 'is-on': i === step, 'is-done': i < step }" @click="go(i)">
          <span class="ag-stepn">{{ i + 1 }}</span>
          <span class="ag-stepl">{{ s.label }}</span>
          <span class="ag-kind" :class="'is-' + s.kind">{{ s.kind === 'web' ? 'HTML' : 'native' }}</span>
        </button>
      </li>
    </ol>

    <div class="ag-split">
      <AgentStage :step="current.key" :theme="theme" />

      <aside class="ag-notes">
        <h2>{{ current.label }}</h2>

        <p class="ag-kindline" :class="'is-' + current.kind">
          <i class="fa-solid" :class="current.kind === 'web' ? 'fa-code' : 'fa-window-maximize'" aria-hidden="true" />
          <span>
            <template v-if="current.kind === 'web'">
              <strong>Shippable markup.</strong> This surface is already a web
              page inside the agent, so this is the real thing rather than a
              picture of it.
            </template>
            <template v-else>
              <strong>Specification.</strong> This surface is native Win32 and
              cannot be HTML. Drawn here so an engineer has something exact to
              build against.
            </template>
          </span>
        </p>

        <p class="ag-note">{{ current.note }}</p>

        <div class="ag-nav">
          <button class="i-btn i-sm" :disabled="step === 0" @click="go(step - 1)">
            <i class="fa-solid fa-arrow-left me-1" aria-hidden="true" />Back
          </button>
          <button class="i-btn i-sm i-primary" :disabled="step === STEPS.length - 1" @click="go(step + 1)">
            Next<i class="fa-solid fa-arrow-right ms-1" aria-hidden="true" />
          </button>
        </div>
      </aside>
    </div>

    <!-- ------------------------------------------------ what engineering needs -->
    <section class="ag-eng">
      <div class="i-chead"><h2>Four changes that are not design work</h2></div>
      <p class="i-secsub">
        Each of these fixes something visible, and none of them needs a
        designer. They are missing lines in build configuration.
      </p>

      <div class="ag-fixes">
        <article>
          <h3>Add a version resource</h3>
          <p>
            <code class="i-tech">InstaSafe-Agent.exe</code> carries no
            FileVersion, CompanyName or ProductName. That is why Windows
            titles the notification
            <code class="i-tech">InstaSafe-Agent.exe</code> — the filename,
            extension and all — and why Add/Remove Programs shows a blank
            publisher.
          </p>
        </article>
        <article>
          <h3>Register an AppUserModelID</h3>
          <p>
            Without one, toasts get Windows’ generic blue information glyph
            instead of the product icon, and cannot carry action buttons.
          </p>
        </article>
        <article>
          <h3>Declare DPI awareness</h3>
          <p>
            The manifest sets no <code class="i-tech">dpiAware</code>, so
            Windows bitmap-stretches the whole window on a high-resolution
            screen. That is the entire reason the agent looks soft next to
            other applications.
          </p>
        </article>
        <article>
          <h3>Agree one version number</h3>
          <p>
            About says <code class="i-tech">v3.06</code>, the manifest says
            <code class="i-tech">3.0.5.0</code>, Add/Remove says
            <code class="i-tech">3.0</code>. Three answers to “which build is
            this?” makes a support call longer than it needs to be.
          </p>
        </article>
      </div>
    </section>
  </div>
</template>
