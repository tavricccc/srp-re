create table if not exists app_private.platform_category_counters (
  category text primary key,
  issues bigint not null default 0 check (issues >= 0),
  comments bigint not null default 0 check (comments >= 0)
);
alter table app_private.platform_category_counters enable row level security;
revoke all on app_private.platform_category_counters from public, anon, authenticated;
grant all on app_private.platform_category_counters to service_role;

insert into app_private.platform_category_counters(category, issues, comments)
select category, count(*)::bigint, 0 from app_private.issues group by category
on conflict(category) do update set issues = excluded.issues;
insert into app_private.platform_category_counters(category, issues, comments)
select issue.category, 0, count(*)::bigint
from app_private.comments comment_row join app_private.issues issue on issue.id = comment_row.issue_id
group by issue.category
on conflict(category) do update set comments = excluded.comments;

create or replace function app_private.adjust_category_counter(category_name text, issue_delta bigint, comment_delta bigint)
returns void language sql security definer set search_path = app_private, public as $$
  insert into app_private.platform_category_counters(category, issues, comments)
  values (category_name, greatest(issue_delta, 0), greatest(comment_delta, 0))
  on conflict(category) do update set
    issues = greatest(app_private.platform_category_counters.issues + issue_delta, 0),
    comments = greatest(app_private.platform_category_counters.comments + comment_delta, 0);
$$;

create or replace function app_private.track_issue_category_counter()
returns trigger language plpgsql security definer set search_path = app_private, public as $$
declare related_comments bigint := 0;
begin
  if tg_op = 'INSERT' then perform app_private.adjust_category_counter(new.category, 1, 0);
  elsif tg_op = 'DELETE' then perform app_private.adjust_category_counter(old.category, -1, 0);
  elsif new.category is distinct from old.category then
    select count(*) into related_comments from app_private.comments where issue_id = new.id;
    perform app_private.adjust_category_counter(old.category, -1, -related_comments);
    perform app_private.adjust_category_counter(new.category, 1, related_comments);
  end if;
  return null;
end;
$$;

create or replace function app_private.track_comment_category_counter()
returns trigger language plpgsql security definer set search_path = app_private, public as $$
declare old_category text; new_category text;
begin
  if tg_op <> 'INSERT' then select category into old_category from app_private.issues where id = old.issue_id; end if;
  if tg_op <> 'DELETE' then select category into new_category from app_private.issues where id = new.issue_id; end if;
  if tg_op = 'INSERT' then perform app_private.adjust_category_counter(new_category, 0, 1);
  elsif tg_op = 'DELETE' then perform app_private.adjust_category_counter(old_category, 0, -1);
  elsif new.issue_id is distinct from old.issue_id then
    perform app_private.adjust_category_counter(old_category, 0, -1);
    perform app_private.adjust_category_counter(new_category, 0, 1);
  end if;
  return null;
end;
$$;

drop trigger if exists track_issue_category_counter on app_private.issues;
create trigger track_issue_category_counter after insert or delete or update of category on app_private.issues
for each row execute function app_private.track_issue_category_counter();
drop trigger if exists track_comment_category_counter on app_private.comments;
create trigger track_comment_category_counter after insert or delete or update of issue_id on app_private.comments
for each row execute function app_private.track_comment_category_counter();

insert into app_private.platform_counters(key, value)
values ('users_seen', (select count(*) from app_private.user_profiles))
on conflict(key) do update set value = excluded.value;

create or replace function app_private.track_user_seen_counter()
returns trigger language plpgsql security definer set search_path = app_private, public as $$
begin
  insert into app_private.platform_counters(key, value) values ('users_seen', 1)
  on conflict(key) do update set value = app_private.platform_counters.value + 1, updated_at = now();
  return null;
end;
$$;
drop trigger if exists track_user_seen_counter on app_private.user_profiles;
create trigger track_user_seen_counter after insert on app_private.user_profiles
for each row execute function app_private.track_user_seen_counter();

insert into app_private.runtime_settings(key, value, updated_at)
values ('last_activity_at', greatest(
  coalesce((select max(created_at) from app_private.issues), 'epoch'::timestamptz),
  coalesce((select max(created_at) from app_private.comments), 'epoch'::timestamptz),
  coalesce((select max(published_at) from app_private.announcements), 'epoch'::timestamptz),
  coalesce((select max(created_at) from app_private.announcement_comments), 'epoch'::timestamptz)
)::text, now())
on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at;

create or replace function app_private.touch_platform_activity()
returns trigger language plpgsql security definer set search_path = app_private, public as $$
begin
  insert into app_private.runtime_settings(key, value, updated_at)
  values ('last_activity_at', now()::text, now())
  on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at;
  return null;
