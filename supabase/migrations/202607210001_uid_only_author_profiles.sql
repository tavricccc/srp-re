-- Author identity is resolved from user_profiles by UID. Content and
-- notifications no longer duplicate mutable names or avatar URLs.

alter table app_private.user_profiles
  add column if not exists profile_version bigint not null default 1,
  add column if not exists avatar_checked_at timestamptz;

create or replace function app_private.version_user_public_profile()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  if new.display_name is distinct from old.display_name
    or new.photo_url is distinct from old.photo_url
    or new.cached_photo_url is distinct from old.cached_photo_url
    or new.avatar_version is distinct from old.avatar_version then
    new.profile_version := old.profile_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists version_user_public_profile on app_private.user_profiles;
create trigger version_user_public_profile
before update on app_private.user_profiles
for each row execute function app_private.version_user_public_profile();

create function app_api.backend_commit_user_avatar(
  actor_uid text,
  next_avatar_hash text,
  next_avatar_public_id text,
  next_avatar_source_url text,
  next_cached_photo_url text,
  next_avatar_version integer,
  next_display_name text
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare
  previous_public_id text;
  committed_version integer;
begin
  select avatar_public_id into previous_public_id
  from app_private.user_profiles where uid=actor_uid for update;

  committed_version := greatest(coalesce((
    select avatar_version+1 from app_private.user_profiles where uid=actor_uid
  ),1),next_avatar_version);

  insert into app_private.user_profiles(
    uid,avatar_hash,avatar_public_id,avatar_source_url,avatar_checked_at,
    avatar_version,display_name,photo_url,cached_photo_url,updated_at
  ) values(
    actor_uid,next_avatar_hash,next_avatar_public_id,next_avatar_source_url,now(),
    committed_version,next_display_name,next_avatar_source_url,next_cached_photo_url,now()
  ) on conflict(uid) do update set
    avatar_hash=excluded.avatar_hash,
    avatar_public_id=excluded.avatar_public_id,
    avatar_source_url=excluded.avatar_source_url,
    avatar_checked_at=excluded.avatar_checked_at,
    avatar_version=excluded.avatar_version,
    display_name=excluded.display_name,
    photo_url=excluded.photo_url,
    cached_photo_url=excluded.cached_photo_url,
    updated_at=excluded.updated_at;

  if previous_public_id is not null and previous_public_id<>next_avatar_public_id then
    insert into app_private.deletion_jobs(cloudinary_public_id,target_id,target_type)
    values(previous_public_id,actor_uid,'avatar');
  end if;

  return jsonb_build_object(
    'photoUrl',next_cached_photo_url,
    'avatarVersion',committed_version
  );
end;
$$;

revoke all on function app_api.backend_commit_user_avatar(text,text,text,text,text,integer,text)
from public,anon,authenticated;
grant execute on function app_api.backend_commit_user_avatar(text,text,text,text,text,integer,text)
to service_role;

create or replace function app_api.backend_comment_to_json(
  comment_record app_private.comments,
  replies jsonb default '[]'::jsonb
)
returns jsonb language sql stable security definer
set search_path = app_private, app_api, public as $$
  select jsonb_build_object(
    'id', comment_record.id,
    'issue_id', comment_record.issue_id,
    'parent_comment_id', comment_record.parent_comment_id,
    'author_uid', comment_record.author_uid,
    'content', comment_record.content,
    'created_at', comment_record.created_at,
    'created_at_ms', floor(extract(epoch from comment_record.created_at) * 1000),
    'replies', replies
  );
$$;

create or replace function app_api.backend_announcement_comment_to_json(
  comment_record app_private.announcement_comments,
  replies jsonb default '[]'::jsonb
)
returns jsonb language sql stable security definer
set search_path = app_private, app_api, public as $$
  select jsonb_build_object(
    'id', comment_record.id,
    'announcement_id', comment_record.announcement_id,
    'parent_comment_id', comment_record.parent_comment_id,
    'author_uid', comment_record.author_uid,
    'content', comment_record.content,
    'created_at', comment_record.created_at,
    'created_at_ms', floor(extract(epoch from comment_record.created_at) * 1000),
    'replies', replies
  );
$$;

create or replace function app_api.backend_announcement_to_json(
  announcement_record app_private.announcements,
  actor_uid text
)
returns jsonb language plpgsql stable security definer
set search_path = app_private, app_api, public as $$
declare current_user_liked boolean;
begin
  select exists(
    select 1 from app_private.announcement_likes
    where announcement_id = announcement_record.id and uid = actor_uid
  ) into current_user_liked;
  return jsonb_build_object(
    'id', announcement_record.id,
    'author_uid', announcement_record.author_uid,
    'title', announcement_record.title,
    'content', announcement_record.content,
    'like_count', announcement_record.like_count,
    'comment_count', announcement_record.comment_count,
    'published_at', announcement_record.published_at,
    'published_at_ms', floor(extract(epoch from announcement_record.published_at) * 1000),
    'currentUserLiked', current_user_liked
  );
end;
$$;

create or replace function app_api.backend_issue_to_json(
  issue_record app_private.issues,
  actor_uid text,
  actor_is_admin boolean,
  private_to_owner_categories text[],
  review_required_categories text[],
  author_private_categories text[]
)
returns jsonb language plpgsql stable security definer
set search_path = app_private, app_api, public as $$
declare
  is_own_issue boolean := issue_record.author_uid = actor_uid;
  can_manage_issue boolean := actor_is_admin or is_own_issue;
  can_view_author boolean := actor_is_admin or is_own_issue or issue_record.author_visible;
  current_user_supported boolean;
begin
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'owner-admin' then
    raise exception 'not-found';
  end if;
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'reviewed-school'
    and issue_record.status in ('under-review','review-rejected') then
    raise exception 'not-found';
  end if;
  select exists(select 1 from app_private.supports support
    where support.issue_id=issue_record.id and support.uid=actor_uid) into current_user_supported;
  return jsonb_build_object(
    'id',issue_record.id,'title',issue_record.title,'content',issue_record.content,
    'created_at',issue_record.created_at,'closed_at',issue_record.closed_at,
    'created_at_ms',floor(extract(epoch from issue_record.created_at)*1000),
    'closed_at_ms',case when issue_record.closed_at is null then null else floor(extract(epoch from issue_record.closed_at)*1000) end,
    'support_count',issue_record.support_count,'status',issue_record.status,'category',issue_record.category,
    'comments_enabled',issue_record.comments_enabled,'read_access',issue_record.read_access,
    'support_enabled',issue_record.support_enabled,'support_goal',issue_record.support_goal,
    'support_deadline_at',issue_record.support_deadline_at,
    'support_deadline_at_ms',case when issue_record.support_deadline_at is null then null else floor(extract(epoch from issue_record.support_deadline_at)*1000) end,
    'response_deadline_at',issue_record.response_deadline_at,
    'response_deadline_at_ms',case when issue_record.response_deadline_at is null then null else floor(extract(epoch from issue_record.response_deadline_at)*1000) end,
    'review_approved_at',issue_record.review_approved_at,
    'review_approved_at_ms',case when issue_record.review_approved_at is null then null else floor(extract(epoch from issue_record.review_approved_at)*1000) end,
    'result_content',issue_record.result_content,'support_met_at',issue_record.support_met_at,
    'support_met_at_ms',case when issue_record.support_met_at is null then null else floor(extract(epoch from issue_record.support_met_at)*1000) end,
    'review_rejection_reason',issue_record.review_rejection_reason,
    'currentUserSupported',current_user_supported,'isOwnIssue',is_own_issue,
    'canManageIssue',can_manage_issue,'canViewAuthor',can_view_author,
    'author_uid',case when can_view_author then issue_record.author_uid else null end
  );
end;
$$;

create or replace function app_api.backend_issue_list_to_json(
  issue_record app_private.issues,
  actor_uid text,
  actor_is_admin boolean,
  current_user_supported boolean,
  private_to_owner_categories text[],
  review_required_categories text[],
  author_private_categories text[]
)
returns jsonb language plpgsql stable security definer
set search_path = app_private, app_api, public as $$
declare
  is_own_issue boolean := issue_record.author_uid = actor_uid;
  can_manage_issue boolean := actor_is_admin or is_own_issue;
  can_view_author boolean := actor_is_admin or is_own_issue or issue_record.author_visible;
begin
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'owner-admin' then raise exception 'not-found'; end if;
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'reviewed-school'
    and issue_record.status in ('under-review','review-rejected') then raise exception 'not-found'; end if;
  return jsonb_build_object(
    'id',issue_record.id,'title',issue_record.title,'created_at',issue_record.created_at,'closed_at',issue_record.closed_at,
    'created_at_ms',floor(extract(epoch from issue_record.created_at)*1000),
    'closed_at_ms',case when issue_record.closed_at is null then null else floor(extract(epoch from issue_record.closed_at)*1000) end,
    'support_count',issue_record.support_count,'status',issue_record.status,'category',issue_record.category,
    'comments_enabled',issue_record.comments_enabled,'read_access',issue_record.read_access,
    'support_enabled',issue_record.support_enabled,'support_goal',issue_record.support_goal,
    'support_deadline_at',issue_record.support_deadline_at,
    'support_deadline_at_ms',case when issue_record.support_deadline_at is null then null else floor(extract(epoch from issue_record.support_deadline_at)*1000) end,
    'response_deadline_at',issue_record.response_deadline_at,
    'response_deadline_at_ms',case when issue_record.response_deadline_at is null then null else floor(extract(epoch from issue_record.response_deadline_at)*1000) end,
    'review_approved_at',issue_record.review_approved_at,
    'review_approved_at_ms',case when issue_record.review_approved_at is null then null else floor(extract(epoch from issue_record.review_approved_at)*1000) end,
    'result_content',issue_record.result_content,'support_met_at',issue_record.support_met_at,
    'support_met_at_ms',case when issue_record.support_met_at is null then null else floor(extract(epoch from issue_record.support_met_at)*1000) end,
    'review_rejection_reason',issue_record.review_rejection_reason,
    'currentUserSupported',current_user_supported,'isOwnIssue',is_own_issue,
    'canManageIssue',can_manage_issue,'canViewAuthor',can_view_author,
    'author_uid',case when can_view_author then issue_record.author_uid else null end
  );
end;
$$;

drop function app_api.backend_create_announcement(text,text,text,text,text);
create function app_api.backend_create_announcement(
  actor_uid text, announcement_title text, announcement_content text
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare announcement_record app_private.announcements%rowtype;
begin
  insert into app_private.announcements(author_uid,title,content)
  values(actor_uid,announcement_title,announcement_content)
  returning * into announcement_record;
  return app_api.backend_announcement_to_json(announcement_record,actor_uid);
end;
$$;

drop function app_api.backend_create_announcement_comment(uuid,uuid,text,text,text,text);
create function app_api.backend_create_announcement_comment(
  announcement_id uuid, parent_comment_id uuid, actor_uid text, comment_content text
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare
  comment_record app_private.announcement_comments%rowtype;
  parent_record app_private.announcement_comments%rowtype;
  next_comment_count integer;
begin
  if parent_comment_id is not null then
    select * into parent_record from app_private.announcement_comments
    where id=backend_create_announcement_comment.parent_comment_id;
    if not found or parent_record.announcement_id<>backend_create_announcement_comment.announcement_id
      or parent_record.parent_comment_id is not null then raise exception 'invalid-parent-comment'; end if;
  end if;
  insert into app_private.announcement_comments(announcement_id,parent_comment_id,author_uid,content)
  values(backend_create_announcement_comment.announcement_id,
    backend_create_announcement_comment.parent_comment_id,actor_uid,comment_content)
  returning * into comment_record;
  select comment_count into next_comment_count from app_private.announcements
  where id=backend_create_announcement_comment.announcement_id;
  return jsonb_build_object(
    'comment',app_api.backend_announcement_comment_to_json(comment_record,'[]'::jsonb),
    'comment_count',coalesce(next_comment_count,0)
  );
end;
$$;

drop function app_api.backend_create_issue_comment(uuid,uuid,text,boolean,text,text,text,text[],text[],text[]);
create function app_api.backend_create_issue_comment(
  issue_id uuid, parent_comment_id uuid, actor_uid text, actor_is_admin boolean,
  comment_content text, private_to_owner_categories text[],
  review_required_categories text[], public_comment_categories text[]
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare
  comment_record app_private.comments%rowtype;
  parent_record app_private.comments%rowtype;
begin
  perform app_api.backend_assert_issue_comment_access(
    issue_id,actor_uid,actor_is_admin,private_to_owner_categories,
    review_required_categories,public_comment_categories
  );
  if parent_comment_id is not null then
    select * into parent_record from app_private.comments
    where id=backend_create_issue_comment.parent_comment_id;
    if not found or parent_record.issue_id<>backend_create_issue_comment.issue_id
      or parent_record.parent_comment_id is not null then raise exception 'invalid-parent-comment'; end if;
  end if;
  insert into app_private.comments(issue_id,parent_comment_id,author_uid,content)
  values(backend_create_issue_comment.issue_id,
    backend_create_issue_comment.parent_comment_id,actor_uid,comment_content)
  returning * into comment_record;
  return app_api.backend_comment_to_json(comment_record,'[]'::jsonb);
end;
$$;

drop function app_api.backend_create_issue(text,text,text,text,text,text,text,boolean,integer,timestamptz,timestamptz,boolean,boolean,text[],text[],text[]);
create function app_api.backend_create_issue(
  actor_uid text, issue_title text, issue_content text, issue_category text,
  issue_status text, support_enabled boolean, support_goal integer,
  support_deadline_at timestamptz, response_deadline_at timestamptz,
  author_is_private boolean, actor_is_admin boolean,
  private_to_owner_categories text[], review_required_categories text[],
  author_private_categories text[]
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare issue_record app_private.issues%rowtype;
begin
  insert into app_private.issues(
    author_uid,category,content,response_deadline_at,review_approved_at,status,
    support_count,support_deadline_at,support_enabled,support_goal,title,title_search
  ) values(
    actor_uid,issue_category,issue_content,response_deadline_at,null,issue_status,
    case when support_enabled then 1 else 0 end,support_deadline_at,
    support_enabled,support_goal,issue_title,lower(issue_title)
  ) returning * into issue_record;
  return app_api.backend_issue_to_json(issue_record,actor_uid,actor_is_admin,
    private_to_owner_categories,review_required_categories,author_private_categories);
end;
$$;

drop function app_api.backend_create_facility(text,text,text,text,text,text);
drop function app_api.backend_create_facility(text,text,text,text,text,text,text);
create function app_api.backend_create_facility(
  actor_uid text, facility_title text, facility_location text,
  facility_content text, facility_category text
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare facility app_private.facility_reports%rowtype;
begin
  if not exists(select 1 from app_private.facility_categories where id=facility_category and is_active)
    then raise exception 'invalid-facility-category'; end if;
  insert into app_private.facility_reports(
    author_uid,title,title_search,location,content,last_actor_uid,category_id
  ) values(
    actor_uid,facility_title,lower(facility_title),facility_location,
    facility_content,actor_uid,facility_category
  ) returning * into facility;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('facility.created','facility',facility.id::text,actor_uid,jsonb_build_object(
    'title',facility.title,'category_id',facility.category_id,'author_uid',facility.author_uid
  ));
  return to_jsonb(facility) || jsonb_build_object(
    'isOwnFacility',true,'currentUserAffected',true,'canManageFacility',false
  );
end;
$$;

create or replace function app_api.backend_list_facilities(
  actor_uid text, actor_is_admin boolean, managed_category_ids text[],
  category_filter text, bucket text, status_filter text, search_query text,
  sort_name text, cursor_created_at timestamptz, cursor_number integer,
  cursor_id uuid, page_size integer
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare
  rows_json jsonb;
  fetched integer;
  effective_size integer := least(greatest(page_size,1),50);
begin
  if not exists(select 1 from app_private.facility_categories category
    where category.id=category_filter and category.is_active) then
    raise exception 'invalid-facility-category';
  end if;
  with candidates as (
    select facility.*,
      facility.author_uid=actor_uid or exists(
        select 1 from app_private.facility_report_affected_users affected
        where affected.facility_id=facility.id and affected.uid=actor_uid
      ) as current_user_affected,
      actor_is_admin or facility.category_id=any(coalesce(managed_category_ids,array[]::text[])) as can_manage_facility
    from app_private.facility_reports facility
    where facility.category_id=category_filter
      and (case when bucket='closed' then facility.status in ('completed','unable-to-handle')
        else facility.status in ('pending','processing') end)
      and (coalesce(status_filter,'')='' or facility.status=status_filter)
      and (coalesce(search_query,'')='' or facility.title_search like '%'||lower(search_query)||'%'
        or lower(facility.location) like '%'||lower(search_query)||'%')
      and (cursor_id is null or case when sort_name='most-affected'
        then (facility.affected_count,facility.id)<(cursor_number,cursor_id)
        else (facility.created_at,facility.id)<(cursor_created_at,cursor_id) end)
    order by case when sort_name='most-affected' then facility.affected_count end desc,
      case when sort_name<>'most-affected' then facility.created_at end desc,facility.id desc
    limit effective_size+1
  ), selected as (select * from candidates limit effective_size)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'category_id',category_id,'title',title,'location',location,
    'status',status,'affected_count',affected_count,'author_uid',author_uid,
    'created_at',created_at,'updated_at',updated_at,'isOwnFacility',author_uid=actor_uid,
    'currentUserAffected',current_user_affected,'canManageFacility',can_manage_facility
  ) order by case when sort_name='most-affected' then affected_count end desc,
    case when sort_name<>'most-affected' then created_at end desc,id desc),'[]'::jsonb),
    (select count(*) from candidates)
  into rows_json,fetched from selected;
  return jsonb_build_object('facilities',rows_json,'hasMore',fetched>effective_size);
end;
$$;

create or replace function app_private.queue_issue_change()
returns trigger language plpgsql security definer
set search_path = app_private, public as $$
begin
  if tg_op='INSERT' then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values('issue.created','issue',new.id::text,new.author_uid,jsonb_build_object(
      'author_uid',new.author_uid,'category',new.category,'content',new.content,
      'issue_id',new.id,'status',new.status,'support_count',new.support_count,
      'support_goal',new.support_goal,'title',new.title
    ));
  elsif old.status is distinct from new.status then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values('issue.status_changed','issue',new.id::text,coalesce(new.last_actor_uid,'system'),jsonb_build_object(
      'author_uid',new.author_uid,'new_status',new.status,'old_status',old.status,
      'reason',new.review_rejection_reason,'support_count',new.support_count,
      'support_goal',new.support_goal,'title',new.title,'issue_category',new.category
    ));
  end if;
  return new;
end;
$$;

create or replace function app_private.queue_comment_created()
returns trigger language plpgsql security definer
set search_path = app_private, public as $$
declare issue_record app_private.issues%rowtype; parent_author_uid text;
begin
  select * into issue_record from app_private.issues where id=new.issue_id;
  if new.parent_comment_id is not null then
    select author_uid into parent_author_uid from app_private.comments where id=new.parent_comment_id;
  end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('issue.comment_created','issue',new.issue_id::text,new.author_uid,jsonb_build_object(
    'author_uid',new.author_uid,'comment_id',new.id,'content',new.content,
    'issue_author_uid',issue_record.author_uid,'issue_category',issue_record.category,
    'issue_id',new.issue_id,'parent_author_uid',parent_author_uid,
    'parent_comment_id',new.parent_comment_id,'title',issue_record.title
  ));
  return new;
end;
$$;

create or replace function app_private.queue_announcement_change()
returns trigger language plpgsql security definer
set search_path = app_private, public as $$
declare row_record app_private.announcements%rowtype;
begin
  if tg_op='DELETE' then row_record:=old; else row_record:=new; end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values(case when tg_op='INSERT' then 'announcement.created'
      when tg_op='UPDATE' then 'announcement.updated' else 'announcement.deleted' end,
    'announcement',row_record.id::text,row_record.author_uid,jsonb_build_object(
      'announcement_id',row_record.id,'author_uid',row_record.author_uid,
      'content',row_record.content,'title',row_record.title
    ));
  return row_record;
end;
$$;

create or replace function app_private.queue_announcement_comment_created()
returns trigger language plpgsql security definer
set search_path = app_private, public as $$
declare announcement_record app_private.announcements%rowtype; parent_author_uid text;
begin
  select * into announcement_record from app_private.announcements where id=new.announcement_id;
  if new.parent_comment_id is not null then
    select author_uid into parent_author_uid from app_private.announcement_comments where id=new.parent_comment_id;
  end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('announcement.comment_created','announcement',new.announcement_id::text,new.author_uid,jsonb_build_object(
    'announcement_author_uid',announcement_record.author_uid,
    'announcement_id',new.announcement_id,'author_uid',new.author_uid,
    'comment_id',new.id,'content',new.content,'parent_author_uid',parent_author_uid,
    'parent_comment_id',new.parent_comment_id,'title',announcement_record.title
  ));
  return new;
end;
$$;

create or replace function app_api.backend_list_announcements(
  actor_uid text, page_size integer, cursor_id uuid, cursor_published_at timestamptz
)
returns jsonb language sql stable security definer
set search_path = app_private, app_api, public as $$
  with settings as (
    select least(greatest(coalesce(page_size,30),1),50) as limited_page_size
  ), liked_ids as materialized (
    select announcement_id from app_private.announcement_likes where uid=actor_uid
  ), page_rows as materialized (
    select announcement.id,announcement.author_uid,announcement.title,
      announcement.like_count,announcement.comment_count,announcement.published_at,
      liked_ids.announcement_id is not null as current_user_liked
    from app_private.announcements announcement
    left join liked_ids on liked_ids.announcement_id=announcement.id
    where cursor_id is null or announcement.published_at<cursor_published_at
      or (announcement.published_at=cursor_published_at and announcement.id<cursor_id)
    order by announcement.published_at desc,announcement.id desc
    limit (select limited_page_size+1 from settings)
  ), limited_rows as (
    select * from page_rows order by published_at desc,id desc
    limit (select limited_page_size from settings)
  ), last_item as (
    select id,published_at from limited_rows order by published_at asc,id asc limit 1
  )
  select jsonb_build_object(
    'announcements',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'author_uid',author_uid,'title',title,'like_count',like_count,
      'comment_count',comment_count,
      'published_at_ms',floor(extract(epoch from published_at)*1000),
      'currentUserLiked',current_user_liked
    ) order by published_at desc,id desc) from limited_rows),'[]'::jsonb),
    'hasMore',(select count(*)>(select limited_page_size from settings) from page_rows),
    'cursor',case when (select count(*)>(select limited_page_size from settings) from page_rows)
      then (select jsonb_build_object('id',id,'publishedAtMs',floor(extract(epoch from published_at)*1000)) from last_item)
      else null end
  );
