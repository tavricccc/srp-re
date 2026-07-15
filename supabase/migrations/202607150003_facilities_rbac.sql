-- Independent facilities workflow, capability-based access, and terminal-only count sync.

create table if not exists app_private.roles (
  code text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_private.permissions (
  code text primary key,
  label text not null
);

create table if not exists app_private.role_permissions (
  role_code text not null references app_private.roles(code) on delete cascade,
  permission_code text not null references app_private.permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);

create table if not exists app_private.user_role_assignments (
  uid text not null,
  role_code text not null references app_private.roles(code) on delete cascade,
  granted_by text not null,
  granted_at timestamptz not null default now(),
  primary key (uid, role_code)
);

create table if not exists app_private.role_assignment_audit (
  id bigint generated always as identity primary key,
  uid text not null,
  role_code text not null,
  operation text not null check (operation in ('grant', 'revoke')),
  actor_uid text not null,
  created_at timestamptz not null default now()
);

insert into app_private.roles(code, label) values
  ('platform-admin', '平台管理員'),
  ('proposal-manager', '提案管理'),
  ('announcement-manager', '公告管理'),
  ('general-affairs', '總務處')
on conflict (code) do update set label = excluded.label;

insert into app_private.permissions(code, label) values
  ('proposal.manage', '管理提案'),
  ('announcement.manage', '管理公告'),
  ('facility.manage', '管理設備'),
  ('role.manage', '管理角色'),
  ('dashboard.view', '查看統計')
on conflict (code) do update set label = excluded.label;

insert into app_private.role_permissions(role_code, permission_code) values
  ('platform-admin', 'proposal.manage'),
  ('platform-admin', 'announcement.manage'),
  ('platform-admin', 'facility.manage'),
  ('platform-admin', 'role.manage'),
  ('platform-admin', 'dashboard.view'),
  ('proposal-manager', 'proposal.manage'),
  ('announcement-manager', 'announcement.manage'),
  ('general-affairs', 'facility.manage')
on conflict do nothing;

create index if not exists user_role_assignments_role_uid_idx
  on app_private.user_role_assignments(role_code, uid);
create index if not exists role_assignment_audit_uid_created_idx
  on app_private.role_assignment_audit(uid, created_at desc);

alter table app_private.roles enable row level security;
alter table app_private.permissions enable row level security;
alter table app_private.role_permissions enable row level security;
alter table app_private.user_role_assignments enable row level security;
alter table app_private.role_assignment_audit enable row level security;

create table if not exists app_private.facility_reports (
  id uuid primary key default gen_random_uuid(),
  author_uid text not null,
  author_name text not null,
  author_photo_url text,
  title text not null check (length(btrim(title)) between 1 and 30),
  title_search text not null,
  location text not null check (length(btrim(location)) between 1 and 120),
  content text not null check (length(btrim(content)) between 1 and 8192),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'unable-to-handle')),
  affected_count integer not null default 1 check (affected_count >= 1),
  result_content text,
  last_actor_uid text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists app_private.facility_report_affected_users (
  facility_id uuid not null references app_private.facility_reports(id) on delete cascade,
  uid text not null,
  created_at timestamptz not null default now(),
  primary key (facility_id, uid)
);

create index if not exists facility_reports_status_created_idx
  on app_private.facility_reports(status, created_at desc, id desc);
create index if not exists facility_reports_status_affected_idx
  on app_private.facility_reports(status, affected_count desc, id desc);
create index if not exists facility_reports_author_created_idx
  on app_private.facility_reports(author_uid, created_at desc);
create index if not exists facility_affected_uid_idx
  on app_private.facility_report_affected_users(uid, facility_id);

alter table app_private.facility_reports enable row level security;
alter table app_private.facility_report_affected_users enable row level security;

alter table app_private.notifications drop constraint if exists notifications_target_type_check;
alter table app_private.notifications add constraint notifications_target_type_check
  check (target_type in ('announcement', 'issue', 'facility'));
alter table app_private.notification_states
  add column if not exists push_facility_updates_enabled boolean not null default true;

create or replace function app_api.backend_notification_state_to_json(state_record app_private.notification_states)
returns jsonb language sql stable security definer set search_path = app_private, app_api, public as $$
  select jsonb_build_object(
    'uid',state_record.uid,
    'broadcast_opened_at_ms',case when state_record.broadcast_opened_at is null then null else floor(extract(epoch from state_record.broadcast_opened_at)*1000) end,
    'admin_opened_at_ms',case when state_record.admin_opened_at is null then null else floor(extract(epoch from state_record.admin_opened_at)*1000) end,
    'user_opened_at_ms',case when state_record.user_opened_at is null then null else floor(extract(epoch from state_record.user_opened_at)*1000) end,
    'push_comments_enabled',state_record.push_comments_enabled,
    'push_issue_updates_enabled',state_record.push_issue_updates_enabled,
    'push_facility_updates_enabled',state_record.push_facility_updates_enabled,
    'updated_at',state_record.updated_at
  );
