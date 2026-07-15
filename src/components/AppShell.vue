<template>
  <div
    class="app-root relative flex flex-col bg-[rgb(var(--color-page-background))]"
    :data-bottom-nav="isAllowedUser ? 'true' : 'false'"
    :data-sidebar-expanded="isSidebarExpanded ? 'true' : 'false'"
    :style="rootStyle"
    @focusin.capture="handleNavigationIntent"
    @pointerdown.capture="handleNavigationIntent"
    @pointerover.capture="handleNavigationIntent"
  >
    <div class="app-background-fill pointer-events-none absolute inset-0"></div>
    <div class="app-background-wash pointer-events-none absolute inset-x-0 top-0 h-80 dark:hidden"></div>

    <AppMobileHeader
      :back-label="mobileBackLabel"
      :show-back-button="showMobileBackButton"
      :title="mobileHeaderTitle"
      :has-unread="hasUnread"
      :notifications-active="route.name === 'notifications'"
      @back="handleMobileBack"
    />

    <AppDesktopSidebar
      v-if="isAllowedUser"
      :default-category="defaultCreateCategory"
      :default-kind="defaultCreateKind"
      :expanded="isSidebarExpanded"
      :has-unread="hasUnread"
      :home-route="homeRoute"
      :is-admin="canCreateAnnouncement"
      :items="primaryRouteNavItems"
      :notifications-active="route.name === 'notifications'"
      :photo-url="displayPhotoUrl"
      :profile-active="isProfileRouteActive"
      :school-label="schoolLabel"
      :user-name="userName"
      @create-announcement="handleCreateAnnouncement"
      @create-facility="handleCreateFacility"
      @create-issue="handleCreateIssue"
      @navigate="handleNavigationClick"
      @navigate-link="closeSidebarDrawerIfNeeded"
      @toggle="toggleSidebar"
    />

    <button
      v-if="isAllowedUser"
      type="button"
      class="app-sidebar__scrim"
      aria-label="收合側邊導覽"
      @click="closeSidebar"
    ></button>

    <div ref="mainContentRef" class="app-main-content relative flex flex-1 flex-col overflow-y-auto overscroll-contain px-4 sm:px-6 lg:px-8">
      <main class="min-h-0 flex-1"><slot /></main>
    </div>

    <AppMobileBottomNav
      v-if="isAllowedUser"
      :active-key="activeMobileNavKey"
      :bottom-gap="bottomGap"
      :default-category="defaultCreateCategory"
      :default-kind="defaultCreateKind"
      :is-admin="canCreateAnnouncement"
      :items="primaryRouteNavItems"
      :photo-url="displayPhotoUrl"
      :profile-active="isProfileRouteActive"
      :user-name="userName"
      @create-announcement="handleCreateAnnouncement"
      @create-facility="handleCreateFacility"
      @create-issue="handleCreateIssue"
      @navigate="handleNavigationClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppDesktopSidebar from '@/components/app-shell/AppDesktopSidebar.vue';
import AppMobileBottomNav from '@/components/app-shell/AppMobileBottomNav.vue';
import AppMobileHeader from '@/components/app-shell/AppMobileHeader.vue';
import { SCHOOL_NAME } from '@/constants/app';
import { DEFAULT_ISSUE_CATEGORY, DEFAULT_ISSUE_ROUTE_FILTER, isIssueCategory } from '@/constants/categories';
import { refreshFromActiveNavigation } from '@/composables/useActiveNavigationRefresh';
import { requestCreateAnnouncement, requestCreateFacility, requestCreateIssue } from '@/composables/useCreateEntryActions';
import { useIssueRouteFilter } from '@/composables/useIssueRouteFilter';
import { useNotificationBadge } from '@/composables/useNotificationBadge';
import { useSession } from '@/composables/useSession';
import type { IssueCategory } from '@/types';
import { preloadRoutePath } from '@/router/route-components';

const SIDEBAR_EXPANDED_STORAGE_KEY = 'novae:desktop-sidebar-expanded';
const MOBILE_NAV_HEIGHT = 60;
const SCROLL_POSITION_LIMIT = 30;

const { can, customPhotoUrl, isAllowedUser, user } = useSession();
const { activeFilter } = useIssueRouteFilter();
const { hasUnread } = useNotificationBadge();
const route = useRoute();
const router = useRouter();
const mainContentRef = ref<HTMLDivElement | null>(null);
const hasSafeIndicator = ref(false);
const isSidebarExpanded = ref(false);
const mainScrollPositions = new Map<string, number>();

const isIssueRouteActive = computed(() => route.name === 'issues' || route.name === 'issue-detail');
const isAnnouncementRouteActive = computed(() => route.name === 'announcements' || route.name === 'announcement-detail');
const isFacilityRouteActive = computed(() => route.name === 'facilities' || route.name === 'facility-detail');
const isMyProposalsRouteActive = computed(() => isIssueRouteActive.value && activeFilter.value === 'my-proposals');
const isProfileRouteActive = computed(() => isMyProposalsRouteActive.value || ['settings', 'dashboard', 'access-management'].includes(route.name as string));
const homeRoute = { name: 'issues', params: { filter: DEFAULT_ISSUE_ROUTE_FILTER } } as const;
const primaryRouteNavItems = computed(() => [
  {
    icon: 'comment' as const,
    isActive: isIssueRouteActive.value && activeFilter.value !== 'my-proposals',
    key: 'issues',
    label: '提案',
    to: homeRoute,
  },
  {
    icon: 'wrench' as const,
    isActive: isFacilityRouteActive.value,
    key: 'facilities',
    label: '設備',
    to: { name: 'facilities' },
  },
  {
    icon: 'megaphone' as const,
    isActive: isAnnouncementRouteActive.value,
    key: 'announcements',
    label: '公告',
    to: { name: 'announcements' },
  },
]);
const displayPhotoUrl = computed(() => customPhotoUrl.value || user.value?.photoURL || null);
const userName = computed(() => user.value?.displayName || '使用者');
const schoolLabel = computed(() => SCHOOL_NAME || '學校未設定');
const canCreateAnnouncement = computed(() => can('announcement.manage'));
const defaultCreateCategory = computed<IssueCategory>(() => isIssueCategory(activeFilter.value) ? activeFilter.value : DEFAULT_ISSUE_CATEGORY);
const defaultCreateKind = computed(() => isFacilityRouteActive.value ? 'facility' as const : isAnnouncementRouteActive.value ? 'announcement' as const : 'issue' as const);
const bottomGap = computed(() => hasSafeIndicator.value ? 22 : 12);
const rootStyle = computed(() => isAllowedUser.value
  ? { '--app-bottom-nav-height': `${bottomGap.value + MOBILE_NAV_HEIGHT + 6}px` }
  : {});
