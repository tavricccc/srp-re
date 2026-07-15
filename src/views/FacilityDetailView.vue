<template>
  <section v-if="loading" class="py-20 text-center text-sm text-ink-500">正在載入設備…</section>
  <PageLoadFailure v-else-if="error" title="設備讀取失敗" :description="error" @retry="reload" />
  <DetailPageShell
    v-else-if="facility"
    back-label="返回設備列表"
    details-label="設備內容"
    :show-comments="false"
    :show-mobile-back-button="false"
    @back="backToList"
  >
    <template #header>
      <span class="tag border-ink-200 bg-ink-100/50 dark:border-ink-800 dark:bg-ink-950/50">設備</span>
      <span class="tag font-semibold shadow-note" :class="statusClass">{{ labels[facility.status] }}</span>
    </template>

    <template #details="{ compact }">
      <div class="flex min-h-0 flex-col">
        <div class="shrink-0 pb-1" :class="compact ? 'space-y-2' : 'space-y-4'">
          <h2 class="break-words font-semibold tracking-[0.015em] text-ink-900 dark:text-ink-50" :class="compact ? 'text-xl leading-snug' : 'text-xl leading-snug sm:text-2xl'">{{ facility.title }}</h2>
          <div class="flex items-center gap-3 border-b border-ink-100 pb-3 text-sm dark:border-ink-800">
            <UserAvatar :photo-url="facility.author_photo_url" :name="facility.author_name" :size="compact ? 'sm' : 'md'" :alt-text="`${facility.author_name} 的頭像`" />
            <div class="min-w-0"><p class="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">{{ facility.author_name }}</p><p class="mt-0.5 truncate text-xs text-ink-500">{{ facility.location }} · {{ formatDate(facility.created_at) }}</p></div>
          </div>
        </div>
        <div class="min-h-0 py-2">
          <div v-if="facility.result_content" class="mb-4 rounded-[var(--radius-inner)] border-0 bg-success-container/80 px-4 py-3 text-sm text-on-success-container shadow-note">
            <p class="font-semibold">處理結果</p>
            <p class="mt-1 whitespace-pre-wrap leading-6">{{ facility.result_content }}</p>
          </div>
          <MarkdownMediaContent :content="facility.content" :fallback-alt="facility.title" />
        </div>
      </div>
    </template>

    <template #actions>
      <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
        <button
          type="button"
          class="button-toolbar flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
          :class="{ 'button-toolbar--active': facility.currentUserAffected }"
          :disabled="facility.isOwnFacility || closed"
          :title="facility.isOwnFacility ? '作者已自動計入' : '我也遇到'"
          @click="toggleAffected"
        >
          <AppIcon name="hand" :size="4" />
          <span>{{ facility.affected_count }} 人遇到</span>
        </button>
        <div class="ml-auto flex gap-2">
          <button v-if="facility.canManageFacility && !closed" class="button-primary" @click="statusOpen = true">更新狀態</button>
          <button v-if="facility.canManageFacility || (facility.isOwnFacility && facility.status === 'pending')" class="button-danger" @click="confirmDelete">刪除</button>
        </div>
      </div>
    </template>
  </DetailPageShell>

  <FacilityStatusDialog v-if="facility" :open="statusOpen" :current-status="facility.status" :saving="statusSaving" :error="statusError" @close="closeStatusDialog" @submit="submitStatus" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import FacilityStatusDialog from '@/components/FacilityStatusDialog.vue';
import MarkdownMediaContent from '@/components/MarkdownMediaContent.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import DetailPageShell from '@/components/ui/DetailPageShell.vue';
import PageLoadFailure from '@/components/ui/PageLoadFailure.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { useFacilityDetail } from '@/composables/useFacilityDetail';
import { useStatusStyling } from '@/composables/useStatusStyling';
import { formatDate } from '@/lib/format';
import type { FacilityStatus } from '@/types';
import { useActionFeedback } from '@/composables/useActionFeedback';

const router = useRouter();
const { changeStatus, error, facility, loading, remove, toggleAffected } = useFacilityDetail();
const statusOpen = ref(false);
const statusSaving = ref(false);
const statusError = ref('');
const { start } = useActionFeedback();
const labels: Record<FacilityStatus, string> = { pending: '待受理', processing: '處理中', completed: '已完成', 'unable-to-handle': '無法處理' };
const closed = computed(() => facility.value ? ['completed', 'unable-to-handle'].includes(facility.value.status) : false);
const status = computed(() => facility.value?.status ?? 'pending');
const { statusClass } = useStatusStyling(status, 'dialog');

function reload() { window.location.reload(); }
function backToList() { void router.push({ name: 'facilities' }); }
function closeStatusDialog() { if (!statusSaving.value) { statusOpen.value = false; statusError.value = ''; } }
async function submitStatus(nextStatus: FacilityStatus, result: string) {
  if (statusSaving.value) return;
  statusSaving.value = true;
  statusError.value = '';
  const feedback = start('正在更新設備狀態');
  try {
    await changeStatus(nextStatus, result);
    statusOpen.value = false;
    feedback.succeed('設備狀態已更新');
  } catch (caught) {
    statusError.value = caught instanceof Error ? caught.message : '更新失敗，請稍後再試。';
    feedback.fail(statusError.value);
  } finally {
    statusSaving.value = false;
  }
}
async function confirmDelete() { if (window.confirm('確定要刪除這筆設備嗎？')) await remove(); }
</script>
