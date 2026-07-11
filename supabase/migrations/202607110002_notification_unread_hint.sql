create or replace function app_api.backend_get_notification_unread_hint(actor_uid text, actor_is_admin boolean)
returns jsonb
language sql
stable
security definer
set search_path = app_private, public
as $$
  with state as (
    select
      coalesce(broadcast_opened_at, '-infinity'::timestamptz) as broadcast_opened_at,
      coalesce(admin_opened_at, '-infinity'::timestamptz) as admin_opened_at,
      coalesce(user_opened_at, '-infinity'::timestamptz) as user_opened_at
    from app_private.notification_states
    where uid = backend_get_notification_unread_hint.actor_uid
  ), normalized_state as (
    select * from state
    union all
    select '-infinity'::timestamptz, '-infinity'::timestamptz, '-infinity'::timestamptz
    where not exists (select 1 from state)
  )
  select jsonb_build_object('hasUnread', exists (
    select 1
    from app_private.notifications notification, normalized_state opened
    where notification.expires_at > now()
      and (
        (notification.source = 'broadcast' and notification.created_at > opened.broadcast_opened_at)
        or (notification.source = 'user' and notification.recipient_uid = backend_get_notification_unread_hint.actor_uid and notification.created_at > opened.user_opened_at)
        or (backend_get_notification_unread_hint.actor_is_admin and notification.source = 'admin' and notification.created_at > opened.admin_opened_at)
      )
    limit 1
  ));
$$;

revoke all on function app_api.backend_get_notification_unread_hint(text, boolean) from public, anon, authenticated;
grant execute on function app_api.backend_get_notification_unread_hint(text, boolean) to service_role;