$$;

alter table app_private.issues drop column author_name, drop column author_photo_url;
alter table app_private.comments drop column author_name, drop column author_photo_url;
alter table app_private.announcements drop column author_name, drop column author_photo_url;
alter table app_private.announcement_comments drop column author_name, drop column author_photo_url;
alter table app_private.facility_reports drop column author_name, drop column author_photo_url;
alter table app_private.notifications drop column actor_name, drop column actor_photo_url;
drop table app_private.private_issue_authors;

update app_private.outbox_events
set payload = payload - 'author_name' - 'author_photo_url' - 'actor_name' - 'actor_photo_url'
where payload ?| array['author_name','author_photo_url','actor_name','actor_photo_url'];

update app_private.notifications
set title = '收到新留言'
where type in ('issue_comment_created','announcement_comment_created');

revoke all on function app_api.backend_create_announcement(text,text,text) from public,anon,authenticated;
revoke all on function app_api.backend_create_announcement_comment(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function app_api.backend_create_issue_comment(uuid,uuid,text,boolean,text,text[],text[],text[]) from public,anon,authenticated;
revoke all on function app_api.backend_create_issue(text,text,text,text,text,boolean,integer,timestamptz,timestamptz,boolean,boolean,text[],text[],text[]) from public,anon,authenticated;
revoke all on function app_api.backend_create_facility(text,text,text,text,text) from public,anon,authenticated;
grant execute on function app_api.backend_create_announcement(text,text,text) to service_role;
grant execute on function app_api.backend_create_announcement_comment(uuid,uuid,text,text) to service_role;
grant execute on function app_api.backend_create_issue_comment(uuid,uuid,text,boolean,text,text[],text[],text[]) to service_role;
grant execute on function app_api.backend_create_issue(text,text,text,text,text,boolean,integer,timestamptz,timestamptz,boolean,boolean,text[],text[],text[]) to service_role;
grant execute on function app_api.backend_create_facility(text,text,text,text,text) to service_role;