$$;

create or replace function app_api.backend_push_notification_preference(actor_uid text,device_id text,permission text)
returns jsonb language plpgsql security definer set search_path = app_private,app_api,public as $$
declare state_record app_private.notification_states%rowtype; token_count integer; device_enabled boolean:=false;
begin
  state_record:=app_api.backend_upsert_notification_state(actor_uid);
  if coalesce(device_id,'')<>'' then select exists(select 1 from app_private.push_tokens where uid=actor_uid and push_tokens.device_id=backend_push_notification_preference.device_id) into device_enabled; end if;
  select count(*) into token_count from app_private.push_tokens where uid=actor_uid;
  return jsonb_build_object('deviceEnabled',device_enabled,'enabled',token_count>0,'personalPreferences',jsonb_build_object(
    'comments',state_record.push_comments_enabled<>false,'issueUpdates',state_record.push_issue_updates_enabled<>false,
    'facilityUpdates',state_record.push_facility_updates_enabled<>false),
    'permission',coalesce(permission,'default'),'tokenCount',token_count);
end;
$$;

create or replace function app_api.backend_update_push_notification_preferences(
  actor_uid text,comments_enabled boolean,issue_updates_enabled boolean,facility_updates_enabled boolean,device_id text,permission text
)
returns jsonb language plpgsql security definer set search_path = app_private,app_api,public as $$
begin
  insert into app_private.notification_states(uid,push_comments_enabled,push_issue_updates_enabled,push_facility_updates_enabled,updated_at)
  values(actor_uid,comments_enabled,issue_updates_enabled,facility_updates_enabled,now())
  on conflict(uid) do update set push_comments_enabled=excluded.push_comments_enabled,
    push_issue_updates_enabled=excluded.push_issue_updates_enabled,push_facility_updates_enabled=excluded.push_facility_updates_enabled,updated_at=excluded.updated_at;
  return app_api.backend_push_notification_preference(actor_uid,device_id,permission);
end;
$$;
grant execute on function app_api.backend_update_push_notification_preferences(text,boolean,boolean,boolean,text,text) to service_role;

create or replace function app_private.attach_markdown_uploads_from_content()
returns trigger language plpgsql security definer set search_path = app_private, public as $$
declare
  upload_ids uuid[];
  removed_upload_ids uuid[];
  target_type_name text;
  valid_upload_count integer;
begin
  select coalesce(array_agg(distinct captures[1]::uuid), array[]::uuid[])
  into upload_ids
  from regexp_matches(coalesce(new.content, ''), 'srp-upload://([0-9a-fA-F-]{36})', 'g') as captures;
  target_type_name := case tg_table_name
    when 'issues' then 'issue' when 'comments' then 'comment'
    when 'announcements' then 'announcement' when 'announcement_comments' then 'announcement_comment'
    when 'facility_reports' then 'facility' else null end;
  if target_type_name is null then raise exception 'unsupported-upload-target'; end if;
  if cardinality(upload_ids) > 0 then
    select count(*) into valid_upload_count from app_private.uploads
    where id = any(upload_ids) and owner_uid = new.author_uid and status in ('ready', 'attached')
      and (attached_target_id is null or (attached_target_type = target_type_name and attached_target_id = new.id));
    if valid_upload_count <> cardinality(upload_ids) then raise exception 'upload-attachment-invalid'; end if;
    update app_private.uploads set attached_target_id = new.id, attached_target_type = target_type_name,
      status = 'attached', updated_at = now()
    where id = any(upload_ids) and owner_uid = new.author_uid;
  end if;
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(id), array[]::uuid[]) into removed_upload_ids
    from app_private.uploads where attached_target_type = target_type_name and attached_target_id = new.id
      and not (id = any(upload_ids));
    if cardinality(removed_upload_ids) > 0 then
      insert into app_private.deletion_jobs(target_type,target_id,cloudinary_public_id)
      select 'upload', id::text, cloudinary_public_id from app_private.uploads where id = any(removed_upload_ids);
      delete from app_private.uploads where id = any(removed_upload_ids);
    end if;
  end if;
  return new;
