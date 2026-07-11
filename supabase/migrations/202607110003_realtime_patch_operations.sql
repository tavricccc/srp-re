alter table app_private.realtime_events
  add column if not exists op text check (op in ('insert', 'update', 'delete'));

create or replace function app_private.emit_content_realtime_event(
  event_type text,
  target_type text,
  target_id text,
  parent_id text default null,
  category text default null,
  audience text default 'owner-admin',
  recipient_uid text default null,
  support_count integer default null,
  like_count integer default null,
  comment_count integer default null,
  op text default null
)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  insert into app_private.realtime_events (
    event_type, target_type, target_id, parent_id, category, audience,
    recipient_uid, support_count, like_count, comment_count, op
  ) values (
    emit_content_realtime_event.event_type, emit_content_realtime_event.target_type,
    emit_content_realtime_event.target_id, emit_content_realtime_event.parent_id,
    emit_content_realtime_event.category, emit_content_realtime_event.audience,
    emit_content_realtime_event.recipient_uid, emit_content_realtime_event.support_count,
    emit_content_realtime_event.like_count, emit_content_realtime_event.comment_count,
    emit_content_realtime_event.op
  );
$$;

create or replace function app_private.queue_issue_realtime_event()
returns trigger language plpgsql security definer set search_path = app_private, public as $$
declare
  issue_record app_private.issues%rowtype;
  next_event_type text := 'issue_changed';
begin
  if tg_op = 'DELETE' then issue_record := old; else issue_record := new; end if;
  if tg_op = 'UPDATE'
    and new.support_count is distinct from old.support_count
    and (to_jsonb(new) - 'support_count') = (to_jsonb(old) - 'support_count')
  then next_event_type := 'issue_support_changed'; end if;
  perform app_private.emit_content_realtime_event(
    next_event_type, 'issue', issue_record.id::text, issue_record.id::text,
    issue_record.category, app_private.issue_realtime_audience(issue_record.category, issue_record.status),
    issue_record.author_uid, issue_record.support_count, null, null,
    lower(tg_op)
  );
  return null;
end;
$$;

create or replace function app_private.queue_announcement_realtime_event()
returns trigger language plpgsql security definer set search_path = app_private, public as $$
declare
  announcement_record app_private.announcements%rowtype;
  next_event_type text := 'announcement_changed';
begin
  if tg_op = 'DELETE' then announcement_record := old; else announcement_record := new; end if;
  if tg_op = 'UPDATE'
    and (new.like_count is distinct from old.like_count or new.comment_count is distinct from old.comment_count)
    and (to_jsonb(new) - 'like_count' - 'comment_count') = (to_jsonb(old) - 'like_count' - 'comment_count')
  then next_event_type := 'announcement_metrics_changed'; end if;
  perform app_private.emit_content_realtime_event(
    next_event_type, 'announcement', announcement_record.id::text, announcement_record.id::text,
    null, 'school', null, null, announcement_record.like_count, announcement_record.comment_count,
    lower(tg_op)
  );
  return null;
end;
$$;

revoke all on function app_private.emit_content_realtime_event(text,text,text,text,text,text,text,integer,integer,integer,text) from public, anon, authenticated;
