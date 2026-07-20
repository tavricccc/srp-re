import { createDatabaseClient } from "../_shared/database-client.ts";
import { requireEnv } from "../_shared/env.ts";
import { requireEligibleFirebaseUser } from "../_shared/firebase-auth.ts";
import { getGoogleAccessToken } from "../_shared/google-oauth.ts";
import { errorMessage, errorStatus, handleCorsPreflight, jsonResponse, publicErrorBody, requireMethod } from "../_shared/http.ts";
import { requireOriginSecret } from "../_shared/origin.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit, utcHourWindow } from "../_shared/upstash-rate-limit.ts";

function parseCustomAttributes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function adminEmails() {
  const emails = requireEnv("ADMIN_EMAILS")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) throw new Error("service-not-configured");
  return [...new Set(emails)];
}

Deno.serve(async (request) => {
  const originFailure = requireOriginSecret(request);
  if (originFailure) return originFailure;
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const methodFailure = requireMethod(request, "POST");
  if (methodFailure) return methodFailure;

  try {
    const projectId = requireEnv("FIREBASE_PROJECT_ID");
    const user = await requireEligibleFirebaseUser(request);
    await claimFixedWindowRateLimit(user.uid, "auth.sync", utcHourWindow(), RATE_LIMITS.loginSyncHourly);

    if (Deno.env.get("LOCAL_TEST_MODE") !== "true") {
      const accessToken = await getGoogleAccessToken([
        "https://www.googleapis.com/auth/identitytoolkit",
        "https://www.googleapis.com/auth/firebase",
      ]);
      const updateResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            localId: user.uid,
            customAttributes: JSON.stringify({
              ...parseCustomAttributes(user.customAttributes),
              role: "authenticated",
            }),
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!updateResponse.ok) {
        throw new Error(`Firebase custom claim update failed: ${await updateResponse.text()}`);
      }
    }

    const supabase = createDatabaseClient();

    // Resolve email conflicts by setting email to null for any other user profile
    const { error: conflictError } = await supabase.schema("app_private")
      .from("user_profiles")
      .update({ email: null })
      .eq("email", user.email.toLowerCase())
      .neq("uid", user.uid);
    if (conflictError) throw conflictError;

    const { error: profileError } = await supabase.schema("app_private").from("user_profiles").upsert({
      uid: user.uid,
      email: user.email.toLowerCase(),
      display_name: user.name,
      photo_url: user.photoUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid" });
    if (profileError) throw profileError;
    const { error: adminSyncError } = await supabase.schema("app_api").rpc("backend_reconcile_platform_admins", {
      actor_uid: user.uid,
      admin_emails: adminEmails(),
    });
    if (adminSyncError) throw adminSyncError;

    return jsonResponse({ ok: true, role: "authenticated" });
  } catch (error) {
    console.error(errorMessage(error));
    return jsonResponse({ ok: false, error: publicErrorBody(error) }, { status: errorStatus(error) });
  }
});
