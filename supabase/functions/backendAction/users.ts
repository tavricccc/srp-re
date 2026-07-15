import {
  createCloudinaryAuthenticatedImageUrl,
  sha256Hex,
  uploadCloudinaryAuthenticatedImage,
} from "../_shared/cloudinary.ts";
import { asString } from "../_shared/http.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { taipeiDayWindow } from "./utils.ts";
import { requirePermission } from "./auth.ts";

const ASSIGNABLE_ROLES = new Set(["platform-admin", "proposal-manager", "announcement-manager", "general-affairs"]);

export function isUserAction(action: string) {
  return action === "recordPlatformVisit"
    || action === "getCurrentUserRole"
    || action === "listRoleAssignments"
    || action === "setUserRoles"
    || action === "cacheUserAvatar"
    || action === "getUserAvatarUrls";
}

export async function handleUserAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (action === "recordPlatformVisit") {
    const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
      uid: auth.uid,
      display_name: auth.name,
      photo_url: auth.photoUrl,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "uid" });
    if (error) throw error;
    return { success: true };
  }

  if (action === "getCurrentUserRole") {
    return { role: auth.roles.includes("platform-admin") ? "admin" : "user", roles: auth.roles, permissions: auth.permissions };
  }

  if (action === "listRoleAssignments") {
    requirePermission(auth, "role.manage");
    const query = asString(payload.query).trim().toLowerCase();
    let profilesQuery = supabase.schema("app_private").from("user_profiles")
      .select("uid,display_name,cached_photo_url,photo_url").order("display_name").limit(100);
    if (query) profilesQuery = profilesQuery.ilike("display_name", `%${query.replace(/[%_]/gu, "")}%`);
    const { data: profiles, error: profileError } = await profilesQuery;
    if (profileError) throw profileError;
    const uids = (profiles ?? []).map((profile) => profile.uid);
    const { data: assignments, error: assignmentError } = uids.length
      ? await supabase.schema("app_private").from("user_role_assignments").select("uid,role_code").in("uid", uids)
      : { data: [], error: null };
    if (assignmentError) throw assignmentError;
    const roleMap = new Map<string, string[]>();
    for (const assignment of assignments ?? []) {
      roleMap.set(assignment.uid, [...(roleMap.get(assignment.uid) ?? []), assignment.role_code]);
    }
    return { users: (profiles ?? []).map((profile) => ({
      uid: profile.uid, name: profile.display_name ?? "使用者",
      photoUrl: profile.cached_photo_url ?? profile.photo_url ?? null,
      roles: roleMap.get(profile.uid) ?? [],
    })) };
  }

  if (action === "setUserRoles") {
    requirePermission(auth, "role.manage");
    const uid = asString(payload.uid);
    const roles = [...new Set(Array.isArray(payload.roles) ? payload.roles.map((value) => asString(value)).filter((role) => ASSIGNABLE_ROLES.has(role)) : [])];
    if (!uid) throw new Error("not-found");
    const { data: currentRows, error: currentError } = await supabase.schema("app_private")
      .from("user_role_assignments").select("role_code").eq("uid", uid);
    if (currentError) throw currentError;
    const current = new Set((currentRows ?? []).map((row) => row.role_code));
    if (current.has("platform-admin") && !roles.includes("platform-admin")) {
      const { count, error } = await supabase.schema("app_private").from("user_role_assignments")
        .select("uid", { count: "exact", head: true }).eq("role_code", "platform-admin");
      if (error) throw error;
      if ((count ?? 0) <= 1) throw new Error("last-platform-admin");
    }
    const grants = roles.filter((role) => !current.has(role));
    const revokes = [...current].filter((role) => !roles.includes(role));
    if (revokes.length) {
      const { error } = await supabase.schema("app_private").from("user_role_assignments").delete().eq("uid", uid).in("role_code", revokes);
      if (error) throw error;
    }
    if (grants.length) {
      const { error } = await supabase.schema("app_private").from("user_role_assignments").insert(
        grants.map((role_code) => ({ uid, role_code, granted_by: auth.uid })),
      );
      if (error) throw error;
    }
    if (grants.length || revokes.length) {
      const { error } = await supabase.schema("app_private").from("role_assignment_audit").insert([
        ...grants.map((role_code) => ({ uid, role_code, operation: "grant", actor_uid: auth.uid })),
        ...revokes.map((role_code) => ({ uid, role_code, operation: "revoke", actor_uid: auth.uid })),
      ]);
      if (error) throw error;
    }
    return { success: true, roles };
  }

  if (action === "cacheUserAvatar") {
    const sourceUrl = auth.photoUrl;
    if (!sourceUrl) return { photoUrl: null };
    const parsedSourceUrl = new URL(sourceUrl);
    if (
      parsedSourceUrl.protocol !== "https:"
      || !parsedSourceUrl.hostname.toLowerCase().endsWith(".googleusercontent.com")
    ) throw new Error("avatar-source-not-allowed");

    const { data: existing, error: existingError } = await supabase
      .schema("app_private")
      .from("user_profiles")
      .select("avatar_hash,avatar_public_id,avatar_source_url,avatar_version,cached_photo_url")
      .eq("uid", auth.uid)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.avatar_source_url === sourceUrl && existing.cached_photo_url) {
      return { photoUrl: existing.cached_photo_url };
    }

    await claimFixedWindowRateLimit(auth.uid, "avatar.cache", taipeiDayWindow(), RATE_LIMITS.avatarCacheDaily);

    const imageResponse = await fetch(sourceUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!imageResponse.ok) {
      throw new Error(`avatar-fetch-failed:${imageResponse.status}`);
    }
    const contentType = imageResponse.headers.get("content-type") ?? "";
    const contentLength = Number(imageResponse.headers.get("content-length") ?? 0);
    if (!contentType.startsWith("image/") || contentLength > 5 * 1024 * 1024) {
      throw new Error("avatar-source-invalid");
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength > 5 * 1024 * 1024) throw new Error("avatar-source-invalid");
    const avatarHash = await sha256Hex(imageBuffer);
    if (existing?.avatar_hash === avatarHash && existing.cached_photo_url) {
      const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
        uid: auth.uid,
        avatar_source_url: sourceUrl,
        display_name: auth.name,
        photo_url: sourceUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: "uid" });
      if (error) throw error;
      return { photoUrl: existing.cached_photo_url };
    }

    const nextVersion = Number(existing?.avatar_version ?? 0) + 1;
    const nextPublicId = `srp/avatars/${auth.uid}_${nextVersion}`;
    await uploadCloudinaryAuthenticatedImage(
      nextPublicId,
      new Blob([imageBuffer], { type: contentType }),
    );
    const cachedPhotoUrl = await createCloudinaryAuthenticatedImageUrl(nextPublicId);
    const previousPublicId = asString(existing?.avatar_public_id);

    const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
      uid: auth.uid,
      avatar_hash: avatarHash,
      avatar_public_id: nextPublicId,
      avatar_source_url: sourceUrl,
      avatar_version: nextVersion,
      display_name: auth.name,
      photo_url: sourceUrl,
      cached_photo_url: cachedPhotoUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid" });
    if (error) throw error;
    if (previousPublicId && previousPublicId !== nextPublicId) {
      const { error: deletionError } = await supabase.schema("app_private").from("deletion_jobs").insert({
        cloudinary_public_id: previousPublicId,
        target_id: auth.uid,
        target_type: "avatar",
      });
      if (deletionError) throw deletionError;
    }
    return { photoUrl: cachedPhotoUrl };
  }

  const uids = Array.isArray(payload.uids) ? payload.uids.map((uid) => asString(uid)).filter(Boolean).slice(0, 50) : [];
  const { data, error } = await supabase.schema("app_private").from("user_profiles").select("uid,cached_photo_url,photo_url").in("uid", uids);
  if (error) throw error;
  return {
    avatars: Object.fromEntries((data ?? []).map((profile) => [
      profile.uid,
      profile.cached_photo_url ?? profile.photo_url ?? null,
    ])),
  };
}