end;
$$;
drop trigger if exists touch_platform_activity_issues on app_private.issues;
create trigger touch_platform_activity_issues after insert or update on app_private.issues for each statement execute function app_private.touch_platform_activity();
drop trigger if exists touch_platform_activity_comments on app_private.comments;
create trigger touch_platform_activity_comments after insert on app_private.comments for each statement execute function app_private.touch_platform_activity();
drop trigger if exists touch_platform_activity_announcements on app_private.announcements;
create trigger touch_platform_activity_announcements after insert or update on app_private.announcements for each statement execute function app_private.touch_platform_activity();
drop trigger if exists touch_platform_activity_announcement_comments on app_private.announcement_comments;
create trigger touch_platform_activity_announcement_comments after insert on app_private.announcement_comments for each statement execute function app_private.touch_platform_activity();

revoke all on function app_private.adjust_category_counter(text,bigint,bigint) from public, anon, authenticated;
revoke all on function app_private.track_issue_category_counter() from public, anon, authenticated;
revoke all on function app_private.track_comment_category_counter() from public, anon, authenticated;
revoke all on function app_private.track_user_seen_counter() from public, anon, authenticated;
revoke all on function app_private.touch_platform_activity() from public, anon, authenticated;

create or replace function app_api.get_platform_dashboard_snapshot()
returns jsonb language sql security definer set search_path = app_private, public as $$
with
counters as (
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) value from app_private.platform_counters
),
category_counters as (
  select
    coalesce(jsonb_object_agg(category, issues), '{}'::jsonb) issues,
    coalesce(jsonb_object_agg(category, comments), '{}'::jsonb) comments
  from app_private.platform_category_counters
),
activity as (
  select coalesce((select value::timestamptz from app_private.runtime_settings where key='last_activity_at'), 'epoch'::timestamptz) value
),
outbox_counts as (
  select
    count(*) filter (where status='failed')::bigint failed,
    count(*) filter (where status in ('pending','processing'))::bigint pending,
    count(*) filter (where status='failed' and notion_completed_at is null)::bigint notion_failed,
    count(*) filter (where status in ('pending','processing') and notion_completed_at is null)::bigint notion_pending,
    min(created_at) filter (where status in ('pending','processing') and notion_completed_at is null) oldest_notion
  from app_private.outbox_events
),
operation_counts as (
  select
    (select count(*) from app_private.push_delivery_logs where status='failed')::bigint push_failed,
    (select count(*) from app_private.uploads where status='pending')::bigint upload_pending,
    (select count(*) from app_private.deletion_jobs where status in ('pending','failed','processing'))::bigint deletion_pending,
    (select count(*) from app_private.deletion_jobs where status='failed')::bigint deletion_failed
),
maintenance as (
  select coalesce((select to_jsonb(row) from (
    select status, started_at, completed_at, error, details
    from app_private.maintenance_runs where task_name='maintenance.cleanup'
    order by started_at desc limit 1
  ) row), '{}'::jsonb) value
),
recent_failures as (
  select coalesce(jsonb_agg(item order by updated_at desc), '[]'::jsonb) value from (
    select id::text, 'outbox'::text source, status, coalesce(last_error,'') message,
      event_type detail_type, target_type, target_id, attempt_count, next_attempt_at, created_at, updated_at
    from app_private.outbox_events where status='failed'
    union all
    select id::text, 'push'::text, status, coalesce(error_message,''), notification_type,
      target_type, target_id, null::integer, null::timestamptz, created_at, updated_at
    from app_private.push_delivery_logs where status='failed'
    union all
    select id::text, 'cleanup'::text, status, coalesce(last_error,''), target_type,
      target_type, target_id, attempt_count, next_attempt_at, created_at, updated_at
    from app_private.deletion_jobs where status='failed'
    order by updated_at desc limit 12
  ) item
)
select jsonb_build_object(
  'counters', counters.value,
  'issues_by_category', category_counters.issues,
  'comments_by_category', category_counters.comments,
  'last_activity_at', activity.value,
  'outbox_failed', outbox_counts.failed,
  'outbox_pending', outbox_counts.pending,
  'notion_failed', outbox_counts.notion_failed,
  'notion_pending', outbox_counts.notion_pending,
  'oldest_pending_notion_at', outbox_counts.oldest_notion,
  'push_failed', operation_counts.push_failed,
  'upload_pending', operation_counts.upload_pending,
  'deletion_pending', operation_counts.deletion_pending,
  'deletion_failed', operation_counts.deletion_failed,
  'maintenance', maintenance.value,
  'recent_failures', recent_failures.value,
  'users_seen', coalesce((counters.value->>'users_seen')::bigint, 0)
)
from counters, category_counters, activity, outbox_counts, operation_counts, maintenance, recent_failures;
$$;

revoke all on function app_api.get_platform_dashboard_snapshot() from public, anon, authenticated;
grant execute on function app_api.get_platform_dashboard_snapshot() to service_role;
