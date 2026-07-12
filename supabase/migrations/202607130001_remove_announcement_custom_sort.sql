drop function if exists app_api.backend_list_announcements(text, text, integer, uuid, timestamptz, integer);

create function app_api.backend_list_announcements(
  actor_uid text,
  page_size integer,
  cursor_id uuid,
  cursor_published_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = app_private, app_api, public
as $$
declare
  limited_page_size integer := least(greatest(coalesce(page_size, 10), 1), 30);
  rows_json jsonb := '[]'::jsonb;
  last_announcement jsonb;
  announcement_record app_private.announcements%rowtype;
begin
  for announcement_record in
    select *
    from app_private.announcements
    where cursor_id is null
      or published_at < cursor_published_at
      or (published_at = cursor_published_at and id < cursor_id)
    order by published_at desc, id desc
    limit limited_page_size + 1
  loop
    rows_json := rows_json || jsonb_build_array(
      app_api.backend_announcement_to_json(announcement_record, actor_uid)
    );
  end loop;

  last_announcement := rows_json -> (limited_page_size - 1);

  return jsonb_build_object(
    'announcements', (
      select coalesce(jsonb_agg(value order by position), '[]'::jsonb)
      from jsonb_array_elements(rows_json) with ordinality as items(value, position)
      where position <= limited_page_size
    ),
    'hasMore', jsonb_array_length(rows_json) > limited_page_size,
    'cursor', case
      when jsonb_array_length(rows_json) > limited_page_size and last_announcement is not null then
        jsonb_build_object(
          'id', last_announcement ->> 'id',
          'publishedAtMs', last_announcement -> 'published_at_ms'
        )
      else null
    end
  );
end;
$$;

revoke all on function app_api.backend_list_announcements(text, integer, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function app_api.backend_list_announcements(text, integer, uuid, timestamptz)
to service_role;
