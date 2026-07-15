import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
import type { RoleCode } from '@/services/session-role';

export interface AccessUser { uid: string; name: string; photoUrl: string | null; roles: RoleCode[] }

export async function listRoleAssignments(query = '') {
  const fn = invokeBackendAction<{ query: string }, { users: AccessUser[] }>('listRoleAssignments');
  return (await fn({ query })).users;
}

export async function setUserRoles(uid: string, roles: RoleCode[]) {
  const fn = invokeBackendAction<{ uid: string; roles: RoleCode[]; requestId: string }, { success: boolean; roles: RoleCode[] }>('setUserRoles');
  return await fn({ uid, roles, requestId: createRequestId() });
}
