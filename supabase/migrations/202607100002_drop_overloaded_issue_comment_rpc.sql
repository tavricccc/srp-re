drop function if exists app_api.backend_create_issue_comment(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  text[],
  text[],
  text[]
);

revoke all on function app_api.backend_create_issue_comment(
  uuid,
  uuid,
  text,
  boolean,
  text,
  text,
  text,
  text[],
  text[],
  text[]
) from public, anon, authenticated;

grant execute on function app_api.backend_create_issue_comment(
  uuid,
  uuid,
  text,
  boolean,
  text,
  text,
  text,
  text[],
  text[],
  text[]
) to service_role;
