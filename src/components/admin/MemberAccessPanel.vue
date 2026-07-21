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

        <SurfacePanel
          v-if="membersLoading"
          variant="list"
          aria-busy="true"
          :aria-label="t('common.loading')"
        >
          <ListSurfaceRow
            v-for="index in 2"
            :key="`assignee-skeleton-${index}`"
            as="div"
            class="skeleton-enter flex flex-wrap items-center gap-3"
            :style="{ '--skeleton-enter-index': index - 1 }"
          >
            <SkeletonBlock class="h-10 w-10 shrink-0 rounded-full" />
            <div class="min-w-0 flex-1 space-y-2">
              <SkeletonBlock class="block h-4 w-28 rounded" />
              <SkeletonBlock class="block h-3 w-40 rounded" />
            </div>
            <SkeletonBlock class="h-9 w-20 rounded-full" />
          </ListSurfaceRow>
        </SurfacePanel>
        <InlineMessage v-else-if="memberError" tone="error">{{ memberError }}</InlineMessage>
        <InlineMessage v-if="membersTruncated" tone="warning">{{ t('adminCenter.memberListTruncated') }}</InlineMessage>
        <EmptyStatePanel
          v-if="!membersLoading && !memberError && assignees.length === 0"
          title="adminCenter.noCurrentAssignees"
          description="adminCenter.noCurrentAssigneesHelp"
          icon="lock"
        />
        <SurfacePanel v-else-if="!membersLoading && assignees.length" variant="list">
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
            <label for="access-member-lookup" class="block text-sm font-bold text-ink-950 dark:text-ink-50">
              {{ t('adminCenter.findMemberStep') }}
            </label>
            <p class="mt-1 text-xs leading-5 text-ink-500">{{ t('adminCenter.findMemberHelp') }}</p>
            <div class="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="access-member-lookup"
                v-model="memberLookup"
                type="search"
                class="field min-w-0 flex-1"
                autocomplete="off"
                :placeholder="t('adminCenter.lookupMemberPlaceholder')"
                :disabled="Boolean(savingUid)"
                @keydown.enter.prevent="lookupMember"
              />
              <AppButton
                variant="secondary"
                class="shrink-0"
                :disabled="!canLookup || Boolean(savingUid)"
                @click="lookupMember"
              >
                <BusyButtonContent
                  :busy="lookupLoading"
                  :label="t('adminCenter.lookupMember')"
                  :busy-label="t('common.loading')"
                />
              </AppButton>
            </div>
          </div>
        </div>

        <SurfacePanel
          v-if="lookupLoading"
          variant="list"
          aria-busy="true"
          :aria-label="t('common.loading')"
        >
          <ListSurfaceRow
            as="div"
            class="skeleton-enter flex flex-wrap items-center gap-3"
            :style="{ '--skeleton-enter-index': 0 }"
          >
            <SkeletonBlock class="h-10 w-10 shrink-0 rounded-full" />
            <div class="min-w-0 flex-1 space-y-2">
              <SkeletonBlock class="block h-4 w-28 rounded" />
              <SkeletonBlock class="block h-3 w-40 rounded" />
            </div>
            <SkeletonBlock class="h-9 w-20 rounded-full" />
          </ListSurfaceRow>
        </SurfacePanel>
        <InlineMessage v-else-if="lookupError" tone="error">{{ lookupError }}</InlineMessage>
        <EmptyStatePanel
          v-else-if="lookupAttempted && !lookupCandidate"
          title="adminCenter.noMatchingMembers"
          description="adminCenter.noMatchingMembersHelp"
          icon="inbox"
        />
        <EmptyStatePanel
          v-else-if="!lookupAttempted"
          title="adminCenter.noMemberSelected"
          description="adminCenter.noMemberSelectedHelp"
          icon="inbox"
        />
        <SurfacePanel v-else-if="lookupCandidate" variant="list">
          <ListSurfaceRow as="div" class="flex flex-wrap items-center gap-3">
            <UserAvatar :photo-url="lookupCandidate.photoUrl" :name="lookupCandidate.name" size="md" />
            <div class="min-w-0 flex-1">
              <h4 class="truncate text-sm font-bold text-ink-900 dark:text-ink-100">{{ lookupCandidate.name }}</h4>
              <p class="mt-0.5 truncate text-xs text-ink-500">{{ lookupCandidate.email || lookupCandidate.uid }}</p>
              <p class="mt-1 text-xs text-ink-500">{{ accessSummary(lookupCandidate) }}</p>
              <p class="mt-1 text-xs font-semibold" :class="userHasSelectedAccess(lookupCandidate) ? 'text-success' : 'text-ink-500'">
                {{ t(userHasSelectedAccess(lookupCandidate) ? 'adminCenter.accessAlreadyGranted' : 'adminCenter.accessNotGranted') }}
              </p>
            </div>
            <AppButton
              v-if="!userHasSelectedAccess(lookupCandidate)"
              size="sm"
              variant="primary"
              class="shrink-0"
              :disabled="Boolean(savingUid)"
              @click="grantCandidate(lookupCandidate)"
            >
              <BusyButtonContent
                :busy="savingUid === lookupCandidate.uid"
                :label="t('adminCenter.grantAccess')"
                :busy-label="t('common.saving')"
              />
            </AppButton>
            <AppButton
              v-else
              size="sm"
              variant="danger"
              class="shrink-0"
              :disabled="Boolean(savingUid)"
              @click="revokeAssignee(lookupCandidate)"
            >
              <BusyButtonContent
                :busy="savingUid === lookupCandidate.uid"
                :label="t('adminCenter.removeAccess')"
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
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
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
  lookupAccessMember,
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
const memberLookup = ref('');
const savingUid = ref('');
const assignees = ref<AccessUser[]>([]);
const membersLoading = ref(false);
const membersTruncated = ref(false);
const memberError = ref('');
const lookupCandidate = ref<AccessUser | null>(null);
const lookupLoading = ref(false);
const lookupError = ref('');
const lookupAttempted = ref(false);
const memberDirectory = ref<HTMLElement | null>(null);
let assigneeRequestSequence = 0;
let lookupRequestSequence = 0;

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
const canLookup = computed(() => memberLookup.value.trim().length > 0);

