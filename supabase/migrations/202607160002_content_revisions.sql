create table if not exists app_private.content_revisions (
  domain text primary key check (domain in ('issues', 'announcements', 'facilities')),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table app_private.content_revisions enable row level security;
revoke all on app_private.content_revisions from public, anon, authenticated;

insert into app_private.content_revisions(domain, revision)
values ('issues', 1), ('announcements', 1), ('facilities', 1)
on conflict (domain) do nothing;

create or replace function app_private.bump_content_revision()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  insert into app_private.content_revisions(domain, revision, updated_at)
  values (tg_argv[0], 1, now())
  on conflict (domain) do update
  set revision = content_revisions.revision + 1,
      updated_at = excluded.updated_at;
  return null;
end;
$$;

revoke all on function app_private.bump_content_revision()
  from public, anon, authenticated;

create trigger bump_issue_content_revision
after insert or update or delete on app_private.issues
for each statement execute function app_private.bump_content_revision('issues');

create trigger bump_issue_comment_content_revision
after insert or update or delete on app_private.comments
for each statement execute function app_private.bump_content_revision('issues');

create trigger bump_announcement_content_revision
after insert or update or delete on app_private.announcements
for each statement execute function app_private.bump_content_revision('announcements');

create trigger bump_announcement_comment_content_revision
after insert or update or delete on app_private.announcement_comments
for each statement execute function app_private.bump_content_revision('announcements');

create trigger bump_facility_content_revision
after insert or update or delete on app_private.facility_reports
for each statement execute function app_private.bump_content_revision('facilities');
