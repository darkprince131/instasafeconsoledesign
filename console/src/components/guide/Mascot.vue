<script setup>
/**
 * Pip — the guide.
 *
 * A drawn character rather than an illustration pasted in, for the same
 * reason the agent parses the brand mark instead of shipping a PNG: it has to
 * work at 40px in a corner and at 160px on an empty state, in light and dark,
 * and a bitmap only works at the size it was exported.
 *
 * **Why it looks like this.** It is built out of the mark's own parts — a
 * purple sphere for a head, an orange broken ring orbiting it — so it belongs
 * to the product without being the product's logo. A mascot that *is* the
 * logo with eyes drawn on is the thing brand guidelines exist to prevent;
 * this is a separate character that happens to be made of the same two
 * shapes. Everything else is a rounded rectangle, because the simplest
 * possible body is the one that still reads at 40px.
 *
 * **Why it moves.** The states are the ones a guide actually needs: it sits
 * while you read, points at the thing it just mentioned, runs when it is
 * taking you somewhere, jumps when you finish, and sleeps when dismissed.
 * Motion is CSS on grouped `<g>` elements, so nothing re-renders — and all of
 * it stops under `prefers-reduced-motion`, where a character that bounces for
 * ever is not charming, it is an accessibility failure.
 */

defineProps({
  /** idle · point · walk · run · jump · think · cheer · sleep */
  state: { type: String, default: 'idle' },
  size: { type: Number, default: 96 },
  /** Face the other way — for when it is on the left of what it points at. */
  flip: { type: Boolean, default: false }
})
</script>

<template>
  <svg
    class="pip" :class="['is-' + state, { 'is-flip': flip }]"
    :width="size" :height="size" viewBox="0 0 120 120"
    role="img" aria-label="Pip, the guide"
  >
    <!-- the orbit: the mark's broken ring, kept behind the character -->
    <g class="pip-orbit">
      <circle
        cx="60" cy="52" r="34" fill="none" stroke="#F06823" stroke-width="4"
        stroke-linecap="round" stroke-dasharray="46 26 18 34"
      />
    </g>

    <!-- the shadow, which is what tells you it left the ground -->
    <ellipse class="pip-shadow" cx="60" cy="110" rx="22" ry="5" />

    <g class="pip-body">
      <!-- legs -->
      <g class="pip-legs">
        <rect class="pip-leg l" x="46" y="92" width="9" height="16" rx="4.5" />
        <rect class="pip-leg r" x="65" y="92" width="9" height="16" rx="4.5" />
      </g>

      <!-- arms -->
      <g class="pip-arms">
        <rect class="pip-arm l" x="24" y="62" width="9" height="26" rx="4.5" />
        <rect class="pip-arm r" x="87" y="62" width="9" height="26" rx="4.5" />
      </g>

      <!-- antenna -->
      <g class="pip-antenna">
        <path d="M60 30 V20" stroke="#652C8F" stroke-width="4" stroke-linecap="round" fill="none" />
        <circle cx="60" cy="16" r="5" fill="#F06823" />
      </g>

      <!-- head -->
      <rect class="pip-head" x="30" y="28" width="60" height="56" rx="20" />

      <!-- the visor: one dark shape, so two dots read as a face -->
      <rect class="pip-visor" x="38" y="40" width="44" height="30" rx="14" />

      <g class="pip-eyes">
        <ellipse class="pip-eye l" cx="51" cy="55" rx="5" ry="6.5" />
        <ellipse class="pip-eye r" cx="69" cy="55" rx="5" ry="6.5" />
      </g>

      <!-- a mouth only when it is worth having one -->
      <path
        class="pip-smile" d="M53 76 q7 6 14 0"
        fill="none" stroke="#652C8F" stroke-width="3" stroke-linecap="round"
      />
    </g>

    <!-- thinking: three dots that climb -->
    <g class="pip-think">
      <circle cx="96" cy="34" r="3" />
      <circle cx="104" cy="26" r="4" />
      <circle cx="113" cy="17" r="5" />
    </g>
  </svg>
