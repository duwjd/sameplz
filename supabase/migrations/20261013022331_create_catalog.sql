-- W2 schema v1 · 3/6: catalog (recipes, versions, hidden originals, media, collections, banners).
-- Three layers: recipes = editable header, recipe_versions(+secrets) = frozen once approved.
-- No client write policies: uploads go through RPCs in W4.

-- ---------------------------------------------------------------- recipes
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique
    default ('r' || substr(md5(gen_random_uuid()::text), 1, 10))
    check (public_id ~ '^[a-z0-9]{6,16}$'),
  owner_id uuid not null references public.profiles (id),
  category text not null check (category in ('prompt', 'agent', 'skill')),
  prompt_kind text check (prompt_kind in ('image', 'video', 'text')),
  title text not null check (char_length(title) between 2 and 40),
  summary text not null default '' check (char_length(summary) <= 60),
  search_tags text[] not null default '{}' check (cardinality(search_tags) <= 10),
  creator_nickname text not null default '',          -- denormalized for search (D15), synced by trigger
  price_krw integer not null default 0 check (price_krw = 0 or price_krw >= 1000),
  status text not null default 'in_review'
    check (status in ('in_review', 'live', 'rejected', 'private', 'stopped')),
  current_version_id uuid,
  forked_from_recipe_id uuid references public.recipes (id) on delete set null,
  forked_from_version_id uuid,
  fork_allowed boolean not null default true,
  job_codes text[] not null check (cardinality(job_codes) between 1 and 2),
  tool_codes text[] not null default '{}',
  filters jsonb not null default '{}'::jsonb,          -- ratio / output format / runtime
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_prompt_kind_only_for_prompts
    check ((category = 'prompt') = (prompt_kind is not null))
);

alter table public.recipes enable row level security;
create index recipes_owner_id_idx on public.recipes (owner_id);
create index recipes_status_category_idx on public.recipes (status, category);
create index recipes_published_at_idx on public.recipes (published_at desc) where status = 'live';

create trigger recipes_touch before update on public.recipes
  for each row execute function private.touch_updated_at();
create trigger recipes_job_codes before insert or update of job_codes on public.recipes
  for each row execute function private.assert_job_codes();

-- creator_nickname follows the owner's profile.
create or replace function private.recipes_set_creator_nickname()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.nickname into new.creator_nickname from public.profiles p where p.id = new.owner_id;
  new.creator_nickname := coalesce(new.creator_nickname, '');
  return new;
end;
$$;
revoke execute on function private.recipes_set_creator_nickname() from public, anon, authenticated;
create trigger recipes_creator_nickname before insert or update of owner_id on public.recipes
  for each row execute function private.recipes_set_creator_nickname();

create or replace function private.profiles_sync_recipe_nickname()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.recipes set creator_nickname = new.nickname where owner_id = new.id;
  return new;
end;
$$;
revoke execute on function private.profiles_sync_recipe_nickname() from public, anon, authenticated;
create trigger profiles_nickname_to_recipes after update of nickname on public.profiles
  for each row when (old.nickname is distinct from new.nickname)
  execute function private.profiles_sync_recipe_nickname();

-- Public sees live + stopped (STOP detail page); lists/search filter live in their RPCs.
-- Private / in review / rejected are invisible to others (same as 404).
create policy recipes_select_public on public.recipes
  for select to anon, authenticated
  using (status in ('live', 'stopped') or owner_id = (select auth.uid()));

-- Visibility helper for child tables (definer: avoids nested RLS evaluation).
create or replace function private.recipe_visible(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe_id
      and (r.status in ('live', 'stopped') or r.owner_id = auth.uid())
  )
$$;
revoke execute on function private.recipe_visible(uuid) from public;
grant execute on function private.recipe_visible(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- recipe_versions
create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  version_no integer not null check (version_no >= 1),
  changelog text not null default '' check (char_length(changelog) <= 500),
  review_status text not null default 'draft'
    check (review_status in ('draft', 'auto_passed', 'pending_review', 'approved', 'rejected')),
  public_meta jsonb not null default '{}'::jsonb,   -- [변수], settings, skill files, agent steps (no originals)
  has_scripts boolean not null default false,
  content_sha256 text check (content_sha256 ~ '^[0-9a-f]{64}$'),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipe_id, version_no)
);

alter table public.recipe_versions enable row level security;
create index recipe_versions_recipe_id_idx on public.recipe_versions (recipe_id);

alter table public.recipes
  add constraint recipes_current_version_fk
    foreign key (current_version_id) references public.recipe_versions (id)
    deferrable initially deferred,
  add constraint recipes_forked_from_version_fk
    foreign key (forked_from_version_id) references public.recipe_versions (id) on delete set null;

-- Approved snapshots are immutable (content columns).
create or replace function private.recipe_versions_freeze()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.approved_at is not null and (
       new.recipe_id is distinct from old.recipe_id
    or new.version_no is distinct from old.version_no
    or new.changelog is distinct from old.changelog
    or new.public_meta is distinct from old.public_meta
    or new.has_scripts is distinct from old.has_scripts
    or new.content_sha256 is distinct from old.content_sha256
    or new.approved_at is distinct from old.approved_at
  ) then
    raise exception using errcode = 'P0001', message = 'VERSION_FROZEN';
  end if;
  return new;
