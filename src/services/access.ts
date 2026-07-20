import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
import type { RoleCode } from '@/services/session-role';

export interface AccessUser {
  uid: string;
  email: string | null;
  name: string;
  photoUrl: string | null;
  roles: RoleCode[];
  managedIssueCategoryIds: string[];
  managedFacilityCategoryIds: string[];
}

export type AccessScope =
  | { kind: 'announcement' }
  | { kind: 'facility' | 'issue'; categoryId: string };

interface AccessUserList {
  truncated: boolean;
  users: AccessUser[];
}

export async function findRoleAssignment(query: string) {
  const fn = invokeBackendAction<{ query: string }, AccessUserList>('listRoleAssignments');
  return (await fn({ query })).users[0] ?? null;
}

export async function listScopeAssignments(scope: AccessScope) {
  const fn = invokeBackendAction<
    { categoryId?: string; query: string; scopeKind: AccessScope['kind'] },
    AccessUserList
  >('listRoleAssignments');
  return await fn({ categoryId: 'categoryId' in scope ? scope.categoryId : undefined, query: '', scopeKind: scope.kind });
}

export async function setUserRoles(
  uid: string,
  roles: RoleCode[],
  managedIssueCategoryIds: string[],
  managedFacilityCategoryIds: string[],
) {
  const fn = invokeBackendAction<
    { uid: string; roles: RoleCode[]; managedIssueCategoryIds: string[]; managedFacilityCategoryIds: string[]; requestId: string },
    { success: boolean; roles: RoleCode[]; managedIssueCategoryIds: string[]; managedFacilityCategoryIds: string[] }
  >('setUserRoles');
  return await fn({ uid, roles, managedIssueCategoryIds, managedFacilityCategoryIds, requestId: createRequestId() });
}
