-- W2 schema v1 · 5/6: popularity (F1-2, F1-3) — materialized view + hourly rank snapshots.
-- popularity = downloads + SAME×4 + likes×0.5, live recipes only. Refreshed by pg_cron.

create materialized view public.mv_recipe_popularity as
with dl as (
  select e.recipe_id,
         count(*)                                                     as downloads,
         count(*) filter (where e.created_at >= now() - interval '7 days')  as downloads_7d,
         count(*) filter (where e.created_at >= now() - interval '24 hours') as downloads_24h
  from public.entitlements e
  join public.recipes r on r.id = e.recipe_id
  where e.revoked_at is null
    and e.source <> 'owner'
    and e.user_id <> r.owner_id                      -- self downloads never count
  group by e.recipe_id
),
same as (
  select g.recipe_id, count(*) as same_count
  from public.gallery_posts g
  where g.kind = 'same_cert' and g.status = 'visible'
  group by g.recipe_id
),
likes as (
  select l.recipe_id, count(*) as likes
  from public.recipe_likes l
  group by l.recipe_id
)
select r.id as recipe_id,
       r.category,
       r.owner_id,
       coalesce(dl.downloads, 0)::integer     as downloads,
       coalesce(dl.downloads_7d, 0)::integer  as downloads_7d,
       coalesce(dl.downloads_24h, 0)::integer as downloads_24h,
       coalesce(same.same_count, 0)::integer  as same_count,
       coalesce(likes.likes, 0)::integer      as likes,
       (coalesce(dl.downloads, 0) + coalesce(same.same_count, 0) * 4 + coalesce(likes.likes, 0) * 0.5)::numeric(12, 1)
         as popularity,
       now() as refreshed_at
from public.recipes r
left join dl on dl.recipe_id = r.id
left join same on same.recipe_id = r.id
left join likes on likes.recipe_id = r.id
where r.status = 'live';

create unique index mv_recipe_popularity_recipe_id_key on public.mv_recipe_popularity (recipe_id);
create index mv_recipe_popularity_rank_idx on public.mv_recipe_popularity (category, popularity desc);

-- Not RLS-protected → never exposed directly; public reads go through definer RPCs.
revoke all on public.mv_recipe_popularity from anon, authenticated;

-- ---------------------------------------------------------------- hourly snapshots (TOP 10 ▲▼)
create table public.ranking_snapshots (
  taken_at timestamptz not null,
  category text not null check (category in ('all', 'prompt', 'agent', 'skill')),
  rank smallint not null check (rank between 1 and 10),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  primary key (taken_at, category, rank)
);
alter table public.ranking_snapshots enable row level security;
create index ranking_snapshots_recipe_id_idx on public.ranking_snapshots (recipe_id);
-- Rows of recipes that later went private / stopped disappear for clients.
create policy ranking_snapshots_select_live on public.ranking_snapshots
  for select to anon, authenticated
  using (exists (select 1 from public.recipes r where r.id = ranking_snapshots.recipe_id and r.status = 'live'));
revoke insert, update, delete on public.ranking_snapshots from anon, authenticated;

-- ---------------------------------------------------------------- refresh jobs
create or replace function private.refresh_popularity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view concurrently public.mv_recipe_popularity;
end;
$$;

-- TOP 10 per tab, max 2 per creator (F1-3), from the current MV. Keeps 48 hours.
create or replace function private.snapshot_rankings()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ts timestamptz := date_trunc('minute', now());
begin
  insert into public.ranking_snapshots (taken_at, category, rank, recipe_id)
  with base as (
    select t.tab, m.recipe_id, m.owner_id, m.popularity
    from public.mv_recipe_popularity m
    cross join (values ('all'), ('prompt'), ('agent'), ('skill')) t(tab)
    where t.tab = 'all' or m.category = t.tab
  ),
  capped as (
    select b.*, row_number() over (partition by b.tab, b.owner_id order by b.popularity desc, b.recipe_id) as per_creator
    from base b
  ),
  ranked as (
    select c.tab, c.recipe_id, row_number() over (partition by c.tab order by c.popularity desc, c.recipe_id) as rn
    from capped c
    where c.per_creator <= 2
  )
  select ts, r.tab, r.rn, r.recipe_id from ranked r where r.rn <= 10
  on conflict do nothing;

  delete from public.ranking_snapshots where taken_at < now() - interval '48 hours';
end;
$$;

revoke execute on function private.refresh_popularity() from public, anon, authenticated;
revoke execute on function private.snapshot_rankings() from public, anon, authenticated;

select cron.schedule('sameplz-refresh-popularity', '*/5 * * * *', 'select private.refresh_popularity()');
select cron.schedule('sameplz-snapshot-rankings', '0 * * * *', 'select private.snapshot_rankings()');
