-- W3: recipe detail (PRM·AGT·SKL·STOP·NF), free claim, library (open original, files, updates),
-- share-link inflow counts (F2-3, counts only in MVP — no fee / attribution).
-- Public reads go through definer RPCs that return public fields only; originals never leave
-- open_original, and only to the entitlement holder.

-- ---------------------------------------------------------------- columns
-- STOP-01 reason codes (copy lives in the UI).
alter table public.recipes
  add column stopped_reason text
    check (stopped_reason in ('creator_request', 'rights_claim', 'policy_violation', 'misleading', 'quality', 'other')),
  add column stopped_at timestamptz;

-- AGT-07: badge only with verified proof (set by ops, never by the user).
alter table public.profiles
  add column expert_badge text check (expert_badge in ('tax_accountant', 'lawyer'));
grant select (expert_badge) on public.profiles to anon, authenticated;

-- ---------------------------------------------------------------- attachments (SKL-05, AGT-04)
-- Names/sizes are public on the detail page; the files themselves come from /api/files/[versionId]
-- (signed URL, holders only). 0 policies: read through definer RPCs / the server.
create table public.recipe_version_files (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.recipe_versions (id) on delete cascade,
  filename text not null check (char_length(filename) between 1 and 120
                                  and filename !~ '(^/|\\|(^|/)\.\.(/|$))'),  -- relative, no traversal
  storage_path text not null unique,
  size_bytes integer not null check (size_bytes between 0 and 10485760),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (version_id, filename)
);
alter table public.recipe_version_files enable row level security;
revoke all on public.recipe_version_files from anon, authenticated;

create or replace function private.recipe_version_files_freeze()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.recipe_versions v
             where v.id in (old.version_id, new.version_id) and v.approved_at is not null) then
    raise exception using errcode = 'P0001', message = 'VERSION_FROZEN';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
-- INSERT too: an approved version's file set is fixed (holders keep exactly what they got).
create trigger recipe_version_files_freeze before insert or update or delete on public.recipe_version_files
  for each row execute function private.recipe_version_files_freeze();

-- Private bucket, no storage.objects policies: only the server (secret key) signs URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('recipe-files', 'recipe-files', false, 10485760)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- share links (F2-3)
-- Created from the seller center in W4. Clicks are counted only (MVP: no fee, no attribution).
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);
alter table public.share_links enable row level security;
revoke all on public.share_links from anon, authenticated;
grant select on public.share_links to authenticated;
create index share_links_recipe_id_idx on public.share_links (recipe_id);
create index share_links_creator_id_idx on public.share_links (creator_id);
create policy share_links_select_own on public.share_links
  for select to authenticated using (creator_id = (select auth.uid()));

