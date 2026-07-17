<template>
  <div class="relative">
    <button
      type="button"
      :class="[supportClass, compact ? '!h-8 !px-2.5 !gap-1 text-xs' : '']"
      :disabled="busy || supportClosed || authorFixed"
      :title="supportTitle"
      :aria-label="t(authorFixed ? 'issue.theAuthorAutomaticallySupportsThisProposal' : optimisticSupported ? 'common.removeSupport' : 'issue.supportProposal')"
      @click="toggle"
    >
      <AppIcon name="thumbs-up" :size="compact ? 4 : 5" />
      <!-- Support count display -->
      <span
        class="font-semibold select-none leading-none"
        :class="compact ? 'text-[11px]' : 'text-sm'"
      >{{ displaySupportCount }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useVoteSupport } from '@/composables/useVoteSupport';
import { useI18n } from '@/i18n';

const props = defineProps<{
  issueId: string;
  currentUserSupported: boolean;
  supportCount: number;
  supportClosed: boolean;
  statusLabel?: string;
  compact?: boolean;
  authorFixed?: boolean;
}>();

const emit = defineEmits<{
  contentUnavailable: [issueId: string];
  supported: [payload: { supported: boolean; supportCount: number }];
}>();
const { t } = useI18n();
const supportTitle = computed(() => {
  if (props.authorFixed) return t('issue.theAuthorAutomaticallySupportsThisProposal');
  if (!props.supportClosed) return t(props.currentUserSupported ? 'common.removeSupport' : 'issue.supportProposal');
  return props.statusLabel
    ? t('issue.support.closedStatus', { status: props.statusLabel })
    : t('issue.submissionsHaveEnded');
});

const supportClosed = computed(() => props.supportClosed);
const {
  busy,
  optimisticSupported,
  displaySupportCount,
  supportClass,
  toggle,
} = useVoteSupport({
  issueId: toRef(props, 'issueId'),
  currentUserSupported: toRef(props, 'currentUserSupported'),
  supportCount: toRef(props, 'supportCount'),
  supportClosed,
  statusLabel: computed(() => props.statusLabel),
  onSupported: (payload) => emit('supported', payload),
  onContentUnavailable: (issueId) => emit('contentUnavailable', issueId),
});
</script>
