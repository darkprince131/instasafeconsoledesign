<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <div class="i-page">
    <div class="i-zero">
      <div class="i-zi"><i class="fa-solid fa-compass" aria-hidden="true" /></div>
      <h3>That screen is not in the demo yet</h3>
      <p>
        <code class="i-tech">{{ route.fullPath }}</code> is a real route in the console,
        but it has not been built here yet. SCOPE.md lists which phase it lands in.
      </p>
      <div class="i-za">
        <RouterLink class="i-btn i-primary" to="/dashboard">Back to dashboard</RouterLink>
      </div>
    </div>
  </div>
</template>
