<template>
  <ContentCardCollection
    :empty="issues.length === 0"
    empty-label="issue.noProposalsYet"
    :error="error"
    list-label="issue.proposalList"
    :loading="loading"
  >
    <template #loading>
      <ContentCardSkeleton
        :action-shapes="['icon', 'pill']"
        :count="loadingCount"
        loading-label="issue.proposalLoading"
        :show-admin="isAdmin"
        :show-author="showAuthor"
        supplement="progress"
      />
    </template>

    <IssueTableRow
      v-for="issue in issues"
      :key="issue.id"
      :issue="issue"
      :highlight-query="highlightQuery"
      @open-details="emit('open-details', $event)"
      @support-changed="emit('support-changed', $event)"
      @issue-updated="emit('issue-updated', $event)"
      @issue-deleted="emit('issue-deleted', $event)"
    />
  </ContentCardCollection>
</template>

<script setup lang="ts">
import IssueTableRow from './IssueTableRow.vue';
import ContentCardCollection from '@/components/ui/organisms/ContentCardCollection.vue';
import ContentCardSkeleton from '@/components/ui/organisms/ContentCardSkeleton.vue';
import { useSession } from '@/composables/useSession';
import type { IssueRecord } from '@/types';

withDefaults(defineProps<{
  issues: IssueRecord[];
  loading: boolean;
  loadingCount?: number;
  error: string;
  showAuthor?: boolean;
  highlightQuery?: string;
}>(), {
  loadingCount: 2,
  showAuthor: true,
  highlightQuery: '',
});

const emit = defineEmits<{
  'support-changed': [payload: { issueId: string; supported: boolean; supportCount: number }];
  'open-details': [payload: { issue: IssueRecord; initialTab: 'details' | 'comments' }];
  'issue-updated': [issue: IssueRecord];
  'issue-deleted': [issueId: string];
}>();

const { isAdmin } = useSession();
</script>
