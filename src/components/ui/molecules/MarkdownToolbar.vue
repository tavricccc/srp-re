<template>
  <div class="flex flex-nowrap overflow-x-auto scrollbar-none items-center gap-1 bg-ink-50/50 dark:bg-ink-950/20 px-2 py-1.5 border-b border-ink-150 dark:border-ink-850 shrink-0 select-none">
    <AppButton
      v-for="command in MARKDOWN_EDITOR_COMMANDS"
      :key="command.id"
      variant="toolbar"
      class="shrink-0 cursor-pointer"
      :class="{ 'table-btn-trigger': command.id === 'table' }"
      :title="command.toolbarTitle"
      @mousedown.prevent
      @click="emit('command', command.id)"
    >
      <AppIcon :name="command.iconName" />
    </AppButton>
    <slot />
  </div>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/atoms/AppButton.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import { MARKDOWN_EDITOR_COMMANDS, type MarkdownEditorCommandId } from '@/lib/markdown-editor-commands';

const emit = defineEmits<{
  'command': [commandId: MarkdownEditorCommandId];
}>();
</script>
