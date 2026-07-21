<template>
  <span
    class="switch-indicator"
    :class="{ 'switch-indicator--checked': checked }"
    aria-hidden="true"
  >
    <span class="switch-indicator__thumb"></span>
  </span>
</template>

<script setup lang="ts">
defineProps<{ checked: boolean }>();
</script>
