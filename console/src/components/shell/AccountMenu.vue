<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'

/**
 * The account menu — one component, both consoles, top right.
 *
 * It was in three places in the portal (a rail footer menu, two rail entries,
 * and a Sign out button in the topbar) and in a fourth shape in the admin
 * console, where the rail footer looked like an account control and actually
 * opened Company details, with no way to sign out at all.
 *
 * Top right is the right place, for three reasons and not because it is
 * fashionable:
 *
 *  1. It is where velto and veno put it, so nobody who already uses the
 *     product has to learn a second habit.
 *  2. It is where people look. The convention is near-universal and
 *     discoverability is the whole job of this control — it is used rarely,
 *     so it cannot afford to be hunted for.
 *  3. It groups identity with the things that act on identity. Sign out next
 *     to a theme toggle is an accident waiting to happen; sign out under
 *     your own name is not.
 *
 * The rail footer is gone from both. Two account affordances is the problem
 * this fixes, so adding one back somewhere quieter would simply recreate it.
 */

const props = defineProps({
  /** Shown in the button and the header of the panel. */
  name: { type: String, default: '' },
  secondary: { type: String, default: '' },
  initials: { type: String, default: '' },
  photo: { type: String, default: '' },
  /** [{ to | action, label, icon, mark }] — rendered in order. */
  items: { type: Array, default: () => [] },
  /** A short line under the name: which console you are in. */
  context: { type: String, default: '' }
})
const emit = defineEmits(['select'])

const open = ref(false)
const root = ref(null)

const mark = computed(() => props.initials ||
  (props.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())

function choose (item) {
  open.value = false
  if (item.action) emit('select', item.action)
}

/* A menu that stays open after you have clicked past it is a menu that gets
   in the way. Escape closes it too, because a keyboard user has no outside
   to click. */
function onDocClick (e) { if (root.value && !root.value.contains(e.target)) open.value = false }
function onKey (e) { if (e.key === 'Escape') open.value = false }

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="i-acct">
    <button
      class="i-acctb" :aria-expanded="open" aria-haspopup="menu"
      :aria-label="`Account menu for ${name}`"
      @click="open = !open"
    >
      <span class="i-acctav">
        <img v-if="photo" :src="photo" alt="">
        <template v-else>{{ mark }}</template>
      </span>
      <span class="i-acctn d-none d-lg-inline">{{ name }}</span>
      <i class="fa-solid fa-chevron-down i-acctc" aria-hidden="true" />
    </button>

    <div v-if="open" class="i-acctmenu" role="menu">
      <div class="i-acctmh">
        <span class="i-acctav is-lg">
          <img v-if="photo" :src="photo" alt="">
          <template v-else>{{ mark }}</template>
        </span>
        <span>
          <strong>{{ name }}</strong>
          <small v-if="secondary">{{ secondary }}</small>
          <small v-if="context" class="i-acctctx">{{ context }}</small>
        </span>
      </div>

      <template v-for="(item, i) in items" :key="i">
        <hr v-if="item.divider" class="i-acctdiv">
        <RouterLink
          v-else-if="item.to" class="i-acctitem" role="menuitem"
          :to="item.to" @click="open = false"
        >
          <i class="fa-solid" :class="item.icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
          <span v-if="item.mark" class="i-count">{{ item.mark }}</span>
        </RouterLink>
        <button
          v-else class="i-acctitem" role="menuitem"
          :class="{ 'is-bad': item.tone === 'bad' }"
          @click="choose(item)"
        >
          <i class="fa-solid" :class="item.icon" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
