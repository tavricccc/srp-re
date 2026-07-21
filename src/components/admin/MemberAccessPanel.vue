<template>
  <section class="space-y-5" aria-labelledby="member-access-title">
    <SectionHeader
      id="member-access-title"
      :title="t('adminCenter.memberSectionTitle')"
      :description="t('adminCenter.memberSectionDescription')"
    />

    <SurfacePanel padding="lg" class="space-y-5">
      <div class="flex items-start gap-3">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white dark:bg-ink-50 dark:text-ink-950">1</span>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-bold text-ink-950 dark:text-ink-50">{{ t('adminCenter.chooseResponsibilityStep') }}</h3>
          <p class="mt-1 text-xs leading-5 text-ink-500">{{ t('adminCenter.chooseResponsibilityHelp') }}</p>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-3" role="group" :aria-label="t('adminCenter.chooseResponsibilityStep')">
        <SelectionOptionButton
          v-for="option in scopeOptions"
          :key="option.value"
          :label="option.label"
          :description="option.description"
          :selected="scopeKind === option.value"
          :disabled="Boolean(savingUid)"
          @select="scopeKind = option.value"
        />
      </div>

      <div v-if="scopeKind === 'issue' || scopeKind === 'facility'" class="space-y-2">
        <p class="text-xs font-semibold text-ink-700 dark:text-ink-300">{{ t('adminCenter.chooseCategoryPrompt') }}</p>
        <div class="grid gap-2 sm:grid-cols-2" role="group" :aria-label="t('adminCenter.chooseCategoryPrompt')">
          <SelectionOptionButton
            v-for="category in selectableCategories"
            :key="category.id"
            :label="category.label"
            :description="categoryDescription(category.label)"
            :selected="selectedCategoryId === category.id"
            :disabled="Boolean(savingUid)"
            @select="selectedCategoryId = category.id"
          />
        </div>
      </div>
      <EmptyStatePanel
        v-if="(scopeKind === 'issue' || scopeKind === 'facility') && selectableCategories.length === 0"
        title="categoryAdmin.noCategoriesAvailable"
        description="adminCenter.noAssignableCategoriesHelp"
        icon="warning"
      />

      <div
        v-if="scopeReady"
        ref="memberDirectory"
        class="scroll-mt-24 space-y-4 border-t border-ink-100 pt-5 focus:outline-none dark:border-ink-800"
        tabindex="-1"
        aria-labelledby="current-assignees-title"
      >
        <div class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white dark:bg-ink-50 dark:text-ink-950">2</span>
          <div class="min-w-0 flex-1">
            <h3 id="current-assignees-title" class="text-sm font-bold text-ink-950 dark:text-ink-50">{{ t('adminCenter.currentAssigneesStep') }}</h3>
            <p class="mt-1 text-xs leading-5 text-ink-500">
              {{ t('adminCenter.currentAssigneesCount', { count: assignees.length, scope: selectedScopeLabel }) }}
            </p>
          </div>
        </div>

        <InlineMessage v-if="membersLoading">{{ t('common.loading') }}</InlineMessage>
        <InlineMessage v-else-if="memberError" tone="error">{{ memberError }}</InlineMessage>
        <InlineMessage v-if="membersTruncated" tone="warning">{{ t('adminCenter.memberListTruncated') }}</InlineMessage>
        <EmptyStatePanel
          v-if="!membersLoading && !memberError && assignees.length === 0"
          title="adminCenter.noCurrentAssignees"
          description="adminCenter.noCurrentAssigneesHelp"
          icon="lock"
        />
        <SurfacePanel v-else-if="assignees.length" variant="list">
          <ListSurfaceRow v-for="assignee in assignees" :key="assignee.uid" as="div" class="flex flex-wrap items-center gap-3">
            <UserAvatar :photo-url="assignee.photoUrl" :name="assignee.name" size="md" />
            <div class="min-w-0 flex-1">
              <h4 class="truncate text-sm font-bold text-ink-900 dark:text-ink-100">{{ assignee.name }}</h4>
              <p class="mt-0.5 truncate text-xs text-ink-500">{{ assignee.email || assignee.uid }}</p>
              <p class="mt-1 text-xs text-ink-500">{{ accessSummary(assignee) }}</p>
            </div>
            <AppButton
              size="sm"
              variant="danger"
              class="shrink-0"
              :disabled="Boolean(savingUid)"
              @click="revokeAssignee(assignee)"
            >
              <BusyButtonContent
                :busy="savingUid === assignee.uid"
                :label="t('adminCenter.removeAccess')"
                :busy-label="t('common.saving')"
              />
            </AppButton>
          </ListSurfaceRow>
        </SurfacePanel>
      </div>

      <div v-if="scopeReady" class="space-y-4 border-t border-ink-100 pt-5 dark:border-ink-800">
        <div class="flex items-start gap-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white dark:bg-ink-50 dark:text-ink-950">3</span>
          <div class="min-w-0 flex-1">
            <label for="access-member-filter" class="block text-sm font-bold text-ink-950 dark:text-ink-50">
              {{ t('adminCenter.findMemberStep') }}
            </label>
            <p class="mt-1 text-xs leading-5 text-ink-500">{{ t('adminCenter.findMemberHelp') }}</p>
            <input
              id="access-member-filter"
              v-model="memberFilter"
              type="search"
              class="field mt-3 w-full"
              autocomplete="off"
              :placeholder="t('adminCenter.filterMembersPlaceholder')"
              :disabled="membersLoading || Boolean(savingUid)"
            />
          </div>
        </div>

        <InlineMessage v-if="membersLoading">{{ t('common.loading') }}</InlineMessage>
        <InlineMessage v-if="memberError" tone="error">{{ memberError }}</InlineMessage>
        <EmptyStatePanel
          v-if="!membersLoading && !memberError && filteredCandidates.length === 0"
          :title="memberFilter.trim() ? 'adminCenter.noMatchingMembers' : 'adminCenter.noAssignableMembers'"
          :description="memberFilter.trim() ? 'adminCenter.noMatchingMembersHelp' : 'adminCenter.noAssignableMembersHelp'"
          icon="inbox"
        />
        <SurfacePanel v-if="!membersLoading && filteredCandidates.length > 0" variant="list">
          <ListSurfaceRow v-for="candidate in filteredCandidates" :key="candidate.uid" as="div" class="flex flex-wrap items-center gap-3">
            <UserAvatar :photo-url="candidate.photoUrl" :name="candidate.name" size="md" />
            <div class="min-w-0 flex-1">
              <h4 class="truncate text-sm font-bold text-ink-900 dark:text-ink-100">{{ candidate.name }}</h4>
              <p class="mt-0.5 truncate text-xs text-ink-500">{{ candidate.email || candidate.uid }}</p>
              <p class="mt-1 text-xs text-ink-500">{{ accessSummary(candidate) }}</p>
            </div>
            <AppButton
              size="sm"
              variant="primary"
              class="shrink-0"
              :disabled="Boolean(savingUid)"
              @click="grantCandidate(candidate)"
            >
              <BusyButtonContent
                :busy="savingUid === candidate.uid"
                :label="t('adminCenter.grantAccess')"
                :busy-label="t('common.saving')"
              />
            </AppButton>
          </ListSurfaceRow>
        </SurfacePanel>
      </div>

      <p class="sr-only" aria-live="polite">{{ memberDirectoryStatus }}</p>
    </SurfacePanel>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import UserAvatar from '@/components/ui/atoms/UserAvatar.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import ListSurfaceRow from '@/components/ui/molecules/ListSurfaceRow.vue';
