alter table app_private.uploads
  add column if not exists delivery_url_scope text
    check (delivery_url_scope in ('private', 'public'));

update app_private.uploads
set delivery_url = null,
    delivery_url_expires_at = null,
    delivery_url_scope = null
where delivery_url is not null;