create table public.share_link_clicks (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.share_links (id) on delete cascade,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.share_link_clicks enable row level security;
revoke all on public.share_link_clicks from anon, authenticated;
create index share_link_clicks_link_visitor_idx on public.share_link_clicks (link_id, visitor_hash, created_at desc);

alter table public.entitlements
  add column share_link_id uuid references public.share_links (id) on delete set null;

-- ---------------------------------------------------------------- update history (F3-8)
create table public.entitlement_version_history (
  id bigint generated always as identity primary key,
  entitlement_id uuid not null references public.entitlements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  from_version_id uuid not null references public.recipe_versions (id),
  to_version_id uuid not null references public.recipe_versions (id),
  applied_at timestamptz not null default now()
);
alter table public.entitlement_version_history enable row level security;
revoke all on public.entitlement_version_history from anon, authenticated;
grant select on public.entitlement_version_history to authenticated;
create index entitlement_version_history_entitlement_idx on public.entitlement_version_history (entitlement_id);
create index entitlement_version_history_user_idx on public.entitlement_version_history (user_id);
create policy entitlement_version_history_select_own on public.entitlement_version_history
  for select to authenticated using (user_id = (select auth.uid()));
create trigger entitlement_version_history_no_update before update on public.entitlement_version_history
  for each row execute function private.reject_update_delete();

-- ---------------------------------------------------------------- detail (public, cacheable)
-- Viewer-independent: live + stopped only, null otherwise (private / in review / rejected / missing
-- are the same 404, F1-7). Never touches recipe_version_secrets.
create or replace function public.get_recipe_public(p_public_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'public_id', r.public_id,
    'category', r.category,
    'prompt_kind', r.prompt_kind,
    'title', r.title,
    'summary', r.summary,
    'status', r.status,
    'stopped_reason', r.stopped_reason,
    'stopped_at', r.stopped_at,
    'price_krw', r.price_krw,
    'job_codes', to_jsonb(r.job_codes),
    'tool_codes', to_jsonb(r.tool_codes),
    'search_tags', to_jsonb(r.search_tags),
    'filters', r.filters,
    'published_at', r.published_at,
    'version', jsonb_build_object(
      'id', v.id, 'no', v.version_no, 'changelog', v.changelog, 'approved_at', v.approved_at,
      'has_scripts', v.has_scripts, 'meta', v.public_meta),
    'creator', jsonb_build_object(
      'handle', p.handle::text, 'nickname', p.nickname, 'avatar_url', p.avatar_url, 'bio', p.bio,
      'is_staff', p.role in ('staff', 'admin'), 'expert_badge', p.expert_badge),
    'tools', (select coalesce(jsonb_agg(jsonb_build_object('code', t.code, 'label', t.label, 'has_api', t.has_api)
                                        order by t.sort), '[]'::jsonb)
              from public.tools t where t.code = any (r.tool_codes)),
    'media', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'path', m.storage_path, 'kind', m.kind,
                                                           'ratio', m.ratio, 'alt', m.alt_text, 'ai', m.is_ai_generated)
                                        order by rvm.sort, m.id), '[]'::jsonb)
              from public.recipe_version_media rvm
              join public.media_assets m on m.id = rvm.media_id
              where rvm.version_id = v.id and rvm.role = 'result'),
    'files', (select coalesce(jsonb_agg(jsonb_build_object('name', f.filename, 'size', f.size_bytes)
                                        order by f.sort, f.filename), '[]'::jsonb)
              from public.recipe_version_files f where f.version_id = v.id),
    'stats', jsonb_build_object(
      'downloads', (select count(*) from public.entitlements e
                    where e.recipe_id = r.id and e.revoked_at is null and e.source <> 'owner' and e.user_id <> r.owner_id),
      'same_count', (select count(*) from public.gallery_posts g
                     where g.recipe_id = r.id and g.kind = 'same_cert' and g.status = 'visible'),
      'likes', (select count(*) from public.recipe_likes l where l.recipe_id = r.id)),
    'forked_from', (select jsonb_build_object('public_id', o.public_id, 'title', o.title, 'creator_nickname', o.creator_nickname)
                    from public.recipes o
                    where o.id = r.forked_from_recipe_id and o.status in ('live', 'stopped'))
  )
  from public.recipes r
  join public.recipe_versions v on v.id = r.current_version_id and v.approved_at is not null
  join public.profiles p on p.id = r.owner_id
  where r.public_id = p_public_id
    and r.status in ('live', 'stopped')
$$;
revoke execute on function public.get_recipe_public(text) from public;
grant execute on function public.get_recipe_public(text) to anon, authenticated;

