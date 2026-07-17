import type { FacilityStatus, IssueStatus } from '@/types';

interface StatusOption<TValue extends string> {
  value: TValue;
  label: string;
}

export const ADMIN_ISSUE_STATUS_OPTIONS: StatusOption<IssueStatus>[] = [
  { value: 'under-review', label: 'common.pendingReview' },
  { value: 'pending', label: 'comments.noReply' },
  { value: 'review-rejected', label: 'common.notApproved' },
  { value: 'processing', label: 'facility.processing' },
  { value: 'infeasible', label: 'issue.notFeasible' },
  { value: 'completed', label: 'facility.completed' },
];

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  'under-review': 'common.pendingReview',
  pending: 'comments.noReply',
  processing: 'facility.processing',
  'auto-rejected': 'common.failed',
  'review-rejected': 'common.notApproved',
  infeasible: 'issue.notFeasible',
  completed: 'facility.completed',
};

export const FACILITY_STATUS_LABELS: Record<FacilityStatus, string> = {
  pending: 'facility.toBeAccepted',
  processing: 'facility.processing',
  completed: 'facility.completed',
  'unable-to-handle': 'facility.cannotBeResolved',
};

export const FACILITY_CLOSED_STATUSES: FacilityStatus[] = ['completed', 'unable-to-handle'];

export function isFacilityClosed(status: FacilityStatus) {
  return FACILITY_CLOSED_STATUSES.includes(status);
}
