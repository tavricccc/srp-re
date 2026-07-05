create schema if not exists app_private;
create schema if not exists app_api;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_trgm with schema extensions;

grant usage on schema app_api to anon, authenticated;
grant usage on schema app_private to service_role;

-- Architectural helper test placeholders: auth.firebase_uid() and auth.firebase_project_id()

create or replace function app_private.firebase_uid()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::text;
$$;

create or replace function app_private.firebase_project_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'aud', '')::text;
$$;

create or replace function app_private.is_expected_firebase_project()
returns boolean
language sql
stable
as $$
  select app_private.firebase_project_id() = nullif(current_setting('app.firebase_project_id', true), '');
$$;

grant execute on function app_private.firebase_uid() to authenticated, anon, service_role;
grant execute on function app_private.firebase_project_id() to authenticated, anon, service_role;
grant execute on function app_private.is_expected_firebase_project() to authenticated, anon, service_role;

create table if not exists app_private.user_roles (
  uid text primary key,
  role text not null check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.issues (
  id uuid primary key default gen_random_uuid(),
  author_uid text not null,
  title text not null,
  content text not null,
  status text not null,
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references app_private.issues(id) on delete cascade,
  author_uid text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_private.supports (
  issue_id uuid not null references app_private.issues(id) on delete cascade,
  uid text not null,
  created_at timestamptz not null default now(),
  primary key (issue_id, uid)
);

create table if not exists app_private.uploads (
  id uuid primary key default gen_random_uuid(),
  owner_uid text not null,
  cloudinary_public_id text not null,
  status text not null check (status in ('pending', 'ready', 'attached', 'failed')),
  visibility text not null check (visibility in ('public', 'private', 'authenticated')),
  attached_target_type text,
  attached_target_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table if not exists app_private.deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  cloudinary_public_id text,
  notion_page_id text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  target_type text not null,
  target_id text not null,
  actor_uid text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_status_check'
      and conrelid = 'app_private.issues'::regclass
  ) then
    alter table app_private.issues
      add constraint issues_status_check
      check (status in ('pending', 'under-review', 'processing', 'completed', 'infeasible', 'auto-rejected', 'review-rejected'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_title_not_blank'
      and conrelid = 'app_private.issues'::regclass
  ) then
    alter table app_private.issues
      add constraint issues_title_not_blank
      check (length(btrim(title)) > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_content_not_blank'
      and conrelid = 'app_private.issues'::regclass
  ) then
    alter table app_private.issues
      add constraint issues_content_not_blank
      check (length(btrim(content)) > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_content_not_blank'
      and conrelid = 'app_private.comments'::regclass
  ) then
    alter table app_private.comments
      add constraint comments_content_not_blank
      check (length(btrim(content)) > 0)
      not valid;
  end if;
end $$;

create index if not exists issues_category_status_created_idx
  on app_private.issues (category, status, created_at desc, id desc);

create index if not exists issues_author_created_idx
  on app_private.issues (author_uid, created_at desc, id desc);

create index if not exists comments_issue_created_idx
  on app_private.comments (issue_id, created_at asc, id asc);

create index if not exists supports_uid_issue_idx
  on app_private.supports (uid, issue_id);

create index if not exists uploads_owner_status_idx
  on app_private.uploads (owner_uid, status, created_at desc);

create index if not exists deletion_jobs_claim_idx
  on app_private.deletion_jobs (status, next_attempt_at, created_at)
  where status in ('pending', 'failed');

create index if not exists outbox_events_claim_idx
  on app_private.outbox_events (status, next_attempt_at, occurred_at)
  where status in ('pending', 'failed');

alter table app_private.user_roles enable row level security;
alter table app_private.issues enable row level security;
alter table app_private.comments enable row level security;
alter table app_private.supports enable row level security;
alter table app_private.uploads enable row level security;
alter table app_private.deletion_jobs enable row level security;
alter table app_private.outbox_events enable row level security;

create or replace function app_private.is_admin(uid text default app_private.firebase_uid())
returns boolean
language sql
stable
security definer
set search_path = app_private, public
as $$
  select exists (
    select 1
    from app_private.user_roles
    where user_roles.uid = is_admin.uid
      and role = 'admin'
  );
$$;

create or replace view app_api.issues
with (security_invoker = true)
as
select
  id,
  title,
  content,
  status,
  category,
  created_at,
  updated_at
from app_private.issues;

grant select on app_api.issues to anon, authenticated;

create policy "read issues with valid firebase token"
on app_private.issues
for select
to authenticated
using (app_private.is_expected_firebase_project());

create policy "read comments with valid firebase token"
on app_private.comments
for select
to authenticated
using (app_private.is_expected_firebase_project());

create policy "read own supports"
on app_private.supports
for select
to authenticated
using (app_private.is_expected_firebase_project() and uid = app_private.firebase_uid());

create policy "read own uploads"
on app_private.uploads
for select
to authenticated
using (app_private.is_expected_firebase_project() and owner_uid = app_private.firebase_uid());

create or replace function app_api.delete_issue(issue_id uuid)
returns void
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  issue_record app_private.issues%rowtype;
  actor_uid text := app_private.firebase_uid();
begin
  if not app_private.is_expected_firebase_project() or actor_uid is null then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select *
  into issue_record
  from app_private.issues
  where id = delete_issue.issue_id
  for update;

  if not found then
    return;
  end if;

  if issue_record.author_uid <> actor_uid and not app_private.is_admin(actor_uid) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  insert into app_private.outbox_events (
    event_type,
    target_type,
    target_id,
    actor_uid,
    payload
  )
  values (
    'issue.deleted',
    'issue',
    issue_record.id::text,
    actor_uid,
    jsonb_build_object('issue_id', issue_record.id::text)
  );

  delete from app_private.issues
  where id = issue_record.id;
end;
$$;

grant execute on function app_api.delete_issue(uuid) to authenticated;

create or replace function app_api.claim_outbox_events(batch_size integer default 100)
returns setof app_private.outbox_events
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  return query
  with claimed as (
    select id
    from app_private.outbox_events
    where status in ('pending', 'failed')
      and next_attempt_at <= now()
    order by occurred_at asc
    limit greatest(1, least(batch_size, 100))
    for update skip locked
  )
  update app_private.outbox_events event
  set
    status = 'processing',
    attempt_count = event.attempt_count + 1,
    locked_at = now(),
    updated_at = now()
  from claimed
  where event.id = claimed.id
  returning event.*;
end;
$$;

create or replace function app_api.complete_outbox_event(event_id uuid)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.outbox_events
  set
    status = 'completed',
    updated_at = now(),
    expires_at = now() + interval '2 days'
  where id = event_id;
$$;

create or replace function app_api.fail_outbox_event(event_id uuid, error_message text)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.outbox_events
  set
    status = 'failed',
    last_error = left(error_message, 1000),
    next_attempt_at = now() + make_interval(mins => least(60, greatest(1, attempt_count * 2))),
    updated_at = now()
  where id = event_id;
$$;

grant execute on function app_api.claim_outbox_events(integer) to service_role;
grant execute on function app_api.complete_outbox_event(uuid) to service_role;
grant execute on function app_api.fail_outbox_event(uuid, text) to service_role;

create or replace function app_api.claim_deletion_jobs(batch_size integer default 50)
returns setof app_private.deletion_jobs
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  return query
  with claimed as (
    select id
    from app_private.deletion_jobs
    where status in ('pending', 'failed')
      and next_attempt_at <= now()
    order by created_at asc
    limit greatest(1, least(batch_size, 50))
    for update skip locked
  )
  update app_private.deletion_jobs job
  set
    status = 'processing',
    attempt_count = job.attempt_count + 1,
    updated_at = now()
  from claimed
  where job.id = claimed.id
  returning job.*;
end;
$$;

create or replace function app_api.complete_deletion_job(job_id uuid)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.deletion_jobs
  set
    status = 'completed',
    updated_at = now()
  where id = job_id;
$$;

create or replace function app_api.fail_deletion_job(job_id uuid, error_message text)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.deletion_jobs
  set
    status = 'failed',
    last_error = left(error_message, 1000),
    next_attempt_at = now() + make_interval(mins => least(60, greatest(1, attempt_count * 2))),
    updated_at = now()
  where id = job_id;
$$;

grant execute on function app_api.claim_deletion_jobs(integer) to service_role;
grant execute on function app_api.complete_deletion_job(uuid) to service_role;
grant execute on function app_api.fail_deletion_job(uuid, text) to service_role;

create or replace function app_private.signal_outbox_worker()
returns trigger
language plpgsql
security definer
set search_path = app_private, extensions, public
as $$
declare
  worker_url text := nullif(current_setting('app.outbox_worker_url', true), '');
  webhook_secret text := nullif(current_setting('app.webhook_secret', true), '');
begin
  if worker_url is null or webhook_secret is null then
    return null;
  end if;

  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || webhook_secret),
    body := jsonb_build_object('signal', 'outbox_insert')
  );

  return null;
end;
$$;

drop trigger if exists outbox_worker_wakeup on app_private.outbox_events;
create trigger outbox_worker_wakeup
after insert on app_private.outbox_events
for each statement
execute function app_private.signal_outbox_worker();
alter table app_private.issues
  add column if not exists author_name text not null default '匿名使用者',
  add column if not exists author_photo_url text,
  add column if not exists support_count integer not null default 0,
  add column if not exists support_enabled boolean not null default true,
  add column if not exists support_goal integer,
  add column if not exists support_deadline_at timestamptz,
  add column if not exists response_deadline_at timestamptz,
  add column if not exists support_met_at timestamptz,
  add column if not exists review_rejection_reason text,
  add column if not exists title_search text not null default '';

alter table app_private.comments
  add column if not exists author_name text not null default '匿名使用者',
  add column if not exists author_photo_url text,
  add column if not exists is_admin_comment boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table app_private.uploads
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists size_bytes integer,
  add column if not exists content_type text,
  add column if not exists delivery_type text not null default 'upload',
  add column if not exists resource_type text not null default 'image',
  add column if not exists secure_url text;

create table if not exists app_private.private_issue_authors (
  issue_id uuid primary key references app_private.issues(id) on delete cascade,
  author_uid text not null,
  author_name text not null default '匿名使用者',
  author_photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists app_private.announcements (
  id uuid primary key default gen_random_uuid(),
  author_uid text not null,
  author_name text not null default '管理員',
  author_photo_url text,
  title text not null,
  content text not null,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz not null default now()
);

create table if not exists app_private.announcement_likes (
  announcement_id uuid not null references app_private.announcements(id) on delete cascade,
  uid text not null,
  created_at timestamptz not null default now(),
  primary key (announcement_id, uid)
);

create table if not exists app_private.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references app_private.announcements(id) on delete cascade,
  author_uid text not null,
  author_name text not null default '匿名使用者',
  author_photo_url text,
  content text not null,
  is_admin_comment boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.notifications (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('broadcast', 'admin', 'user')),
  recipient_uid text,
  type text not null,
  target_type text not null check (target_type in ('announcement', 'issue')),
  target_id text not null,
  title text not null,
  actor_uid text,
  actor_name text,
  actor_photo_url text,
  body_preview text,
  issue_category text,
  old_status text,
  new_status text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table if not exists app_private.notification_states (
  uid text primary key,
  broadcast_opened_at timestamptz,
  admin_opened_at timestamptz,
  user_opened_at timestamptz,
  push_comments_enabled boolean not null default true,
  push_issue_updates_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists app_private.push_tokens (
  uid text not null,
  device_id text not null,
  token text not null,
  permission text not null,
  platform text not null,
  user_agent text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (uid, device_id)
);

create table if not exists app_private.user_profiles (
  uid text primary key,
  display_name text not null default '匿名使用者',
  photo_url text,
  cached_photo_url text,
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists app_private.notion_pages (
  target_type text not null,
  target_id text not null,
  notion_page_id text not null,
  updated_at timestamptz not null default now(),
  primary key (target_type, target_id)
);

create table if not exists app_private.maintenance_runs (
  id uuid primary key default gen_random_uuid(),
  task_name text not null,
  status text not null default 'completed',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text
);

alter table app_private.private_issue_authors enable row level security;
alter table app_private.announcements enable row level security;
alter table app_private.announcement_likes enable row level security;
alter table app_private.announcement_comments enable row level security;
alter table app_private.notifications enable row level security;
alter table app_private.notification_states enable row level security;
alter table app_private.push_tokens enable row level security;
alter table app_private.user_profiles enable row level security;
alter table app_private.notion_pages enable row level security;
alter table app_private.maintenance_runs enable row level security;

create or replace view app_api.notifications
with (security_invoker = true)
as
select id, source, recipient_uid, type, target_type, target_id, title, created_at
from app_private.notifications;

create or replace view app_api.notification_states
with (security_invoker = true)
as
select uid, broadcast_opened_at, admin_opened_at, user_opened_at, updated_at
from app_private.notification_states;

grant select on app_api.notifications to authenticated;
grant select on app_api.notification_states to authenticated;

create policy "read notifications with valid firebase token"
on app_private.notifications
for select
to authenticated
using (
  app_private.is_expected_firebase_project()
  and (
    source = 'broadcast'
    or recipient_uid = app_private.firebase_uid()
    or (source = 'admin' and app_private.is_admin(app_private.firebase_uid()))
  )
);

create policy "read own notification state"
on app_private.notification_states
for select
to authenticated
using (app_private.is_expected_firebase_project() and uid = app_private.firebase_uid());

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.set_issue_derived_fields()
returns trigger
language plpgsql
as $$
begin
  new.title_search = lower(btrim(new.title));

  if new.support_goal is not null
    and new.support_count >= new.support_goal
    and new.support_met_at is null
  then
    new.support_met_at = now();
  end if;

  return new;
end;
$$;

create or replace function app_private.refresh_issue_support_count()
returns trigger
language plpgsql
as $$
declare
  changed_issue_id uuid := coalesce(new.issue_id, old.issue_id);
begin
  update app_private.issues
  set support_count = (
    select count(*)::integer
    from app_private.supports
    where supports.issue_id = changed_issue_id
  )
  where id = changed_issue_id;

  return null;
end;
$$;

create or replace function app_private.refresh_announcement_like_count()
returns trigger
language plpgsql
as $$
declare
  changed_announcement_id uuid := coalesce(new.announcement_id, old.announcement_id);
begin
  update app_private.announcements
  set like_count = (
    select count(*)::integer
    from app_private.announcement_likes
    where announcement_likes.announcement_id = changed_announcement_id
  )
  where id = changed_announcement_id;

  return null;
end;
$$;

create or replace function app_private.refresh_announcement_comment_count()
returns trigger
language plpgsql
as $$
declare
  changed_announcement_id uuid := coalesce(new.announcement_id, old.announcement_id);
begin
  update app_private.announcements
  set comment_count = (
    select count(*)::integer
    from app_private.announcement_comments
    where announcement_comments.announcement_id = changed_announcement_id
  )
  where id = changed_announcement_id;

  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_support_count_non_negative'
      and conrelid = 'app_private.issues'::regclass
  ) then
    alter table app_private.issues
      add constraint issues_support_count_non_negative
      check (support_count >= 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_support_goal_positive'
      and conrelid = 'app_private.issues'::regclass
  ) then
    alter table app_private.issues
      add constraint issues_support_goal_positive
      check (support_goal is null or support_goal > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'uploads_dimensions_non_negative'
      and conrelid = 'app_private.uploads'::regclass
  ) then
    alter table app_private.uploads
      add constraint uploads_dimensions_non_negative
      check (
        (width is null or width >= 0)
        and (height is null or height >= 0)
        and (size_bytes is null or size_bytes >= 0)
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_title_not_blank'
      and conrelid = 'app_private.announcements'::regclass
  ) then
    alter table app_private.announcements
      add constraint announcements_title_not_blank
      check (length(btrim(title)) > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_content_not_blank'
      and conrelid = 'app_private.announcements'::regclass
  ) then
    alter table app_private.announcements
      add constraint announcements_content_not_blank
      check (length(btrim(content)) > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcement_comments_content_not_blank'
      and conrelid = 'app_private.announcement_comments'::regclass
  ) then
    alter table app_private.announcement_comments
      add constraint announcement_comments_content_not_blank
      check (length(btrim(content)) > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_counts_non_negative'
      and conrelid = 'app_private.announcements'::regclass
  ) then
    alter table app_private.announcements
      add constraint announcements_counts_non_negative
      check (like_count >= 0 and comment_count >= 0)
      not valid;
  end if;
end $$;

create index if not exists issues_title_search_trgm_idx
  on app_private.issues using gin (title_search extensions.gin_trgm_ops);

create index if not exists issues_category_status_support_idx
  on app_private.issues (category, status, support_count desc, created_at desc, id desc);

create index if not exists private_issue_authors_author_idx
  on app_private.private_issue_authors (author_uid, created_at desc);

create index if not exists announcements_published_idx
  on app_private.announcements (published_at desc, id desc);

create index if not exists announcements_like_idx
  on app_private.announcements (like_count desc, published_at desc, id desc);

create index if not exists announcements_comment_idx
  on app_private.announcements (comment_count desc, published_at desc, id desc);

create index if not exists announcement_comments_announcement_created_idx
  on app_private.announcement_comments (announcement_id, created_at asc, id asc);

create index if not exists announcement_likes_uid_announcement_idx
  on app_private.announcement_likes (uid, announcement_id);

create index if not exists notifications_source_created_idx
  on app_private.notifications (source, created_at desc, id desc);

create index if not exists notifications_recipient_source_created_idx
  on app_private.notifications (recipient_uid, source, created_at desc, id desc)
  where recipient_uid is not null;

create index if not exists push_tokens_token_idx
  on app_private.push_tokens (token);

create index if not exists maintenance_runs_task_started_idx
  on app_private.maintenance_runs (task_name, started_at desc);

drop trigger if exists touch_issues_updated_at on app_private.issues;
create trigger touch_issues_updated_at
before update on app_private.issues
for each row execute function app_private.touch_updated_at();

drop trigger if exists set_issue_derived_fields_on_write on app_private.issues;
create trigger set_issue_derived_fields_on_write
before insert or update of title, support_count, support_goal on app_private.issues
for each row execute function app_private.set_issue_derived_fields();

drop trigger if exists touch_announcements_updated_at on app_private.announcements;
create trigger touch_announcements_updated_at
before update on app_private.announcements
for each row execute function app_private.touch_updated_at();

drop trigger if exists touch_comments_updated_at on app_private.comments;
create trigger touch_comments_updated_at
before update on app_private.comments
for each row execute function app_private.touch_updated_at();

drop trigger if exists touch_announcement_comments_updated_at on app_private.announcement_comments;
create trigger touch_announcement_comments_updated_at
before update on app_private.announcement_comments
for each row execute function app_private.touch_updated_at();

drop trigger if exists refresh_issue_support_count_on_insert on app_private.supports;
create trigger refresh_issue_support_count_on_insert
after insert on app_private.supports
for each row execute function app_private.refresh_issue_support_count();

drop trigger if exists refresh_issue_support_count_on_delete on app_private.supports;
create trigger refresh_issue_support_count_on_delete
after delete on app_private.supports
for each row execute function app_private.refresh_issue_support_count();

drop trigger if exists refresh_announcement_like_count_on_insert on app_private.announcement_likes;
create trigger refresh_announcement_like_count_on_insert
after insert on app_private.announcement_likes
for each row execute function app_private.refresh_announcement_like_count();

drop trigger if exists refresh_announcement_like_count_on_delete on app_private.announcement_likes;
create trigger refresh_announcement_like_count_on_delete
after delete on app_private.announcement_likes
for each row execute function app_private.refresh_announcement_like_count();

drop trigger if exists refresh_announcement_comment_count_on_insert on app_private.announcement_comments;
create trigger refresh_announcement_comment_count_on_insert
after insert on app_private.announcement_comments
for each row execute function app_private.refresh_announcement_comment_count();

drop trigger if exists refresh_announcement_comment_count_on_delete on app_private.announcement_comments;
create trigger refresh_announcement_comment_count_on_delete
after delete on app_private.announcement_comments
for each row execute function app_private.refresh_announcement_comment_count();
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, app_api, app_private';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
grant usage on schema app_api to service_role;
grant usage on schema app_private to service_role;

grant all privileges on all tables in schema app_private to service_role;
grant usage, select, update on all sequences in schema app_private to service_role;

alter default privileges in schema app_private
grant all privileges on tables to service_role;

alter default privileges in schema app_private
grant usage, select, update on sequences to service_role;
grant usage on schema app_private to authenticated;
grant select on app_private.notifications to authenticated;
grant select on app_private.notification_states to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'app_private'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table app_private.notifications;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'app_private'
      and tablename = 'notification_states'
  ) then
    alter publication supabase_realtime add table app_private.notification_states;
  end if;
end $$;
create table if not exists app_private.idempotency_keys (
  uid text not null,
  action text not null,
  request_id text not null,
  status text not null default 'processing' check (status in ('processing', 'completed')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  primary key (uid, action, request_id)
);

alter table app_private.idempotency_keys enable row level security;

create index if not exists idempotency_keys_expiry_idx
  on app_private.idempotency_keys (expires_at);

create or replace function app_api.claim_idempotency_key(
  actor_uid text,
  action_name text,
  request_id text
)
returns table(claimed boolean, completed boolean, response jsonb)
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  inserted boolean := false;
  existing_status text;
  existing_response jsonb;
begin
  if actor_uid is null
    or length(btrim(actor_uid)) = 0
    or action_name is null
    or length(btrim(action_name)) = 0
    or request_id is null
    or length(btrim(request_id)) = 0
    or length(request_id) > 120
  then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;

  insert into app_private.idempotency_keys (uid, action, request_id)
  values (actor_uid, action_name, request_id)
  on conflict do nothing
  returning true into inserted;

  if inserted then
    return query select true, false, null::jsonb;
    return;
  end if;

  select status, response
  into existing_status, existing_response
  from app_private.idempotency_keys
  where uid = actor_uid
    and action = action_name
    and idempotency_keys.request_id = claim_idempotency_key.request_id;

  return query select false, existing_status = 'completed', existing_response;
end;
$$;

create or replace function app_api.complete_idempotency_key(
  actor_uid text,
  action_name text,
  request_id text,
  action_response jsonb
)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.idempotency_keys
  set
    status = 'completed',
    response = action_response,
    updated_at = now(),
    expires_at = now() + interval '7 days'
  where uid = actor_uid
    and action = action_name
    and idempotency_keys.request_id = complete_idempotency_key.request_id
    and status = 'processing';
$$;

create or replace function app_api.release_idempotency_key(
  actor_uid text,
  action_name text,
  request_id text
)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  delete from app_private.idempotency_keys
  where uid = actor_uid
    and action = action_name
    and idempotency_keys.request_id = release_idempotency_key.request_id
    and status = 'processing';
$$;

grant execute on function app_api.claim_idempotency_key(text, text, text) to service_role;
grant execute on function app_api.complete_idempotency_key(text, text, text, jsonb) to service_role;
grant execute on function app_api.release_idempotency_key(text, text, text) to service_role;
grant all privileges on app_private.idempotency_keys to service_role;
create table if not exists app_private.push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  token_uid text,
  notification_type text not null,
  target_type text not null,
  target_id text not null,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_private.push_delivery_logs enable row level security;

create index if not exists push_delivery_logs_status_updated_idx
  on app_private.push_delivery_logs (status, updated_at desc);

create index if not exists push_delivery_logs_target_idx
  on app_private.push_delivery_logs (target_type, target_id, created_at desc);
alter table app_private.user_profiles
  add column if not exists avatar_public_id text,
  add column if not exists avatar_source_url text,
  add column if not exists avatar_hash text,
  add column if not exists avatar_version integer not null default 0;

create index if not exists user_profiles_avatar_public_id_idx
  on app_private.user_profiles (avatar_public_id)
  where avatar_public_id is not null;
alter table app_private.maintenance_runs
  add column if not exists details jsonb not null default '{}'::jsonb;

create index if not exists notifications_expires_idx
  on app_private.notifications (expires_at);

create index if not exists outbox_events_expiry_idx
  on app_private.outbox_events (expires_at)
  where status in ('completed', 'failed');

create index if not exists uploads_cleanup_idx
  on app_private.uploads (status, updated_at, created_at)
  where status in ('pending', 'ready', 'failed');

create index if not exists deletion_jobs_completed_updated_idx
  on app_private.deletion_jobs (status, updated_at)
  where status in ('completed', 'failed');

create index if not exists push_tokens_updated_idx
  on app_private.push_tokens (updated_at);

create or replace function app_private.run_maintenance_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  cleanup_details jsonb := '{}'::jsonb;
  deleted_count integer := 0;
  failed_deletion_jobs_too_old integer := 0;
  queued_count integer := 0;
  run_id uuid;
  run_status text := 'success';
begin
  insert into app_private.maintenance_runs (task_name, status, started_at)
  values ('maintenance.cleanup', 'running', now())
  returning id into run_id;

  with stale_uploads as (
    select id, cloudinary_public_id
    from app_private.uploads
    where cloudinary_public_id is not null
      and (
        (status = 'pending' and created_at < now() - interval '24 hours')
        or (status = 'ready' and attached_target_id is null and updated_at < now() - interval '7 days')
        or (status = 'failed' and updated_at < now() - interval '7 days')
      )
  ),
  queued_upload_deletions as (
    insert into app_private.deletion_jobs (target_type, target_id, cloudinary_public_id)
    select 'upload', id::text, cloudinary_public_id
    from stale_uploads
    returning 1
  ),
  deleted_uploads as (
    delete from app_private.uploads
    where id in (select id from stale_uploads)
    returning 1
  )
  select
    (select count(*) from queued_upload_deletions),
    (select count(*) from deleted_uploads)
  into queued_count, deleted_count;
  cleanup_details := cleanup_details || jsonb_build_object(
    'uploads_queued_for_deletion', queued_count,
    'uploads_deleted', deleted_count
  );

  delete from app_private.notifications
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('notifications_deleted', deleted_count);

  delete from app_private.outbox_events
  where status in ('completed', 'failed')
    and expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('outbox_events_deleted', deleted_count);

  delete from app_private.push_delivery_logs
  where updated_at < now() - interval '7 days';
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('push_delivery_logs_deleted', deleted_count);

  delete from app_private.idempotency_keys
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('idempotency_keys_deleted', deleted_count);

  delete from app_private.push_tokens
  where permission <> 'granted'
    or updated_at < now() - interval '90 days';
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('push_tokens_deleted', deleted_count);

  delete from app_private.deletion_jobs
  where status = 'completed'
    and updated_at < now() - interval '7 days';
  get diagnostics deleted_count = row_count;
  cleanup_details := cleanup_details || jsonb_build_object('completed_deletion_jobs_deleted', deleted_count);

  select count(*)::integer
  into failed_deletion_jobs_too_old
  from app_private.deletion_jobs
  where status = 'failed'
    and updated_at < now() - interval '30 days';
  cleanup_details := cleanup_details || jsonb_build_object('failed_deletion_jobs_too_old', failed_deletion_jobs_too_old);

  if failed_deletion_jobs_too_old > 0 then
    run_status := 'attention';
  end if;

  delete from app_private.maintenance_runs
  where task_name = 'maintenance.cleanup'
    and id <> run_id
    and started_at < now() - interval '90 days';

  update app_private.maintenance_runs
  set
    status = run_status,
    completed_at = now(),
    details = cleanup_details
  where id = run_id;

  return jsonb_build_object(
    'ok', true,
    'run_id', run_id,
    'status', run_status,
    'details', cleanup_details
  );
exception
  when others then
    if run_id is not null then
      update app_private.maintenance_runs
      set
        status = 'failed',
        completed_at = now(),
        error = left(sqlerrm, 1000),
        details = cleanup_details
      where id = run_id;
    end if;
    raise;
end;
$$;

create or replace function app_api.run_maintenance_cleanup()
returns jsonb
language sql
security definer
set search_path = app_private, app_api, public
as $$
  select app_private.run_maintenance_cleanup();
$$;

grant execute on function app_api.run_maintenance_cleanup() to service_role;

do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'pg_cron extension is not available: %', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'srp_maintenance_cleanup';

    perform cron.schedule(
      'srp_maintenance_cleanup',
      '17 19 * * *',
      'select app_private.run_maintenance_cleanup();'
    );
  end if;
end $$;
revoke all on app_api.issues from anon, authenticated;
revoke execute on function app_api.delete_issue(uuid) from authenticated;
grant execute on function app_api.delete_issue(uuid) to service_role;

create or replace function app_api.backend_delete_issue(
  issue_id uuid,
  actor_uid text,
  actor_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  issue_record app_private.issues%rowtype;
begin
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then return; end if;
  if issue_record.author_uid <> actor_uid and not actor_is_admin then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values (
    'issue.deleted',
    'issue',
    issue_record.id::text,
    actor_uid,
    jsonb_build_object(
      'author_uid', issue_record.author_uid,
      'issue_category', issue_record.category,
      'issue_id', issue_record.id,
      'title', issue_record.title
    )
  );
  delete from app_private.issues where id = issue_record.id;
end;
$$;
revoke all on function app_api.backend_delete_issue(uuid,text,boolean) from public, anon, authenticated;
grant execute on function app_api.backend_delete_issue(uuid,text,boolean) to service_role;

alter table app_private.uploads
  add column if not exists delivery_url text,
  add column if not exists delivery_url_expires_at timestamptz;

alter table app_private.notion_pages
  add column if not exists managed_block_ids jsonb not null default '[]'::jsonb;

create table if not exists app_private.runtime_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_private.runtime_settings enable row level security;

create or replace function app_private.signal_outbox_worker()
returns trigger
language plpgsql
security definer
set search_path = app_private, extensions, public
as $$
declare
  worker_url text;
  webhook_secret text;
begin
  select value into worker_url from app_private.runtime_settings where key = 'outbox_worker_url';
  select value into webhook_secret from app_private.runtime_settings where key = 'webhook_secret';
  if worker_url is null or webhook_secret is null then
    return null;
  end if;
  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || webhook_secret),
    body := jsonb_build_object('signal', 'outbox_insert')
  );
  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'issues_text_length_check'
      and conrelid = 'app_private.issues'::regclass
  ) then
    alter table app_private.issues add constraint issues_text_length_check
      check (char_length(title) between 1 and 120 and char_length(content) between 1 and 5000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'comments_length_check'
      and conrelid = 'app_private.comments'::regclass
  ) then
    alter table app_private.comments add constraint comments_length_check
      check (char_length(content) between 1 and 2000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'announcements_text_length_check'
      and conrelid = 'app_private.announcements'::regclass
  ) then
    alter table app_private.announcements add constraint announcements_text_length_check
      check (char_length(title) between 1 and 120 and char_length(content) between 1 and 5000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'announcement_comments_length_check'
      and conrelid = 'app_private.announcement_comments'::regclass
  ) then
    alter table app_private.announcement_comments add constraint announcement_comments_length_check
      check (char_length(content) between 1 and 2000);
  end if;
end $$;

create or replace function app_private.signal_maintenance_worker()
returns void
language plpgsql
security definer
set search_path = app_private, extensions, public
as $$
declare
  worker_url text;
  webhook_secret text;
begin
  select value into worker_url from app_private.runtime_settings where key = 'maintenance_worker_url';
  select value into webhook_secret from app_private.runtime_settings where key = 'webhook_secret';
  if worker_url is null or webhook_secret is null then
    return;
  end if;
  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || webhook_secret),
    body := jsonb_build_object('signal', 'daily_maintenance')
  );
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job
    where jobname in ('srp_maintenance_cleanup', 'srp_maintenance_worker');
    perform cron.schedule(
      'srp_maintenance_worker',
      '17 19 * * *',
      'select app_private.signal_maintenance_worker();'
    );
  end if;
end $$;
