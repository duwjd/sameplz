-- W2 schema v1 · 4/6: entitlements, gallery, likes, follows, creator waitlist, search log.
-- MVP has no payments: entitlements come from free claims (W3 RPC) or ownership.

-- ---------------------------------------------------------------- entitlements
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  version_id uuid not null references public.recipe_versions (id),
  source text not null check (source in ('free', 'owner', 'purchase')),  -- purchase: paid phase only
  opened_at timestamptz,                                                  -- stats only in MVP (D6)
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
create unique index entitlements_active_user_recipe_key
  on public.entitlements (user_id, recipe_id) where revoked_at is null;
create index entitlements_recipe_id_idx on public.entitlements (recipe_id) where revoked_at is null;

-- Read own only. Writes only through definer RPCs (claim_free_recipe, W3).
revoke insert, update, delete on public.entitlements from anon, authenticated;
create policy entitlements_select_own on public.entitlements
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.has_entitlement(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.recipe_id = p_recipe_id and e.user_id = auth.uid() and e.revoked_at is null
  )
$$;
revoke execute on function private.has_entitlement(uuid) from public, anon;
grant execute on function private.has_entitlement(uuid) to authenticated;

-- ---------------------------------------------------------------- gallery (GAL, HOME-04)
create table public.gallery_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  version_id uuid references public.recipe_versions (id),
  kind text not null check (kind in ('original', 'same_cert')),
  entitlement_id uuid references public.entitlements (id),
  generated_here boolean not null default false,
  media_id uuid references public.media_assets (id) on delete set null,
  title text not null check (char_length(title) between 1 and 40),
  ratio text check (ratio in ('1/1', '3/4', '4/3', '4/5', '9/16', '16/9')),
  status text not null default 'visible' check (status in ('visible', 'pending_review', 'hidden')),
  created_at timestamptz not null default now()
);
alter table public.gallery_posts enable row level security;
create index gallery_posts_recipe_id_idx on public.gallery_posts (recipe_id);
create index gallery_posts_author_id_idx on public.gallery_posts (author_id);
create index gallery_posts_feed_idx on public.gallery_posts (created_at desc) where status = 'visible';

create policy gallery_posts_select_visible on public.gallery_posts
  for select to anon, authenticated
  using ((status = 'visible' and (select private.recipe_visible(recipe_id)))
         or author_id = (select auth.uid()));

-- Referenced rows must belong to the caller / this recipe (no attaching someone else's media).
create or replace function private.gallery_refs_ok(p_media_id uuid, p_recipe_id uuid, p_version_id uuid, p_entitlement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_media_id is null or exists (
            select 1 from public.media_assets m where m.id = p_media_id and m.owner_id = auth.uid()))
     and (p_version_id is null or exists (
            select 1 from public.recipe_versions v where v.id = p_version_id and v.recipe_id = p_recipe_id))
     and (p_entitlement_id is null or exists (
            select 1 from public.entitlements e
            where e.id = p_entitlement_id and e.user_id = auth.uid() and e.recipe_id = p_recipe_id and e.revoked_at is null))
$$;
revoke execute on function private.gallery_refs_ok(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function private.gallery_refs_ok(uuid, uuid, uuid, uuid) to authenticated;

-- SAME 인증 needs an active entitlement; originals only by the recipe owner.
create policy gallery_posts_insert_same_cert on public.gallery_posts
  for insert to authenticated
  with check (kind = 'same_cert' and author_id = (select auth.uid())
              and status = 'visible' and (select private.has_entitlement(recipe_id))
              and (select private.gallery_refs_ok(media_id, recipe_id, version_id, entitlement_id)));
create policy gallery_posts_insert_original on public.gallery_posts
  for insert to authenticated
  with check (kind = 'original' and author_id = (select auth.uid()) and status = 'visible'
              and exists (select 1 from public.recipes r where r.id = gallery_posts.recipe_id and r.owner_id = (select auth.uid()))
              and (select private.gallery_refs_ok(media_id, recipe_id, version_id, entitlement_id)));
create policy gallery_posts_delete_own on public.gallery_posts
  for delete to authenticated using (author_id = (select auth.uid()));

-- Media shown on visible gallery posts is public too.
create policy media_assets_select_gallery_visible on public.media_assets
  for select to anon, authenticated
  using (exists (
    select 1 from public.gallery_posts g
    where g.media_id = media_assets.id and g.status = 'visible' and (select private.recipe_visible(g.recipe_id))
  ));

-- ---------------------------------------------------------------- likes & follows
create table public.recipe_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
alter table public.recipe_likes enable row level security;
create index recipe_likes_recipe_id_idx on public.recipe_likes (recipe_id);
create policy recipe_likes_select_all on public.recipe_likes
  for select to anon, authenticated using ((select private.recipe_visible(recipe_id)));
create policy recipe_likes_insert_own on public.recipe_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.recipe_visible(recipe_id)));
create policy recipe_likes_delete_own on public.recipe_likes
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.post_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.gallery_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.post_likes enable row level security;
create index post_likes_post_id_idx on public.post_likes (post_id);
-- Gated by gallery_posts RLS: likes on hidden / pending / invisible-recipe posts stay hidden.
create policy post_likes_select_visible on public.post_likes
  for select to anon, authenticated
  using (exists (select 1 from public.gallery_posts g where g.id = post_likes.post_id));
create policy post_likes_insert_own on public.post_likes
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.gallery_posts g where g.id = post_likes.post_id and g.status = 'visible'));
create policy post_likes_delete_own on public.post_likes
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.follows enable row level security;
create index follows_followee_id_idx on public.follows (followee_id);
create policy follows_select_all on public.follows
  for select to anon, authenticated using (true);
create policy follows_insert_own on public.follows
  for insert to authenticated with check (follower_id = (select auth.uid()));
create policy follows_delete_own on public.follows
  for delete to authenticated using (follower_id = (select auth.uid()));

-- ---------------------------------------------------------------- creator waitlist (F5-14)
create table public.creator_waitlist (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  categories text[] not null default '{}'
    check (categories <@ array['prompt', 'agent', 'skill']::text[]),
  consent_version text not null check (char_length(consent_version) between 1 and 40),
  created_at timestamptz not null default now()
);
alter table public.creator_waitlist enable row level security;
create policy creator_waitlist_select_own on public.creator_waitlist
  for select to authenticated using (user_id = (select auth.uid()));
create policy creator_waitlist_insert_own on public.creator_waitlist
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy creator_waitlist_delete_own on public.creator_waitlist
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- search log (written by search RPC only)
create table public.search_queries (
  id bigint generated always as identity primary key,
  query_norm text not null check (char_length(query_norm) between 1 and 100),
  result_count integer not null check (result_count >= 0),
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.search_queries enable row level security;
revoke all on public.search_queries from anon, authenticated;
create index search_queries_created_at_idx on public.search_queries (created_at desc);
