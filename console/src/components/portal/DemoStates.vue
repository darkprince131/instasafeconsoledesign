<script setup>
import { ref, computed } from 'vue'
import { demo, resetDemoState, isModified } from '../../lib/demo-state.js'

/**
 * The state switcher.
 *
 * A floating control that turns the portal's interesting states on and off
 * without touching the database. It exists because the screens worth
 * reviewing are the ones a seeded tenant never reaches — the first day, the
 * agent being down, an administrator switching recording on — and emptying a
 * table to see one is both slow and destructive.
 *
 * It is demo scaffolding and says so. It is not a product feature and should
 * not be mistaken for one, which is why it is a floating panel rather than a
 * settings screen, and why it carries the word "demo" on its face.
 */

const open = ref(false)
const modified = computed(() => isModified())

/* Grouped the way somebody reviewing would ask for them, not the way the
   object happens to be ordered. */
const CHOICES = [
  {
    group: 'What they can reach',
    rows: [
      { key: 'applications', label: 'Applications',
        options: [['all', 'All'], ['web', 'Browser only'], ['none', 'None']],
        why: 'None is the first-day state, and the empty screen nobody designs.' },
      { key: 'devices', label: 'Registered devices',
        options: [['some', 'Some'], ['none', 'None']],
        why: 'A new starter has none until the agent registers one.' },
      { key: 'history', label: 'Access history',
        options: [['some', 'Some'], ['none', 'None']] }
    ]
  },
  {
    group: 'This machine',
    rows: [
      { key: 'agent', label: 'InstaSafe agent',
        options: [['auto', 'Really probe'], ['running', 'Running'], ['missing', 'Not running']],
        why: 'Probe asks the loopback port for real; the other two force the answer.' }
    ]
  }
]

const SWITCHES = [
  { key: 'mfaRequired', label: 'Multi-factor required',
    why: 'Off, sign-in skips the second step entirely.' },
  { key: 'sessionRecording', label: 'Session recording',
    why: 'On, the portal tells the person their sessions are recorded — which it should, and velto does not.' },
  { key: 'shiftSchedule', label: 'Shift schedule',
    why: 'Access only inside set hours.' },
  { key: 'geoBinding', label: 'Geo binding',
    why: 'Access only from a set area.' },
  { key: 'mfaSimulator', label: 'Accept any code',
    why: 'For walking somebody through the flow without a phone. Off, the authenticator is verified for real.',
    warn: true }
]
</script>

<template>
  <div class="d-states">
    <button
      class="d-fab" :class="{ 'is-open': open, 'is-mod': modified }"
      :aria-expanded="open" aria-label="Demo states"
      @click="open = !open"
    >
      <i class="fa-solid" :class="open ? 'fa-xmark' : 'fa-sliders'" aria-hidden="true" />
      <span class="d-fabl">Demo states</span>
      <span v-if="modified && !open" class="d-dot" aria-hidden="true" />
    </button>

    <div v-if="open" class="d-panel" role="dialog" aria-label="Demo states">
      <header class="d-ph">
        <div>
          <h2>Demo states</h2>
          <p>
            Switches for the states a seeded tenant never reaches. Nothing is
            faked downstream — a screen set to “none” runs the same empty
            branch a real empty tenant would.
          </p>
        </div>
        <button v-if="modified" class="d-reset" @click="resetDemoState">Reset</button>
      </header>

      <section v-for="g in CHOICES" :key="g.group" class="d-grp">
        <h3>{{ g.group }}</h3>
        <div v-for="row in g.rows" :key="row.key" class="d-row">
          <label :for="'d_' + row.key">{{ row.label }}</label>
          <div class="d-seg" role="group" :aria-label="row.label">
            <button
              v-for="[val, text] in row.options" :key="val"
              class="d-segb" :class="{ 'is-on': demo[row.key] === val }"
              @click="demo[row.key] = val"
            >{{ text }}</button>
          </div>
          <p v-if="row.why" class="d-why">{{ row.why }}</p>
        </div>
      </section>

      <section class="d-grp">
        <h3>What the administrator has turned on</h3>
        <div v-for="sw in SWITCHES" :key="sw.key" class="d-row d-swrow">
          <label class="d-sw">
            <input type="checkbox" v-model="demo[sw.key]">
            <span class="d-track" />
            <span class="d-swl">
              {{ sw.label }}
              <i v-if="sw.warn && demo[sw.key]" class="fa-solid fa-triangle-exclamation d-warn" aria-hidden="true" />
            </span>
          </label>
          <p class="d-why">{{ sw.why }}</p>
        </div>
      </section>

      <p class="d-foot">
        Demo scaffolding, not a product screen. It is stored in this browser
        only, so a reviewer's switches never reach anybody else.
      </p>
    </div>
  </div>
</template>
