<template>
  <section class="mx-auto w-full max-w-4xl py-2 md:py-6">
    <div v-if="loading" class="py-20 text-center text-sm text-ink-500">正在載入設備…</div>
    <PageLoadFailure v-else-if="error" title="設備讀取失敗" :description="error" @retry="reload" />
    <article v-else-if="facility" class="panel panel-pad space-y-5">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 pb-4 dark:border-ink-800">
        <div><span class="rounded-full bg-ink-100 px-2 py-1 text-xs font-semibold dark:bg-ink-800">{{ labels[facility.status] }}</span><h1 class="mt-3 text-2xl font-bold">{{ facility.title }}</h1><p class="mt-2 text-sm text-ink-500">{{ facility.location }} · {{ facility.author_name }} · {{ formatDate(facility.created_at) }}</p></div>
        <button class="button-icon-pill" :class="{ 'button-icon-pill-filled': facility.currentUserAffected }" :disabled="facility.isOwnFacility || closed" :title="facility.isOwnFacility ? '作者已自動計入' : '我也遇到'" @click="toggleAffected"><AppIcon name="hand" /><span>{{ facility.affected_count }}</span></button>
      </div>
      <MarkdownRenderer :content="facility.content" />
      <div v-if="facility.result_content" class="rounded-xl bg-ink-50 p-4 dark:bg-ink-800/50"><h2 class="text-sm font-bold">處理結果</h2><p class="mt-2 whitespace-pre-wrap text-sm leading-6">{{ facility.result_content }}</p></div>
      <div class="flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
        <button v-if="facility.canManageFacility && !closed" class="button-primary" @click="statusOpen = true">更新狀態</button>
        <button v-if="facility.canManageFacility || (facility.isOwnFacility && facility.status === 'pending')" class="button-danger" @click="confirmDelete">刪除</button>
      </div>
    </article>
    <FacilityStatusDialog v-if="facility" :open="statusOpen" :current-status="facility.status" @close="statusOpen = false" @submit="submitStatus" />
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import FacilityStatusDialog from '@/components/FacilityStatusDialog.vue';
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';
import PageLoadFailure from '@/components/ui/PageLoadFailure.vue';
import { useFacilityDetail } from '@/composables/useFacilityDetail';
import { formatDate } from '@/lib/format';
import type { FacilityStatus } from '@/types';
const { changeStatus, error, facility, loading, remove, toggleAffected } = useFacilityDetail();
const statusOpen = ref(false); const labels: Record<FacilityStatus, string> = { pending: '待受理', processing: '處理中', completed: '已完成', 'unable-to-handle': '無法處理' };
const closed = computed(() => facility.value ? ['completed', 'unable-to-handle'].includes(facility.value.status) : false);
function reload() { window.location.reload(); }
async function submitStatus(status: FacilityStatus, result: string) { await changeStatus(status, result); statusOpen.value = false; }
async function confirmDelete() { if (window.confirm('確定要刪除這筆設備嗎？')) await remove(); }
</script>
