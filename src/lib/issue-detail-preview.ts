import type { IssueRecord } from '@/types';

let pendingPreview: IssueRecord | null = null;

export function rememberIssueDetailPreview(issue: IssueRecord) {
  pendingPreview = issue;
}

export function takeIssueDetailPreview(issueId: string) {
  const preview = pendingPreview;
  pendingPreview = null;
  return preview?.id === issueId ? preview : null;
}
