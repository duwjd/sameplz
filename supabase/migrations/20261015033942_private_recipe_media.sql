-- D18 (B, 2026-10-15): results of recipes that are not public live in a private bucket
-- (`recipe-media-draft`, signed URLs for the owner) and move to the public `recipe-media` bucket only
-- while the version is the current one of a live / stopped recipe. Same path `{owner}/{uuid}.{ext}`
-- in both buckets. Changes are queued here; the app (src/data/media-sync.ts) claims a recipe with a
-- lease, re-checks each path right before moving it, and reports done / retry. Unreferenced uploads
-- older than 24 hours are listed for deletion (hourly).

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

-- The 300MB/day upload cap counts the draft bucket too (results now upload there).
create or replace function public.hit_upload_target_limit(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bytes bigint;
begin
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) into v_bytes
    from storage.objects o
   where o.bucket_id in ('recipe-media', 'recipe-media-draft', 'recipe-files')
     and o.name like p_user::text || '/%'
     and o.created_at > now() - interval '1 day';
  if v_bytes > 300 * 1024 * 1024 then
    return false;
  end if;
  return private.hit_rate_limit('upload-target:user:' || p_user, 60, interval '1 hour');
end;
$$;

create index if not exists media_assets_storage_path_idx on public.media_assets (storage_path);
create index if not exists gallery_posts_media_idx on public.gallery_posts (media_id) where media_id is not null;

-- ---------------------------------------------------------------- what must be public
-- Public while it belongs to the current version of a live / stopped recipe, or to a visible
-- gallery post of such a recipe (same visibility as gallery_posts_select_visible).
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
                   join public.recipes r on r.id = g.recipe_id
                  where m.storage_path = p_path and g.status = 'visible' and r.status in ('live', 'stopped'))
$$;
revoke execute on function private.media_path_public(text) from public, anon, authenticated;

-- Fresh answer per path, asked right before each move (a claim can be minutes old).
create or replace function public.media_paths_public(p_paths text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(p, private.media_path_public(p)), '{}'::jsonb)
    from unnest(coalesce(p_paths, '{}')) as p
$$;

-- ---------------------------------------------------------------- queue
create table public.media_sync_queue (
  recipe_id uuid primary key references public.recipes (id) on delete cascade,
  queued_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0,
  next_try_at timestamptz not null default now(),
  lease_until timestamptz
);
alter table public.media_sync_queue enable row level security;   -- server only, no policies
revoke all on public.media_sync_queue from anon, authenticated;
create index media_sync_queue_due_idx on public.media_sync_queue (next_try_at);

-- A change re-queues with a new queued_at. An in-flight worker keeps its lease (no parallel run for
-- the same recipe); its done then fails on queued_at and the recipe runs again with fresh state.
create or replace function private.queue_media_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.media_sync_queue (recipe_id) values (new.id)
  on conflict (recipe_id) do update
    set queued_at = clock_timestamp(), attempts = 0, next_try_at = now();
  return null;
end;
$$;
revoke execute on function private.queue_media_sync() from public, anon, authenticated;
create trigger recipes_queue_media_sync_insert
  after insert on public.recipes
  for each row execute function private.queue_media_sync();
create trigger recipes_queue_media_sync_update
  after update of status, current_version_id on public.recipes
  for each row
  when (old.status is distinct from new.status or old.current_version_id is distinct from new.current_version_id)
  execute function private.queue_media_sync();

-- Gallery posts follow their recipe's queue (posted, hidden, removed).
create or replace function private.queue_media_sync_gallery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.media_sync_queue (recipe_id) values (coalesce(new.recipe_id, old.recipe_id))
  on conflict (recipe_id) do update
    set queued_at = clock_timestamp(), attempts = 0, next_try_at = now();
  return null;
end;
$$;
revoke execute on function private.queue_media_sync_gallery() from public, anon, authenticated;
create trigger gallery_posts_queue_media_sync
  after insert or delete or update of status, media_id on public.gallery_posts
  for each row execute function private.queue_media_sync_gallery();

