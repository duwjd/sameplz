-- Search (D15, F1-4~F1-6): two-letter Korean hits, nickname hits, live only, short query, hostile
-- input, filters, per-category counts, logging, anon access.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

set local role anon;
select ok((select count(*) from public.search_recipes('세무')) >= 1, 'F1-5 "세무" hits (summary/tags)');
select ok((select count(*) from public.search_recipes('보고')) >= 1, 'F1-5 "보고" hits (title)');
select ok((select count(*) from public.search_recipes('엑셀')) >= 1, 'F1-5 "엑셀" hits (title/tags)');
select is((select count(*) from public.search_recipes('상세장인')), 2::bigint,
          'F1-5 nickname hits, stopped recipe of the same creator excluded');
select is((select count(*) from public.search_recipes('쿠팡 로켓')), 0::bigint, 'F1-4 stopped recipe not searchable');
select is((select count(*) from public.search_recipes('채용공고')), 0::bigint, 'F1-4 in_review recipe not searchable');
select is((select count(*) from public.search_recipes('글')), 0::bigint, 'one-character query returns nothing (UI shows popular terms)');
select lives_ok($$ select * from public.search_recipes('-세무 OR ("엑셀') $$, 'hostile query syntax does not error');
select throws_ok($$ select * from public.search_recipes('세무', p_sort => 'price') $$, 'P0001', 'INVALID_SORT',
          'unknown sort rejected');
select is((select count(*) from public.search_recipes(null, p_category => 'agent')), 2::bigint,
          'browse mode: category filter (live agents only)');
select is((select count(*) from public.search_recipes(null, p_job => 'tax')), 1::bigint, 'browse mode: job filter');
select is((select total from public.search_recipe_counts('상세페이지') where category = 'prompt'), 3::bigint,
          'F1-6 per-category counts for zero-result chips');
select is((select max(total_count) from public.search_recipes(null, p_limit => 5)), 16::bigint,
          'total_count reports all live matches beyond the page');
reset role;

select ok((select count(*) from public.search_queries where query_norm = '세무') >= 1, 'search queries are logged');
select ok(has_function_privilege('anon', 'public.search_recipes(text, text, text, text, text, integer, integer)', 'execute'),
          'guests can search (SCN 10 runs as guest)');

select * from finish();
rollback;
