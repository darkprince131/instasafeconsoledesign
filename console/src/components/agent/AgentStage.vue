<script setup>
import { computed } from 'vue'

/**
 * A Windows desktop, with the agent's surfaces drawn on it.
 *
 * Shown on a desktop rather than floated on a page because every judgement
 * about this product is a judgement about proportion: a tray panel is small,
 * a toast is smaller, and a setup window is a fixed strip. Drawn at their own
 * size against a taskbar, the questions answer themselves — a four-line
 * tooltip is obviously too much, and a 480px wizard with a log in it is
 * obviously the wrong container.
 */

const props = defineProps({
  step: { type: String, required: true },
  theme: { type: String, default: 'dark' }
})

const isSetup = computed(() => ['welcome', 'installing', 'server'].includes(props.step))
const isWeb = computed(() => ['signin', 'mfa', 'failed'].includes(props.step))
const isTray = computed(() => ['connecting', 'connected', 'dropped'].includes(props.step))
</script>

<template>
  <div class="ag-desk" :class="'is-' + theme">
    <!-- ======================================================= setup -->
    <div v-if="isSetup" class="ag-win ag-setup">
      <header class="ag-titlebar">
        <span class="ag-tbmark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="14" height="14">
            <circle cx="16" cy="16" r="15" fill="#5B4FD1" />
            <circle cx="16" cy="16" r="6" fill="#fff" opacity=".9" />
          </svg>
        </span>
        <span class="ag-tbtitle">Set up InstaSafe</span>
        <span class="ag-tbbtns"><i>—</i><i>▢</i><i class="x">✕</i></span>
      </header>

      <!-- Velto's installer opens on a finished install. This says what is
           about to happen, and what it will change. -->
      <div v-if="step === 'welcome'" class="ag-body">
        <div class="ag-hero">
          <span class="ag-heroico"><i class="fa-solid fa-shield-halved" aria-hidden="true" /></span>
          <h2>InstaSafe connects this computer to your company’s applications</h2>
          <p>
            It runs quietly in the background. You sign in once a day; after
            that it stays out of the way.
          </p>
        </div>
        <ul class="ag-will">
          <li><i class="fa-solid fa-check" aria-hidden="true" />Adds a network adapter, so traffic for company applications is routed privately</li>
          <li><i class="fa-solid fa-check" aria-hidden="true" />Installs a background service, so the connection survives a reboot</li>
          <li><i class="fa-solid fa-check" aria-hidden="true" />Needs administrator permission once, now</li>
        </ul>
        <footer class="ag-foot">
          <a href="#" @click.prevent>Licence agreement</a>
          <span class="i-right">
            <button class="ag-btn ag-ghost">Cancel</button>
            <button class="ag-btn ag-primary">Install</button>
          </span>
        </footer>
      </div>

      <!-- Named steps instead of "tapinstall cumulative status: 0". -->
      <div v-else-if="step === 'installing'" class="ag-body">
        <h2 class="ag-h2">Installing</h2>
        <ul class="ag-prog">
          <li class="is-done"><i class="fa-solid fa-check" aria-hidden="true" />Copied files</li>
          <li class="is-done"><i class="fa-solid fa-check" aria-hidden="true" />Added the network adapter</li>
          <li class="is-now"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />Starting the background service</li>
        </ul>
        <div class="ag-bar"><span style="width:72%" /></div>
        <details class="ag-details">
          <summary>Show technical detail</summary>
          <pre>tapinstall install returned: 0