import SectionHeader from '@/components/ui/molecules/SectionHeader.vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useCategories } from '@/composables/useCategories';
import { useI18n } from '@/i18n';
import {
  listScopeMembers,
  setUserRoles,
  type AccessScope,
  type AccessUser,
} from '@/services/access';
import type { RoleCode } from '@/services/session-role';

type AccessScopeKind = 'issue' | 'facility' | 'announcement';

const { t } = useI18n();
const { activeFacilityCategories, activeIssueCategories, refresh } = useCategories();
const { show } = useActionFeedback();
const scopeKind = ref<AccessScopeKind>('issue');
const selectedCategoryId = ref('');
const memberFilter = ref('');
const savingUid = ref('');
const members = ref<AccessUser[]>([]);
const membersLoading = ref(false);
const membersTruncated = ref(false);
const memberError = ref('');
const memberDirectory = ref<HTMLElement | null>(null);
let memberRequestSequence = 0;

const scopeOptions = computed(() => [
  { value: 'issue' as const, label: t('adminCenter.proposalResponsibility'), description: t('adminCenter.proposalResponsibilityHelp') },
  { value: 'facility' as const, label: t('adminCenter.facilityResponsibility'), description: t('adminCenter.facilityResponsibilityHelp') },
  { value: 'announcement' as const, label: t('access.announcementManagement'), description: t('access.publishAndDeleteAnnouncements') },
]);

const selectableCategories = computed(() => scopeKind.value === 'issue'
  ? activeIssueCategories.value
  : scopeKind.value === 'facility' ? activeFacilityCategories.value : []);

const scopeReady = computed(() => scopeKind.value === 'announcement' || Boolean(selectedCategoryId.value));

const selectedAccessScope = computed<AccessScope | null>(() => {
  if (scopeKind.value === 'issue' || scopeKind.value === 'facility') {
    return selectedCategoryId.value ? { kind: scopeKind.value, categoryId: selectedCategoryId.value } : null;
  }
  return { kind: scopeKind.value };
});

const selectedCategory = computed(() => selectableCategories.value.find((category) => category.id === selectedCategoryId.value));
const selectedScopeLabel = computed(() => selectedCategory.value?.label
  ?? t('access.announcementManagement'));

