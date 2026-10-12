-- 1) RLS on: authenticated role, policy = public rows only. Does the pgroonga index still answer?
alter table public.spike_recipes enable row level security;
create policy spike_public_read on public.spike_recipes for select to authenticated using (is_public);
grant select on public.spike_recipes to authenticated;
grant execute on function public.spike_search_doc(text, text, text[], text) to authenticated;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
\echo '== RLS: counts visible to authenticated (정리: 4010 public expected)'
select count(*) from public.spike_recipes r
where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ pgroonga_query_escape('정리');
\echo '== RLS: plan'
explain (analyze, costs off, summary on)
select id from public.spike_recipes r
where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ pgroonga_query_escape('엑셀')
limit 20;
rollback;

-- 2) Write cost: 1,000 inserts with the index in place
\timing on
\echo '== insert 1000 rows'
insert into public.spike_recipes (title, summary, tags, creator_nickname, synthetic)
select '추가 레시피 ' || g, '쓰기 비용 측정용 ' || g, '{측정}', '측정봇', true from generate_series(1, 1000) g;
\echo '== update 1000 titles'
update public.spike_recipes set title = title || ' 수정' where creator_nickname = '측정봇';
\timing off
\echo '== new rows searchable immediately'
select count(*) from public.spike_recipes r
where public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ pgroonga_query_escape('측정봇');
