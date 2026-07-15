<template>
  <button
    type="button"
    class="content-trigger flex w-full items-center justify-between gap-3 border px-3 py-3 text-left"
    :class="[
      selected ? 'button-toolbar--active shadow-note' : 'border-ink-100 dark:border-ink-800',
      disabled ? 'cursor-not-allowed opacity-55' : '',
    ]"
    :disabled="disabled"
    :aria-pressed="selected"
    @click="$emit('select')"
  >
    <span class="min-w-0">
      <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ label }}</span>
      <span v-if="description" class="mt-0.5 block text-xs leading-5 text-ink-500 dark:text-ink-400">{{ description }}</span>
    </span>
    <SelectionMark :selected="selected" />
  </button>
</template>

<script setup lang="ts">
import SelectionMark from '@/components/ui/SelectionMark.vue';

withDefaults(defineProps<{
  description?: string;
  disabled?: boolean;
  label: string;
  selected: boolean;
}>(), { description: '', disabled: false });

defineEmits<{ select: [] }>();
</script>