</template>

<style scoped>
/* The character's own tokens, so one line changes it everywhere and the dark
   theme is a redefinition rather than a second copy of every rule. */
.pip {
  --pip-shell: #ffffff;
  --pip-edge: #652c8f;
  --pip-visor: #652c8f;
  --pip-eye: #ffffff;
  --pip-limb: #b8a6d6;
  --pip-shadow: rgba(26, 20, 44, .16);
  display: block;
  overflow: visible;
}
:global(html[data-i-theme='dark']) .pip,
:global(html[data-p-theme='dark']) .pip {
  --pip-shell: #221d33;
  --pip-edge: #a98fd4;
  --pip-visor: #15111f;
  --pip-eye: #cdb8f0;
  --pip-limb: #5a4a7d;
  --pip-shadow: rgba(0, 0, 0, .4);
}
.pip.is-flip { transform: scaleX(-1); }

.pip-head {
  fill: var(--pip-shell);
  stroke: var(--pip-edge);
  stroke-width: 3.5;
}
.pip-visor { fill: var(--pip-visor); }
.pip-eye { fill: var(--pip-eye); }
.pip-leg, .pip-arm { fill: var(--pip-limb); }
.pip-shadow { fill: var(--pip-shadow); }
.pip-smile { opacity: 0; }
.pip-think { fill: var(--pip-edge); opacity: 0; }

/* ---------------------------------------------------------------- motion */
/* Transform origins are set per part, because a limb that rotates about the
   middle of the viewBox swings like a clock hand instead of a shoulder. */
.pip-body { transform-origin: 60px 100px; }
.pip-arm.l { transform-origin: 28px 66px; }
.pip-arm.r { transform-origin: 91px 66px; }
.pip-leg.l { transform-origin: 50px 94px; }
.pip-leg.r { transform-origin: 69px 94px; }
.pip-antenna { transform-origin: 60px 32px; }
.pip-orbit { transform-origin: 60px 52px; animation: pip-spin 14s linear infinite; }

@keyframes pip-spin { to { transform: rotate(360deg); } }

/* Breathing. Always on, in every state, because a character that is utterly
   still reads as a broken image. */
@keyframes pip-breathe {
  0%, 100% { transform: translateY(0) scaleY(1); }
  50%      { transform: translateY(-2px) scaleY(1.015); }
}
.pip-body { animation: pip-breathe 3.6s ease-in-out infinite; }

/* Blinking, off-rhythm from the breathing so the two never sync into a tic. */
@keyframes pip-blink {
  0%, 92%, 100% { transform: scaleY(1); }
  95%           { transform: scaleY(.1); }
}
.pip-eyes { transform-origin: 60px 55px; animation: pip-blink 5.1s infinite; }

/* idle — a slow sway, as if waiting without minding. */
.is-idle .pip-antenna { animation: pip-sway 4s ease-in-out infinite; }
@keyframes pip-sway {
  0%, 100% { transform: rotate(-5deg); }
  50%      { transform: rotate(5deg); }
}

/* point — one arm up and held, the other still. The arm that points is the
   right one, and `flip` turns the whole character when the target is left. */
.is-point .pip-arm.r { animation: pip-point 1.6s ease-in-out infinite; }
@keyframes pip-point {
  0%, 100% { transform: rotate(-128deg) translateY(2px); }
  50%      { transform: rotate(-138deg) translateY(0); }
}
.is-point .pip-smile { opacity: 1; }

