-- Popularity (F1-2, F1-3): live only, formula, self downloads excluded, stopped drops out after
-- refresh, TOP 10 snapshot caps (≤10 per tab, ≤2 per creator), refresh jobs not client-callable.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- The view refreshes every 5 minutes; compare against a fresh one (other runs may have added claims).
select private.refresh_popularity();

select is((select count(*) from public.mv_recipe_popularity m
           join public.recipes r on r.id = m.recipe_id where r.status <> 'live'), 0::bigint,
          'F1-2 popularity: live recipes only');

select is_empty($$ select 1 from public.mv_recipe_popularity
                   where popularity <> downloads + same_count * 4 + likes * 0.5 $$,
          'F1-2 popularity = downloads + SAME×4 + likes×0.5');

select is((select downloads from public.mv_recipe_popularity where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
          (select count(*)::integer from public.entitlements e
            where e.recipe_id = 'aaaaaaaa-0000-0000-0000-000000000001' and e.revoked_at is null
              and e.source <> 'owner' and e.user_id <> '00000000-0000-0000-0000-000000000005'),
          'F1-2 downloads exclude the owner');

update public.recipes set status = 'stopped' where id = 'aaaaaaaa-0000-0000-0000-000000000005';
select private.refresh_popularity();
select is((select count(*) from public.mv_recipe_popularity where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000005'), 0::bigint,
          'F1-2 stopped recipe leaves rankings after refresh');

select private.snapshot_rankings();
select is_empty($$ select category, taken_at from public.ranking_snapshots
                   group by category, taken_at having count(*) > 10 $$,
          'F1-3 TOP 10: at most 10 per tab');
select is_empty($$ select s.category, s.taken_at, r.owner_id from public.ranking_snapshots s
                   join public.recipes r on r.id = s.recipe_id
                   group by s.category, s.taken_at, r.owner_id having count(*) > 2 $$,
          'F1-3 TOP 10: at most 2 per creator');

set local role anon;
select throws_ok($$ select * from public.mv_recipe_popularity $$, '42501', null,
          'mv_recipe_popularity: not readable directly by clients');
reset role;

set local role authenticated;
select throws_ok($$ select private.refresh_popularity() $$, '42501', null,
          'refresh_popularity: not callable by clients');
reset role;

select * from finish();
rollback;
