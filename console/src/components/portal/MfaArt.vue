<script setup>
/**
 * One drawing per factor, and each one draws the mechanism.
 *
 * Not decoration. The thing people never learn about multi-factor
 * authentication is *why* the six differ, and a sentence does not carry it —
 * "phishing-resistant" means nothing to somebody who has never seen what gets
 * phished. So each drawing animates the step that matters:
 *
 *  - TOTP: a code rolling over on a clock, with no wire to anywhere. That is
 *    the point of it — nothing is sent, so nothing can be intercepted.
 *  - Authenticator: a request travelling to a phone and an answer coming
 *    back. The round trip is the method.
 *  - SMS: the same code crossing a network, with a point where it can be
 *    lifted. The weakness is a picture, not a caveat.
 *  - E-mail: a code sitting in a mailbox, which is as safe as the mailbox.
 *  - Hardware key: a challenge going out, a signature coming back, and the
 *    origin check refusing a lookalike site.
 *  - Backup code: ten codes, one being crossed off for good.
 *
 * SVG and CSS keyframes, no library. Everything stops under
 * `prefers-reduced-motion`.
 */
defineProps({ method: { type: String, default: '' } })
</script>

<template>
  <div class="a-wrap" :key="method">
    <!-- ------------------------------------------------------ TOTP -->
    <svg v-if="method === 'totp'" viewBox="0 0 220 150" class="a-svg" role="img"
         aria-label="A code changing on a phone, with nothing sent over any network">
      <rect x="78" y="18" width="64" height="114" rx="10" class="a-body" />
      <rect x="84" y="30" width="52" height="86" rx="5" class="a-screen" />
      <text x="110" y="66" class="a-code a-roll1">418 302</text>
      <text x="110" y="66" class="a-code a-roll2">925 147</text>
      <circle cx="110" cy="92" r="13" class="a-ring" />
      <circle cx="110" cy="92" r="13" class="a-ringfill" />
      <!-- the absent wire: deliberately an open gap on both sides -->
      <path d="M8 75 H60" class="a-dash" />
      <path d="M160 75 H212" class="a-dash" />
      <text x="34" y="66" class="a-tag">no network</text>
      <text x="186" y="66" class="a-tag">no network</text>
    </svg>

    <!-- --------------------------------------------- authenticator -->
    <svg v-else-if="method === 'push'" viewBox="0 0 220 150" class="a-svg" role="img"
         aria-label="A sign-in request travelling to a phone and an approval returning">
      <rect x="10" y="44" width="62" height="46" rx="6" class="a-body" />
      <rect x="16" y="50" width="50" height="30" rx="3" class="a-screen" />
      <rect x="150" y="26" width="58" height="98" rx="9" class="a-body" />
      <rect x="156" y="38" width="46" height="72" rx="4" class="a-screen" />
      <path d="M78 62 H144" class="a-wire" />
      <circle r="4" class="a-pulse"><animateMotion dur="1.9s" repeatCount="indefinite" path="M78 62 H144" /></circle>
      <path d="M144 98 H78" class="a-wire a-back" />
      <circle r="4" class="a-pulse a-ok"><animateMotion dur="1.9s" begin="0.95s" repeatCount="indefinite" path="M144 98 H78" /></circle>
      <text x="111" y="54" class="a-tag">request</text>
      <text x="111" y="116" class="a-tag">you approve</text>
      <path d="M170 68 l8 9 l16 -18" class="a-tick" />
    </svg>

    <!-- ------------------------------------------------------- SMS -->
    <svg v-else-if="method === 'sms'" viewBox="0 0 220 150" class="a-svg" role="img"
         aria-label="A code crossing a mobile network, where it can be intercepted">
      <rect x="10" y="48" width="56" height="42" rx="6" class="a-body" />
      <rect x="156" y="30" width="54" height="90" rx="9" class="a-body" />
      <rect x="162" y="42" width="42" height="66" rx="4" class="a-screen" />
      <text x="183" y="80" class="a-codesm">418302</text>
      <path d="M72 69 H150" class="a-wire" />
      <circle r="4" class="a-pulse"><animateMotion dur="2.1s" repeatCount="indefinite" path="M72 69 H150" /></circle>
      <!-- where it can be lifted: the whole reason this one is last -->
      <g class="a-risk">
        <path d="M111 69 v-26" class="a-riskline" />
        <circle cx="111" cy="34" r="12" class="a-riskdot" />
        <text x="111" y="39" class="a-riskmark">!</text>
      </g>
      <text x="111" y="110" class="a-tag">a SIM can be swapped</text>
    </svg>

    <!-- ----------------------------------------------------- e-mail -->
    <svg v-else-if="method === 'email'" viewBox="0 0 220 150" class="a-svg" role="img"
         aria-label="A code arriving in a mailbox">
      <!-- The flap used to run straight through the code, which made the
           one thing the drawing is about unreadable. The envelope is open
           now and the code sits above its mouth rather than behind it. -->
      <rect x="62" y="56" width="96" height="50" rx="8" class="a-body" />
      <path d="M62 56 L110 86 L158 56" class="a-flap" />
      <rect x="80" y="22" width="60" height="26" rx="5" class="a-screen a-pop" />
      <text x="110" y="40" class="a-codesm">418302</text>
      <path d="M14 73 H56" class="a-wire" />
      <circle r="4" class="a-pulse"><animateMotion dur="2s" repeatCount="indefinite" path="M14 73 H56" /></circle>
      <text x="110" y="126" class="a-tag">as safe as the mailbox</text>
    </svg>

    <!-- ----------------------------------------------- hardware key -->
    <svg v-else-if="method === 'key'" viewBox="0 0 220 150" class="a-svg" role="img"
         aria-label="A challenge signed by a key, and a lookalike site refused">
      <rect x="10" y="50" width="62" height="46" rx="6" class="a-body" />
      <rect x="16" y="56" width="50" height="30" rx="3" class="a-screen" />
      <g class="a-key">
        <rect x="150" y="60" width="58" height="26" rx="13" class="a-body" />
        <circle cx="166" cy="73" r="7" class="a-keyeye" />
        <rect x="178" y="70" width="24" height="6" rx="3" class="a-keybit" />
      </g>
      <path d="M78 63 H144" class="a-wire" />
      <circle r="4" class="a-pulse"><animateMotion dur="1.8s" repeatCount="indefinite" path="M78 63 H144" /></circle>
      <path d="M144 86 H78" class="a-wire a-back" />
      <circle r="4" class="a-pulse a-ok"><animateMotion dur="1.8s" begin="0.9s" repeatCount="indefinite" path="M144 86 H78" /></circle>
      <text x="111" y="55" class="a-tag">challenge</text>
      <text x="111" y="104" class="a-tag">signed, and bound to this site</text>
      <g class="a-refuse">
        <circle cx="41" cy="118" r="11" class="a-riskdot" />
        <path d="M36 113 l10 10 M46 113 l-10 10" class="a-cross" />
        <text x="41" y="142" class="a-tag">fake site</text>
      </g>
    </svg>

    <!-- ----------------------------------------------- backup codes -->
    <svg v-else-if="method === 'backup'" viewBox="0 0 220 150" class="a-svg" role="img"
         aria-label="Ten one-time codes, one being used up">
      <rect x="54" y="20" width="112" height="112" rx="9" class="a-body" />
      <g class="a-list">
        <template v-for="n in 5" :key="n">
          <rect x="70" :y="14 + n * 19" width="52" height="7" rx="3.5" class="a-line" />
          <rect x="128" :y="14 + n * 19" width="24" height="7" rx="3.5" class="a-line a-dim" />
        </template>
      </g>
      <path d="M66 52 H158" class="a-strike" />
      <text x="110" y="144" class="a-tag">each one works once</text>
    </svg>

    <!-- ----------------------------------------------- nothing picked -->
    <svg v-else viewBox="0 0 220 150" class="a-svg" role="img"
         aria-label="A password plus a second factor">
      <rect x="18" y="56" width="74" height="38" rx="8" class="a-body" />
      <text x="55" y="80" class="a-codesm">••••••••</text>
      <text x="55" y="110" class="a-tag">something you know</text>
      <text x="110" y="82" class="a-plus">+</text>
      <rect x="128" y="46" width="74" height="58" rx="8" class="a-body a-breathe" />
      <circle cx="165" cy="70" r="11" class="a-ring" />
      <path d="M159 70 l5 6 l11 -13" class="a-tick" />
      <text x="165" y="96" class="a-codesm" style="font-size:8px">verified</text>
      <text x="165" y="118" class="a-tag">something you have</text>
    </svg>
  </div>
</template>
