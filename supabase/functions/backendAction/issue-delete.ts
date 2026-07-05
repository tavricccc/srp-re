import { asString } from "../_shared/http.ts";
import { selectIssue } from "./issue-shared.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { queueAttachedUploadsForDeletion } from "./uploads.ts";

export async function deleteIssue(payload: JsonRecord, auth: AuthContext, supabase: BackendSupabase) {
  const issue = await selectIssue(supabase, asString(payload.issueId));
  const issueId = asString(issue.id);
  if (asString(issue.author_uid) !== auth.uid && !auth.isAdmin) throw new Error("permission-denied");
  const { data: comments, error: commentsError } = await supabase.schema("app_private").from("comments")
    .select("id").eq("issue_id", issueId);
  if (commentsError) throw commentsError;
  await queueAttachedUploadsForDeletion(supabase, [
    { id: issueId, type: "issue" },
    ...(comments ?? []).map((comment) => ({ id: comment.id, type: "comment" as const })),
  ]);
  const { error } = await supabase.schema("app_api").rpc("backend_delete_issue", {
    issue_id: issueId,
    actor_uid: auth.uid,
    actor_is_admin: auth.isAdmin,
  });
  if (error) throw error;
  return { success: true, issueId };
}