function userHasSelectedAccess(accessUser: AccessUser) {
  if (scopeKind.value === 'issue') return accessUser.managedIssueCategoryIds.includes(selectedCategoryId.value);
  if (scopeKind.value === 'facility') return accessUser.managedFacilityCategoryIds.includes(selectedCategoryId.value);
  return accessUser.roles.includes('announcement-manager');
}

const memberDirectoryStatus = computed(() => scopeReady.value
  ? t('adminCenter.memberDirectoryStatus', {
    assigned: assignees.value.length,
    available: lookupCandidate.value && !userHasSelectedAccess(lookupCandidate.value) ? 1 : 0,
  })
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

async function loadAssignees() {
  const scope = selectedAccessScope.value;
  const requestSequence = ++assigneeRequestSequence;
  if (!scope) {
    assignees.value = [];
    membersLoading.value = false;
    membersTruncated.value = false;
    memberError.value = '';
    return;
  }
  membersLoading.value = true;
  assignees.value = [];
  membersTruncated.value = false;
  memberError.value = '';
  try {
    const result = await listScopeMembers(scope);
    if (requestSequence !== assigneeRequestSequence) return;
    assignees.value = result.users;
    membersTruncated.value = result.truncated;
  } catch (caught) {
    if (requestSequence === assigneeRequestSequence) {
      memberError.value = t(caught instanceof Error ? caught.message : 'access.theSearchFailed');
    }
  } finally {
    if (requestSequence === assigneeRequestSequence) membersLoading.value = false;
  }
}

async function lookupMember() {
  const query = memberLookup.value.trim();
  const scope = selectedAccessScope.value;
  if (!query || !scope || lookupLoading.value) return;
  const requestSequence = ++lookupRequestSequence;
  lookupLoading.value = true;
  lookupError.value = '';
  lookupAttempted.value = true;
  lookupCandidate.value = null;
  try {
    const result = await lookupAccessMember(query);
    if (requestSequence !== lookupRequestSequence) return;
    lookupCandidate.value = result.users[0] ?? null;
  } catch (caught) {
    if (requestSequence === lookupRequestSequence) {
      lookupError.value = t(caught instanceof Error ? caught.message : 'access.theSearchFailed');
    }
  } finally {
    if (requestSequence === lookupRequestSequence) lookupLoading.value = false;
  }
}

function resetLookup() {
  lookupCandidate.value = null;
  lookupError.value = '';
  lookupAttempted.value = false;
  lookupLoading.value = false;
  lookupRequestSequence += 1;
}

watch(scopeKind, () => {
  selectedCategoryId.value = '';
  memberLookup.value = '';
  memberError.value = '';
  resetLookup();
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
  memberLookup.value = '';
  resetLookup();
  void loadAssignees();
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
    if (grant) {
      if (!assignees.value.some((member) => member.uid === updated.uid)) {
        assignees.value = [...assignees.value, updated];
      } else {
        assignees.value = assignees.value.map((member) => member.uid === updated.uid ? updated : member);
      }
    } else {
      assignees.value = assignees.value.filter((member) => member.uid !== updated.uid);
    }
    if (lookupCandidate.value?.uid === updated.uid) lookupCandidate.value = updated;
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
