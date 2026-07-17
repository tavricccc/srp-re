<template>
  <div class="relative" role="listitem">
    <article
      class="issue-card surface-card surface-card--interactive list-row-trigger relative overflow-hidden"
      data-list-row-trigger
      @click="emit('open')"
    >
      <header class="flex min-w-0 items-center gap-2">
        <span class="tag-sm shrink-0 font-semibold" :class="statusClass">
          {{ t(statusLabel) }}
        </span>
        <span class="ml-auto truncate text-xs text-ink-400 dark:text-ink-500">
          {{ timeLabel }}
        </span>
        <div v-if="$slots.admin" class="shrink-0" @click.stop>
          <slot name="admin" />
        </div>
      </header>

      <div class="mt-3 flex min-w-0 items-center gap-2.5">
        <AuthorAvatar
          v-if="showAuthor"
          :author-uid="authorUid"
          :photo-url="authorPhotoUrl"
          :name="authorName"
          size="sm"
          :alt-text="t('notification.nameAvatar', { name: authorName })"
          class="shrink-0"
        />
        <div class="min-w-0 flex-1">
          <h3 class="line-clamp-2 text-[15px] font-semibold leading-6 tracking-[0.01em] text-ink-950 dark:text-ink-50 sm:text-base">
            <SearchHighlight :text="title" :query="highlightQuery" />
          </h3>
          <p v-if="showAuthor" class="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">
            {{ authorName }}
          </p>
        </div>
      </div>

      <slot name="supplement" />

      <footer v-if="$slots.actions" class="mt-3 flex items-center justify-end gap-1.5" @click.stop>
        <slot name="actions" />
      </footer>
    </article>

    <slot name="dialogs" />
  </div>
</template>

<script setup lang="ts">
import AuthorAvatar from '@/components/AuthorAvatar.vue';
import SearchHighlight from '@/components/ui/SearchHighlight.vue';
import { useI18n } from '@/i18n';

const { t } = useI18n();

withDefaults(defineProps<{
  authorName: string;
  authorPhotoUrl?: string | null;
  authorUid?: string | null;
  highlightQuery?: string;
  showAuthor?: boolean;
  statusClass?: string;
  statusLabel: string;
  timeLabel: string;
  title: string;
}>(), {
  authorPhotoUrl: null,
  authorUid: null,
  highlightQuery: '',
  showAuthor: true,
  statusClass: '',
});

const emit = defineEmits<{
  open: [];
}>();

defineSlots<{
  actions(): unknown;
  admin(): unknown;
  dialogs(): unknown;
  supplement(): unknown;
}>();
</script>
