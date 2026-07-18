<template>
  <component
    :is="as"
    class="route-page-frame"
    :class="[
      `route-page-frame--${layout}`,
      `route-page-frame--padding-${padding}`,
      { 'route-page-frame--bottom-safe': bottomSafe },
    ]"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  as?: 'div' | 'main' | 'section';
  bottomSafe?: boolean;
  layout?: 'fill' | 'flow';
  padding?: 'compact' | 'none' | 'responsive';
}>(), {
  as: 'section',
  bottomSafe: false,
  layout: 'flow',
  padding: 'none',
});
</script>
