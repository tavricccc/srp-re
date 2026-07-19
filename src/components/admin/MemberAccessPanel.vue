<template>
  <section class="space-y-5" aria-labelledby="member-access-title">
    <SectionHeader
      id="member-access-title"
      :title="t('adminCenter.memberSectionTitle')"
      :description="t('adminCenter.memberSectionDescription')"
    />

    <SurfacePanel as="form" padding="lg" @submit.prevent="findUser">
      <div class="flex items-start gap-3">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white dark:bg-ink-50 dark:text-ink-950">1</span>
        <div class="min-w-0 flex-1">
          <label for="access-user-lookup" class="block text-sm font-bold text-ink-950 dark:text-ink-50">
            {{ t('adminCenter.findMemberStep') }}
          </label>
          <p class="mt-1 text-xs leading-5 text-ink-500">{{ t('adminCenter.findMemberHelp') }}</p>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              id="access-user-lookup"
              v-model="lookup"
              class="field min-w-0 flex-1"
              autocomplete="off"
              inputmode="email"
              :placeholder="t('access.enterYourCampusEmailOrUid')"
              :disabled="loading || Boolean(savingUid)"
            />
            <AppButton type="submit" variant="primary" class="shrink-0" :disabled="loading || Boolean(savingUid) || !lookup.trim()">
              <BusyButtonContent :busy="loading" :label="t('access.find')" :busy-label="t('access.searching')" />
            </AppButton>
          </div>
        </div>
      </div>
    </SurfacePanel>

    <EmptyStatePanel v-if="error && !user" title="access.unableToFindUser" :description="error" icon="warning" />
    <EmptyStatePanel
      v-else-if="!user"
      title="adminCenter.noMemberSelected"
      description="adminCenter.noMemberSelectedHelp"
      icon="lock"
    />

    <SurfacePanel v-else as="article" padding="lg" class="space-y-6">
      <div class="flex items-start gap-3 border-b border-ink-100 pb-5 dark:border-ink-800">
        <UserAvatar :photo-url="user.photoUrl" :name="user.name" size="md" />
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-base font-bold text-ink-900 dark:text-ink-100">{{ user.name }}</h2>
          <p class="mt-0.5 truncate text-xs text-ink-500">{{ user.email || user.uid }}</p>
          <p class="mt-2 text-xs font-semibold text-primary-700 dark:text-primary-300">{{ accessSummary }}</p>
        </div>
        <span v-if="savingUid" class="text-xs font-semibold text-ink-500">{{ t('common.saving') }}</span>
      </div>

      <div class="flex items-start gap-3">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white dark:bg-ink-50 dark:text-ink-950">2</span>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-bold text-ink-950 dark:text-ink-50">{{ t('adminCenter.assignResponsibilityStep') }}</h3>
          <p class="mt-1 text-xs leading-5 text-ink-500">{{ t('adminCenter.assignResponsibilityHelp') }}</p>
        </div>
      </div>

      <div class="space-y-5">
        <div>
          <p class="field-label mb-2">{{ t('adminCenter.fullPlatformAccess') }}</p>
          <SelectionOptionButton
            label="access.platformAdministrator"
            description="adminCenter.platformAdminWarning"
            :selected="isPlatformAdmin"
            :disabled="Boolean(savingUid)"
            @select="togglePlatformAdmin"
          />
        </div>

        <div>
          <p class="field-label mb-1">{{ t('adminCenter.proposalResponsibility') }}</p>
          <p class="mb-2 text-xs leading-5 text-ink-500">{{ t('adminCenter.proposalResponsibilityHelp') }}</p>
          <div class="grid gap-2 md:grid-cols-2">
            <SelectionOptionButton
              v-for="category in activeIssueCategories"
              :key="category.id"
              :label="t('access.manageCategory', { category: category.label })"
              :description="t('access.reviewAndManageProposalsInCategory', { category: category.label })"
              :selected="isPlatformAdmin || user.managedIssueCategoryIds.includes(category.id)"
              :disabled="Boolean(savingUid) || isPlatformAdmin"
              @select="toggleCategory(category.id)"
            />
          </div>
        </div>

        <div>
          <p class="field-label mb-1">{{ t('adminCenter.facilityResponsibility') }}</p>
          <p class="mb-2 text-xs leading-5 text-ink-500">{{ t('adminCenter.facilityResponsibilityHelp') }}</p>
          <div class="grid gap-2 md:grid-cols-2">
            <SelectionOptionButton
              v-for="category in activeFacilityCategories"
              :key="category.id"
              :label="t('access.manageCategory', { category: category.label })"
              :description="t('access.handleFacilityReportsInCategory', { category: category.label })"
              :selected="isPlatformAdmin || user.managedFacilityCategoryIds.includes(category.id)"
              :disabled="Boolean(savingUid) || isPlatformAdmin"
              @select="toggleFacilityCategory(category.id)"
            />
          </div>
        </div>

        <div>
          <p class="field-label mb-1">{{ t('adminCenter.otherResponsibility') }}</p>
          <p class="mb-2 text-xs leading-5 text-ink-500">{{ t('adminCenter.otherResponsibilityHelp') }}</p>
          <SelectionOptionButton
            label="access.announcementManagement"
            description="access.publishAndDeleteAnnouncements"
            :selected="isPlatformAdmin || user.roles.includes('announcement-manager')"
            :disabled="Boolean(savingUid) || isPlatformAdmin"
            @select="toggleScopedRole('announcement-manager')"
          />
        </div>
      </div>

      <InlineMessage v-if="error">{{ error }}</InlineMessage>

      <p class="border-t border-ink-100 pt-4 text-xs leading-5 text-ink-500 dark:border-ink-800">
        {{ t('adminCenter.autoSaveHelp') }}
      </p>
    </SurfacePanel>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import UserAvatar from '@/components/ui/atoms/UserAvatar.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import SectionHeader from '@/components/ui/molecules/SectionHeader.vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useCategories } from '@/composables/useCategories';
