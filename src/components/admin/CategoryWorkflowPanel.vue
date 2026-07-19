<template>
  <section class="space-y-5" aria-labelledby="category-workflow-title">
    <SectionHeader
      id="category-workflow-title"
      :title="t('adminCenter.categorySectionTitle')"
      :description="t('adminCenter.categorySectionDescription')"
    />

    <SurfacePanel variant="inset" padding="md" class="grid gap-3 md:grid-cols-3">
      <div>
        <p class="text-xs font-semibold text-ink-500">{{ t('adminCenter.proposalCategoryCount') }}</p>
        <p class="mt-1 text-xl font-bold text-ink-950 dark:text-ink-50">{{ issueCategories.length }}</p>
      </div>
      <div>
        <p class="text-xs font-semibold text-ink-500">{{ t('adminCenter.facilityCategoryCount') }}</p>
        <p class="mt-1 text-xl font-bold text-ink-950 dark:text-ink-50">{{ facilityCategories.length }}</p>
      </div>
      <div>
        <p class="text-xs font-semibold text-ink-500">{{ t('adminCenter.privacyRule') }}</p>
        <p class="mt-1 text-sm font-semibold leading-5 text-ink-900 dark:text-ink-100">
          {{ t('categoryAdmin.permanentlyLocked') }}
        </p>
      </div>
    </SurfacePanel>

    <SurfacePanel variant="inset" padding="md">
      <p class="text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('categoryAdmin.policyNoticeTitle') }}</p>
      <p class="mt-1 text-xs leading-5 text-ink-500">{{ t('categoryAdmin.policyNoticeDescription') }}</p>
    </SurfacePanel>

    <EmptyStatePanel v-if="error" title="categoryAdmin.loadFailed" :description="error" icon="warning" />
    <div v-if="loading" class="space-y-3">
      <SurfacePanel v-for="index in 2" :key="index" padding="lg">
        <SkeletonBlock class="h-44 w-full rounded-xl" />
      </SurfacePanel>
    </div>

    <template v-else>
      <CategoryManagementSection
        v-model="issueCategories"
        kind="issue"
        :title="t('categoryAdmin.proposalCategories')"
        :description="t('categoryAdmin.proposalManagementHelp')"
        :on-save="saveIssue"
        @add="addIssue"
      />
      <CategoryManagementSection
        v-model="facilityCategories"
        kind="facility"
        :title="t('categoryAdmin.facilityCategories')"
        :description="t('categoryAdmin.facilityManagementHelp')"
        :on-save="saveFacility"
        @add="addFacility"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import CategoryManagementSection from '@/components/categories/CategoryManagementSection.vue';
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import SectionHeader from '@/components/ui/molecules/SectionHeader.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useCategories } from '@/composables/useCategories';
import { useI18n } from '@/i18n';
import { getCategoryManagement, saveFacilityCategory, saveIssueCategory } from '@/services/categories';
import type { FacilityCategoryConfig, IssueCategoryConfig } from '@/types/categories';

const { t } = useI18n();
const { refresh } = useCategories();
const loading = ref(true);
const error = ref('');
const issueCategories = ref<IssueCategoryConfig[]>([]);
const facilityCategories = ref<FacilityCategoryConfig[]>([]);

function newIssue(index: number): IssueCategoryConfig {
  return {
    id: '', label: '', description: '', readAccess: 'school', authorVisible: true,
    supportEnabled: false, supportGoal: null, supportDeadlineDays: null,
    responseDeadlineDays: null, commentsEnabled: true, isActive: true,
    isDefault: issueCategories.value.length === 0, sortOrder: index,
  };
}

function newFacility(index: number): FacilityCategoryConfig {
  return {
    id: '', label: '', description: '', isActive: true,
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
  } catch (caught) {
    error.value = t(caught instanceof Error ? caught.message : 'common.loadFailed');
  } finally {
    loading.value = false;
  }
}

async function saveIssue(index: number) {
  issueCategories.value[index] = await saveIssueCategory({ ...issueCategories.value[index], sortOrder: index });
  await refresh();
}

async function saveFacility(index: number) {
  facilityCategories.value[index] = await saveFacilityCategory({ ...facilityCategories.value[index], sortOrder: index });
  await refresh();
}

onMounted(() => { void load(); });
</script>
