<script setup>
/**
 * Pip — the guide.
 *
 * **Why it has no legs.** A walk cycle is four moving parts that only ever
 * read at one size, and it pins the character to a floor. Pip hovers instead:
 * one float loop serves every state, it can be anywhere on the screen without
 * looking like it is standing on nothing, and travelling across the page is a
 * translate rather than a gait. The shadow underneath is what sells the
 * height, so it is a separate element that never moves with the body — it
 * only shrinks and fades as Pip rises, and returns to full size on landing.
 *
 * **Why it looks like this.** The head is a visor: one dark shape with two
 * bright eyes, which reads as a face at 34px where a mouth and a nose do not.
 * The antenna's bead and the broken ring behind it are the mark's orange and
 * the mark's geometry, so Pip belongs to the product without being the logo
 * with eyes drawn on — which is the thing brand guidelines exist to prevent.
 *
 * **Why it turns.** A guide that points at something across the room while
 * facing you is not pointing. `facing` slides the visor and the arms toward
 * the side it is looking at and drops the far eye, and `left` is the same
 * drawing mirrored — one profile, not two.
 *
 * All motion is CSS on grouped elements, so nothing re-renders, and all of it
 * stops under `prefers-reduced-motion`: a character that bobs for ever is not
 * charming there, it is an accessibility failure.
 */

import { computed } from 'vue'

const props = defineProps({
  /** idle · point · travel · jump · think · cheer · sleep · poke */
  state: { type: String, default: 'idle' },
  /** front · left · right */
  facing: { type: String, default: 'front' },
  size: { type: Number, default: 96 }
})

const side = computed(() => props.facing !== 'front')
</script>

<template>
  <svg
    class="pip"
    :class="['is-' + state, side ? 'is-side' : 'is-front', 'face-' + facing]"
    :width="size" :height="size" viewBox="0 0 120 120"
    role="img" aria-label="Pip, the guide"
  >
    <!-- The shadow is outside the floating group on purpose: it is on the
         ground, and the whole trick of a hover is that the body moves and
         this does not. -->
    <ellipse class="pip-shadow" cx="60" cy="112" rx="19" ry="5" />

    <g class="pip-float">
      <!-- The mark's broken ring, behind everything and slowly turning. It
           sits just outside the helmet so it reads as a halo rather than
           cutting across the face. -->
      <g class="pip-orbit">
        <circle
          cx="60" cy="45" r="34" fill="none" stroke="#F06823" stroke-width="3.5"
          stroke-linecap="round" stroke-dasharray="42 28 15 34"
        />
      </g>

      <!-- Arms, drawn before the body so the body's outline covers where
           they join it. Set far enough in that they touch the torso: at a
           distance they read as two detached blobs beside the character. -->
      <g class="pip-arms">
        <rect class="pip-arm l" x="39" y="63" width="9" height="20" rx="4.5" />
        <rect class="pip-arm r" x="72" y="63" width="9" height="20" rx="4.5" />
      </g>

      <!-- the body: small, and clearly under the head rather than beside it -->
      <rect class="pip-torso" x="47" y="66" width="26" height="26" rx="11" />

      <!-- antenna -->
      <g class="pip-antenna">
        <path d="M60 18 V9" stroke="#652C8F" stroke-width="3.6" stroke-linecap="round" fill="none" />
        <circle cx="60" cy="6" r="4.6" fill="#F06823" />
      </g>

      <!-- the discs at the sides of the helmet, as the reference has -->
      <g class="pip-ears">
        <circle class="pip-ear l" cx="31" cy="44" r="6.5" />
        <circle class="pip-ear r" cx="89" cy="44" r="6.5" />
      </g>

      <!-- the helmet -->
      <rect class="pip-head" x="33" y="17" width="54" height="52" rx="23" />

      <!-- The face. One group, so turning is a single translate.
           Each eye is wrapped: the wrapper carries the turn, the ellipse
           carries the blink. One element cannot do both, because the blink is
           an animation on `transform` and would wipe the turn every frame. -->
      <g class="pip-face">
        <rect class="pip-visor" x="42" y="29" width="36" height="26" rx="12" />
        <g class="pip-eyewrap l"><ellipse class="pip-eye l" cx="52" cy="42" rx="4.8" ry="6.2" /></g>
        <g class="pip-eyewrap r"><ellipse class="pip-eye r" cx="68" cy="42" rx="4.8" ry="6.2" /></g>
        <!-- a highlight, so the visor reads as glass rather than a hole -->
        <ellipse class="pip-gleam" cx="50" cy="34" rx="5.5" ry="2.4" />
      </g>
    </g>

    <!-- thinking: three dots that climb -->
    <g class="pip-think">
      <circle cx="94" cy="26" r="2.8" />
      <circle cx="102" cy="18" r="3.8" />
      <circle cx="111" cy="9" r="4.8" />
    </g>
  </svg>
