<template>
  <section class="space-y-5" aria-labelledby="category-workflow-title">
    <h2 id="category-workflow-title" class="sr-only">{{ t('adminCenter.categorySectionTitle') }}</h2>

    <div class="grid gap-3 pb-1 sm:grid-cols-2" role="group" :aria-label="t('adminCenter.categorySectionTitle')">
      <SelectionOptionButton
        v-for="option in kindOptions"
        :key="option.value"
        :label="option.label"
        :description="option.description"
        :selected="activeCategoryKind === option.value"
        @select="activeCategoryKind = option.value"
      />
    </div>

    <EmptyStatePanel v-if="error" title="categoryAdmin.loadFailed" :description="error" icon="warning" />

    <div v-if="loading" class="space-y-3" aria-busy="true" :aria-label="t('common.loading')">
      <SurfacePanel padding="md" class="space-y-3">
        <SkeletonBlock class="block h-4 w-28 rounded" />
        <SkeletonBlock class="block h-3 w-2/3 rounded" />
        <SkeletonBlock class="h-14 w-full rounded-[var(--radius-inner)]" />
      </SurfacePanel>
      <div class="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <SurfacePanel variant="list" padding="sm" class="space-y-2">
          <SkeletonBlock class="block h-3 w-20 rounded" />
          <div
            v-for="index in 3"
            :key="index"
            class="skeleton-enter flex items-center gap-3 rounded-[var(--radius-inner)] px-3 py-3"
            :style="{ '--skeleton-enter-index': index - 1 }"
          >
            <div class="min-w-0 flex-1 space-y-2">
              <SkeletonBlock class="block h-4 w-24 rounded" />
              <SkeletonBlock class="block h-3 w-16 rounded" />
            </div>
            <SkeletonBlock class="h-3 w-10 rounded" />
          </div>
        </SurfacePanel>
        <SurfacePanel padding="lg" class="space-y-4">
          <SkeletonBlock class="block h-3 w-16 rounded" />
          <SkeletonBlock class="block h-5 w-40 rounded" />
          <SkeletonBlock class="block h-10 w-full rounded-xl" />
          <SkeletonBlock class="block h-10 w-full rounded-xl" />
          <SkeletonBlock class="block h-24 w-full rounded-xl" />
        </SurfacePanel>
      </div>
    </div>

    <template v-else>
      <div class="space-y-2">
        <PlatformFeatureToggle
          :label="activeFeatureToggle.label"
          :description="activeFeatureToggle.description"
          :enabled="activeFeatureToggle.enabled"
          :disabled="saving"
          @toggle="toggleFeature(activeCategoryKind)"
        />
        <InlineMessage v-if="featureError">{{ featureError }}</InlineMessage>
      </div>

      <CategoryManagementSection
        v-if="activeCategoryKind === 'issue'"
        v-model="issueCategories"
        kind="issue"
        :title="t('categoryAdmin.proposalCategories')"
        :description="t('categoryAdmin.proposalManagementHelp')"
        :on-delete="deleteIssue"
        @add="addIssue"
      />
      <CategoryManagementSection
        v-else
        v-model="facilityCategories"
        kind="facility"
        :title="t('categoryAdmin.facilityCategories')"
        :description="t('categoryAdmin.facilityManagementHelp')"
        :on-delete="deleteFacility"
        @add="addFacility"
      />
    </template>

    <div v-if="!loading" class="flex flex-col items-stretch gap-3 border-t border-ink-100 pt-4 dark:border-ink-800 sm:flex-row sm:items-center sm:justify-end">
      <InlineMessage v-if="saveError" class="min-w-0 flex-1">{{ saveError }}</InlineMessage>
      <AppButton variant="primary" :disabled="saving" @click="saveAll">
        <BusyButtonContent :busy="saving" :label="t('categoryAdmin.saveAllChanges')" :busy-label="t('common.saving')" />
      </AppButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import CategoryManagementSection from '@/components/categories/CategoryManagementSection.vue';
import PlatformFeatureToggle from '@/components/categories/PlatformFeatureToggle.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useCategories } from '@/composables/useCategories';
import { useI18n } from '@/i18n';
import {
  deleteCategory,
  getCategoryManagement,
  saveCategoryManagement,
} from '@/services/categories';
import type { FacilityCategoryConfig, IssueCategoryConfig } from '@/types/categories';