-- Claim due recipes (non-public ones first, so hiding is never stuck behind publishing), with a
-- 2-minute lease, and return every result path split by where it must be.
create or replace function public.media_sync_claim(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  with due as (
    select q.recipe_id from public.media_sync_queue q
      join public.recipes r on r.id = q.recipe_id
     where q.next_try_at <= now() and (q.lease_until is null or q.lease_until < now())
     order by (r.status in ('live', 'stopped')), q.queued_at
     limit greatest(p_limit, 1)
     for update of q skip locked
  ), claimed as (
    update public.media_sync_queue q set lease_until = now() + interval '2 minutes'
      from due where q.recipe_id = due.recipe_id
    returning q.recipe_id, q.queued_at
  ), recipe_paths as (
    select c.recipe_id, c.queued_at, m.storage_path as path
      from claimed c
      join public.recipe_versions v on v.recipe_id = c.recipe_id
      join public.recipe_version_media vm on vm.version_id = v.id
      join public.media_assets m on m.id = vm.media_id
    union
    select c.recipe_id, c.queued_at, m.storage_path
      from claimed c
      join public.gallery_posts g on g.recipe_id = c.recipe_id
      join public.media_assets m on m.id = g.media_id
  ), paths as (
    select recipe_id, queued_at, path, private.media_path_public(path) as pub from recipe_paths
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'recipe_id', c.recipe_id, 'queued_at', c.queued_at,
           'publish', coalesce((select jsonb_agg(p.path) from paths p where p.recipe_id = c.recipe_id and p.pub), '[]'),
           'unpublish', coalesce((select jsonb_agg(p.path) from paths p where p.recipe_id = c.recipe_id and not p.pub), '[]'))),
         '[]'::jsonb)
    into out
    from claimed c;
  return out;
end;
$$;

-- Done: drop the entry unless the recipe changed meanwhile (then release the lease so it runs again).
create or replace function public.media_sync_done(p_recipe uuid, p_queued_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.media_sync_queue where recipe_id = p_recipe and queued_at = p_queued_at;
  if found then
    return true;
  end if;
  update public.media_sync_queue set lease_until = null where recipe_id = p_recipe;
  return false;
end;
$$;

-- Retry later with backoff (1, 2, 4 … 60 minutes); keeps the queue from being blocked by one recipe.
create or replace function public.media_sync_retry(p_recipe uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.media_sync_queue
     set attempts = attempts + 1, lease_until = null,
         next_try_at = now() + make_interval(mins => least(power(2, least(attempts, 6))::integer, 60))
   where recipe_id = p_recipe
$$;

-- ---------------------------------------------------------------- unreferenced uploads (D18 cleanup)
-- Older than 24 hours and referenced by no version / gallery media and by no saved draft of the same
-- owner: draft-bucket results, public-bucket leftovers of deleted rows, and uploaded skill zips.
create or replace function public.orphan_uploads(p_limit integer default 100)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with draft_refs as materialized (
    select distinct d.owner_id::text || '|' || (x #>> '{}') as k
      from public.recipe_drafts d, jsonb_path_query(d.payload, 'lax $.**.path') x
  ), candidates as (
    select o.bucket_id, o.name from storage.objects o
     where o.bucket_id in ('recipe-media-draft', 'recipe-media', 'recipe-files')
       and o.created_at < now() - interval '24 hours'
       and not exists (select 1 from public.media_assets m where m.storage_path = o.name)
       and not exists (select 1 from public.recipe_version_files f where f.storage_path = o.name)
       and not exists (select 1 from draft_refs r where r.k = split_part(o.name, '/', 1) || '|' || o.name)
     order by o.created_at
     limit greatest(p_limit, 1)
  )
  select jsonb_build_object(
    'media', coalesce((select jsonb_agg(name) from candidates where bucket_id = 'recipe-media-draft'), '[]'),
    'public', coalesce((select jsonb_agg(name) from candidates where bucket_id = 'recipe-media'), '[]'),
    'files', coalesce((select jsonb_agg(name) from candidates where bucket_id = 'recipe-files'), '[]'))
$$;

-- The orphan scan runs at most once an hour (it reads storage.objects).
create or replace function public.claim_orphan_scan()
returns boolean
language sql
security definer
set search_path = ''
as $$ select private.hit_rate_limit('orphan_scan', 1, interval '1 hour') $$;

revoke execute on function public.media_paths_public(text[]), public.media_sync_claim(integer),
  public.media_sync_done(uuid, timestamptz), public.media_sync_retry(uuid), public.orphan_uploads(integer),
  public.claim_orphan_scan() from public, anon, authenticated;
grant execute on function public.media_paths_public(text[]), public.media_sync_claim(integer),
  public.media_sync_done(uuid, timestamptz), public.media_sync_retry(uuid), public.orphan_uploads(integer),
  public.claim_orphan_scan() to service_role;

-- ---------------------------------------------------------------- existing data
-- Everything was public before: queue every recipe once (non-public ones are claimed first).
insert into public.media_sync_queue (recipe_id) select id from public.recipes
on conflict (recipe_id) do nothing;