</template>

<style scoped>
.pip {
  --pip-shell: #ffffff;
  --pip-edge: #652c8f;
  --pip-visor: #3b2258;
  --pip-eye: #8ad2ff;
  --pip-limb: #b8a6d6;
  --pip-shadow: rgba(26, 20, 44, .18);
  display: block;
  overflow: visible;
}
/* No `:global()` here. With a descendant after it the SFC compiler drops the
   descendant entirely, so these would land on the document element and the
   block above would override every one of them. */
html[data-i-theme='dark'] .pip,
html[data-p-theme='dark'] .pip {
  --pip-shell: #2a2340;
  --pip-edge: #a98fd4;
  --pip-visor: #120e1c;
  --pip-eye: #7fc6ff;
  --pip-limb: #5a4a7d;
  --pip-shadow: rgba(0, 0, 0, .42);
}

.pip-head {
  fill: var(--pip-shell);
  stroke: var(--pip-edge);
  stroke-width: 3.5;
}
.pip-torso { fill: var(--pip-shell); stroke: var(--pip-edge); stroke-width: 3.5; }
.pip-ear { fill: var(--pip-limb); }
.pip-visor { fill: var(--pip-visor); }
.pip-eye { fill: var(--pip-eye); }
.pip-gleam { fill: #fff; opacity: .16; }
.pip-arm { fill: var(--pip-limb); }
.pip-shadow { fill: var(--pip-shadow); }
.pip-think { fill: var(--pip-edge); opacity: 0; }

/* ----------------------------------------------------------------- turn */
/* One profile, mirrored. Facing left is the right-facing drawing flipped,
   which is half the geometry and cannot drift out of sync with itself. */
.pip.face-left { transform: scaleX(-1); }

.pip-face { transition: transform .28s cubic-bezier(.2, .8, .3, 1); }
.pip.is-side .pip-face { transform: translateX(4px); }

/* Both eyes stay in profile.
 *
 * Dropping the far one gives a true side view and loses the character: two
 * eyes are most of what makes this read as a face at 34px. So it is a
 * three-quarter turn instead — the far eye narrows and slides toward the edge
 * of the visor, the near one barely moves — which is how an illustrated
 * character turns without becoming a different drawing.
 *
 * The transform lives on the wrapper because the ellipse's own `transform` is
 * already spoken for by the blink. */
.pip-eyewrap { transition: transform .28s cubic-bezier(.2, .8, .3, 1); }
.pip-eyewrap.l { transform-origin: 52px 42px; }
.pip-eyewrap.r { transform-origin: 68px 42px; }
.pip.is-side .pip-eyewrap.l { transform: translateX(3px) scaleX(.52); }
.pip.is-side .pip-eyewrap.r { transform: translateX(-2px) scaleX(1.02); }

.pip.is-side .pip-gleam { opacity: .08; }
/* The far disc shrinks rather than vanishing, for the same reason. */
.pip.is-side .pip-ear.r { transform: scale(.7); opacity: .75; }
.pip.is-side .pip-ear.l { transform: translateX(4px); }
.pip.is-side .pip-arm.l { opacity: .62; }
.pip-ear.l { transform-origin: 31px 44px; }
.pip-ear.r { transform-origin: 89px 44px; }
.pip-ear, .pip-arm, .pip-gleam {
  transition: opacity .25s ease, transform .28s cubic-bezier(.2, .8, .3, 1);
}

/* --------------------------------------------------------------- motion */
.pip-float { transform-origin: 60px 70px; }
.pip-arm.l { transform-origin: 37.5px 68px; }   /* the shoulder, not the hand */
.pip-arm.r { transform-origin: 82.5px 68px; }
.pip-antenna { transform-origin: 60px 20px; }
.pip-orbit { transform-origin: 60px 45px; animation: pip-spin 16s linear infinite; }
@keyframes pip-spin { to { transform: rotate(360deg); } }

/* The hover. One loop, every state, because a character that is utterly
   still reads as a broken image. */
@keyframes pip-hover {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-5px); }
}
.pip-float { animation: pip-hover 3.4s ease-in-out infinite; }

/* The shadow breathes against the hover, never with it. */
@keyframes pip-hover-shadow {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(.88); opacity: .72; }
}
.pip-shadow { transform-origin: 60px 112px; animation: pip-hover-shadow 3.4s ease-in-out infinite; }

/* Blinking, off-rhythm from the hover so the two never sync into a tic. */
@keyframes pip-blink {
  0%, 93%, 100% { transform: scaleY(1); }
  96%           { transform: scaleY(.08); }
}
.pip-eye { transform-origin: 60px 42px; animation: pip-blink 5.3s infinite; }

