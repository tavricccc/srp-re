delete from app_private.outbox_events
where event_type in ('support.created', 'support.deleted');

alter table app_private.uploads
  drop column if exists delivery_type,
  drop column if exists resource_type,
  drop column if exists secure_url,
  drop column if exists original_url,
  drop column if exists preview_url;

delete from app_private.realtime_events
where created_at < now() - interval '1 day';

delete from app_private.push_delivery_logs
where status <> 'failed' or created_at < now() - interval '30 days';

delete from app_private.notion_support_dirty dirty
where not exists (select 1 from app_private.issues issue where issue.id = dirty.issue_id);
