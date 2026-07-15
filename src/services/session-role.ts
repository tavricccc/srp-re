import { invokeBackendAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/issues-core';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  getCachedContentPersistent,
  runCoalescedContentRequest,
  setCachedContent,
} from '@/services/content-read-cache';

export type SessionRole = 'admin' | 'user';
export type RoleCode = 'platform-admin' | 'proposal-manager' | 'announcement-manager' | 'general-affairs';
export type PermissionCode = 'proposal.manage' | 'announcement.manage' | 'facility.manage' | 'role.manage' | 'dashboard.view';
export interface SessionAccess {
  role: SessionRole;
  roles: RoleCode[];
  permissions: PermissionCode[];
  managedIssueCategoryIds: string[];
}
let cachedSessionRole: SessionRole = 'user';
const SESSION_ACCESS_CACHE_KEY = 'current-session-access';

export function getCachedSessionRole() {
  return cachedSessionRole;
}

export async function fetchCurrentUserRole(): Promise<SessionAccess> {
  const cached = await getCachedContentPersistent<SessionAccess>(
    SESSION_ACCESS_CACHE_KEY,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  if (cached) {
    cachedSessionRole = cached.role;
    return cached;
  }

  return runCoalescedContentRequest(SESSION_ACCESS_CACHE_KEY, async () => {
    try {
      const result = await invokeBackendAction<Record<string, never>, SessionAccess>('getCurrentUserRole')({});
      cachedSessionRole = result.role === 'admin' ? 'admin' : 'user';
      const access = {
        role: cachedSessionRole,
        roles: Array.isArray(result.roles) ? result.roles : [],
        permissions: Array.isArray(result.permissions) ? result.permissions : [],
        managedIssueCategoryIds: Array.isArray(result.managedIssueCategoryIds) ? result.managedIssueCategoryIds : [],
      };
      setCachedContent(SESSION_ACCESS_CACHE_KEY, access);
      return access;
    } catch (error) {
      throw toReadableBackendError(error);
    }
  });
}
