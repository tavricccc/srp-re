import type { IssueCursor, IssueFilter, IssueRecord, IssueSortOption, IssueStatusBucket } from '@/types';
import { buildTitleSearchTokens, normalizeSearchText } from '@/lib/search';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { invokeBackendAction } from '@/services/backend-action';
import { createContentCacheKey, getCachedContent, setCachedContent } from '@/services/content-read-cache';
import { TABLE_PAGE_SIZE, normalizeIssueCursor, normalizeIssueRecord, toReadableBackendError, withSupportState } from './issues-core';

function normalizeIssueList(records: Record<string, unknown>[]) {
  return records.map((record) => normalizeIssueRecord(String(record.id ?? ''), record));
}

export async function fetchIssuesPageByStatus(
  uid: string,
  activeFilter: IssueFilter,
  statusBucket: IssueStatusBucket,
  cursor: IssueCursor | null,
  options?: {
    forceRefresh?: boolean;
    isAdmin?: boolean;
    pageSize?: number;
    sort?: IssueSortOption;
    supportedIssueIds?: Set<string>;
  },
) {
  const pageSize = options?.pageSize ?? TABLE_PAGE_SIZE;
  const cacheKey = createContentCacheKey([
    'issue-list-page',
    uid,
    options?.isAdmin ? 'admin' : 'user',
    activeFilter,
    statusBucket,
    options?.sort ?? 'latest',
    pageSize,
    cursor?.id ?? 'first',
    cursor?.sort_number ?? '',
    cursor?.sort_date?.getTime() ?? '',
    cursor?.created_at?.getTime() ?? '',
  ]);
  if (!options?.forceRefresh) {
    const cached = getCachedContent<{ cursor: IssueCursor | null; hasMore: boolean; issues: IssueRecord[] }>(cacheKey);
    if (cached) {
      return {
        ...cached,
        issues: withSupportState(cached.issues, options?.supportedIssueIds),
      };
    }
  }

  try {
    const fn = invokeBackendAction<
      {
        activeFilter: IssueFilter;
        cursor: IssueCursor | null;
        isAdmin: boolean;
        pageSize: number;
        sort: IssueSortOption;
        statusBucket: IssueStatusBucket;
        uid: string;
      },
      { cursor: IssueCursor | null; hasMore: boolean; issues: Record<string, unknown>[] }
    >('listIssues', { timeoutMs: READ_REQUEST_TIMEOUT_MS });
    const result = await fn({
      activeFilter,
      cursor,
      isAdmin: options?.isAdmin ?? false,
      pageSize,
      sort: options?.sort ?? 'latest',
      statusBucket,
      uid,
    });
    const page = {
      cursor: normalizeIssueCursor(result.cursor),
      hasMore: result.hasMore,
      issues: withSupportState(normalizeIssueList(result.issues), options?.supportedIssueIds),
    };
    setCachedContent(cacheKey, page);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function fetchIssuesForTitleSearch(
  uid: string,
  activeFilter: IssueFilter,
  statusBucket: IssueStatusBucket,
  titleQuery: string,
  options?: {
    forceRefresh?: boolean;
    isAdmin?: boolean;
    sort?: IssueSortOption;
    supportedIssueIds?: Set<string>;
  },
): Promise<{ issues: IssueRecord[]; limited: boolean }> {
  const normalizedQuery = normalizeSearchText(titleQuery);
  const searchTokens = buildTitleSearchTokens(normalizedQuery);
  if (searchTokens.length === 0) {
    return { issues: [], limited: false };
  }
  const cacheKey = createContentCacheKey([
    'issue-search',
    uid,
    options?.isAdmin ? 'admin' : 'user',
    activeFilter,
    statusBucket,
    options?.sort ?? 'latest',
    normalizedQuery,
  ]);
  if (!options?.forceRefresh) {
    const cached = getCachedContent<{ issues: IssueRecord[]; limited: boolean }>(cacheKey);
    if (cached) {
      return {
        issues: withSupportState(cached.issues, options?.supportedIssueIds),
        limited: cached.limited,
      };
    }
  }

  try {
    const fn = invokeBackendAction<
      {
        activeFilter: IssueFilter;
        isAdmin: boolean;
        sort: IssueSortOption;
        statusBucket: IssueStatusBucket;
        titleQuery: string;
        uid: string;
      },
      { issues: Record<string, unknown>[]; limited: boolean }
    >('searchIssues', { timeoutMs: READ_REQUEST_TIMEOUT_MS });
    const result = await fn({
      activeFilter,
      isAdmin: options?.isAdmin ?? false,
      sort: options?.sort ?? 'latest',
      statusBucket,
      titleQuery,
      uid,
    });
    const page = {
      issues: withSupportState(normalizeIssueList(result.issues), options?.supportedIssueIds),
      limited: result.limited,
    };
    setCachedContent(cacheKey, page);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
