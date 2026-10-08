<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NAV } from '../../router/nav.js'

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
      <span class="i-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#5b4fd1"/>
          <path d="M16 7l7 3.5v6c0 4.4-2.9 7.6-7 8.5-4.1-.9-7-4.1-7-8.5v-6L16 7z"
                fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>
      </span>
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
              <span v-if="badge(item.badgeKey)" class="i-count">{{ badge(item.badgeKey) }}</span>
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

    <!-- This used to link to the admin's own MFA enrolment, which put an
         end-user task in the administrator's navigation. It is the account
         row now; enrolment is in the portal. -->
    <RouterLink to="/settings/company-details" class="i-railfoot">
      <span class="i-av">DA</span>
      <span class="i-uname">Demo Admin</span>
      <i class="fa-solid fa-gear ms-auto" style="font-size:12px;opacity:.6" aria-hidden="true" />
    </RouterLink>
  </nav>
</template>
