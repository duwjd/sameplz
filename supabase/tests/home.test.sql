-- HOME RPCs (F1-1~F1-3): weekly max 1 per creator and live only, TOP 10 move / NEW from
-- snapshots with the < 100 downloads rule, fresh-DB fallback, creators, gallery, anon access.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- HOME-02
set local role anon;
select is_empty($$ select creator_nickname from public.home_weekly(12) group by 1 having count(*) > 1 $$,
          'F1-2 HOME-02: at most one recipe per creator');
select ok((select count(*) from public.home_weekly()) <= 4, 'HOME-02: four cards by default');
reset role;

update public.recipes set status = 'stopped' where public_id = 'rdetailcopy';
select private.refresh_popularity();
set local role anon;
select is((select count(*) from public.home_weekly(12) where public_id = 'rdetailcopy'), 0::bigint,
          'F1-2 HOME-02: stopped recipe drops out after refresh');
select is((select count(*) from public.home_rankings('all') where public_id = 'rdetailcopy'), 0::bigint,
          'F1-2 HOME-03: stopped recipe drops out of TOP 10');
reset role;

-- HOME-03 with two snapshots: a fresh entry is NEW, a mover gets ▲▼ only with ≥ 100 downloads / 24h.
delete from public.ranking_snapshots;
insert into public.ranking_snapshots (taken_at, category, rank, recipe_id)
select now() - interval '1 hour', 'all', 1, id from public.recipes where public_id = 'rlinkedin01'
union all
select now() - interval '1 hour', 'all', 2, id from public.recipes where public_id = 'rtranslate1'
union all
select now(), 'all', 1, id from public.recipes where public_id = 'rtranslate1'
union all
select now(), 'all', 2, id from public.recipes where public_id = 'rlinkedin01'
union all
select now(), 'all', 3, id from public.recipes where public_id = 'rexcelfx001';

set local role anon;
select is((select is_new from public.home_rankings('all') where public_id = 'rexcelfx001'), true,
          'F1-3 entry missing from the previous snapshot is NEW');
select is((select move from public.home_rankings('all') where public_id = 'rtranslate1'), 0,
          'F1-3 under 100 downloads in 24h: no ▲▼ (move 0 → —)');
select is((select count(*) from public.home_rankings('all')), 3::bigint, 'HOME-03: rows come from the latest snapshot');
reset role;

-- Push 24h downloads over 100 for rtranslate1 to see a real ▲1.
insert into auth.users (id, aud, role, email)
select gen_random_uuid(), 'authenticated', 'authenticated', 'bulk' || g || '@sameplz.test' from generate_series(1, 100) g;
insert into public.entitlements (user_id, recipe_id, version_id, source)
select p.id, r.id, r.current_version_id, 'free'
from public.profiles p, public.recipes r
where r.public_id = 'rtranslate1' and p.handle like 'user_%'
on conflict do nothing;
select private.refresh_popularity();
set local role anon;
select is((select move from public.home_rankings('all') where public_id = 'rtranslate1'), 1,
          'F1-3 with ≥ 100 downloads in 24h: ▲1 against the previous hour');
reset role;

-- Fresh DB: no snapshots → computed live, max 2 per creator.
delete from public.ranking_snapshots;
set local role anon;
select ok((select count(*) from public.home_rankings('prompt')) between 1 and 10, 'HOME-03: works before the first snapshot');
select is_empty($$ select creator_nickname from public.home_rankings('all') group by 1 having count(*) > 2 $$,
          'F1-3 fallback ranking: at most two per creator');
select throws_ok($$ select * from public.home_rankings('nope') $$, 'P0001', 'INVALID_CATEGORY', 'HOME-03: unknown tab rejected');

-- HOME-04 / HOME-05
select ok((select count(*) from public.home_creators()) >= 1, 'HOME-05: creators with live recipes');
select is_empty($$ select 1 from public.home_gallery(32) g
                   join public.recipes r on r.public_id = g.recipe_public_id where r.status <> 'live' $$,
          'HOME-04: gallery shows posts of live recipes only');
reset role;

select * from finish();
rollback;
