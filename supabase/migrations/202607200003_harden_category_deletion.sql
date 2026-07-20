-- Make category deletion set-based, auditable, and explicit about missing rows.
-- Existing content deletion triggers remain the single owner of upload cleanup.

alter table app_private.category_configuration_audit
  drop constraint if exists category_configuration_audit_operation_check;
alter table app_private.category_configuration_audit
  add constraint category_configuration_audit_operation_check
  check (operation in ('create', 'update', 'archive', 'restore', 'delete', 'complete-setup'));

create or replace function app_api.backend_delete_issue_category(category_id text, actor_uid text)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare
  category_record app_private.issue_categories%rowtype;
  deleted_count integer;
begin
  if coalesce(btrim(actor_uid), '') = '' or coalesce(btrim(category_id), '') = '' then
    raise exception 'validation-required';
  end if;
  select * into category_record from app_private.issue_categories
    where id = backend_delete_issue_category.category_id for update;
  if not found then raise exception 'not-found'; end if;
  if category_record.is_default then raise exception 'cannot-delete-default-category'; end if;

  insert into app_private.outbox_events(event_type, target_type, target_id, actor_uid, payload)
  select 'issue.deleted', 'issue', issue.id::text, backend_delete_issue_category.actor_uid,
    jsonb_build_object(
      'author_uid', issue.author_uid,
      'issue_category', issue.category,
      'issue_id', issue.id,
      'supporter_uids', coalesce((
        select jsonb_agg(supporter.uid order by supporter.created_at)
        from app_private.supports supporter where supporter.issue_id = issue.id
      ), '[]'::jsonb),
      'title', issue.title
    )
  from app_private.issues issue where issue.category = category_record.id;

  delete from app_private.notifications notification
    where notification.target_type = 'issue'
      and notification.target_id in (select id::text from app_private.issues where category = category_record.id);
  delete from app_private.issues where category = category_record.id;
  get diagnostics deleted_count = row_count;
  delete from app_private.issue_categories where id = category_record.id;

  insert into app_private.category_configuration_audit(domain, category_id, operation, actor_uid, before_value)
  values('issue', category_record.id, 'delete', backend_delete_issue_category.actor_uid, to_jsonb(category_record));
  return jsonb_build_object('success', true, 'deletedRecords', deleted_count);
end;
$$;

create or replace function app_api.backend_delete_facility_category(category_id text, actor_uid text)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare
  category_record app_private.facility_categories%rowtype;
  deleted_count integer;
begin
  if coalesce(btrim(actor_uid), '') = '' or coalesce(btrim(category_id), '') = '' then
    raise exception 'validation-required';
  end if;
  select * into category_record from app_private.facility_categories
    where id = backend_delete_facility_category.category_id for update;
  if not found then raise exception 'not-found'; end if;
  if category_record.is_default then raise exception 'cannot-delete-default-category'; end if;

  insert into app_private.outbox_events(event_type, target_type, target_id, actor_uid, payload)
  select 'facility.deleted', 'facility', facility.id::text, backend_delete_facility_category.actor_uid,
    jsonb_build_object('author_uid', facility.author_uid, 'title', facility.title)
  from app_private.facility_reports facility where facility.category_id = category_record.id;

  delete from app_private.notifications notification
    where notification.target_type = 'facility'
      and notification.target_id in (
        select report.id::text from app_private.facility_reports report where report.category_id = category_record.id
      );
  delete from app_private.facility_reports report where report.category_id = category_record.id;
  get diagnostics deleted_count = row_count;
  delete from app_private.facility_categories where id = category_record.id;

  insert into app_private.category_configuration_audit(domain, category_id, operation, actor_uid, before_value)
  values('facility', category_record.id, 'delete', backend_delete_facility_category.actor_uid, to_jsonb(category_record));
  return jsonb_build_object('success', true, 'deletedRecords', deleted_count);
end;
$$;

revoke all on function app_api.backend_delete_issue_category(text,text) from public, anon, authenticated;
grant execute on function app_api.backend_delete_issue_category(text,text) to service_role;
revoke all on function app_api.backend_delete_facility_category(text,text) from public, anon, authenticated;
grant execute on function app_api.backend_delete_facility_category(text,text) to service_role;
