<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NAV } from '../../router/nav.js'
import Mark from '../ui/Mark.vue'

const props = defineProps({ stats: { type: Object, default: () => ({}) } })
const route = useRoute()

/** Which parent groups are expanded. The one containing the current route
 *  opens itself, so you never land somewhere and lose your place. */
const open = ref(new Set())

function isCurrent (to) { return route.path === to }
function groupHasCurrent (item) {
  return (item.children || []).some(c => isCurrent(c.to))
}

watch(() => route.path, () => {
  for (const sec of NAV) {
    for (const item of sec.items) {
      if (groupHasCurrent(item)) open.value.add(item.label)
    }
  }
}, { immediate: true })

function toggle (label) {
  const s = new Set(open.value)
  s.has(label) ? s.delete(label) : s.add(label)
  open.value = s
}

/** A count only earns its place when something is actually waiting. */
function badge (key) {
  const v = props.stats?.[key]
  return v && v > 0 ? v : null
}
</script>

<template>
  <nav class="i-rail" aria-label="Main navigation">
    <div class="i-brand">
      <span class="i-mark"><Mark :size="22" /></span>
      <span class="i-wm">InstaSafe</span>
      <span class="i-tenant">demo</span>
    </div>

    <div class="i-navwrap">
      <template v-for="sec in NAV" :key="sec.section">
        <div class="i-navsec">{{ sec.section }}</div>

        <template v-for="item in sec.items" :key="item.label">
          <!-- leaf -->
          <RouterLink
            v-if="item.to"
            class="i-navitem"
            :to="item.to"
            :aria-current="isCurrent(item.to) ? 'page' : null"
            @click="$emit('close')"
          >
            <i class="fa-solid" :class="item.icon" aria-hidden="true" />
            <span class="i-lab">{{ item.label }}</span>
            <span v-if="item.isNew" class="i-new">New</span>
            <span v-else-if="badge(item.badgeKey)" class="i-count">{{ badge(item.badgeKey) }}</span>
          </RouterLink>

          <!-- group -->
          <template v-else>
            <button
              class="i-navitem"
              :class="{ 'is-parent-active': groupHasCurrent(item) && !open.has(item.label) }"
              :aria-expanded="open.has(item.label)"
              @click="toggle(item.label)"
            >
              <i class="fa-solid" :class="item.icon" aria-hidden="true" />
              <span class="i-lab">{{ item.label }}</span>
              <!-- The group carries its child's count only while it is shut.
                   Open, the same number is on the child a line below, and two
                   copies of it either side of a caret is what made the row
                   read as broken. -->
              <span
                v-if="badge(item.badgeKey) && !open.has(item.label)"
                class="i-count"
              >{{ badge(item.badgeKey) }}</span>
              <i class="fa-solid fa-chevron-right i-caret" aria-hidden="true" />
            </button>

            <template v-if="open.has(item.label)">
              <RouterLink
                v-for="child in item.children"
                :key="child.to"
                class="i-subitem"
                :to="child.to"
                :aria-current="isCurrent(child.to) ? 'page' : null"
                @click="$emit('close')"
              >
                <span class="i-lab">{{ child.label }}</span>
                <span v-if="badge(child.badgeKey)" class="i-count">{{ badge(child.badgeKey) }}</span>
              </RouterLink>
            </template>
          </template>
        </template>
      </template>
    </div>

    <!-- The account row that used to sit here looked like an account
         control and opened Company details, and there was no way to sign out
         of this console at all. Both are the account menu's job now, top
         right, where velto puts it and where people look. -->
  </nav>
</template>
