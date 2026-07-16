import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { invokeBackendAction } from '@/services/backend-action';
import { captureContentCacheWriteGuard, createContentCacheKey, getCachedContentPersistent, setCachedContentFromRead } from '@/services/content-read-cache';
import type { IssueCursor, IssueSortOption, IssueStatusBucket } from '@/types';
import { normalizeIssueCursor, normalizeIssueRecord, toReadableBackendError, withSupportState } from './issues-core';
import { prepareContentRevisionRead } from '@/services/content-revisions';

export async function fetchUserIssues(
  uid: string,
  cursor: IssueCursor | null,
  options?: {
    forceRefresh?: boolean;
    pageSize?: number;
    sort?: IssueSortOption;
    statusBucket?: IssueStatusBucket;
    supportedIssueIds?: Set<string>;
    signal?: AbortSignal;
  },
) {
  if (!options?.forceRefresh) await prepareContentRevisionRead();
  const pageSize = options?.pageSize ?? 30;
  const sort = options?.sort ?? 'latest';
  const statusBucket = options?.statusBucket ?? 'active';
  const cacheKey = createContentCacheKey([
    'user-issue-list-page',
    uid,
    statusBucket,
    sort,
    pageSize,
    cursor?.id ?? 'first',
    cursor?.sort_number ?? '',
    cursor?.sort_date?.getTime() ?? '',
    cursor?.created_at?.getTime() ?? '',
  ]);
  if (!options?.forceRefresh) {
    const cached = await getCachedContentPersistent<{ cursor: IssueCursor | null; hasMore: boolean; issues: ReturnType<typeof normalizeIssueRecord>[] }>(cacheKey);
    if (cached) {
      return {
        ...cached,
        issues: withSupportState(cached.issues, options?.supportedIssueIds),
      };
    }
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);

  try {
    const fn = invokeBackendAction<
      { cursor: IssueCursor | null; pageSize: number; sort: IssueSortOption; statusBucket: IssueStatusBucket; uid: string },
      { cursor: IssueCursor | null; hasMore: boolean; issues: Record<string, unknown>[] }
    >('listUserIssues', {
      signal: options?.signal,
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({ cursor, pageSize, sort, statusBucket, uid });
    const issues = result.issues.map((issue) => normalizeIssueRecord(String(issue.id ?? ''), issue));
    const page = {
      cursor: normalizeIssueCursor(result.cursor),
      hasMore: result.hasMore,
      issues: withSupportState(issues, options?.supportedIssueIds),
    };
    setCachedContentFromRead(cacheGuard, page);
    return page;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
