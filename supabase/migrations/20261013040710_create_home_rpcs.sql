-- HOME read RPCs (HOME-02~05, F1-1~F1-3). Public data only; the popularity MV is not readable
-- by clients, so HOME reads it through these definer functions. Live recipes only.

-- HOME-02 이번 주 다운로드 많은: last 7 days, max 1 per creator. (MVP: every recipe is free,
-- so "1–2 free recipes included" holds by construction.)
create or replace function public.home_weekly(p_limit integer default 4)
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
  downloads_7d integer,
  same_count integer,
  likes integer,
  popularity numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select r.*, m.downloads, m.downloads_7d, m.same_count, m.likes, m.popularity,
           row_number() over (partition by r.owner_id order by m.downloads_7d desc, m.popularity desc, r.id) as per_creator
    from public.recipes r
    join public.mv_recipe_popularity m on m.recipe_id = r.id
    where r.status = 'live'
  )
  select x.public_id, x.title, x.summary, x.category, x.prompt_kind, x.price_krw, x.creator_nickname,
         p.handle::text, x.job_codes, x.tool_codes, x.filters,
         x.downloads, x.downloads_7d, x.same_count, x.likes, x.popularity
  from ranked x
  join public.profiles p on p.id = x.owner_id
  where x.per_creator = 1
  order by x.downloads_7d desc, x.popularity desc, x.id
  limit least(greatest(coalesce(p_limit, 4), 1), 12)
$$;

-- HOME-03 실시간 인기 TOP 10 (F1-3): latest hourly snapshot vs the previous one.
-- move: places gained since the previous snapshot (null when NEW). With < 100 downloads in
-- 24h the UI shows NEW / — instead of ▲▼, so move is reported as 0 for existing rows.
-- Without any snapshot yet (fresh DB) the ranking is computed live with move 0.
create or replace function public.home_rankings(p_category text default 'all')
returns table (
  rank integer,
  move integer,
  is_new boolean,
  taken_at timestamptz,
  public_id text,
  title text,
  category text,
  prompt_kind text,
  price_krw integer,
  creator_nickname text,
  filters jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cat text := coalesce(p_category, 'all');
  latest timestamptz;
  previous timestamptz;
begin
  if cat not in ('all', 'prompt', 'agent', 'skill') then
    raise exception using errcode = 'P0001', message = 'INVALID_CATEGORY';
  end if;

  select max(s.taken_at) into latest from public.ranking_snapshots s where s.category = cat;
  select max(s.taken_at) into previous from public.ranking_snapshots s
   where s.category = cat and s.taken_at < latest;

  if latest is null then
    return query
    with base as (
      select r.*, m.popularity,
             row_number() over (partition by r.owner_id order by m.popularity desc, r.id) as per_creator
      from public.recipes r
      join public.mv_recipe_popularity m on m.recipe_id = r.id
      where r.status = 'live' and (cat = 'all' or r.category = cat)
    )
    select (row_number() over (order by b.popularity desc, b.id))::integer, 0, false, now(),
           b.public_id, b.title, b.category, b.prompt_kind, b.price_krw, b.creator_nickname, b.filters
    from base b
    where b.per_creator <= 2
    order by b.popularity desc, b.id
    limit 10;
    return;
  end if;

  return query
  with cur as (
    select s.rank, s.recipe_id from public.ranking_snapshots s
    where s.category = cat and s.taken_at = latest
  ),
  prev as (
    select s.rank, s.recipe_id from public.ranking_snapshots s
    where s.category = cat and s.taken_at = previous
  ),
  live as (
    select c.rank as snap_rank, c.recipe_id, p.rank as prev_rank, r.*, coalesce(m.downloads_24h, 0) as d24
    from cur c
    join public.recipes r on r.id = c.recipe_id and r.status = 'live'
    left join prev p on p.recipe_id = c.recipe_id
    left join public.mv_recipe_popularity m on m.recipe_id = c.recipe_id
  )
  select (row_number() over (order by l.snap_rank))::integer,
         case when previous is null or l.prev_rank is null then null
              when l.d24 < 100 then 0
              else (l.prev_rank - l.snap_rank)::integer end,
         previous is not null and l.prev_rank is null,
         latest,
         l.public_id, l.title, l.category, l.prompt_kind, l.price_krw, l.creator_nickname, l.filters
  from live l
  order by l.snap_rank;
end;
$$;

-- HOME-05 인기 크리에이터: creators with live recipes, by followers then total popularity.
create or replace function public.home_creators(p_limit integer default 8)
returns table (
  handle text,
  nickname text,
  bio text,
  avatar_url text,
  is_staff boolean,
  followers integer,
  top_title text,
  top_public_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  with live as (
    select r.owner_id, r.title, r.public_id, coalesce(m.popularity, 0) as popularity,
           row_number() over (partition by r.owner_id order by coalesce(m.popularity, 0) desc, r.id) as rn
    from public.recipes r
    left join public.mv_recipe_popularity m on m.recipe_id = r.id
    where r.status = 'live'
  ),
  creators as (
    select l.owner_id, sum(l.popularity) as total_popularity
    from live l group by l.owner_id
  )
  select p.handle::text, p.nickname, p.bio, p.avatar_url, p.role = 'staff',
         (select count(*) from public.follows f where f.followee_id = p.id)::integer,
         t.title, t.public_id
  from creators c
  join public.profiles p on p.id = c.owner_id and p.deleted_at is null
  join live t on t.owner_id = c.owner_id and t.rn = 1
  order by 6 desc, c.total_popularity desc, p.id
  limit least(greatest(coalesce(p_limit, 8), 1), 16)
$$;

-- HOME-04 지금 뜨는 결과물: visible gallery posts on live recipes, most liked first.
create or replace function public.home_gallery(p_limit integer default 16)
returns table (
  id uuid,
  title text,
  kind text,
  ratio text,
  media_kind text,
  generated_here boolean,
  author_nickname text,
  recipe_title text,
  recipe_public_id text,
  likes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.title, g.kind, g.ratio, ma.kind, g.generated_here, a.nickname, r.title, r.public_id,
         (select count(*) from public.post_likes pl where pl.post_id = g.id)::integer as likes
  from public.gallery_posts g
  join public.recipes r on r.id = g.recipe_id and r.status = 'live'
  join public.profiles a on a.id = g.author_id
  left join public.media_assets ma on ma.id = g.media_id
  where g.status = 'visible'
  order by likes desc, g.created_at desc, g.id
  limit least(greatest(coalesce(p_limit, 16), 1), 32)
$$;

revoke execute on function public.home_weekly(integer) from public;
revoke execute on function public.home_rankings(text) from public;
revoke execute on function public.home_creators(integer) from public;
revoke execute on function public.home_gallery(integer) from public;
grant execute on function public.home_weekly(integer) to anon, authenticated;
grant execute on function public.home_rankings(text) to anon, authenticated;
grant execute on function public.home_creators(integer) to anon, authenticated;
grant execute on function public.home_gallery(integer) to anon, authenticated;