end;
$$;

create or replace function app_private.queue_deleted_content_uploads()
returns trigger language plpgsql security definer set search_path = app_private, public as $$
declare removed_upload_ids uuid[]; target_type_name text;
begin
  target_type_name := case tg_table_name
    when 'issues' then 'issue' when 'comments' then 'comment'
    when 'announcements' then 'announcement' when 'announcement_comments' then 'announcement_comment'
    when 'facility_reports' then 'facility' else null end;
  if target_type_name is null then raise exception 'unsupported-upload-target'; end if;
  select coalesce(array_agg(id), array[]::uuid[]) into removed_upload_ids from app_private.uploads
    where attached_target_type = target_type_name and attached_target_id = old.id;
  if cardinality(removed_upload_ids) > 0 then
    insert into app_private.deletion_jobs(target_type,target_id,cloudinary_public_id)
    select 'upload', id::text, cloudinary_public_id from app_private.uploads where id = any(removed_upload_ids);
    delete from app_private.uploads where id = any(removed_upload_ids);
  end if;
  return old;
end;
$$;

create trigger attach_facility_markdown_uploads
after insert or update of content on app_private.facility_reports
for each row execute function app_private.attach_markdown_uploads_from_content();
create trigger queue_deleted_facility_uploads
before delete on app_private.facility_reports
for each row execute function app_private.queue_deleted_content_uploads();

create or replace function app_private.refresh_issue_support_count()
returns trigger language plpgsql set search_path = app_private, public as $$
declare changed_issue_id uuid := coalesce(new.issue_id, old.issue_id);
begin
  update app_private.issues issue set support_count =
    case when issue.support_enabled then 1 else 0 end
    + (select count(*)::integer from app_private.supports where supports.issue_id = changed_issue_id)
  where issue.id = changed_issue_id;
  return null;
end;
$$;

create or replace function app_api.backend_create_issue(
  actor_uid text, actor_name text, actor_photo_url text, issue_title text, issue_content text,
  issue_category text, issue_status text, support_enabled boolean, support_goal integer,
  support_deadline_at timestamptz, response_deadline_at timestamptz, author_is_private boolean,
  actor_is_admin boolean, private_to_owner_categories text[], review_required_categories text[], author_private_categories text[]
)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare issue_record app_private.issues%rowtype;
begin
  insert into app_private.issues(
    author_uid,author_name,author_photo_url,category,content,response_deadline_at,
    review_approved_at,status,support_count,support_deadline_at,support_enabled,support_goal,title,title_search
  ) values (
    actor_uid,actor_name,actor_photo_url,issue_category,issue_content,response_deadline_at,
    null,issue_status,case when support_enabled then 1 else 0 end,support_deadline_at,
    support_enabled,support_goal,issue_title,lower(issue_title)
  ) returning * into issue_record;
  if author_is_private then
    insert into app_private.private_issue_authors(issue_id,author_uid,author_name,author_photo_url)
    values(issue_record.id,actor_uid,actor_name,actor_photo_url)
    on conflict(issue_id) do update set author_uid=excluded.author_uid,author_name=excluded.author_name,author_photo_url=excluded.author_photo_url;
  end if;
  return app_api.backend_issue_to_json(issue_record,actor_uid,actor_is_admin,
    private_to_owner_categories,review_required_categories,author_private_categories);
end;
$$;

create or replace function app_api.backend_toggle_support(
  issue_id uuid, actor_uid text, remove_support boolean, response_deadline_days integer
)
returns table(supported boolean, support_count integer, goal_met boolean)
language plpgsql security definer set search_path = app_private, app_api, public as $$
declare issue_record app_private.issues%rowtype; existing boolean; next_count integer; reached_goal boolean := false;
begin
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;
  if issue_record.author_uid = actor_uid then raise exception 'support-not-available'; end if;
  if issue_record.status <> 'pending' or not issue_record.support_enabled or issue_record.support_met_at is not null
    or (issue_record.support_deadline_at is not null and issue_record.support_deadline_at <= now())
  then raise exception 'support-not-available'; end if;
  select exists(select 1 from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and uid = actor_uid) into existing;
  if remove_support or existing then
    delete from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and uid = actor_uid;
    supported := false;
  else
    insert into app_private.supports(issue_id, uid) values (backend_toggle_support.issue_id, actor_uid);
    supported := true;
  end if;
  select issues.support_count into next_count from app_private.issues where id = backend_toggle_support.issue_id;
  if supported and issue_record.support_goal is not null and next_count >= issue_record.support_goal then
    update app_private.issues set support_met_at = coalesce(support_met_at, now()),
      response_deadline_at = case when response_deadline_days is null then null else now() + make_interval(days => response_deadline_days) end
    where id = backend_toggle_support.issue_id and support_met_at is null;
    reached_goal := found;
  end if;
  if reached_goal then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values ('support.goal_met','issue',issue_id::text,actor_uid,jsonb_build_object(
      'author_uid',issue_record.author_uid,'issue_category',issue_record.category,
      'new_support_count',next_count,'support_goal',issue_record.support_goal,'title',issue_record.title));
  end if;
  support_count := next_count; goal_met := reached_goal; return next;
