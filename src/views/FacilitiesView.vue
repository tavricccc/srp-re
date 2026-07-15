<template>
  <section class="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-5 py-2 md:py-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div><h1 class="text-2xl font-semibold">設備</h1><p class="mt-1 text-sm text-ink-500">查看與回報校園設備問題</p></div>
      <button class="button-primary" @click="composerOpen = true"><AppIcon name="plus" />新增</button>
    </div>
    <div class="panel flex flex-wrap items-center gap-2 p-3">
      <PillSegmentedControl v-model="bucket" :options="bucketOptions" show-inactive-labels />
      <select v-model="status" class="field !w-auto"><option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select>
      <select v-model="sort" class="field !w-auto"><option value="latest">最新</option><option value="most-affected">最多人遇到</option></select>
      <input v-model="query" class="field min-w-48 flex-1" placeholder="搜尋標題或地點" aria-label="搜尋設備" />
    </div>
    <div class="scrollbar-none min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
      <div v-if="loading" class="py-16 text-center text-sm text-ink-500">正在載入設備…</div>
      <EmptyStatePanel v-else-if="error" title="設備讀取失敗" :description="error" icon="warning" action-label="重試" @action="load()" />
      <EmptyStatePanel v-else-if="facilities.length === 0" title="目前沒有設備" description="沒有符合目前條件的設備案件。" icon="inbox" />
      <RouterLink v-for="facility in facilities" v-else :key="facility.id" :to="{ name: 'facility-detail', params: { facilityId: facility.id } }" class="panel block p-4 transition hover:-translate-y-0.5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full bg-ink-100 px-2 py-1 text-xs font-semibold dark:bg-ink-800">{{ statusLabel(facility.status) }}</span><span class="text-xs text-ink-500">{{ formatDate(facility.created_at) }}</span></div><h2 class="mt-2 truncate text-base font-bold">{{ facility.title }}</h2><p class="mt-1 text-sm text-ink-500">{{ facility.location }} · {{ facility.author_name }}</p></div>
          <button type="button" class="button-icon-pill shrink-0" :class="{ 'button-icon-pill-filled': facility.currentUserAffected }" :disabled="facility.isOwnFacility || bucket === 'closed'" :title="facility.isOwnFacility ? '作者已自動計入' : '我也遇到'" @click.prevent="toggleAffected(facility)"><AppIcon name="hand" /><span>{{ facility.affected_count }}</span></button>
        </div>
      </RouterLink>
      <FeedLoadMoreControl :has-more="hasMore" :loading="loadingMore" :error="false" @load-more="load(true)" />
    </div>
    <FacilityComposer :open="composerOpen" @close="composerOpen = false" @submitted="handleSubmitted" />
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FacilityComposer from '@/components/FacilityComposer.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import EmptyStatePanel from '@/components/ui/EmptyStatePanel.vue';
import FeedLoadMoreControl from '@/components/ui/FeedLoadMoreControl.vue';
import PillSegmentedControl from '@/components/ui/PillSegmentedControl.vue';
import { useFacilities } from '@/composables/useFacilities';
import { CREATE_ENTRY_QUERY_KEY, CREATE_FACILITY_QUERY_VALUE, registerCreateFacilityHandler } from '@/composables/useCreateEntryActions';
import { formatDate } from '@/lib/format';
import type { FacilityRecord, FacilityStatus } from '@/types';
const route = useRoute(); const router = useRouter(); const composerOpen = ref(false);
const { bucket, error, facilities, hasMore, load, loading, loadingMore, query, sort, status, statusOptions, toggleAffected } = useFacilities();
const bucketOptions = [{ value: 'active' as const, label: '處理中', icon: 'list' as const }, { value: 'closed' as const, label: '已結案', icon: 'inbox' as const }];
const labels: Record<FacilityStatus, string> = { pending: '待受理', processing: '處理中', completed: '已完成', 'unable-to-handle': '無法處理' };
const statusLabel = (value: FacilityStatus) => labels[value];
registerCreateFacilityHandler(() => { composerOpen.value = true; });
watch(() => route.query[CREATE_ENTRY_QUERY_KEY], (value) => { if (value === CREATE_FACILITY_QUERY_VALUE) { composerOpen.value = true; const query = { ...route.query }; delete query[CREATE_ENTRY_QUERY_KEY]; void router.replace({ query }); } }, { immediate: true });
function handleSubmitted(facility: FacilityRecord) { facilities.value.unshift(facility); }
</script>