Service INSTALL
Output folder: C:\Program Files\InstaSafe</pre>
        </details>
        <footer class="ag-foot">
          <span class="ag-footnote">This takes about a minute.</span>
        </footer>
      </div>

      <!-- One name for the field, and a button that says what it does. -->
      <div v-else class="ag-body">
        <h2 class="ag-h2">Which workspace?</h2>
        <p class="ag-p">
          Your IT team gave you an address. It usually looks like your company
          name followed by <code>.instasafe.com</code>.
        </p>
        <label class="ag-label" for="ws">Workspace address</label>
        <div class="ag-inputwrap">
          <input id="ws" class="ag-input" value="veno.instasafe.com" readonly>
          <span class="ag-ok"><i class="fa-solid fa-circle-check" aria-hidden="true" /></span>
        </div>
        <p class="ag-hint">Reachable — this workspace answered.</p>
        <footer class="ag-foot">
          <span class="i-right">
            <button class="ag-btn ag-ghost">Back</button>
            <button class="ag-btn ag-primary">Save and sign in</button>
          </span>
        </footer>
      </div>

      <p class="ag-caption">
        Setup window — native. 560&times;420, resizable, one question per screen.
      </p>
    </div>

    <!-- ========================================================= web -->
    <div v-else-if="isWeb" class="ag-win ag-webwin">
      <header class="ag-titlebar">
        <span class="ag-tbmark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="14" height="14">
            <circle cx="16" cy="16" r="15" fill="#5B4FD1" />
            <circle cx="16" cy="16" r="6" fill="#fff" opacity=".9" />
          </svg>
        </span>
        <span class="ag-tbtitle">Sign in to veno</span>
        <span class="ag-tbbtns"><i>—</i><i>▢</i><i class="x">✕</i></span>
      </header>

      <div class="ag-web">
        <!-- The knockout lockup, which is what a dark card needs. The shipped
             screen uses the light-background raster, which is why its
             strapline all but disappears. -->
        <div class="ag-brand">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <circle cx="16" cy="16" r="15" fill="#fff" opacity=".1" />
            <circle cx="16" cy="16" r="14" fill="none" stroke="#fff" stroke-width="1.4" opacity=".55" />
            <circle cx="16" cy="16" r="6" fill="#fff" />
          </svg>
          <span>InstaSafe</span>
        </div>

        <template v-if="step === 'signin'">
          <h2 class="ag-wh">Sign in</h2>
          <p class="ag-wsub">veno.instasafe.com</p>
          <label class="ag-wlabel" for="u">Email address</label>
          <input id="u" class="ag-winput" value="alen.joseph@veno.com" readonly>
          <button class="ag-btn ag-primary ag-wide">Continue</button>
          <p class="ag-wfoot">
            By continuing you accept the
            <a href="#" @click.prevent>Terms of Use</a> and
            <a href="#" @click.prevent>Privacy Policy</a>.
          </p>
        </template>

        <template v-else-if="step === 'mfa'">
          <h2 class="ag-wh">Prove it is you</h2>
          <p class="ag-wsub">Choose whichever you have to hand.</p>
          <ul class="ag-methods">
            <li><i class="fa-solid fa-mobile-screen" aria-hidden="true" /><span><strong>TOTP</strong><small>A rotating code</small></span><i class="fa-solid fa-chevron-right c" aria-hidden="true" /></li>
            <li class="is-on"><i class="fa-solid fa-bell" aria-hidden="true" /><span><strong>Authenticator</strong><small>Approve on your phone</small></span><i class="fa-solid fa-chevron-right c" aria-hidden="true" /></li>
            <li><i class="fa-solid fa-key" aria-hidden="true" /><span><strong>Hardware key</strong><small>Cannot be phished</small></span><i class="fa-solid fa-chevron-right c" aria-hidden="true" /></li>
          </ul>
          <p class="ag-wfoot"><a href="#" @click.prevent>Other methods</a></p>
        </template>

        <!-- Space for the error is reserved, so nothing jumps. -->
        <template v-else>
          <h2 class="ag-wh">Sign in</h2>
          <p class="ag-wsub">veno.instasafe.com</p>
          <div class="ag-err">
            <i class="fa-solid fa-circle-exclamation" aria-hidden="true" />
            <span>
              <strong>That password was not accepted.</strong>
              Two attempts left before the account locks for 15 minutes.
              <a href="#" @click.prevent>Forgotten it?</a>
            </span>
          </div>
          <label class="ag-wlabel" for="p2">Password</label>
          <input id="p2" class="ag-winput is-bad" type="password" value="xxxxxxxxxx" readonly>
          <button class="ag-btn ag-primary ag-wide">Sign in</button>
        </template>
      </div>

      <p class="ag-caption">
        Sign-in window — <strong>already HTML</strong>, rendered by WebView2.
        These are the portal’s components at agent width.
      </p>
    </div>

    <!-- ======================================================== tray -->
    <template v-else-if="isTray">
      <div class="ag-tray">
        <header class="ag-trayh" :class="'is-' + step">
          <span class="ag-dot" />
          <span class="ag-trayst">
            <strong>
              {{ step === 'connected' ? 'Connected'
                : step === 'connecting' ? 'Connecting…' : 'Not connected' }}
            </strong>
            <small>
              <template v-if="step === 'connected'">veno · 12 minutes · 10.130.9.3</template>
              <template v-else-if="step === 'connecting'">Checking this device…</template>
              <template v-else>The connection dropped at 15:21</template>
            </small>
          </span>
        </header>

        <!-- A dropped connection is the commonest support call for any VPN
             client, and today it has no surface at all. -->
        <div v-if="step === 'dropped'" class="ag-trayerr">
          Your network changed. InstaSafe will keep trying.
        </div>

        <ul class="ag-traymenu">
          <li v-if="step === 'connected'"><i class="fa-solid fa-power-off" aria-hidden="true" />Disconnect</li>
          <li v-else-if="step === 'dropped'" class="is-primary"><i class="fa-solid fa-rotate" aria-hidden="true" />Reconnect now</li>
          <li v-else class="is-dim"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />Cancel</li>
          <li><i class="fa-solid fa-grip" aria-hidden="true" />My applications<i class="fa-solid fa-chevron-right c" aria-hidden="true" /></li>
          <li><i class="fa-solid fa-gear" aria-hidden="true" />Settings<i class="fa-solid fa-chevron-right c" aria-hidden="true" /></li>
          <li><i class="fa-solid fa-life-ring" aria-hidden="true" />Help and diagnostics<i class="fa-solid fa-chevron-right c" aria-hidden="true" /></li>
        </ul>
      </div>

      <!-- The toast, with the product's own name and actions on it. -->
      <div class="ag-toast" :class="'is-' + step">
        <span class="ag-toastico"><i class="fa-solid fa-shield-halved" aria-hidden="true" /></span>
        <div class="ag-toastb">
          <strong>InstaSafe</strong>
          <p v-if="step === 'connected'">You’re connected. Company applications are available.</p>
          <p v-else-if="step === 'connecting'">Connecting to veno…</p>
          <p v-else>Connection lost. Retrying automatically.</p>
          <div v-if="step !== 'connecting'" class="ag-toasta">
            <button class="ag-btn ag-tiny">{{ step === 'connected' ? 'Open' : 'Retry now' }}</button>
            <button class="ag-btn ag-tiny ag-ghost">{{ step === 'connected' ? 'Disconnect' : 'Get help' }}</button>
          </div>
        </div>
      </div>

      <p class="ag-caption ag-traycap">
        Tray panel and notification — native. The panel replaces a four-item
        menu that never says whether you are connected.
      </p>
    </template>

    <!-- the taskbar, so everything above is seen at its real size -->
    <div class="ag-taskbar">
      <span class="ag-start" aria-hidden="true" />
      <span class="ag-trayzone">
        <i class="fa-solid fa-shield-halved ag-trayicon" :class="{ 'is-on': step === 'connected', 'is-bad': step === 'dropped' }" aria-hidden="true" />
        <span class="ag-clock">15:21</span>
      </span>
    </div>
  </div>
</template>