-- STOP-03 / detail footer: live recipes, same category first, then shared job, then popularity.
create or replace function public.similar_recipes(p_public_id text, p_limit integer default 4)
returns table (
  public_id text,
  title text,
  summary text,
  category text,
  prompt_kind text,
  price_krw integer,
  creator_nickname text,
  creator_handle text,
  job_codes text[],
  tool_codes text[],
  filters jsonb,
  downloads integer,
  same_count integer,
  likes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.public_id, r.title, r.summary, r.category, r.prompt_kind, r.price_krw, r.creator_nickname,
         p.handle::text, r.job_codes, r.tool_codes, r.filters, m.downloads, m.same_count, m.likes
  from public.recipes src
  join public.recipes r on r.id <> src.id and r.status = 'live'
  join public.mv_recipe_popularity m on m.recipe_id = r.id
  join public.profiles p on p.id = r.owner_id
  where src.public_id = p_public_id
    and src.status in ('live', 'stopped')
  order by (r.category = src.category) desc, (r.job_codes && src.job_codes) desc, m.popularity desc, r.id
  limit least(greatest(coalesce(p_limit, 4), 1), 12)
$$;
revoke execute on function public.similar_recipes(text, integer) from public;
grant execute on function public.similar_recipes(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------- viewer state (dynamic)
create or replace function public.my_recipe_state(p_recipe_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'is_owner', r.owner_id = auth.uid(),
    'liked', exists (select 1 from public.recipe_likes l where l.recipe_id = r.id and l.user_id = auth.uid()),
    'entitlement', (
      select jsonb_build_object('id', e.id, 'version_id', e.version_id, 'version_no', v.version_no,
                                'opened_at', e.opened_at, 'created_at', e.created_at,
                                'update_available', e.version_id <> r.current_version_id)
      from public.entitlements e
      join public.recipe_versions v on v.id = e.version_id
      where e.recipe_id = r.id and e.user_id = auth.uid() and e.revoked_at is null and e.source <> 'owner')
  )
  from public.recipes r
  where r.id = p_recipe_id
    and auth.uid() is not null
    and (r.status in ('live', 'stopped') or r.owner_id = auth.uid())
$$;
revoke execute on function public.my_recipe_state(uuid) from public, anon;
grant execute on function public.my_recipe_state(uuid) to authenticated;

-- ---------------------------------------------------------------- free claim (F2-1)
-- Idempotent per (user, recipe). MVP: every live recipe is free; paid ones refuse (NOT_FREE).
create or replace function public.claim_free_recipe(p_recipe_id uuid, p_ref_code text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rec public.recipes%rowtype;
  ent_id uuid;
  link_id uuid;
begin
  if uid is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if not private.signup_complete() then
    raise exception using errcode = 'P0001', message = 'SIGNUP_INCOMPLETE';
  end if;

  select * into rec from public.recipes r where r.id = p_recipe_id for share;
  if not found or rec.status <> 'live'
     or not exists (select 1 from public.recipe_versions v
                    where v.id = rec.current_version_id and v.approved_at is not null) then
    raise exception using errcode = 'P0001', message = 'RECIPE_UNAVAILABLE';
  end if;
  if rec.owner_id = uid then
    raise exception using errcode = 'P0001', message = 'OWN_RECIPE';
  end if;
  if rec.price_krw <> 0 then
    raise exception using errcode = 'P0001', message = 'NOT_FREE';
  end if;

  select e.id into ent_id from public.entitlements e
   where e.user_id = uid and e.recipe_id = rec.id and e.revoked_at is null;
  if ent_id is not null then
    return jsonb_build_object('entitlement_id', ent_id, 'created', false);
  end if;

  if p_ref_code is not null then
    select l.id into link_id from public.share_links l where l.code = p_ref_code and l.recipe_id = rec.id;
  end if;

  insert into public.entitlements (user_id, recipe_id, version_id, source, share_link_id)
  values (uid, rec.id, rec.current_version_id, 'free', link_id)
  on conflict (user_id, recipe_id) where revoked_at is null do nothing
  returning id into ent_id;

  if ent_id is null then  -- lost a race with a concurrent claim
    select e.id into ent_id from public.entitlements e
     where e.user_id = uid and e.recipe_id = rec.id and e.revoked_at is null;
    return jsonb_build_object('entitlement_id', ent_id, 'created', false);
  end if;
  return jsonb_build_object('entitlement_id', ent_id, 'created', true);
end;
$$;
revoke execute on function public.claim_free_recipe(uuid, text) from public, anon;
grant execute on function public.claim_free_recipe(uuid, text) to authenticated;

-- ---------------------------------------------------------------- share-link click (F2-3)
-- Counts one click per (link, visitor) per 24h. Returns the creator nickname for the inflow band,
-- or null when the code does not belong to this recipe. Server only (secret key): the visitor hash
-- is derived on the server, so clients cannot mint visitors to inflate counts.
create or replace function public.record_share_click(p_public_id text, p_code text, p_visitor_hash text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  link record;
begin
  if p_code is null or p_code !~ '^[a-z0-9]{6,12}$' or p_visitor_hash is null or p_visitor_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select l.id, p.nickname into link
  from public.share_links l
  join public.recipes r on r.id = l.recipe_id
  join public.profiles p on p.id = l.creator_id
  where l.code = p_code and r.public_id = p_public_id and r.status = 'live';
  if not found then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(link.id::text || p_visitor_hash, 0));
  if not exists (select 1 from public.share_link_clicks c
                 where c.link_id = link.id and c.visitor_hash = p_visitor_hash
                   and c.created_at > now() - interval '24 hours') then
    insert into public.share_link_clicks (link_id, visitor_hash) values (link.id, p_visitor_hash);
  end if;
  return link.nickname;
end;
$$;
revoke execute on function public.record_share_click(text, text, text) from public, anon, authenticated;
grant execute on function public.record_share_click(text, text, text) to service_role;

-- ---------------------------------------------------------------- library (LIB)
-- Received recipes (not the user's own). Stopped recipes stay (the pinned version keeps working).
create or replace function public.my_library()
returns table (
  entitlement_id uuid,
  recipe_id uuid,
  public_id text,
  title text,
  summary text,
  category text,
  prompt_kind text,
  status text,
  creator_nickname text,
  tool_codes text[],
  filters jsonb,
  version_id uuid,
  version_no integer,
  latest_version_no integer,
  latest_changelog text,
  update_available boolean,
  opened_at timestamptz,
  claimed_at timestamptz,
  files jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, r.id, r.public_id, r.title, r.summary, r.category, r.prompt_kind, r.status, r.creator_nickname,
         r.tool_codes, r.filters, e.version_id, v.version_no, cv.version_no, cv.changelog,
         cv.id is not null and cv.id <> e.version_id and cv.version_no > v.version_no,
         e.opened_at, e.created_at,
         (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.filename, 'size', f.size_bytes)
                                    order by f.sort, f.filename), '[]'::jsonb)
          from public.recipe_version_files f where f.version_id = e.version_id)
  from public.entitlements e
  join public.recipes r on r.id = e.recipe_id
  join public.recipe_versions v on v.id = e.version_id
  left join public.recipe_versions cv on cv.id = r.current_version_id and cv.approved_at is not null
  where e.user_id = auth.uid()
    and e.revoked_at is null
    and e.source <> 'owner'
  order by e.created_at desc, e.id
$$;
revoke execute on function public.my_library() from public, anon;
grant execute on function public.my_library() to authenticated;

-- F3-5 (MVP, D6): no confirm step; the first open is recorded for stats only.
create or replace function public.open_original(p_entitlement_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ent public.entitlements%rowtype;
  first_open boolean;
  out jsonb;
begin
  select * into ent from public.entitlements e
   where e.id = p_entitlement_id and e.user_id = auth.uid() and e.revoked_at is null
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  first_open := ent.opened_at is null;
  if first_open then
    update public.entitlements set opened_at = now() where id = ent.id returning * into ent;
  end if;

  select jsonb_build_object(
           'version_no', v.version_no,
           'prompt_body', s.prompt_body,
           'skill_md', s.skill_md,
           'agent_config', s.agent_config,
           'opened_at', ent.opened_at,
           'claimed_at', ent.created_at,
           'first_open', first_open)
    into out
  from public.recipe_versions v
  left join public.recipe_version_secrets s on s.version_id = v.id
  where v.id = ent.version_id;
  return out;
end;
$$;
revoke execute on function public.open_original(uuid) from public, anon;
grant execute on function public.open_original(uuid) to authenticated;

-- F3-8: move this one entitlement to the latest approved version and keep the history.
create or replace function public.apply_update(p_entitlement_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ent public.entitlements%rowtype;
  latest uuid;
begin
  select * into ent from public.entitlements e
   where e.id = p_entitlement_id and e.user_id = auth.uid() and e.revoked_at is null
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select v.id into latest
  from public.recipes r
  join public.recipe_versions v on v.id = r.current_version_id and v.approved_at is not null
  join public.recipe_versions pinned on pinned.id = ent.version_id
  where r.id = ent.recipe_id
    and v.version_no > pinned.version_no;  -- forward only

  if latest is null or latest = ent.version_id then
    return jsonb_build_object('updated', false, 'version_id', ent.version_id);
  end if;

  insert into public.entitlement_version_history (entitlement_id, user_id, from_version_id, to_version_id)
  values (ent.id, ent.user_id, ent.version_id, latest);
  update public.entitlements set version_id = latest where id = ent.id;
  return jsonb_build_object('updated', true, 'version_id', latest);
end;
$$;
revoke execute on function public.apply_update(uuid) from public, anon;
grant execute on function public.apply_update(uuid) to authenticated;

-- /api/files/[versionId]: storage path only for a holder of exactly that version (or the owner).
create or replace function public.file_for_download(p_version_id uuid, p_file_id uuid)
returns table (storage_path text, filename text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.storage_path, f.filename
  from public.recipe_version_files f
  join public.recipe_versions v on v.id = f.version_id
  join public.recipes r on r.id = v.recipe_id
  where f.id = p_file_id
    and f.version_id = p_version_id
    and auth.uid() is not null
    and (r.owner_id = auth.uid()
         or exists (select 1 from public.entitlements e
                    where e.user_id = auth.uid() and e.recipe_id = r.id
                      and e.version_id = p_version_id and e.revoked_at is null))
$$;
revoke execute on function public.file_for_download(uuid, uuid) from public, anon;
grant execute on function public.file_for_download(uuid, uuid) to authenticated;
