-- Store normalized email for exact access lookup and remove the facility status
-- RPC's result_content parameter/column ambiguity.

alter table app_private.user_profiles add column if not exists email text;

create unique index if not exists user_profiles_email_unique_idx
  on app_private.user_profiles(lower(email)) where email is not null;

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
  if next_status in ('completed','unable-to-handle') and coalesce(length(btrim(backend_update_facility_status.result_content)),0)=0 then raise exception 'missing-result'; end if;
  update app_private.facility_reports set
    status=next_status,
    result_content=case when next_status in ('completed','unable-to-handle') then backend_update_facility_status.result_content else null end,
    started_at=case when next_status='processing' then coalesce(started_at,now()) else started_at end,
    closed_at=case when next_status in ('completed','unable-to-handle') then now() else null end,
    last_actor_uid=actor_uid,
    updated_at=now()
  where id=facility_id returning * into facility;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values('facility.status_changed','facility',facility.id::text,actor_uid,jsonb_build_object(
    'author_uid',facility.author_uid,'old_status',old_status,'new_status',next_status,'title',facility.title,
    'affected_count',facility.affected_count,'result_content',facility.result_content));
  return to_jsonb(facility) || jsonb_build_object(
    'isOwnFacility',facility.author_uid=actor_uid,
    'currentUserAffected',facility.author_uid=actor_uid or exists(
      select 1 from app_private.facility_report_affected_users affected
      where affected.facility_id=facility.id and affected.uid=actor_uid
    ),
    'canManageFacility',true
  );
end;
$$;

grant execute on function app_api.backend_update_facility_status(uuid,text,boolean,text,text) to service_role;