function userHasSelectedAccess(accessUser: AccessUser) {
  if (scopeKind.value === 'issue') return accessUser.managedIssueCategoryIds.includes(selectedCategoryId.value);
  if (scopeKind.value === 'facility') return accessUser.managedFacilityCategoryIds.includes(selectedCategoryId.value);
  return accessUser.roles.includes('announcement-manager');
}

const assignees = computed(() => members.value.filter(userHasSelectedAccess));
const candidates = computed(() => members.value.filter((member) => !userHasSelectedAccess(member)));
const filteredCandidates = computed(() => {
  const query = memberFilter.value.trim().toLocaleLowerCase();
  if (!query) return candidates.value;
  return candidates.value.filter((member) => [member.name, member.email, member.uid]
    .some((value) => value?.toLocaleLowerCase().includes(query)));
});
const memberDirectoryStatus = computed(() => scopeReady.value
  ? t('adminCenter.memberDirectoryStatus', { assigned: assignees.value.length, available: candidates.value.length })
  : '');

function categoryDescription(label: string) {
  return scopeKind.value === 'issue'
    ? t('access.reviewAndManageProposalsInCategory', { category: label })
    : t('access.handleFacilityReportsInCategory', { category: label });
}

function accessSummary(accessUser: AccessUser) {
  const count = accessUser.roles.filter((role) => role !== 'platform-admin').length
    + accessUser.managedIssueCategoryIds.length
    + accessUser.managedFacilityCategoryIds.length;
  return t('adminCenter.scopedAccessSummary', { count });
}

async function loadMembers() {
  const scope = selectedAccessScope.value;
  const requestSequence = ++memberRequestSequence;
  if (!scope) {
    members.value = [];
    membersLoading.value = false;
    membersTruncated.value = false;
    memberError.value = '';
    return;
  }
  membersLoading.value = true;
  members.value = [];
  membersTruncated.value = false;
  memberError.value = '';
  try {
    const result = await listScopeMembers(scope);
    if (requestSequence !== memberRequestSequence) return;
    members.value = result.users;
    membersTruncated.value = result.truncated;
  } catch (caught) {
    if (requestSequence === memberRequestSequence) {
      memberError.value = t(caught instanceof Error ? caught.message : 'access.theSearchFailed');
    }
  } finally {
    if (requestSequence === memberRequestSequence) membersLoading.value = false;
  }
}

watch(scopeKind, () => {
  selectedCategoryId.value = '';
  memberFilter.value = '';
  memberError.value = '';
});

watch(selectableCategories, (categories) => {
  if ((scopeKind.value === 'issue' || scopeKind.value === 'facility')
    && !selectedCategoryId.value && categories.length === 1) {
    selectedCategoryId.value = categories[0]?.id ?? '';
  }
}, { immediate: true });

async function focusMemberDirectory() {
  await nextTick();
  memberDirectory.value?.focus({ preventScroll: true });
  memberDirectory.value?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

watch(selectedAccessScope, (scope) => {
  memberFilter.value = '';
  void loadMembers();
  if (scope) void focusMemberDirectory();
}, { immediate: true });

async function saveAccess(accessUser: AccessUser, grant: boolean) {
  savingUid.value = accessUser.uid;
  try {
    let roles: RoleCode[] = [...accessUser.roles];
    let issueIds = [...accessUser.managedIssueCategoryIds];
    let facilityIds = [...accessUser.managedFacilityCategoryIds];
    if (scopeKind.value === 'announcement') {
      roles = grant
        ? [...new Set([...roles.filter((role) => role !== 'platform-admin'), 'announcement-manager' as const])]
        : roles.filter((role) => role !== 'announcement-manager');
    } else if (scopeKind.value === 'issue') {
      issueIds = grant ? [...new Set([...issueIds, selectedCategoryId.value])] : issueIds.filter((id) => id !== selectedCategoryId.value);
    } else {
      facilityIds = grant ? [...new Set([...facilityIds, selectedCategoryId.value])] : facilityIds.filter((id) => id !== selectedCategoryId.value);
    }
    const result = await setUserRoles(accessUser.uid, roles, issueIds, facilityIds);
    const updated = { ...accessUser, ...result };
    members.value = members.value.map((member) => member.uid === accessUser.uid ? updated : member);
    show(t('adminCenter.accessSaved'), 'success');
    return true;
  } catch (caught) {
    const message = t(caught instanceof Error ? caught.message : 'access.saveFailed');
    memberError.value = message;
    return false;
  } finally {
    savingUid.value = '';
  }
}

async function grantCandidate(accessUser: AccessUser) {
  memberError.value = '';
  await saveAccess(accessUser, true);
}

async function revokeAssignee(accessUser: AccessUser) {
  memberError.value = '';
  await saveAccess(accessUser, false);
}

onMounted(async () => {
  await refresh();
});
</script>