end;
$$;
create trigger recipe_versions_freeze before update on public.recipe_versions
  for each row execute function private.recipe_versions_freeze();

create policy recipe_versions_select_visible on public.recipe_versions
  for select to anon, authenticated
  using (
    (approved_at is not null and (select private.recipe_visible(recipe_id)))
    or exists (select 1 from public.recipes r where r.id = recipe_versions.recipe_id and r.owner_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------- hidden originals (0 policies)
-- Read only through src/data/secrets.ts / definer RPCs. Never select elsewhere.
create table public.recipe_version_secrets (
  version_id uuid primary key references public.recipe_versions (id) on delete cascade,
  prompt_body text,
  skill_md text,
  agent_config jsonb,
  created_at timestamptz not null default now()
);
alter table public.recipe_version_secrets enable row level security;
revoke all on public.recipe_version_secrets from anon, authenticated;

create or replace function private.recipe_version_secrets_freeze()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.recipe_versions v where v.id = old.version_id and v.approved_at is not null) then
    raise exception using errcode = 'P0001', message = 'VERSION_FROZEN';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger recipe_version_secrets_freeze before update or delete on public.recipe_version_secrets
  for each row execute function private.recipe_version_secrets_freeze();

-- ---------------------------------------------------------------- media
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  storage_path text not null,
  kind text not null check (kind in ('image', 'video')),
  ratio text check (ratio in ('1/1', '3/4', '4/3', '4/5', '9/16', '16/9')),
  is_ai_generated boolean not null default true,
  source text not null default 'upload' check (source in ('upload', 'playground')),
  alt_text text check (char_length(alt_text) <= 120),
  created_at timestamptz not null default now()
);
alter table public.media_assets enable row level security;
create index media_assets_owner_id_idx on public.media_assets (owner_id);

create table public.recipe_version_media (
  version_id uuid not null references public.recipe_versions (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  role text not null default 'result' check (role in ('result', 'reference')),
  sort smallint not null default 0,
  primary key (version_id, media_id)
);
alter table public.recipe_version_media enable row level security;
create index recipe_version_media_media_id_idx on public.recipe_version_media (media_id);

create policy recipe_version_media_select_visible on public.recipe_version_media
  for select to anon, authenticated
  using (exists (
    select 1 from public.recipe_versions v
    where v.id = recipe_version_media.version_id
      and ((v.approved_at is not null and (select private.recipe_visible(v.recipe_id)))
           or exists (select 1 from public.recipes r where r.id = v.recipe_id and r.owner_id = (select auth.uid())))
  ));

create policy media_assets_select_own on public.media_assets
  for select to authenticated using (owner_id = (select auth.uid()));

create policy media_assets_select_recipe_visible on public.media_assets
  for select to anon, authenticated
  using (exists (
    select 1
    from public.recipe_version_media rvm
    join public.recipe_versions v on v.id = rvm.version_id
    where rvm.media_id = media_assets.id and v.approved_at is not null and (select private.recipe_visible(v.recipe_id))
  ));

-- ---------------------------------------------------------------- collections (COL)
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  title text not null check (char_length(title) between 2 and 40),
  intro text not null default '' check (char_length(intro) <= 120),
  reason text not null default '' check (char_length(reason) <= 60),
  status text not null default 'draft' check (status in ('draft', 'live')),
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.collections enable row level security;
create trigger collections_touch before update on public.collections
  for each row execute function private.touch_updated_at();

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  sort smallint not null default 0,
  primary key (collection_id, recipe_id)
);
alter table public.collection_items enable row level security;
create index collection_items_recipe_id_idx on public.collection_items (recipe_id);

create policy collections_select_live on public.collections
  for select to anon, authenticated using (status = 'live' or (select private.is_admin()));
create policy collections_write_admin on public.collections
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy collection_items_select_live on public.collection_items
  for select to anon, authenticated
  using (exists (select 1 from public.collections c where c.id = collection_items.collection_id and c.status = 'live')
         or (select private.is_admin()));
create policy collection_items_write_admin on public.collection_items
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------- banners (HOME-01)
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 12),       -- slide label for a11y
  eyebrow text not null default '' check (char_length(eyebrow) <= 20),
  title text not null check (char_length(title) between 1 and 30),
  subtitle text not null default '' check (char_length(subtitle) <= 80),
  cta_label text check (char_length(cta_label) <= 12),
  cta_href text check (cta_href ~ '^/'),
  media_id uuid references public.media_assets (id) on delete set null,
  alt_text text check (char_length(alt_text) <= 120),
  sort smallint not null default 0,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.banners enable row level security;

create policy banners_select_active on public.banners
  for select to anon, authenticated using (active or (select private.is_admin()));
create policy banners_write_admin on public.banners
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
