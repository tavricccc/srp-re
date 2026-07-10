import type { IssueRecord } from '@/types';
import { invokeBackendAction } from '@/services/backend-action';
import { READ_REQUEST_TIMEOUT_MS, RequestFailure } from '@/lib/request';
import { createContentCacheKey, getCachedContent, setCachedContent } from '@/services/content-read-cache';
import {
  STATUS_BUCKETS,
  TABLE_PAGE_SIZE,
} from './issues-constants';
import {
  normalizeDate,
  normalizeIssueCursor,
  normalizeIssueRecord,
  normalizeStatus,
  withSupportState,
} from './issues-normalize';
import { isContentUnavailableError, toReadableBackendError } from './issues-errors';

export {
  STATUS_BUCKETS,
  TABLE_PAGE_SIZE,
  normalizeDate,
  normalizeIssueCursor,
  normalizeIssueRecord,
  normalizeStatus,
  isContentUnavailableError,
  toReadableBackendError,
  withSupportState,
};

export async function fetchIssueRecordById(
  issueId: string,
  options: { cacheScope?: string; forceRefresh?: boolean } = {},
): Promise<IssueRecord> {
  const cacheKey = createContentCacheKey(['issue-detail', options.cacheScope ?? 'default', issueId]);
  if (!options.forceRefresh) {
    const cached = getCachedContent<IssueRecord>(cacheKey);
    if (cached) return cached;
  }

  try {
    const fn = invokeBackendAction<{ issueId: string }, { issue: Record<string, unknown> }>('getIssue', {
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({ issueId });
    const issue = normalizeIssueRecord(String(result.issue.id ?? issueId), result.issue);
    setCachedContent(cacheKey, issue);
    return issue;
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new Error('找不到這篇提案。', { cause: error });
  }
}
