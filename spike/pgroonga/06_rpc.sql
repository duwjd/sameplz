-- Fix candidate for the RLS seq-scan: search through a SECURITY DEFINER RPC that applies the
-- visibility rule itself (is_public), so the planner may use the pgroonga index.
create schema if not exists spike_private;

create or replace function spike_private.search_ids(p_query text, p_limit int default 20)
returns table (id bigint, score double precision)
language sql stable security definer set search_path = public  -- pgroonga_condition() resolves its type unqualified; '' breaks it
as $$
  select r.id, public.pgroonga_score(r.tableoid, r.ctid)
  from public.spike_recipes r
  where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname)
          operator(public.&@~) public.pgroonga_condition(public.pgroonga_query_escape(p_query), weights => array[10, 1, 3, 2])
    and r.is_public
  order by 2 desc, r.id
  limit least(greatest(p_limit, 1), 50)
$$;

revoke execute on function spike_private.search_ids(text, int) from public, anon;
grant usage on schema spike_private to authenticated;
grant execute on function spike_private.search_ids(text, int) to authenticated;

begin;
set local role authenticated;
\timing on
\echo '== RPC as authenticated: 엑셀'
select * from spike_private.search_ids('엑셀');
\echo '== RPC as authenticated: 정리 (4010 hits, top 20)'
select count(*) from spike_private.search_ids('정리');
\echo '== RPC hostile input'
select count(*) from spike_private.search_ids('-세무');
select count(*) from spike_private.search_ids('');
\timing off
rollback;

\echo '== plan inside RPC body (as owner)'
explain (analyze, costs off, summary on)
select r.id from public.spike_recipes r
where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname)
        &@~ pgroonga_condition(pgroonga_query_escape('엑셀'), weights => array[10, 1, 3, 2])
  and r.is_public
limit 20;
