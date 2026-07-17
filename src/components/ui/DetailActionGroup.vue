<template>
  <div
    class="mt-4 shrink-0 border-t border-ink-100 pb-1 dark:border-ink-800"
    :class="compact ? 'space-y-3 px-1 pt-3' : 'space-y-3 pt-3'"
  >
    <slot name="header" />

    <div class="flex flex-wrap items-center gap-2">
      <slot name="primary" />

      <DetailActionButton
        v-if="showShare"
        label="common.share"
        :compact="compact"
        title="common.shareLink"
        aria-label="common.shareLink"
        @click="emit('share')"
      >
        <AppIcon name="share" />
      </DetailActionButton>

      <slot />

      <DetailActionButton
        v-if="showDelete"
        danger
        :label="deleteLabel"
        :compact="compact"
        :title="deleteTitle"
        :aria-label="deleteTitle"
        @click="emit('delete')"
      >
        <AppIcon name="trash" />
      </DetailActionButton>
    </div>

    <OperationTimeList
      v-if="operationTimeItems.length > 0"
      :items="operationTimeItems"
      :compact="compact"
      :class="{ 'border-t border-ink-100 pt-3 dark:border-ink-800': separateOperationTimes }"
    />
  </div>
</template>

<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';
import DetailActionButton from '@/components/ui/DetailActionButton.vue';
import OperationTimeList from '@/components/ui/OperationTimeList.vue';
import type { OperationTimeListItem } from '@/types';

withDefaults(defineProps<{
  compact?: boolean;
  deleteLabel?: string;
  deleteTitle?: string;
  operationTimeItems?: OperationTimeListItem[];
  separateOperationTimes?: boolean;
  showDelete?: boolean;
  showShare?: boolean;
}>(), {
  compact: false,
  deleteLabel: 'common.delete',
  deleteTitle: 'common.delete',
  operationTimeItems: () => [],
  separateOperationTimes: false,
  showDelete: false,
  showShare: true,
});

const emit = defineEmits<{
  delete: [];
  share: [];
}>();

defineSlots<{
  default(): unknown;
  header(): unknown;
  primary(): unknown;
}>();
</script>
