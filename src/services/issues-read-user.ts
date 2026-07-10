import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { invokeBackendAction } from '@/services/backend-action';
import { createContentCacheKey, getCachedContent, setCachedContent } from '@/services/content-read-cache';
import type { IssueCursor, IssueSortOption } from '@/types';
import { normalizeIssueCursor, normalizeIssueRecord, toReadableBackendError, withSupportState } from './issues-core';

export async function fetchUserIssues(
  uid: string,
  cursor: IssueCursor | null,
  options?: {
    forceRefresh?: boolean;
    pageSize?: number;
    sort?: IssueSortOption;
    supportedIssueIds?: Set<string>;
  },
) {
  const pageSize = options?.pageSize ?? 20;
  const sort = options?.sort ?? 'latest';
  const cacheKey = createContentCacheKey([
    'user-issue-list-page',
    uid,
    sort,
    pageSize,
    cursor?.id ?? 'first',
    cursor?.sort_number ?? '',
    cursor?.sort_date?.getTime() ?? '',
    cursor?.created_at?.getTime() ?? '',
  ]);
  if (!options?.forceRefresh) {
    const cached = getCachedContent<{ cursor: IssueCursor | null; hasMore: boolean; issues: ReturnType<typeof normalizeIssueRecord>[] }>(cacheKey);
    if (cached) {
      return {
        ...cached,
        issues: withSupportState(cached.issues, options?.supportedIssueIds),
      };
    }
  }

  try {
    const fn = invokeBackendAction<
      { cursor: IssueCursor | null; pageSize: number; sort: IssueSortOption; uid: string },
      { cursor: IssueCursor | null; hasMore: boolean; issues: Record<string, unknown>[] }
    >('listUserIssues', {
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({ cursor, pageSize, sort, uid });
    const issues = result.issues.map((issue) => normalizeIssueRecord(String(issue.id ?? ''), issue));
    const page = {
      cursor: normalizeIssueCursor(result.cursor),
      hasMore: result.hasMore,
      issues: withSupportState(issues, options?.supportedIssueIds),
    };
    setCachedContent(cacheKey, page);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