end;
$$;

create or replace function app_api.backend_create_facility(
  actor_uid text, actor_name text, actor_photo_url text,
  facility_title text, facility_location text, facility_content text
)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare facility app_private.facility_reports%rowtype;
begin
  insert into app_private.facility_reports(author_uid,author_name,author_photo_url,title,title_search,location,content,last_actor_uid)
  values(actor_uid,actor_name,actor_photo_url,facility_title,lower(facility_title),facility_location,facility_content,actor_uid)
  returning * into facility;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('facility.created','facility',facility.id::text,actor_uid,jsonb_build_object('title',facility.title));
  return to_jsonb(facility) || jsonb_build_object('isOwnFacility',true,'currentUserAffected',true,'canManageFacility',false);
end;
$$;

create or replace function app_api.backend_get_facility(facility_id uuid, actor_uid text, actor_can_manage boolean)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare facility app_private.facility_reports%rowtype; affected boolean;
begin
  select * into facility from app_private.facility_reports where id = facility_id;
  if not found then raise exception 'not-found'; end if;
  select facility.author_uid = actor_uid or exists(select 1 from app_private.facility_report_affected_users a where a.facility_id = facility.id and a.uid = actor_uid) into affected;
  return to_jsonb(facility) || jsonb_build_object('isOwnFacility',facility.author_uid = actor_uid,'currentUserAffected',affected,'canManageFacility',actor_can_manage);
end;
$$;

create or replace function app_api.backend_list_facilities(
  actor_uid text, actor_can_manage boolean, bucket text, status_filter text,
  search_query text, sort_name text, cursor_created_at timestamptz,
  cursor_number integer, cursor_id uuid, page_size integer
)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare rows_json jsonb; fetched integer; effective_size integer := least(greatest(page_size,1),50);
begin
  with candidates as (
    select f.*, (f.author_uid = actor_uid or exists(select 1 from app_private.facility_report_affected_users a where a.facility_id=f.id and a.uid=actor_uid)) current_user_affected
    from app_private.facility_reports f
    where (case when bucket='closed' then f.status in ('completed','unable-to-handle') else f.status in ('pending','processing') end)
      and (coalesce(status_filter,'')='' or f.status=status_filter)
      and (coalesce(search_query,'')='' or f.title_search like '%'||lower(search_query)||'%' or lower(f.location) like '%'||lower(search_query)||'%')
      and (cursor_id is null or case when sort_name='most-affected'
        then (f.affected_count,f.id) < (cursor_number,cursor_id)
        else (f.created_at,f.id) < (cursor_created_at,cursor_id) end)
    order by case when sort_name='most-affected' then f.affected_count end desc,
      case when sort_name<>'most-affected' then f.created_at end desc, f.id desc
    limit effective_size + 1
  ), selected as (select * from candidates limit effective_size)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'title',title,'location',location,'status',status,'affected_count',affected_count,
    'author_uid',author_uid,'author_name',author_name,'author_photo_url',author_photo_url,
    'created_at',created_at,'updated_at',updated_at,'isOwnFacility',author_uid=actor_uid,
    'currentUserAffected',current_user_affected,'canManageFacility',actor_can_manage
  ) order by case when sort_name='most-affected' then affected_count end desc,
    case when sort_name<>'most-affected' then created_at end desc,id desc),'[]'::jsonb),
    (select count(*) from candidates)
  into rows_json,fetched from selected;
  return jsonb_build_object('facilities',rows_json,'hasMore',fetched>effective_size);
end;
$$;

