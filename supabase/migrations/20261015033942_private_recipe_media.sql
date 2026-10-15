-- D18 (B, 2026-10-15): results of recipes that are not public live in a private bucket
-- (`recipe-media-draft`, signed URLs for the owner) and move to the public `recipe-media` bucket only
-- while the version is the current one of a live / stopped recipe. Same path `{owner}/{uuid}.{ext}`
-- in both buckets. Changes to recipes are queued here; the app moves the objects (Storage API) and
-- reports back. Unsubmitted uploads older than 24 hours are listed for deletion.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-media-draft', 'recipe-media-draft', false, 52428800,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A result may sit in either bucket: uploads land in the draft bucket, and a new version may reuse
-- results already published by an earlier version. Every other bucket is checked as before.
create or replace function private.storage_object_ok(p_bucket text, p_path text, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path is not null
     and split_part(p_path, '/', 1) = p_owner::text
     and p_path !~ '(^/|\.\.)'
     and exists (select 1 from storage.objects o
                  where o.name = p_path
                    and (o.bucket_id = p_bucket
                         or (p_bucket = 'recipe-media' and o.bucket_id = 'recipe-media-draft')))
$$;

-- ---------------------------------------------------------------- what must be public
-- A path is public while it belongs to the current version of a live / stopped recipe, or to a
-- visible gallery post.
create or replace function private.media_path_public(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.media_assets m
                   join public.recipe_version_media vm on vm.media_id = m.id
                   join public.recipes r on r.current_version_id = vm.version_id
                  where m.storage_path = p_path and r.status in ('live', 'stopped'))
      or exists (select 1 from public.media_assets m
                   join public.gallery_posts g on g.media_id = m.id
                  where m.storage_path = p_path and g.status = 'visible')
$$;
revoke execute on function private.media_path_public(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- queue
create table public.media_sync_queue (
  recipe_id uuid primary key references public.recipes (id) on delete cascade,
  queued_at timestamptz not null default now()
);
alter table public.media_sync_queue enable row level security;   -- server only, no policies
revoke all on public.media_sync_queue from anon, authenticated;
create index media_sync_queue_queued_idx on public.media_sync_queue (queued_at);

create or replace function private.queue_media_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.media_sync_queue (recipe_id) values (new.id)
  on conflict (recipe_id) do update set queued_at = now();
  return null;
end;
$$;
revoke execute on function private.queue_media_sync() from public, anon, authenticated;
create trigger recipes_queue_media_sync
  after insert or update of status, current_version_id on public.recipes
  for each row execute function private.queue_media_sync();

-- Next recipes to sync: every result path of every version, split by where it must be.
create or replace function public.media_sync_batch(p_limit integer default 20)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'recipe_id', q.recipe_id, 'queued_at', q.queued_at,
           'publish', coalesce((select jsonb_agg(distinct m.storage_path)
                                  from public.recipe_versions v
                                  join public.recipe_version_media vm on vm.version_id = v.id
                                  join public.media_assets m on m.id = vm.media_id
                                 where v.recipe_id = q.recipe_id and private.media_path_public(m.storage_path)),
                               '[]'::jsonb),
           'unpublish', coalesce((select jsonb_agg(distinct m.storage_path)
                                    from public.recipe_versions v
                                    join public.recipe_version_media vm on vm.version_id = v.id
                                    join public.media_assets m on m.id = vm.media_id
                                   where v.recipe_id = q.recipe_id and not private.media_path_public(m.storage_path)),
                                 '[]'::jsonb))
           order by q.queued_at), '[]'::jsonb)
    from (select recipe_id, queued_at from public.media_sync_queue order by queued_at limit greatest(p_limit, 1)) q
$$;

-- Done only if nothing re-queued the recipe meanwhile.
create or replace function public.media_sync_done(p_recipe uuid, p_queued_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.media_sync_queue where recipe_id = p_recipe and queued_at = p_queued_at;
  return found;
end;
$$;

-- ---------------------------------------------------------------- unsubmitted uploads (D18 cleanup)
-- Draft-bucket results and uploaded skill zips older than 24 hours that no version and no saved
-- draft refers to.
create or replace function public.orphan_uploads(p_limit integer default 100)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'media', coalesce((select jsonb_agg(o.name) from (
        select o.name from storage.objects o
         where o.bucket_id = 'recipe-media-draft' and o.created_at < now() - interval '24 hours'
           and not exists (select 1 from public.media_assets m where m.storage_path = o.name)
           and not exists (select 1 from public.recipe_drafts d where strpos(d.payload::text, o.name) > 0)
         order by o.created_at limit greatest(p_limit, 1)) o), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(o.name) from (
        select o.name from storage.objects o
         where o.bucket_id = 'recipe-files' and o.created_at < now() - interval '24 hours'
           and not exists (select 1 from public.recipe_version_files f where f.storage_path = o.name)
           and not exists (select 1 from public.recipe_drafts d where strpos(d.payload::text, o.name) > 0)
         order by o.created_at limit greatest(p_limit, 1)) o), '[]'::jsonb))
$$;

revoke execute on function public.media_sync_batch(integer), public.media_sync_done(uuid, timestamptz),
  public.orphan_uploads(integer) from public, anon, authenticated;
grant execute on function public.media_sync_batch(integer), public.media_sync_done(uuid, timestamptz),
  public.orphan_uploads(integer) to service_role;

-- ---------------------------------------------------------------- existing data
-- Everything was public before: queue every recipe once so non-public results move to the draft bucket.
insert into public.media_sync_queue (recipe_id) select id from public.recipes
on conflict (recipe_id) do nothing;
