-- Keep child-row delete triggers safe when PostgreSQL cascades a parent deletion.

create or replace function app_private.mark_notion_support_dirty()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  changed_issue_id uuid := coalesce(new.issue_id, old.issue_id);
begin
  if tg_op = 'DELETE'
    and not exists (
      select 1 from app_private.issues where id = changed_issue_id
    )
  then
    return null;
  end if;

  insert into app_private.notion_support_dirty (issue_id, updated_at, locked_until)
  values (changed_issue_id, now(), null)
  on conflict (issue_id) do update
    set updated_at = excluded.updated_at,
        locked_until = null;
  return null;
end;
$$;

create or replace function app_private.track_issue_category_counter()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  related_comments bigint := 0;
begin
  if tg_op = 'INSERT' then
    perform app_private.adjust_category_counter(new.category, 1, 0);
  elsif tg_op = 'DELETE' then
    select count(*) into related_comments
    from app_private.comments
    where issue_id = old.id;
    perform app_private.adjust_category_counter(old.category, -1, -related_comments);
  elsif new.category is distinct from old.category then
    select count(*) into related_comments
    from app_private.comments
    where issue_id = new.id;
    perform app_private.adjust_category_counter(old.category, -1, -related_comments);
    perform app_private.adjust_category_counter(new.category, 1, related_comments);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function app_private.track_comment_category_counter()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  old_category text;
  new_category text;
begin
  if tg_op <> 'INSERT' then
    select category into old_category
    from app_private.issues
    where id = old.issue_id;
  end if;
  if tg_op <> 'DELETE' then
    select category into new_category
    from app_private.issues
    where id = new.issue_id;
  end if;

  if tg_op = 'INSERT' then
    perform app_private.adjust_category_counter(new_category, 0, 1);
  elsif tg_op = 'DELETE' and old_category is not null then
    perform app_private.adjust_category_counter(old_category, 0, -1);
  elsif tg_op = 'UPDATE' and new.issue_id is distinct from old.issue_id then
    if old_category is not null then
      perform app_private.adjust_category_counter(old_category, 0, -1);
    end if;
    if new_category is not null then
      perform app_private.adjust_category_counter(new_category, 0, 1);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists track_issue_category_counter on app_private.issues;
create trigger track_issue_category_counter
before insert or delete or update of category on app_private.issues
for each row execute function app_private.track_issue_category_counter();

revoke all on function app_private.mark_notion_support_dirty()
from public, anon, authenticated;
revoke all on function app_private.track_issue_category_counter()
from public, anon, authenticated;
revoke all on function app_private.track_comment_category_counter()
from public, anon, authenticated;