const activeMobileNavKey = computed(() => {
  if (isAnnouncementRouteActive.value) return 'announcements';
  if (isFacilityRouteActive.value) return 'facilities';
  if (isProfileRouteActive.value) return 'settings';
  if (route.name === 'notifications') return 'notifications';
  if (isIssueRouteActive.value) return 'issues';
  return '';
});
const mobileHeaderTitle = computed(() => {
  if (route.name === 'issue-detail') return isMyProposalsRouteActive.value ? '我的提案' : '提案內容';
  if (route.name === 'facility-detail') return '設備';
  if (route.name === 'announcement-detail') return '公告內容';
  if (route.name === 'dashboard') return '統計';
  if (route.name === 'access-management') return '角色管理';
  if (route.name === 'notifications') return '通知';
  if (route.name === 'settings') return '我的';
  if (isAnnouncementRouteActive.value) return '公告';
  if (isFacilityRouteActive.value) return '設備';
  if (isMyProposalsRouteActive.value) return '我的提案';
  return '提案';
});
const showMobileBackButton = computed(() => ['issue-detail', 'facility-detail', 'announcement-detail', 'dashboard', 'access-management'].includes(route.name as string) || isMyProposalsRouteActive.value);
const mobileBackLabel = computed(() => {
  if (route.name === 'dashboard') return '返回我的';
  if (route.name === 'access-management') return '返回我的';
  if (route.name === 'issue-detail' && isMyProposalsRouteActive.value) return '返回我的提案';
  if (isMyProposalsRouteActive.value) return '返回我的';
  if (route.name === 'announcement-detail') return '返回公告列表';
  if (route.name === 'facility-detail') return '返回設備列表';
  return '返回提案列表';
});

async function handleCreateIssue(category: IssueCategory) {
  await requestCreateIssue(router, category);
}

async function handleCreateAnnouncement() {
  await requestCreateAnnouncement(router);
}

function handleNavigationClick(isActive: boolean) {
  if (isActive) void refreshFromActiveNavigation();
}

async function handleCreateFacility() {
  await requestCreateFacility(router);
}

function handleNavigationIntent(event: Event) {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>('a[href]');
  if (!link) return;

  const url = new URL(link.href, window.location.origin);
  if (url.origin !== window.location.origin) return;
  void preloadRoutePath(url.pathname);
}

function setSidebarExpanded(expanded: boolean) {
  isSidebarExpanded.value = expanded;
  window.localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, expanded ? 'true' : 'false');
}

function toggleSidebar() {
  setSidebarExpanded(!isSidebarExpanded.value);
}

function closeSidebar() {
  setSidebarExpanded(false);
}

function closeSidebarDrawerIfNeeded() {
  if (window.matchMedia('(min-width: 768px) and (max-width: 1399px)').matches) closeSidebar();
}

function handleSidebarKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isSidebarExpanded.value) closeSidebarDrawerIfNeeded();
}

async function handleMobileBack() {
  if (route.name === 'announcement-detail') return void await router.push({ name: 'announcements' });
  if (route.name === 'facility-detail') return void await router.push({ name: 'facilities' });
  if (route.name === 'issue-detail') {
    const query = { ...route.query };
    delete query.tab;
    delete query.comment;
    return void await router.push({ name: 'issues', params: { filter: activeFilter.value }, query });
  }
  if (isMyProposalsRouteActive.value || route.name === 'dashboard' || route.name === 'access-management') await router.push({ name: 'settings' });
}

watch(() => route.fullPath, (newPath, oldPath) => {
  if (oldPath && mainContentRef.value) {
    mainScrollPositions.set(oldPath, mainContentRef.value.scrollTop);
    if (mainScrollPositions.size > SCROLL_POSITION_LIMIT) {
      const oldestPath = mainScrollPositions.keys().next().value;
      if (oldestPath) mainScrollPositions.delete(oldestPath);
    }
  }
  nextTick(() => mainContentRef.value?.scrollTo({ behavior: 'auto', left: 0, top: mainScrollPositions.get(newPath) ?? 0 }));
});

onMounted(() => {
  isSidebarExpanded.value = window.localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY) === 'true';
  const probe = document.createElement('div');
  probe.style.cssText = 'padding-bottom:env(safe-area-inset-bottom);position:fixed;visibility:hidden';
  document.body.appendChild(probe);
  hasSafeIndicator.value = parseFloat(window.getComputedStyle(probe).paddingBottom) > 0;
  probe.remove();
  window.addEventListener('keydown', handleSidebarKeydown);
});

onBeforeUnmount(() => window.removeEventListener('keydown', handleSidebarKeydown));
</script>
