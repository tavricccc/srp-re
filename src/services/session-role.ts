import { invokeBackendAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/issues-core';

export type SessionRole = 'admin' | 'user';
export type RoleCode = 'platform-admin' | 'proposal-manager' | 'announcement-manager' | 'general-affairs';
export type PermissionCode = 'proposal.manage' | 'announcement.manage' | 'facility.manage' | 'role.manage' | 'dashboard.view';
export interface SessionAccess {
  role: SessionRole;
  roles: RoleCode[];
  permissions: PermissionCode[];
}
let cachedSessionRole: SessionRole = 'user';

export function getCachedSessionRole() {
  return cachedSessionRole;
}

export async function fetchCurrentUserRole(): Promise<SessionAccess> {
  cachedSessionRole = 'user';
  try {
    const fn = invokeBackendAction<Record<string, never>, SessionAccess>('getCurrentUserRole');
    const result = await fn({});
    cachedSessionRole = result.role === 'admin' ? 'admin' : 'user';
    return {
      role: cachedSessionRole,
      roles: Array.isArray(result.roles) ? result.roles : [],
      permissions: Array.isArray(result.permissions) ? result.permissions : [],
    };
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