const { t } = useI18n();
const { refresh } = useCategories();
const loading = ref(true);
const error = ref('');
const issueCategories = ref<IssueCategoryConfig[]>([]);
const facilityCategories = ref<FacilityCategoryConfig[]>([]);
const activeCategoryKind = ref<'issue' | 'facility'>('issue');
const issuesEnabled = ref(true);
const facilitiesEnabled = ref(true);
const featureError = ref('');
const saving = ref(false);
const saveError = ref('');

const kindOptions = computed(() => [
  { value: 'issue' as const, label: t('categoryAdmin.proposalCategories'), description: t('categoryAdmin.proposalManagementHelp') },
  { value: 'facility' as const, label: t('categoryAdmin.facilityCategories'), description: t('categoryAdmin.facilityManagementHelp') },
]);

const activeFeatureToggle = computed(() => activeCategoryKind.value === 'issue'
  ? {
    description: 'categoryAdmin.proposalFeatureHelp',
    enabled: issuesEnabled.value,
    label: 'categoryAdmin.proposalFeature',
  }
  : {
    description: 'categoryAdmin.facilityFeatureHelp',
    enabled: facilitiesEnabled.value,
    label: 'categoryAdmin.facilityFeature',
  });

function newIssue(index: number): IssueCategoryConfig {
  return {
    id: '', label: '', readAccess: 'school', authorVisible: true,
    supportEnabled: false, supportGoal: null, supportDeadlineDays: null,
    responseDeadlineDays: null, commentsEnabled: true, isActive: true,
    isDefault: issueCategories.value.length === 0, sortOrder: index,
  };
}

function newFacility(index: number): FacilityCategoryConfig {
  return {
    id: '', label: '', isActive: true,
    isDefault: facilityCategories.value.length === 0, sortOrder: index,
  };
}

function addIssue() { issueCategories.value.push(newIssue(issueCategories.value.length)); }
function addFacility() { facilityCategories.value.push(newFacility(facilityCategories.value.length)); }

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await getCategoryManagement();
    issueCategories.value = result.issueCategories;
    facilityCategories.value = result.facilityCategories;
    issuesEnabled.value = result.features.issuesEnabled;
    facilitiesEnabled.value = result.features.facilitiesEnabled;
  } catch (caught) {
    error.value = t(caught instanceof Error ? caught.message : 'common.loadFailed');
  } finally {
    loading.value = false;
  }
}

function toggleFeature(kind: 'facility' | 'issue') {
  if (loading.value || saving.value) return;
  featureError.value = '';
  if (kind === 'facility') facilitiesEnabled.value = !facilitiesEnabled.value;
  else issuesEnabled.value = !issuesEnabled.value;
}

async function saveAll() {
  if (saving.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    const result = await saveCategoryManagement({
      facilitiesEnabled: facilitiesEnabled.value,
      facilityCategories: facilityCategories.value.map((category, sortOrder) => ({ ...category, sortOrder })),
      issueCategories: issueCategories.value.map((category, sortOrder) => ({ ...category, sortOrder })),
      issuesEnabled: issuesEnabled.value,
    });
    facilityCategories.value = result.facilityCategories;
    issueCategories.value = result.issueCategories;
    facilitiesEnabled.value = result.features.facilitiesEnabled;
    issuesEnabled.value = result.features.issuesEnabled;
    await refresh();
  } catch (caught) {
    saveError.value = t(caught instanceof Error ? caught.message : 'common.saveFailed');
  } finally {
    saving.value = false;
  }
}

async function deleteIssue(index: number) {
  const category = issueCategories.value[index];
  if (category.id) {
    await deleteCategory({ kind: 'issue', id: category.id });
  }
  issueCategories.value.splice(index, 1);
  await refresh();
}

async function deleteFacility(index: number) {
  const category = facilityCategories.value[index];
  if (category.id) {
    await deleteCategory({ kind: 'facility', id: category.id });
  }
  facilityCategories.value.splice(index, 1);
  await refresh();
}

onMounted(() => { void load(); });
</script>
