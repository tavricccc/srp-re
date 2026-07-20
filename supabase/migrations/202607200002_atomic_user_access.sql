-- Apply roles and category-scoped responsibilities atomically. The Edge action
-- performs authorization; this service-role-only RPC owns validation, last-admin
-- protection, persistence, and a complete before/after audit record.

create table app_private.access_assignment_audit (
  id bigint generated always as identity primary key,
  actor_uid text not null,
  target_uid text not null,
  before_value jsonb not null,
  after_value jsonb not null,
  created_at timestamptz not null default now()
);

create index access_assignment_audit_target_created_idx
  on app_private.access_assignment_audit(target_uid, created_at desc, id desc);

alter table app_private.access_assignment_audit enable row level security;
revoke all on app_private.access_assignment_audit from public, anon, authenticated;

create or replace function app_api.backend_set_user_access(
  actor_uid text,
  target_uid text,
  requested_roles text[],
  issue_category_ids text[],
  facility_category_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  roles text[] := coalesce((select array_agg(distinct value order by value) from unnest(requested_roles) value), array[]::text[]);
  issue_ids text[] := coalesce((select array_agg(distinct value order by value) from unnest(issue_category_ids) value), array[]::text[]);
  facility_ids text[] := coalesce((select array_agg(distinct value order by value) from unnest(facility_category_ids) value), array[]::text[]);
  previous_roles text[];
  previous_issue_ids text[];
  previous_facility_ids text[];
  before_value jsonb;
  after_value jsonb;
begin
  if coalesce(btrim(actor_uid), '') = '' or coalesce(btrim(target_uid), '') = '' then
    raise exception 'validation-required';
  end if;
  if not exists(select 1 from app_private.user_profiles where uid = target_uid) then
    raise exception 'not-found';
  end if;
  if exists(select 1 from unnest(roles) role_code where role_code not in ('announcement-manager', 'general-affairs')) then
    raise exception 'validation-invalid';
  end if;
  if (select count(*) from app_private.issue_categories where id = any(issue_ids) and is_active) <> cardinality(issue_ids)
    or (select count(*) from app_private.facility_categories where id = any(facility_ids) and is_active) <> cardinality(facility_ids) then
    raise exception 'validation-invalid';
  end if;

  lock table app_private.user_role_assignments in share row exclusive mode;
  select coalesce(array_agg(role_code order by role_code), array[]::text[])
    into previous_roles from app_private.user_role_assignments where uid = target_uid;
  select coalesce(array_agg(category_id order by category_id), array[]::text[])
    into previous_issue_ids from app_private.user_issue_category_assignments where uid = target_uid;
  select coalesce(array_agg(category_id order by category_id), array[]::text[])
    into previous_facility_ids from app_private.user_facility_category_assignments where uid = target_uid;

  if 'platform-admin' = any(previous_roles) then
    raise exception 'permission-denied';
  end if;

  before_value := jsonb_build_object(
    'roles', to_jsonb(previous_roles),
    'managedIssueCategoryIds', to_jsonb(previous_issue_ids),
    'managedFacilityCategoryIds', to_jsonb(previous_facility_ids)
  );

  delete from app_private.user_role_assignments where uid = target_uid;
  insert into app_private.user_role_assignments(uid, role_code, granted_by)
    select target_uid, role_code, actor_uid from unnest(roles) role_code;

  insert into app_private.role_assignment_audit(uid, role_code, operation, actor_uid)
    select target_uid, role_code, 'revoke', actor_uid from unnest(previous_roles) role_code where not role_code = any(roles)
    union all
    select target_uid, role_code, 'grant', actor_uid from unnest(roles) role_code where not role_code = any(previous_roles);

  delete from app_private.user_issue_category_assignments where uid = target_uid;
  insert into app_private.user_issue_category_assignments(uid, category_id, granted_by)
    select target_uid, category_id, actor_uid from unnest(issue_ids) category_id;

  delete from app_private.user_facility_category_assignments where uid = target_uid;
  insert into app_private.user_facility_category_assignments(uid, category_id, notify_on_created, granted_by)
    select target_uid, category_id, true, actor_uid from unnest(facility_ids) category_id;

  after_value := jsonb_build_object(
    'roles', to_jsonb(roles),
    'managedIssueCategoryIds', to_jsonb(issue_ids),
    'managedFacilityCategoryIds', to_jsonb(facility_ids)
  );
  if before_value <> after_value then
    insert into app_private.access_assignment_audit(actor_uid, target_uid, before_value, after_value)
    values(actor_uid, target_uid, before_value, after_value);
  end if;

  return jsonb_build_object(
    'success', true,
    'roles', to_jsonb(roles),
    'managedIssueCategoryIds', to_jsonb(issue_ids),
    'managedFacilityCategoryIds', to_jsonb(facility_ids)
  );
end;
$$;

revoke all on function app_api.backend_set_user_access(text,text,text[],text[],text[]) from public, anon, authenticated;
grant execute on function app_api.backend_set_user_access(text,text,text[],text[],text[]) to service_role;

-- ADMIN_EMAILS is the only source of platform administrators. Reconcile every
-- signed-in profile in one transaction so config removals cannot leave stale admins.
create or replace function app_api.backend_reconcile_platform_admins(actor_uid text, admin_emails text[])
returns jsonb
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  emails text[] := coalesce((
    select array_agg(distinct lower(btrim(value)) order by lower(btrim(value)))
    from unnest(admin_emails) value where btrim(value) <> ''
  ), array[]::text[]);
  granted_count integer;
  revoked_count integer;
begin
  if coalesce(btrim(actor_uid), '') = '' or cardinality(emails) = 0 then
    raise exception 'validation-required';
  end if;

  lock table app_private.user_role_assignments in share row exclusive mode;

  with revoked as (
    delete from app_private.user_role_assignments assignment
    where assignment.role_code = 'platform-admin'
      and not exists (
        select 1 from app_private.user_profiles profile
        where profile.uid = assignment.uid and lower(profile.email) = any(emails)
      )
    returning assignment.uid
  ), audited as (
    insert into app_private.role_assignment_audit(uid, role_code, operation, actor_uid)
    select uid, 'platform-admin', 'revoke', backend_reconcile_platform_admins.actor_uid from revoked
    returning uid
  )
  select count(*) into revoked_count from audited;

  with granted as (
    insert into app_private.user_role_assignments(uid, role_code, granted_by)
    select profile.uid, 'platform-admin', backend_reconcile_platform_admins.actor_uid
    from app_private.user_profiles profile
    where lower(profile.email) = any(emails)
    on conflict (uid, role_code) do nothing
    returning uid
  ), audited as (
    insert into app_private.role_assignment_audit(uid, role_code, operation, actor_uid)
    select uid, 'platform-admin', 'grant', backend_reconcile_platform_admins.actor_uid from granted
    returning uid
  )
  select count(*) into granted_count from audited;

  return jsonb_build_object('success', true, 'granted', granted_count, 'revoked', revoked_count);
end;
$$;

revoke all on function app_api.backend_reconcile_platform_admins(text,text[]) from public, anon, authenticated;
grant execute on function app_api.backend_reconcile_platform_admins(text,text[]) to service_role;
