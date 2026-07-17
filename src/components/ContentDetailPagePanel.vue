<template>
  <DetailPageShell
    :back-label="backLabel"
    :comment-count="commentCount"
    :comments-label="commentsLabel"
    :details-label="detailsLabel"
    :initial-tab="initialTab"
    :show-comments="showComments"
    :show-mobile-back-button="showMobileBackButton"
    @back="emit('back')"
  >
    <template #header>
      <slot name="header" />
    </template>

    <template #details="{ compact, scrollContent }">
      <ContentDetailBody
        :author-name="authorName"
        :author-photo-url="authorPhotoUrl"
        :author-secondary="authorSecondary"
        :author-uid="authorUid"
        :compact="compact"
        :content="content"
        :notice-content="noticeContent"
        :notice-fallback-alt="noticeFallbackAlt"
        :notice-markdown="noticeMarkdown"
        :notice-title="noticeTitle"
        :notice-tone="noticeTone"
        :scroll-content="scrollContent"
        :show-author="showAuthor"
        :title="title"
      />
    </template>

    <template #actions="{ compact }">
      <slot name="actions" :compact="compact" />
    </template>

    <template #comments="{ compactHeader }">
      <slot name="comments" :compact-header="compactHeader" />
    </template>
  </DetailPageShell>
</template>

<script setup lang="ts">
import ContentDetailBody from '@/components/ContentDetailBody.vue';
import DetailPageShell from '@/components/ui/DetailPageShell.vue';

withDefaults(defineProps<{
  authorName: string;
  authorPhotoUrl?: string | null;
  authorSecondary?: string;
  authorUid?: string | null;
  backLabel: string;
  commentCount?: number;
  commentsLabel?: string;
  content: string;
  detailsLabel: string;
  initialTab?: 'details' | 'comments';
  noticeContent?: string | null;
  noticeFallbackAlt?: string;
  noticeMarkdown?: boolean;
  noticeTitle?: string;
  noticeTone?: 'error' | 'success';
  showAuthor?: boolean;
  showComments?: boolean;
  showMobileBackButton?: boolean;
  title: string;
}>(), {
  authorPhotoUrl: null,
  authorSecondary: '',
  authorUid: null,
  commentCount: 0,
  commentsLabel: 'comments.title',
  initialTab: 'details',
  noticeContent: '',
  noticeFallbackAlt: '',
  noticeMarkdown: false,
  noticeTitle: '',
  noticeTone: 'success',
  showAuthor: true,
  showComments: true,
  showMobileBackButton: false,
});

const emit = defineEmits<{
  back: [];
}>();

defineSlots<{
  actions(props: { compact: boolean }): unknown;
  comments(props: { compactHeader: boolean }): unknown;
  header(): unknown;
}>();
</script>
