-- 1) Hostile / syntax-looking user input: raw &@~ vs escaped &@~ vs &@ (no query syntax)
\echo '== safety'
create or replace function pg_temp.try(q text, mode text) returns text language plpgsql as $$
declare n int;
begin
  if mode = 'raw' then
    select count(*) into n from public.spike_recipes r
      where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ q;
  elsif mode = 'escaped' then
    select count(*) into n from public.spike_recipes r
      where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ pgroonga_query_escape(q);
  else
    select count(*) into n from public.spike_recipes r
      where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@ q;
  end if;
  return n::text;
exception when others then
  return 'ERROR: ' || left(sqlerrm, 60);
end $$;

select q, pg_temp.try(q, 'raw') as raw_query_syntax, pg_temp.try(q, 'escaped') as escaped, pg_temp.try(q, '&@') as match_op
from (values ('세무 OR 엑셀'), ('-세무'), ('"'), ('('), ('보고)'), ('title:@x'), ('*'), (''), ('   '), ('엑셀 -수식'), ('\')) v(q);

-- 2) Synthetic rows must never match the F1-5 words (no false positives from bigrams across words)
\echo '== synthetic false positives'
select term, count(*) from (values ('보고'), ('세무'), ('엑셀')) t(term)
join public.spike_recipes r
  on public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ pgroonga_query_escape(t.term)
where r.synthetic group by term;

-- 3) Ranking: weights title 10, summary 1, tags 3, nickname 2
\echo '== score, weights [10,1,3,2] for 보고'
select r.title, r.creator_nickname, pgroonga_score(r.tableoid, r.ctid) as score
from public.spike_recipes r
where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname)
      &@~ pgroonga_condition('보고', weights => array[10, 1, 3, 2])
order by score desc, r.id;

\echo '== score, no weights for 보고'
select r.title, pgroonga_score(r.tableoid, r.ctid) as score
from public.spike_recipes r
where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ '보고'
order by score desc, r.id;

-- 4) Plan + timing on 20k rows (planner free to choose)
\echo '== explain 엑셀 (rare term)'
explain (analyze, buffers, costs off, summary on)
select id, title from public.spike_recipes r
where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ pgroonga_query_escape('엑셀')
  and is_public
order by pgroonga_score(r.tableoid, r.ctid) desc limit 20;

\echo '== explain 정리 (common term, many synthetic hits)'
explain (analyze, buffers, costs off, summary on)
select id, title from public.spike_recipes r
where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ pgroonga_query_escape('정리')
  and is_public
order by pgroonga_score(r.tableoid, r.ctid) desc limit 20;