import { useI18n } from '@/i18n';
import { listRoleAssignments, setUserRoles, type AccessUser } from '@/services/access';
import type { RoleCode } from '@/services/session-role';

const lookup = ref('');
const { t } = useI18n();
const { activeFacilityCategories, activeIssueCategories, refresh } = useCategories();
const { show } = useActionFeedback();
const user = ref<AccessUser | null>(null);
const loading = ref(false);
const error = ref('');
const savingUid = ref('');
const isPlatformAdmin = computed(() => user.value?.roles.includes('platform-admin') === true);
const responsibilityCount = computed(() => {
  if (!user.value || isPlatformAdmin.value) return 0;
  return user.value.managedIssueCategoryIds.length
    + user.value.managedFacilityCategoryIds.length
    + Number(user.value.roles.includes('announcement-manager'));
});
const accessSummary = computed(() => isPlatformAdmin.value
  ? t('adminCenter.fullAccessSummary')
  : t('adminCenter.scopedAccessSummary', { count: responsibilityCount.value }));

async function findUser() {
  const query = lookup.value.trim();
  if (!query) return;
  loading.value = true;
  error.value = '';
  user.value = null;
  try {
    const matches = await listRoleAssignments(query);
    user.value = matches[0] ?? null;
    if (!user.value) error.value = t('access.userNotFoundHelp');
  } catch (caught) {
    error.value = caught instanceof Error ? t(caught.message) : t('access.theSearchFailed');
  } finally {
    loading.value = false;
  }
}

async function saveAccess(roles: RoleCode[], categories: string[], facilityCategories: string[]) {
  if (!user.value) return;
  savingUid.value = user.value.uid;
  error.value = '';
  try {
    const result = await setUserRoles(user.value.uid, roles, categories, facilityCategories);
    user.value.roles = result.roles;
    user.value.managedIssueCategoryIds = result.managedIssueCategoryIds;
    user.value.managedFacilityCategoryIds = result.managedFacilityCategoryIds;
    show(t('adminCenter.accessSaved'), 'success');
  } catch (caught) {
    error.value = caught instanceof Error ? t(caught.message) : t('access.saveFailed');
  } finally {
    savingUid.value = '';
  }
}

async function togglePlatformAdmin() {
  if (!user.value) return;
  await saveAccess(isPlatformAdmin.value ? [] : ['platform-admin'], [], []);
}

async function toggleCategory(categoryId: string) {
  if (!user.value || isPlatformAdmin.value) return;
  const categories = user.value.managedIssueCategoryIds.includes(categoryId)
    ? user.value.managedIssueCategoryIds.filter((value) => value !== categoryId)
    : [...user.value.managedIssueCategoryIds, categoryId];
  await saveAccess(user.value.roles.filter((role) => role !== 'proposal-manager'), categories, user.value.managedFacilityCategoryIds);
}

async function toggleFacilityCategory(categoryId: string) {
  if (!user.value || isPlatformAdmin.value) return;
  const categories = user.value.managedFacilityCategoryIds.includes(categoryId)
    ? user.value.managedFacilityCategoryIds.filter((value) => value !== categoryId)
    : [...user.value.managedFacilityCategoryIds, categoryId];
  await saveAccess(user.value.roles.filter((role) => role !== 'general-affairs'), user.value.managedIssueCategoryIds, categories);
}

async function toggleScopedRole(role: Extract<RoleCode, 'announcement-manager'>) {
  if (!user.value || isPlatformAdmin.value) return;
  const roles = user.value.roles.includes(role)
    ? user.value.roles.filter((value) => value !== role)
    : [...user.value.roles.filter((value) => value !== 'proposal-manager'), role];
  await saveAccess(roles, user.value.managedIssueCategoryIds, user.value.managedFacilityCategoryIds);
}

onMounted(() => { void refresh(); });
</script>
