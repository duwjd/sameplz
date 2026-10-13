-- W2 schema v1 · 6/6: recipe search (D15, F1-4~F1-6).
-- Search runs ONLY through these definer RPCs: PGroonga on an RLS table seq-scans (2.4s / 20k rows),
-- inside the RPC the index is used (9–19ms). Spike: docs/spikes/W1-pgroonga-korean.md.

create or replace function public.recipe_search_doc(title text, summary text, search_tags text[], nickname text)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$ select array[title, summary, array_to_string(search_tags, ' '), nickname] $$;

create index recipes_search_idx on public.recipes
  using pgroonga (public.recipe_search_doc(title, summary, search_tags, creator_nickname));

-- Market list + search. p_query null → browse (no text match, no log); 1 char → empty.
-- Sort: popular (default) | downloads | new | relevance. Live recipes only.
create or replace function public.search_recipes(
  p_query text default null,
  p_category text default null,
  p_job text default null,
  p_tool text default null,
  p_sort text default 'popular',
  p_limit integer default 20,
  p_offset integer default 0
)
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
  likes integer,
  popularity numeric,
  published_at timestamptz,
  score double precision,
  total_count bigint
)
language plpgsql
volatile
security definer
set search_path = extensions, public  -- D15 exception: pgroonga_condition() fails under ''
as $$
declare
  q text := nullif(btrim(left(coalesce(p_query, ''), 100)), '');
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  off integer := greatest(coalesce(p_offset, 0), 0);
  srt text := coalesce(p_sort, 'popular');
  found_total bigint := 0;
begin
  if srt not in ('popular', 'downloads', 'new', 'relevance') then
    raise exception using errcode = 'P0001', message = 'INVALID_SORT';
  end if;
  if p_category is not null and p_category not in ('prompt', 'agent', 'skill') then
    raise exception using errcode = 'P0001', message = 'INVALID_CATEGORY';
  end if;
  if q is not null and char_length(q) < 2 then
    return;  -- UI shows popular search terms instead (F1-6)
  end if;

  return query
  with hits as (
    select r.*,
           case when q is null then 0::double precision
                else extensions.pgroonga_score(r.tableoid, r.ctid) end as s
    from public.recipes r
    where r.status = 'live'
      and (q is null
           or public.recipe_search_doc(r.title, r.summary, r.search_tags, r.creator_nickname)
              operator(extensions.&@~)
              extensions.pgroonga_condition(extensions.pgroonga_query_escape(q), weights => array[10, 1, 3, 2]))
      and (p_category is null or r.category = p_category)
      and (p_job is null or p_job = any (r.job_codes))
      and (p_tool is null or p_tool = any (r.tool_codes))
  )
  select h.public_id, h.title, h.summary, h.category, h.prompt_kind, h.price_krw,
         h.creator_nickname, p.handle::text, h.job_codes, h.tool_codes, h.filters,
         coalesce(m.downloads, 0), coalesce(m.same_count, 0), coalesce(m.likes, 0),
         coalesce(m.popularity, 0::numeric), h.published_at, h.s,
         count(*) over ()
  from hits h
  join public.profiles p on p.id = h.owner_id
  left join public.mv_recipe_popularity m on m.recipe_id = h.id
  order by
    case when srt = 'relevance' then h.s end desc nulls last,
    case when srt = 'downloads' then coalesce(m.downloads, 0) end desc nulls last,
    case when srt = 'new' then h.published_at end desc nulls last,
    coalesce(m.popularity, 0) desc,
    h.s desc,
    h.published_at desc nulls last,
    h.id
  limit lim offset off;

  if q is not null and off = 0 then
    get diagnostics found_total = row_count;
    insert into public.search_queries (query_norm, result_count, user_id)
    values (lower(q), found_total, auth.uid());
  end if;
end;
$$;

revoke execute on function public.search_recipes(text, text, text, text, text, integer, integer) from public;
grant execute on function public.search_recipes(text, text, text, text, text, integer, integer) to anon, authenticated;

-- Per-category hit counts for zero-result chips (F1-6: 「스킬에 1개」, 「마켓 전체에 N개」).
create or replace function public.search_recipe_counts(
  p_query text default null,
  p_job text default null,
  p_tool text default null
)
returns table (category text, total bigint)
language sql
stable
security definer
set search_path = extensions, public  -- D15 exception
as $$
  with q as (select nullif(btrim(left(coalesce(p_query, ''), 100)), '') as v)
  select r.category, count(*)
  from public.recipes r, q
  where r.status = 'live'
    and (q.v is null or char_length(q.v) >= 2)
    and (q.v is null
         or public.recipe_search_doc(r.title, r.summary, r.search_tags, r.creator_nickname)
            operator(extensions.&@~)
            extensions.pgroonga_condition(extensions.pgroonga_query_escape(q.v), weights => array[10, 1, 3, 2]))
    and (p_job is null or p_job = any (r.job_codes))
    and (p_tool is null or p_tool = any (r.tool_codes))
  group by r.category
$$;

revoke execute on function public.search_recipe_counts(text, text, text) from public;
grant execute on function public.search_recipe_counts(text, text, text) to anon, authenticated;