/* walk — legs alternate, body bobs on the step. */
.is-walk .pip-leg.l, .is-run .pip-leg.l { animation: pip-step 760ms ease-in-out infinite; }
.is-walk .pip-leg.r, .is-run .pip-leg.r { animation: pip-step 760ms ease-in-out infinite reverse; }
.is-walk .pip-arm.l, .is-run .pip-arm.l { animation: pip-swing 760ms ease-in-out infinite reverse; }
.is-walk .pip-arm.r, .is-run .pip-arm.r { animation: pip-swing 760ms ease-in-out infinite; }
.is-walk .pip-body { animation: pip-bob 380ms ease-in-out infinite; }
@keyframes pip-step {
  0%, 100% { transform: rotate(24deg); }
  50%      { transform: rotate(-24deg); }
}
@keyframes pip-swing {
  0%, 100% { transform: rotate(18deg); }
  50%      { transform: rotate(-18deg); }
}
@keyframes pip-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-2.5px); }
}

/* run — the same cycle, faster and leaning, with the shadow tightening. */
.is-run .pip-leg.l, .is-run .pip-leg.r,
.is-run .pip-arm.l, .is-run .pip-arm.r { animation-duration: 340ms; }
.is-run .pip-body { animation: pip-lean 340ms ease-in-out infinite; }
.is-run .pip-smile { opacity: 1; }
@keyframes pip-lean {
  0%, 100% { transform: translateY(0) rotate(7deg); }
  50%      { transform: translateY(-4px) rotate(7deg); }
}
.is-run .pip-shadow { animation: pip-shadow 340ms ease-in-out infinite; }

/* jump — the shadow shrinks as it rises, which is the whole trick. */
.is-jump .pip-body { animation: pip-jump 900ms cubic-bezier(.3, .7, .3, 1) infinite; }
.is-jump .pip-arm.l { transform: rotate(150deg); }
.is-jump .pip-arm.r { transform: rotate(-150deg); }
.is-jump .pip-shadow { animation: pip-shadow 900ms ease-in-out infinite; }
.is-jump .pip-smile { opacity: 1; }
@keyframes pip-jump {
  0%, 100% { transform: translateY(0) scaleY(1); }
  18%      { transform: translateY(4px) scaleY(.92); }
  50%      { transform: translateY(-22px) scaleY(1.04); }
  82%      { transform: translateY(2px) scaleY(.96); }
}
@keyframes pip-shadow {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(.6); opacity: .5; }
}

/* cheer — both arms up, a small hop, the antenna flicking. */
.is-cheer .pip-body { animation: pip-hop 620ms ease-in-out infinite; }
.is-cheer .pip-arm.l { transform: rotate(160deg); }
.is-cheer .pip-arm.r { transform: rotate(-160deg); }
.is-cheer .pip-antenna { animation: pip-flick 620ms ease-in-out infinite; }
.is-cheer .pip-smile { opacity: 1; }
@keyframes pip-hop {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-9px); }
}
@keyframes pip-flick {
  0%, 100% { transform: rotate(-14deg); }
  50%      { transform: rotate(14deg); }
}

/* think — dots climb, one eye narrows. */
.is-think .pip-think { animation: pip-dots 1.5s ease-in-out infinite; opacity: 1; }
.is-think .pip-eye.r { transform: scaleY(.55); transform-origin: 69px 55px; }
@keyframes pip-dots {
  0%        { opacity: 0; }
  30%       { opacity: .4; }
  60%, 100% { opacity: 1; }
}

/* sleep — eyes closed, antenna drooped, nothing else moving. */
.is-sleep .pip-eyes { animation: none; transform: scaleY(.08); transform-origin: 60px 55px; }
.is-sleep .pip-antenna { transform: rotate(26deg); }
.is-sleep .pip-body { animation: pip-breathe 5.5s ease-in-out infinite; }
.is-sleep .pip-orbit { animation-duration: 40s; opacity: .5; }

/* Everything above is decoration. Someone who has asked their system to stop
   animating things means it, so the character holds still and keeps only the
   breath — without which it reads as a broken image rather than a calm one. */
@media (prefers-reduced-motion: reduce) {
  .pip *, .pip { animation: none !important; }
  .pip-body { animation: pip-breathe 6s ease-in-out infinite !important; }
}
</style>