/* idle — the antenna sways, as if waiting without minding. */
.is-idle .pip-antenna { animation: pip-sway 4.2s ease-in-out infinite; }
@keyframes pip-sway {
  0%, 100% { transform: rotate(-6deg); }
  50%      { transform: rotate(6deg); }
}

/* point — the near arm up and held. */
.is-point .pip-arm.r { animation: pip-point 1.7s ease-in-out infinite; }
@keyframes pip-point {
  0%, 100% { transform: rotate(-120deg) translateY(2px); }
  50%      { transform: rotate(-132deg) translateY(0); }
}

/* travel — leaning into the direction of movement, arms trailing. The
   translation itself belongs to whatever is carrying Pip across the page;
   this is only the attitude. */
.is-travel .pip-float { animation: pip-hover 1.1s ease-in-out infinite; }
.is-travel .pip-head, .is-travel .pip-torso, .is-travel .pip-face { transform-box: fill-box; }
.is-travel .pip-arm.r { transform: rotate(32deg); }
.is-travel .pip-arm.l { transform: rotate(26deg); }
.is-travel .pip-shadow { animation: pip-hover-shadow 1.1s ease-in-out infinite; }

/* jump — the shadow shrinks as Pip rises and is full again the moment it
   lands. That contrast is the entire reason a jump reads as a jump. */
.is-jump .pip-float { animation: pip-jump 980ms cubic-bezier(.3, .7, .3, 1) infinite; }
.is-jump .pip-arm.l { transform: rotate(148deg); }
.is-jump .pip-arm.r { transform: rotate(-148deg); }
.is-jump .pip-shadow { animation: pip-jump-shadow 980ms cubic-bezier(.3, .7, .3, 1) infinite; }
@keyframes pip-jump {
  0%, 100% { transform: translateY(0) scaleY(1); }
  14%      { transform: translateY(5px) scaleY(.9); }   /* the crouch */
  48%      { transform: translateY(-30px) scaleY(1.05); }
  80%      { transform: translateY(3px) scaleY(.94); }  /* the landing */
}
@keyframes pip-jump-shadow {
  0%, 100% { transform: scale(1);   opacity: 1; }
  14%      { transform: scale(1.1); opacity: 1; }
  48%      { transform: scale(.42); opacity: .34; }
  80%      { transform: scale(1.08); opacity: 1; }
}

/* cheer — both arms up, a quick hop, the antenna flicking. */
.is-cheer .pip-float { animation: pip-cheer 640ms ease-in-out infinite; }
.is-cheer .pip-arm.l { transform: rotate(158deg); }
.is-cheer .pip-arm.r { transform: rotate(-158deg); }
.is-cheer .pip-antenna { animation: pip-flick 640ms ease-in-out infinite; }
.is-cheer .pip-shadow { animation: pip-jump-shadow 640ms ease-in-out infinite; }
@keyframes pip-cheer {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-13px); }
}
@keyframes pip-flick {
  0%, 100% { transform: rotate(-16deg); }
  50%      { transform: rotate(16deg); }
}

/* poke — what happens when you click it: a startle, then settle. */
.is-poke .pip-float { animation: pip-poke 620ms cubic-bezier(.3, 1.4, .4, 1); }
.is-poke .pip-eye { transform: scaleY(1.22); }
.is-poke .pip-antenna { animation: pip-flick 300ms ease-in-out 2; }
@keyframes pip-poke {
  0%   { transform: translateY(0) rotate(0); }
  25%  { transform: translateY(-11px) rotate(-7deg); }
  55%  { transform: translateY(-3px) rotate(5deg); }
  100% { transform: translateY(0) rotate(0); }
}

/* think — dots climb, the visible eye narrows. */
.is-think .pip-think { animation: pip-dots 1.6s ease-in-out infinite; opacity: 1; }
.is-think .pip-eyewrap.r { transform: scaleY(.6); }
@keyframes pip-dots {
  0%        { opacity: 0; }
  30%       { opacity: .4; }
  60%, 100% { opacity: 1; }
}

/* sleep — eyes shut, antenna drooped, barely moving. */
.is-sleep .pip-eye { animation: none; transform: scaleY(.07); }
.is-sleep .pip-antenna { transform: rotate(28deg); }
.is-sleep .pip-float { animation: pip-hover 6s ease-in-out infinite; }
.is-sleep .pip-shadow { animation: pip-hover-shadow 6s ease-in-out infinite; }
.is-sleep .pip-orbit { animation-duration: 48s; opacity: .45; }

@media (prefers-reduced-motion: reduce) {
  .pip *, .pip { animation: none !important; transition: none !important; }
  .pip-float { animation: pip-hover 7s ease-in-out infinite !important; }
}
</style>
