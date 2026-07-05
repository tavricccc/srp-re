-- Queue content events in the same transaction as their source row mutation.

alter table app_private.issues add column if not exists last_actor_uid text;

create or replace function app_private.queue_issue_change()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values (
      'issue.created', 'issue', new.id::text, new.author_uid,
      jsonb_build_object(
        'author_name', new.author_name, 'author_uid', new.author_uid, 'category', new.category,
        'content', new.content, 'issue_id', new.id, 'status', new.status,
        'support_count', new.support_count, 'support_goal', new.support_goal, 'title', new.title
      )
    );
  elsif old.status is distinct from new.status then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values (
      'issue.status_changed', 'issue', new.id::text, coalesce(new.last_actor_uid, 'system'),
      jsonb_build_object(
        'author_uid', new.author_uid, 'new_status', new.status, 'old_status', old.status,
        'reason', new.review_rejection_reason, 'support_count', new.support_count,
        'support_goal', new.support_goal, 'title', new.title, 'issue_category', new.category
      )
    );
  end if;
  return new;
end;
$$;
drop trigger if exists queue_issue_change_outbox on app_private.issues;
create trigger queue_issue_change_outbox
after insert or update of status on app_private.issues
for each row execute function app_private.queue_issue_change();

create or replace function app_private.queue_comment_created()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare issue_record app_private.issues%rowtype;
begin
  select * into issue_record from app_private.issues where id = new.issue_id;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values (
    'issue.comment_created', 'issue', new.issue_id::text, new.author_uid,
    jsonb_build_object(
      'author_name', new.author_name, 'author_photo_url', new.author_photo_url,
      'author_uid', new.author_uid, 'content', new.content,
      'issue_author_uid', issue_record.author_uid, 'issue_category', issue_record.category,
      'issue_id', new.issue_id, 'title', issue_record.title
    )
  );
  return new;
end;
$$;
drop trigger if exists queue_comment_created_outbox on app_private.comments;
create trigger queue_comment_created_outbox after insert on app_private.comments
for each row execute function app_private.queue_comment_created();

create or replace function app_private.queue_announcement_change()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare row_record app_private.announcements%rowtype;
begin
  if tg_op = 'DELETE' then row_record := old; else row_record := new; end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values (
    case when tg_op='INSERT' then 'announcement.created'
         when tg_op='UPDATE' then 'announcement.updated'
         else 'announcement.deleted' end,
    'announcement', row_record.id::text, row_record.author_uid,
    jsonb_build_object(
      'announcement_id', row_record.id, 'author_name', row_record.author_name,
      'content', row_record.content, 'title', row_record.title
    )
  );
  return row_record;
end;
$$;
drop trigger if exists queue_announcement_created_outbox on app_private.announcements;
create trigger queue_announcement_created_outbox
after insert on app_private.announcements
for each row execute function app_private.queue_announcement_change();
drop trigger if exists queue_announcement_updated_outbox on app_private.announcements;
create trigger queue_announcement_updated_outbox
after update of title, content on app_private.announcements
for each row execute function app_private.queue_announcement_change();
drop trigger if exists queue_announcement_deleted_outbox on app_private.announcements;
create trigger queue_announcement_deleted_outbox
after delete on app_private.announcements
for each row execute function app_private.queue_announcement_change();

create or replace function app_private.queue_announcement_comment_created()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare announcement_record app_private.announcements%rowtype;
begin
  select * into announcement_record from app_private.announcements where id = new.announcement_id;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values (
    'announcement.comment_created', 'announcement', new.announcement_id::text, new.author_uid,
    jsonb_build_object(
      'announcement_id', new.announcement_id, 'author_name', new.author_name,
      'author_photo_url', new.author_photo_url, 'author_uid', new.author_uid,
      'content', new.content, 'title', announcement_record.title
    )
  );
  return new;
end;
$$;
drop trigger if exists queue_announcement_comment_created_outbox on app_private.announcement_comments;
create trigger queue_announcement_comment_created_outbox after insert on app_private.announcement_comments
for each row execute function app_private.queue_announcement_comment_created();
