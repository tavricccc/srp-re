create or replace function app_private.is_expected_firebase_project()
returns boolean
language sql
stable
security definer
set search_path = app_private, public
as $$
  select app_private.firebase_project_id() = (
    select value
    from app_private.runtime_settings
    where key = 'firebase_project_id'
  );
$$;

grant execute on function app_private.is_expected_firebase_project()
to authenticated, anon, service_role;
