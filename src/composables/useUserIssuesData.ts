import { computed, reactive, watch, type Ref } from 'vue';
import { fetchUserIssues } from '@/services/issues';
import { createContentCacheKey, isContentCacheFresh } from '@/services/content-read-cache';
import type { IssueCursor, IssueFilter, IssueRecord, IssueSortOption } from '@/types';

type IssueBoardFilter = IssueFilter | 'my-proposals';
interface UserIssuesSnapshot {
  allIssues: IssueRecord[];
  cursor: IssueCursor | null;
  hasMore: boolean;
  updatedAt: number;
}

const userIssuesCache = new Map<string, UserIssuesSnapshot>();

export function useUserIssuesData(
  activeFilter: Ref<IssueBoardFilter>,
  userUid: Ref<string>,
  isAllowedUser: Ref<boolean>,
  supportedIssueIds: Ref<Set<string>>,
  sortOption: Ref<IssueSortOption>,
  pageSize: Ref<number>,
) {
  const userIssuesState = reactive({
    allIssues: [] as IssueRecord[],
    error: '',
    cursor: null as IssueCursor | null,
    hasMore: false,
    loading: false,
    loadingMore: false,
    refreshing: false,
    updatedAt: 0,
  });

  let requestToken = 0;

  const visibleIssues = computed(() => userIssuesState.allIssues);
  const hasMore = computed(() => userIssuesState.hasMore);

  function getCacheKey() {
    return createContentCacheKey([
      'user-issues-state',
      userUid.value,
      sortOption.value,
      pageSize.value,
    ]);
  }

  function saveSnapshot() {
    if (!userUid.value) return;
    userIssuesCache.set(getCacheKey(), {
      allIssues: userIssuesState.allIssues,
      cursor: userIssuesState.cursor,
      hasMore: userIssuesState.hasMore,
      updatedAt: Date.now(),
    });
  }

  function hydrateSnapshot() {
    const cached = userIssuesCache.get(getCacheKey());
    if (!cached || !isContentCacheFresh(cached.updatedAt)) return false;
    userIssuesState.allIssues = cached.allIssues;
    userIssuesState.cursor = cached.cursor;
    userIssuesState.hasMore = cached.hasMore;
    userIssuesState.updatedAt = cached.updatedAt;
    userIssuesState.error = '';
    userIssuesState.loading = false;
    userIssuesState.loadingMore = false;
    userIssuesState.refreshing = false;
    return true;
  }

  function addUserIssue(issue: IssueRecord) {
    const issueMap = new Map(userIssuesState.allIssues.map((entry) => [entry.id, entry]));
    issueMap.set(issue.id, {
      ...issue,
      currentUserSupported: issue.currentUserSupported || supportedIssueIds.value.has(issue.id),
    });
    userIssuesState.allIssues = Array.from(issueMap.values());
    saveSnapshot();
  }

  function removeUserIssue(issueId: string) {
    userIssuesState.allIssues = userIssuesState.allIssues.filter((issue) => issue.id !== issueId);
    saveSnapshot();
  }

  function stopUserIssuesRequest() {
    requestToken += 1;
    userIssuesState.loading = false;
    userIssuesState.loadingMore = false;
    userIssuesState.refreshing = false;
  }

  function resetUserIssues() {
    stopUserIssuesRequest();
    userIssuesState.allIssues = [];
    userIssuesState.error = '';
    userIssuesState.cursor = null;
    userIssuesState.hasMore = false;
  }

  function bumpUserIssuesRequestToken() {
    requestToken += 1;
  }

  async function loadCurrentUserIssues(options: { silent?: boolean } = {}) {
    const uid = userUid.value;
    if (activeFilter.value !== 'my-proposals' || !isAllowedUser.value || !uid) {
      userIssuesState.loading = false;
      return;
    }

    if (!options.silent && hydrateSnapshot()) return;

    const currentToken = ++requestToken;
    userIssuesState.error = '';
    if (options.silent && userIssuesState.allIssues.length > 0) {
      userIssuesState.refreshing = true;
    } else {
      userIssuesState.loading = true;
    }

    try {
      const page = await fetchUserIssues(uid, null, {
        pageSize: pageSize.value,
        forceRefresh: options.silent === true,
        sort: sortOption.value,
        supportedIssueIds: supportedIssueIds.value,
      });
      if (currentToken !== requestToken) return;
      userIssuesState.allIssues = page.issues;
      userIssuesState.cursor = page.cursor;
      userIssuesState.hasMore = page.hasMore;
      userIssuesState.updatedAt = Date.now();
      userIssuesState.error = '';
      saveSnapshot();
    } catch {
      if (currentToken === requestToken && userIssuesState.allIssues.length === 0) {
        userIssuesState.error = '提案載入失敗，請稍後再試。';
      }
    } finally {
      if (currentToken === requestToken) {
        userIssuesState.loading = false;
        userIssuesState.refreshing = false;
      }
    }
  }

  async function loadMoreUserIssues() {
    if (!hasMore.value || userIssuesState.loadingMore) return;
    userIssuesState.loadingMore = true;
    try {
      const page = await fetchUserIssues(userUid.value, userIssuesState.cursor, {
        pageSize: pageSize.value,
        sort: sortOption.value,
        supportedIssueIds: supportedIssueIds.value,
      });
      const ids = new Set(userIssuesState.allIssues.map((issue) => issue.id));
      userIssuesState.allIssues = [
        ...userIssuesState.allIssues,
        ...page.issues.filter((issue) => !ids.has(issue.id)),
      ];
      userIssuesState.cursor = page.cursor;
      userIssuesState.hasMore = page.hasMore;
      userIssuesState.updatedAt = Date.now();
      userIssuesState.error = '';
      saveSnapshot();
    } catch {
      userIssuesState.error = '載入更多提案失敗，請稍後再試。';
    } finally {
      userIssuesState.loadingMore = false;
    }
  }

  watch([activeFilter, userUid, isAllowedUser], () => {
    void loadCurrentUserIssues();
  }, { immediate: true });

  watch(supportedIssueIds, (newIds) => {
    userIssuesState.allIssues = userIssuesState.allIssues.map((issue) => ({
      ...issue,
      currentUserSupported: issue.currentUserSupported || newIds.has(issue.id),
    }));
    saveSnapshot();
  });

  watch(sortOption, () => void loadCurrentUserIssues());

  return {
    userIssuesState,
    hasMoreUserIssues: hasMore,
    visibleUserIssues: visibleIssues,
    bumpUserIssuesRequestToken,
    loadMoreUserIssues,
    addUserIssue,
    removeUserIssue,
    resetUserIssues,
    stopUserIssuesRequest,
    loadCurrentUserIssues,
  };
}
