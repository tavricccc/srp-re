create table if not exists app_private.notion_support_dirty (
  issue_id uuid primary key references app_private.issues(id) on delete cascade,
  updated_at timestamptz not null default now(),
  locked_until timestamptz
);

alter table app_private.notion_support_dirty enable row level security;

create or replace function app_private.mark_notion_support_dirty()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  insert into app_private.notion_support_dirty (issue_id, updated_at, locked_until)
  values (coalesce(new.issue_id, old.issue_id), now(), null)
  on conflict (issue_id) do update
    set updated_at = excluded.updated_at,
        locked_until = null;
  return null;
end;
$$;

drop trigger if exists mark_notion_support_dirty on app_private.supports;
create trigger mark_notion_support_dirty
after insert or delete on app_private.supports
for each row execute function app_private.mark_notion_support_dirty();

create or replace function app_api.claim_notion_support_dirty(batch_size integer default 100)
returns table(issue_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  return query
  with claimed as (
    select dirty.issue_id, dirty.updated_at
    from app_private.notion_support_dirty dirty
    where dirty.locked_until is null or dirty.locked_until < now()
    order by dirty.updated_at
    for update skip locked
    limit least(greatest(batch_size, 1), 200)
  )
  update app_private.notion_support_dirty dirty
  set locked_until = now() + interval '10 minutes'
  from claimed
  where dirty.issue_id = claimed.issue_id
  returning dirty.issue_id, dirty.updated_at;
end;
$$;

create or replace function app_api.complete_notion_support_dirty(issue_id uuid, claimed_updated_at timestamptz)
returns void language sql security definer set search_path = app_private, public as $$
  delete from app_private.notion_support_dirty
  where notion_support_dirty.issue_id = complete_notion_support_dirty.issue_id
    and notion_support_dirty.updated_at = complete_notion_support_dirty.claimed_updated_at;
$$;

create or replace function app_api.release_notion_support_dirty(issue_id uuid)
returns void language sql security definer set search_path = app_private, public as $$
  update app_private.notion_support_dirty set locked_until = null
  where notion_support_dirty.issue_id = release_notion_support_dirty.issue_id;
$$;

revoke all on app_private.notion_support_dirty from public, anon, authenticated;
revoke all on function app_private.mark_notion_support_dirty() from public, anon, authenticated;
revoke all on function app_api.claim_notion_support_dirty(integer) from public, anon, authenticated;
revoke all on function app_api.complete_notion_support_dirty(uuid, timestamptz) from public, anon, authenticated;
revoke all on function app_api.release_notion_support_dirty(uuid) from public, anon, authenticated;
grant execute on function app_api.claim_notion_support_dirty(integer) to service_role;
grant execute on function app_api.complete_notion_support_dirty(uuid, timestamptz) to service_role;
grant execute on function app_api.release_notion_support_dirty(uuid) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'srp_notion_support_sync';
    perform cron.schedule('srp_notion_support_sync', '7 */2 * * *',
      'select app_private.signal_maintenance_worker();');
  end if;
end;
$$;
