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
 * facing you is not pointing. `facing` compresses the face toward the side it
 * is looking at, and `left` is the same drawing mirrored — one profile to
 * keep in sync rather than two. Both eyes stay: dropping the far one is a
 * truer side view and loses the character, because two eyes are most of what
 * makes this read as a face at 34px. They narrow together, equally, which is
 * what a turning face does — an eye that keeps its width while its partner
 * shrinks reads as a squint, not a turn.
 *
 * **Why the eyes have a vocabulary.** A face with one expression is a logo.
 * `expression` swaps the eye shape — open, the arcs of `^ ^`, the flat dashes
 * of `- -`, the pinch of `> <`, a wide stare, a sleepy `~` — and the blink
 * loop runs under all of them, singly and occasionally twice, because a blink
 * that arrives on a metronome is the one thing that makes a face look dead.
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
  /**
   * open · happy · flat · squint · wide · sleepy · wink
   * Left unset it follows the state, which is right nearly always; pass it
   * to override, for a reaction the pose does not imply.
   */
  expression: { type: String, default: '' },
  size: { type: Number, default: 96 }
})

const side = computed(() => props.facing !== 'front')

/** What each pose does with its face when nothing else is asked for. */
const FOR_STATE = {
  jump: 'happy',
  cheer: 'happy',
  poke: 'wide',
  think: 'squint',
  sleep: 'sleepy',
  travel: 'flat'
}
const eyes = computed(() => props.expression || FOR_STATE[props.state] || 'open')
</script>

<template>
  <svg
    class="pip"
    :class="['is-' + state, side ? 'is-side' : 'is-front',
              'face-' + facing, 'eyes-' + eyes]"
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
           they join it. Each is a forearm and a hand: a bare rounded bar has
           nothing to point *with*, and the whole job of this character is
           pointing. The hand is a disc because it survives being 6px across,
           which fingers do not. -->
      <g class="pip-arms">
        <g class="pip-arm l">
          <rect class="pip-limb" x="38" y="62" width="8" height="19" rx="4" />
          <circle class="pip-hand" cx="42" cy="80" r="6.4" />
        </g>
        <g class="pip-arm r">
          <rect class="pip-limb" x="74" y="62" width="8" height="19" rx="4" />
          <circle class="pip-hand" cx="78" cy="80" r="6.4" />
        </g>
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
        <g class="pip-eyewrap l">
          <g class="pip-eye l">
            <ellipse class="pip-pupil" cx="52" cy="42" rx="4.8" ry="6.2" />
            <path class="pip-arc"   d="M46.6 44.4 q5.4 -7 10.8 0" />
            <path class="pip-dash"  d="M47 42.4 h10" />
            <path class="pip-pinch" d="M47 37.4 l9.6 4.6 l-9.6 4.6" />
            <path class="pip-wave"  d="M46.8 42.4 q2.7 -3 5.4 0 q2.7 3 5.4 0" />
          </g>
        </g>
        <g class="pip-eyewrap r">
          <g class="pip-eye r">
            <ellipse class="pip-pupil" cx="68" cy="42" rx="4.8" ry="6.2" />
            <path class="pip-arc"   d="M62.6 44.4 q5.4 -7 10.8 0" />
            <path class="pip-dash"  d="M63 42.4 h10" />
            <path class="pip-pinch" d="M73 37.4 l-9.6 4.6 l9.6 4.6" />
            <path class="pip-wave"  d="M62.8 42.4 q2.7 -3 5.4 0 q2.7 3 5.4 0" />
          </g>
        </g>
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
/* The eye is five shapes stacked; one is shown at a time. Drawing them all
   and switching visibility keeps every expression crisp — a single path
   morphed between these would have to share a point count, and `- -` and
   `> <` do not. */
.pip-pupil { fill: var(--pip-eye); }
.pip-arc, .pip-dash, .pip-pinch, .pip-wave {
  fill: none; stroke: var(--pip-eye); stroke-width: 3.2;
  stroke-linecap: round; stroke-linejoin: round;
}
.pip-arc, .pip-dash, .pip-pinch, .pip-wave { display: none; }

