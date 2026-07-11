alter table app_private.push_tokens
  add column if not exists topic_broadcast boolean not null default false,
  add column if not exists topic_admin boolean not null default false;

create index if not exists push_tokens_topic_broadcast_fallback_idx
  on app_private.push_tokens(uid) where topic_broadcast = false;
create index if not exists push_tokens_topic_admin_fallback_idx
  on app_private.push_tokens(uid) where topic_admin = false;
