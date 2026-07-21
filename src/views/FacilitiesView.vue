<template>
  <RoutePageFrame layout="fill" class="relative gap-5">
    <BoardControls
      v-model:active-filter="category"
      v-model:status-tab="bucket"
      v-model:search-query="query"
      v-model:sort-option="sort"
      mode="facility"
      :active-category-label="activeCategoryLabel"
      :category-options="categoryOptions"
      :create-label="t('facility.addFacility')"
      :search-hint="searchHint"
      @create="composerOpen = true"
      @submit-search="submitSearch"
      @clear-search="clearSearch"
    />

    <div class="route-scroll-through scroll-shadow-bleed scrollbar-none min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain">
      <ContentListState
        :empty="facilities.length === 0"
        :empty-description="emptyDescription"
        empty-title="facility.noMatchingFacilities"
        :error="error"
        error-title="facility.failedToLoadFacilityTitle"
        :has-more="hasMore"
        :loading="visibleFacilityLoading"
        :loading-has-problem="facilityLoadingHasProblem"
        :loading-more="loadingMore"
        :panel-key="facilityPanelKey"
        :problem-description="facilityProblemDescription"
        :problem-title="facilityProblemTitle"
        :retry-disabled="!facilityOnline"
        @load-more="load(true)"
        @retry="retryFacilities"
      >
        <template #loading>
          <FacilityTable :facilities="[]" :loading="true" />
        </template>

        <template #loading-more>
          <FacilityTable :facilities="[]" :loading="true" :loading-count="1" />
        </template>

        <FacilityTable
          :affecting-facility-id="affectingFacilityId"
          :facilities="facilities"
          :loading="false"
          :highlight-query="committedQuery"
          @open-details="openDetails"
          @toggle-affected="handleToggleAffected"
          @manage-status="openStatusDialog"
          @delete="openDeleteDialog"
        />

        <template #sentinel>
          <div ref="loadMoreSentinel" class="h-1" aria-hidden="true"></div>
        </template>
      </ContentListState>
    </div>

    <FacilityComposer :open="composerOpen" :category-id="category" @close="composerOpen = false" @submitted="handleSubmitted" />
    <FacilityStatusDialog
      v-if="selectedFacility"
      :open="statusDialogOpen"
      :current-status="selectedFacility.status"
      :saving="statusSaving"
      :error="statusError"
      @close="closeStatusDialog"
      @submit="submitStatus"
    />
    <ConfirmDialog
      :open="deleteDialogOpen"
      title="facility.areYouSureYouWantToDeleteThisFacilityReport"
      message="facility.deleteWarning"
      confirm-label="comments.confirmDeletion"
      :busy="deleting"
      @cancel="closeDeleteDialog"
      @confirm="confirmDelete"
    />
  </RoutePageFrame>
</template>