.eyes-happy  .pip-pupil { display: none; }
.eyes-happy  .pip-arc   { display: block; }
.eyes-flat   .pip-pupil { display: none; }
.eyes-flat   .pip-dash  { display: block; }
.eyes-squint .pip-pupil { display: none; }
.eyes-squint .pip-pinch { display: block; }
.eyes-sleepy .pip-pupil { display: none; }
.eyes-sleepy .pip-wave  { display: block; }
.eyes-wide   .pip-pupil { transform: scale(1.22); }
/* A wink is one eye open, one arced — the only expression that is not
   symmetrical, which is exactly why it reads as deliberate. */
.eyes-wink .pip-eye.l .pip-pupil { display: none; }
.eyes-wink .pip-eye.l .pip-arc   { display: block; }

.pip-eye.l .pip-pupil { transform-origin: 52px 42px; }
.pip-eye.r .pip-pupil { transform-origin: 68px 42px; }
.pip-gleam { fill: #fff; opacity: .16; }
/* Forearm and hand overlap and share one flat fill, with no stroke on
   either. Outlining them separately drew a seam straight across the wrist,
   which read as two parts rather than one limb — and the ear discs are flat
   for the same reason, so the character stays consistent about it. */
.pip-limb, .pip-hand { fill: var(--pip-limb); }
.pip-arm { transition: opacity .25s ease, transform .3s cubic-bezier(.2, .8, .3, 1); }
.pip-shadow { fill: var(--pip-shadow); }
.pip-think { fill: var(--pip-edge); opacity: 0; }

/* ----------------------------------------------------------------- turn */
/* One profile, mirrored. Facing left is the right-facing drawing flipped,
   which is half the geometry and cannot drift out of sync with itself. */
.pip.face-left { transform: scaleX(-1); }

.pip-face { transition: transform .28s cubic-bezier(.2, .8, .3, 1); }
.pip.is-side .pip-face { transform: translateX(4px); }

/* Turning.
 *
 * Both eyes keep the same shape and the same size; they simply get narrower,
 * together, and crowd toward the side Pip is looking at. That is what a face
 * does when it turns — the far side of it foreshortens, both features with
 * it. Narrowing only the far eye reads as a squint, which is an expression,
 * and expressions are the other control's job.
 *
 * The transform lives on the wrapper because the eye's own `transform` is
 * already spoken for by the blink. */
.pip-eyewrap { transition: transform .28s cubic-bezier(.2, .8, .3, 1); }
.pip-eyewrap.l { transform-origin: 52px 42px; }
.pip-eyewrap.r { transform-origin: 68px 42px; }
.pip.is-side .pip-eyewrap.l { transform: translateX(5.5px) scaleX(.74); }
.pip.is-side .pip-eyewrap.r { transform: translateX(1.5px) scaleX(.74); }

.pip.is-side .pip-gleam { opacity: .08; }
/* The far disc shrinks rather than vanishing, for the same reason the far
   eye stays: the silhouette should still be Pip from any angle. */
.pip.is-side .pip-ear.r { transform: scale(.68); opacity: .7; }
.pip.is-side .pip-ear.l { transform: translateX(4px); }
/* The far arm goes quiet and tucks behind the body — it is the one on the
   far side of a turned figure, so it should read as being back there rather
   than as a second arm at full strength. */
.pip.is-side .pip-arm.l { opacity: .34; transform: translateX(10px) scale(.86); }
.pip.is-side .pip-arm.r { transform: translateX(2px); }
.pip-arm.l { transform-origin: 42px 64px; }   /* the shoulder, not the hand */
.pip-arm.r { transform-origin: 78px 64px; }
.pip-ear.l { transform-origin: 31px 44px; }
.pip-ear.r { transform-origin: 89px 44px; }
.pip-ear, .pip-gleam {
  transition: opacity .25s ease, transform .28s cubic-bezier(.2, .8, .3, 1);
}

/* --------------------------------------------------------------- motion */
.pip-float { transform-origin: 60px 70px; }
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

/* Blinking.
 *
 * One loop with two different blinks in it: a single at a third of the way
 * through and a double near the end. A blink on a metronome is the one thing
 * that makes a face look dead, and two blinks a few hundred milliseconds
 * apart is what people actually do. Eleven seconds is long enough that the
 * pattern never announces itself.
 *
 * It scales the eye group, so it works on every expression — a dash and an
 * arc both close the same way. */
@keyframes pip-blink {
  0%, 29%, 100%      { transform: scaleY(1); }
  31%                { transform: scaleY(.06); }
  33%                { transform: scaleY(1); }

  71%                { transform: scaleY(1); }
  73%                { transform: scaleY(.06); }
  75.5%              { transform: scaleY(1); }
  78%                { transform: scaleY(.06); }
  80.5%              { transform: scaleY(1); }
}
.pip-eye { transform-origin: 60px 42px; animation: pip-blink 11s infinite; }
.pip-eye.l { transform-origin: 52px 42px; }
.pip-eye.r { transform-origin: 68px 42px; }

/* The expressions that are already a closed eye do not blink on top of it. */
.eyes-sleepy .pip-eye,
.eyes-flat .pip-eye { animation: none; }

/* idle — the antenna sways, as if waiting without minding. */
.is-idle .pip-antenna { animation: pip-sway 4.2s ease-in-out infinite; }
@keyframes pip-sway {
  0%, 100% { transform: rotate(-6deg); }
  50%      { transform: rotate(6deg); }
}

/* point — the near arm up and held. */
.pip.is-point .pip-arm.r { animation: pip-point 1.7s ease-in-out infinite; }
@keyframes pip-point {
  0%, 100% { transform: rotate(-120deg) translateY(2px); }
  50%      { transform: rotate(-132deg) translateY(0); }
}

/* travel — leaning into the direction of movement, arms trailing. The
   translation itself belongs to whatever is carrying Pip across the page;
   this is only the attitude. */
.is-travel .pip-float { animation: pip-hover 1.1s ease-in-out infinite; }
.is-travel .pip-head, .is-travel .pip-torso, .is-travel .pip-face { transform-box: fill-box; }
.pip.is-travel .pip-arm.r { transform: rotate(32deg); }
.pip.is-travel .pip-arm.l { transform: rotate(26deg); }
.is-travel .pip-shadow { animation: pip-hover-shadow 1.1s ease-in-out infinite; }

/* jump — the shadow shrinks as Pip rises and is full again the moment it
   lands. That contrast is the entire reason a jump reads as a jump. */
.is-jump .pip-float { animation: pip-jump 980ms cubic-bezier(.3, .7, .3, 1) infinite; }
.pip.is-jump .pip-arm.l { transform: rotate(148deg); }
.pip.is-jump .pip-arm.r { transform: rotate(-148deg); }
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
.pip.is-cheer .pip-arm.l { transform: rotate(158deg); }
.pip.is-cheer .pip-arm.r { transform: rotate(-158deg); }
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
.is-poke .pip-antenna { animation: pip-flick 300ms ease-in-out 2; }
@keyframes pip-poke {
  0%   { transform: translateY(0) rotate(0); }
  25%  { transform: translateY(-11px) rotate(-7deg); }
  55%  { transform: translateY(-3px) rotate(5deg); }
  100% { transform: translateY(0) rotate(0); }
}

/* think — dots climb, the visible eye narrows. */
.is-think .pip-think { animation: pip-dots 1.6s ease-in-out infinite; opacity: 1; }
@keyframes pip-dots {
  0%        { opacity: 0; }
  30%       { opacity: .4; }
  60%, 100% { opacity: 1; }
}

/* sleep — eyes shut, antenna drooped, barely moving. */
.is-sleep .pip-antenna { transform: rotate(28deg); }
.is-sleep .pip-float { animation: pip-hover 6s ease-in-out infinite; }
.is-sleep .pip-shadow { animation: pip-hover-shadow 6s ease-in-out infinite; }
.is-sleep .pip-orbit { animation-duration: 48s; opacity: .45; }

@media (prefers-reduced-motion: reduce) {
  .pip *, .pip { animation: none !important; transition: none !important; }
  .pip-float { animation: pip-hover 7s ease-in-out infinite !important; }
}
</style>
