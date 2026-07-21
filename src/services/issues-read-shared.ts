export interface CommentResponseRecord {
  id: string;
  issue_id: string;
  parent_comment_id: string | null;
  content: string;
  author_uid: string;
  created_at_ms: number | null;
  replies?: CommentResponseRecord[];
}