<script setup lang="ts">
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BoardControls from '@/components/BoardControls.vue';
import FacilityComposer from '@/components/FacilityComposer.vue';
import FacilityStatusDialog from '@/components/FacilityStatusDialog.vue';
import FacilityTable from '@/components/FacilityTable.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ContentListState from '@/components/ui/organisms/ContentListState.vue';
import { useFacilities } from '@/composables/useFacilities';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useContentListRuntime } from '@/composables/useContentListRuntime';
import { normalizeSearchText } from '@/lib/search';
import type { FacilityRecord, FacilityStatus, FacilitySummary } from '@/types';
import { useI18n } from '@/i18n';
import { findFacilityCategory, getDefaultFacilityCategoryId, useCategories } from '@/composables/useCategories';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { activeFacilityCategories } = useCategories();
const routeCategory = Array.isArray(route.query.category) ? route.query.category[0] : route.query.category;
const category = ref(findFacilityCategory(routeCategory)?.isActive ? routeCategory as string : getDefaultFacilityCategoryId());
const activeCategoryLabel = computed(() => findFacilityCategory(category.value)?.label ?? t('facility.facility'));
const categoryOptions = computed(() => activeFacilityCategories.value.map((entry) => ({
  label: entry.label,
  value: entry.id,
})));
const composerOpen = ref(false);
const {
  affectingFacilityId,
  bucket,
  changeStatus,
  clearSearch,
  committedQuery,
  error,
  facilities,
  hasMore,
  load,
  loading,
  loadingMore,
  query,
  remove,
  sort,
  submitSearch,
  toggleAffected,
} = useFacilities(category);
const selectedFacility = ref<FacilitySummary | null>(null);
const statusDialogOpen = ref(false);
const statusSaving = ref(false);
const statusError = ref('');
const deleteDialogOpen = ref(false);
const deleting = ref(false);
const { show } = useActionFeedback();
const facilityPanelKey = computed(() => [
  bucket.value,
  sort.value,
  committedQuery.value.trim(),
].join(':'));
const {
  isOnline: facilityOnline,
  loadMoreSentinel,
  loadingHasProblem: facilityLoadingHasProblem,
  problemDescription: facilityProblemDescription,
  problemTitle: facilityProblemTitle,
  retry: retryFacilities,
  visibleLoading: visibleFacilityLoading,
} = useContentListRuntime({
  error,
  hasMore,
  loadMore: () => load(true),
  loading,
  loadingMore,
  refresh: () => load(),
});
const searchHint = computed(() => {
  const draft = normalizeSearchText(query.value);
  const committed = normalizeSearchText(committedQuery.value);
  if (draft !== committed) return t('issue.search.pressEnterToSearch');
  if (!committed) return t('issue.search.enterTheKeywordAndPressEnterToSearch');
  if (committed.length < 3) return t('facility.search.loadedOnlyHint');
  return t('facility.searchForQuery', { query: committedQuery.value });
});
const emptyDescription = computed(() => committedQuery.value.trim()
  ? t('facility.noFacilityReportsMatchQuery', { query: committedQuery.value.trim() })
  : t('facility.noFacilityReportsInStatus', { status: t(bucket.value === 'closed' ? 'facility.caseClosed' : 'facility.processing') }));

watch(category, (value) => {
  if (!findFacilityCategory(value)?.isActive) {
    category.value = getDefaultFacilityCategoryId();
    return;
  }
  const current = Array.isArray(route.query.category) ? route.query.category[0] : route.query.category;
  if (current === value) return;
  void router.replace({ query: { ...route.query, category: value } });
});
watch(() => route.query.category, (value) => {
  const requested = Array.isArray(value) ? value[0] : value;
  if (requested && findFacilityCategory(requested)?.isActive && requested !== category.value) {
    category.value = requested;
  }
});

function openDetails(facility: FacilitySummary) {
  void router.push({ name: 'facility-detail', params: { facilityId: facility.id } });
}

function handleSubmitted(facility: FacilityRecord) {
  if (facility.category_id === category.value) facilities.value.unshift(facility);
}

async function handleToggleAffected(facility: FacilitySummary) {
  try {
    await toggleAffected(facility);
  } catch (caught) {
    show(caught instanceof Error ? t(caught.message) : t('facility.theOperationFailedPleaseTryAgainLater'), 'error');
  }
}

function openStatusDialog(facility: FacilitySummary) {
  selectedFacility.value = facility;
  statusError.value = '';
  statusDialogOpen.value = true;
}
function closeStatusDialog() {
  if (!statusSaving.value) statusDialogOpen.value = false;
}
async function submitStatus(status: FacilityStatus, result: string) {
  if (!selectedFacility.value || statusSaving.value) return;
  statusSaving.value = true;
  statusError.value = '';
  try {
    await changeStatus(selectedFacility.value, status, result);
    statusDialogOpen.value = false;
  } catch (caught) {
    statusError.value = caught instanceof Error ? t(caught.message) : t('facility.updateFailedPleaseTryAgainLater');
  } finally {
    statusSaving.value = false;
  }
}
function openDeleteDialog(facility: FacilitySummary) {
  selectedFacility.value = facility;
  deleteDialogOpen.value = true;
}
function closeDeleteDialog() {
  if (!deleting.value) deleteDialogOpen.value = false;
}
async function confirmDelete() {
  if (!selectedFacility.value || deleting.value) return;
  deleting.value = true;
  try {
    await remove(selectedFacility.value);
    deleteDialogOpen.value = false;
  } catch (caught) {
    show(caught instanceof Error ? t(caught.message) : t('facility.deletionFailedPleaseTryAgainLater'), 'error');
  } finally {
    deleting.value = false;
  }
}
</script>
