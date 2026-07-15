import { requireEnv } from "../_shared/env.ts";
import { ensureCloudinaryImageUploadPreset } from "../_shared/cloudinary.ts";
import { requireVerifiedFirebaseUser } from "../_shared/firebase-auth.ts";
import { getIssueCategoryIdsByReadAccess } from "../_shared/issue-categories.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import type { AuthContext, BackendSupabase, PermissionCode } from "./types.ts";

export async function requireAuth(supabase: BackendSupabase, request: Request): Promise<AuthContext> {
  const firebaseUser = await requireVerifiedFirebaseUser(request);
  const { data: assignments, error: assignmentError } = await supabase.schema("app_private")
    .from("user_role_assignments").select("role_code").eq("uid", firebaseUser.uid);
  if (assignmentError) throw assignmentError;
  const roles = (assignments ?? []).map((row) => row.role_code);
  let permissions: PermissionCode[] = [];
  if (roles.length > 0) {
    const { data: grants, error: grantError } = await supabase.schema("app_private")
      .from("role_permissions").select("permission_code").in("role_code", roles);
    if (grantError) throw grantError;
    permissions = [...new Set((grants ?? []).map((row) => row.permission_code as PermissionCode))];
  }

  return {
    email: firebaseUser.email,
    isAdmin: permissions.includes("proposal.manage"),
    name: firebaseUser.name,
    photoUrl: firebaseUser.photoUrl,
    permissions,
    roles,
    uid: firebaseUser.uid,
  };
}

export function requireAdmin(auth: AuthContext) {
  requirePermission(auth, "proposal.manage");
}

export function hasPermission(auth: AuthContext, permission: PermissionCode) {
  return auth.permissions.includes(permission);
}

export function requirePermission(auth: AuthContext, permission: PermissionCode) {
  if (!hasPermission(auth, permission)) throw new Error("permission-denied");
}

export async function handleHealthcheck(request: Request, supabase: BackendSupabase) {
  const expected = requireEnv("WEBHOOK_SECRET");
  if (request.headers.get("x-healthcheck-secret") !== expected) {
    throw new Error("permission-denied");
  }

  requireEnv("APP_SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("FIREBASE_WEB_API_KEY");
  requireEnv("ALLOWED_DOMAIN");
  requireEnv("ADMIN_EMAILS");
  requireEnv("UPSTASH_REDIS_REST_URL");
  requireEnv("UPSTASH_REDIS_REST_TOKEN");

  await ensureCloudinaryImageUploadPreset(
    RATE_LIMITS.imageCompression.maxUploadBytes,
    RATE_LIMITS.imageCompression.maxDimension,
  );

  const { error } = await supabase
    .schema("app_private")
    .from("roles")
    .select("code")
    .limit(1);
  if (error) throw error;

  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/u, "");
  const { error: settingsError } = await supabase
    .schema("app_private")
    .from("runtime_settings")
    .upsert([
      {
        key: "deletion_worker_url",
        value: `${supabaseUrl}/functions/v1/processDeletionJobs`,
        updated_at: new Date().toISOString(),
      },
      {
        key: "firebase_project_id",
        value: requireEnv("FIREBASE_PROJECT_ID"),
        updated_at: new Date().toISOString(),
      },
      {
        key: "owner_admin_issue_categories",
        value: getIssueCategoryIdsByReadAccess("owner-admin").join(","),
        updated_at: new Date().toISOString(),
      },
      {
        key: "reviewed_school_issue_categories",
        value: getIssueCategoryIdsByReadAccess("reviewed-school").join(","),
        updated_at: new Date().toISOString(),
      },
      {
        key: "maintenance_worker_url",
        value: `${supabaseUrl}/functions/v1/maintenanceCleanup`,
        updated_at: new Date().toISOString(),
      },
      {
        key: "outbox_worker_url",
        value: `${supabaseUrl}/functions/v1/outboxWorker`,
        updated_at: new Date().toISOString(),
      },
      { key: "webhook_secret", value: expected, updated_at: new Date().toISOString() },
    ], { onConflict: "key" });
  if (settingsError) throw settingsError;

  return { ok: true };
}
