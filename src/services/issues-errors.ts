import { RequestFailure } from '@/lib/request';

export function toReadableBackendError(error: unknown) {
  if (error instanceof RequestFailure) return error;
  const message = error instanceof Error ? error.message : '';
  if (message.includes('is not configured')) {
    return new Error('issue.serviceSetupHasNotBeenCompletedPleaseTryAgainLater', { cause: error });
  }
  if (message.includes('issue.upperLimitReached')) {
    return new Error(message);
  }
  if (isContentUnavailableError(error)) {
    return new Error(message || 'issue.theContentNoLongerExists');
  }
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'permission-denied' || code === '42501') {
    return new Error('access.youCurrentlyDoNotHavePermissionToPerformThisOperation');
  }
  if (code === 'unauthenticated' || code === '401') {
    return new Error('issue.pleaseLogInBeforeContinuing');
  }
  if (/backend|provider|session/i.test(message)) {
    return new Error('facility.theOperationFailedPleaseTryAgainLater');
  }
  return new Error(message || 'facility.theOperationFailedPleaseTryAgainLater');
}

export function isContentUnavailableError(error: unknown) {
  if (error && typeof error === 'object') {
    const code = 'code' in error ? String(error.code) : '';
    const details = 'details' in error ? (error.details as Record<string, unknown> | null) : null;
    if (details && (details.reason === 'CONTENT_DELETED' || details.reason === 'CONTENT_NOT_FOUND')) {
      return true;
    }
    if (code === 'not-found' || code === 'PGRST116') {
      return true;
    }
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('issue.deleted') || message.includes('issue.notFound');
}