create or replace function app_api.backend_toggle_facility_affected(facility_id uuid, actor_uid text)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare facility app_private.facility_reports%rowtype; now_affected boolean;
begin
  select * into facility from app_private.facility_reports where id=facility_id for update;
  if not found then raise exception 'not-found'; end if;
  if facility.author_uid=actor_uid then raise exception 'facility-author-fixed'; end if;
  if facility.status in ('completed','unable-to-handle') then raise exception 'facility-closed'; end if;
  delete from app_private.facility_report_affected_users where facility_report_affected_users.facility_id=backend_toggle_facility_affected.facility_id and uid=actor_uid;
  if found then now_affected := false;
  else insert into app_private.facility_report_affected_users(facility_id,uid) values(backend_toggle_facility_affected.facility_id,actor_uid); now_affected := true; end if;
  update app_private.facility_reports set affected_count=affected_count+case when now_affected then 1 else -1 end,updated_at=now()
    where id=facility_id returning * into facility;
  return jsonb_build_object('affected',now_affected,'affected_count',facility.affected_count);
end;
$$;

create or replace function app_api.backend_update_facility_status(
  facility_id uuid, actor_uid text, actor_can_manage boolean, next_status text, result_content text
)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare facility app_private.facility_reports%rowtype; old_status text;
begin
  if not actor_can_manage then raise exception 'permission-denied'; end if;
  select * into facility from app_private.facility_reports where id=facility_id for update;
  if not found then raise exception 'not-found'; end if;
  old_status := facility.status;
  if not ((old_status='pending' and next_status='processing') or (old_status='processing' and next_status in ('completed','unable-to-handle'))) then raise exception 'invalid-status'; end if;
  if next_status in ('completed','unable-to-handle') and coalesce(length(btrim(result_content)),0)=0 then raise exception 'missing-result'; end if;
  update app_private.facility_reports set status=next_status,result_content=case when next_status in ('completed','unable-to-handle') then result_content else null end,
    started_at=case when next_status='processing' then coalesce(started_at,now()) else started_at end,
    closed_at=case when next_status in ('completed','unable-to-handle') then now() else null end,
    last_actor_uid=actor_uid,updated_at=now() where id=facility_id returning * into facility;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('facility.status_changed','facility',facility.id::text,actor_uid,jsonb_build_object(
    'author_uid',facility.author_uid,'old_status',old_status,'new_status',next_status,'title',facility.title,
    'affected_count',facility.affected_count,'result_content',facility.result_content));
  return to_jsonb(facility) || jsonb_build_object('isOwnFacility',facility.author_uid=actor_uid,'currentUserAffected',facility.author_uid=actor_uid,'canManageFacility',true);
end;
$$;

create or replace function app_api.backend_delete_facility(facility_id uuid, actor_uid text, actor_can_manage boolean)
returns jsonb language plpgsql security definer set search_path = app_private, app_api, public as $$
declare facility app_private.facility_reports%rowtype;
begin
  select * into facility from app_private.facility_reports where id=facility_id for update;
  if not found then raise exception 'not-found'; end if;
  if not actor_can_manage and not (facility.author_uid=actor_uid and facility.status='pending') then raise exception 'permission-denied'; end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('facility.deleted','facility',facility.id::text,actor_uid,jsonb_build_object('title',facility.title,'author_uid',facility.author_uid));
  delete from app_private.facility_reports where id=facility_id;
  return jsonb_build_object('success',true,'facilityId',facility_id);
end;
$$;

drop trigger if exists mark_notion_support_dirty on app_private.supports;
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='srp_notion_support_sync';
  end if;
end $$;
drop function if exists app_api.claim_notion_support_dirty(integer);
drop function if exists app_api.complete_notion_support_dirty(uuid,timestamptz);
drop function if exists app_api.release_notion_support_dirty(uuid);
drop function if exists app_private.mark_notion_support_dirty();
drop table if exists app_private.notion_support_dirty;

drop index if exists app_private.push_tokens_topic_admin_fallback_idx;
alter table app_private.push_tokens drop column if exists topic_admin;

revoke all on app_private.roles,app_private.permissions,app_private.role_permissions,
  app_private.user_role_assignments,app_private.role_assignment_audit,
  app_private.facility_reports,app_private.facility_report_affected_users from public,anon,authenticated;
grant execute on function app_api.backend_create_facility(text,text,text,text,text,text) to service_role;
grant execute on function app_api.backend_get_facility(uuid,text,boolean) to service_role;
grant execute on function app_api.backend_list_facilities(text,boolean,text,text,text,text,timestamptz,integer,uuid,integer) to service_role;
grant execute on function app_api.backend_toggle_facility_affected(uuid,text) to service_role;
grant execute on function app_api.backend_update_facility_status(uuid,text,boolean,text,text) to service_role;
grant execute on function app_api.backend_delete_facility(uuid,text,boolean) to service_role;
