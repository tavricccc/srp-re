<template>
  <ContentCardCollection
    :empty="issues.length === 0"
    empty-label="issue.noProposalsYet"
    :error="error"
    list-label="issue.proposalList"
    :loading="loading"
  >
    <template #loading>
      <SkeletonTable :show-author="showAuthor" :is-admin="isAdmin" />
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
import ContentCardCollection from '@/components/ui/ContentCardCollection.vue';
import SkeletonTable from '@/components/ui/SkeletonTable.vue';
import { useSession } from '@/composables/useSession';
import type { IssueRecord } from '@/types';

withDefaults(defineProps<{
  issues: IssueRecord[];
  loading: boolean;
  error: string;
  showAuthor?: boolean;
  highlightQuery?: string;
}>(), {
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
