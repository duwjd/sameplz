-- Catalog: recipe visibility (live/stopped public, in_review owner only), no client writes,
-- versions, hidden originals (0 policies), frozen approved versions, media, collections, banners.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

create or replace function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create or replace function pg_temp.login_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;

-- seed: 15 live, 1 stopped (…15, owner 02), 1 in_review (…16, owner 03)
select pg_temp.login_anon();
select is((select count(*) from public.recipes), 16::bigint, 'recipes: anon sees live + stopped only');
select is((select count(*) from public.recipes where id = 'aaaaaaaa-0000-0000-0000-000000000016'), 0::bigint,
          'recipes: anon cannot see in_review (404 semantics)');
select throws_ok($$ insert into public.recipes (owner_id, category, title, job_codes)
                    values ('00000000-0000-0000-0000-000000000001', 'skill', '익명 레시피', '{office}') $$,
          '42501', null, 'recipes: anon cannot insert');

select pg_temp.login_as('00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.recipes where id = 'aaaaaaaa-0000-0000-0000-000000000016'), 1::bigint,
          'recipes: owner sees own in_review recipe');
select is((select count(*) from public.recipe_versions where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000016'), 1::bigint,
          'recipe_versions: owner sees own pending version');
update public.recipes set title = '남의 레시피 수정' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select throws_ok($$ insert into public.recipes (owner_id, category, title, job_codes)
                    values ('00000000-0000-0000-0000-000000000003', 'skill', '직접 올리기', '{office}') $$,
          '42501', null, 'recipes: no client insert even for self (upload RPC only)');

select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select is((select count(*) from public.recipes where id = 'aaaaaaaa-0000-0000-0000-000000000016'), 0::bigint,
          'recipes: other user cannot see in_review');
select is((select count(*) from public.recipe_versions where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000016'), 0::bigint,
          'recipe_versions: other user cannot see pending version');

select pg_temp.as_postgres();
select is((select title from public.recipes where id = 'aaaaaaaa-0000-0000-0000-000000000001'), '셀카 → 링크드인 프로필 사진',
          'recipes: user update of another recipe changes nothing');

select pg_temp.login_anon();
select is((select count(*) from public.recipe_versions where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint,
          'recipe_versions: anon sees approved version of live recipe');

-- hidden originals
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'recipe_version_secrets'), 0::bigint,
          'secrets: RLS on with zero policies');
select throws_ok($$ select * from public.recipe_version_secrets $$, '42501', null, 'secrets: anon cannot select');
select pg_temp.login_as('00000000-0000-0000-0000-000000000005');
select throws_ok($$ select * from public.recipe_version_secrets $$, '42501', null, 'secrets: even the owner cannot select directly');

-- frozen approved versions
select pg_temp.as_postgres();
select throws_ok($$ update public.recipe_versions set changelog = '몰래 수정' where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
          'P0001', 'VERSION_FROZEN', 'recipe_versions: approved content cannot change');
select throws_ok($$ update public.recipe_version_secrets set prompt_body = 'x' where version_id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
          'P0001', 'VERSION_FROZEN', 'secrets: approved original cannot change');
select throws_ok($$ insert into public.recipes (owner_id, category, title, job_codes)
                    values ('00000000-0000-0000-0000-000000000005', 'skill', '잘못된 직무', '{nope}') $$,
          '23514', 'UNKNOWN_JOB_CODE', 'recipes: job_codes must exist in jobs');

-- creator_nickname follows profile nickname (search doc)
update public.profiles set nickname = '사진관케이' where id = '00000000-0000-0000-0000-000000000005';
select is((select creator_nickname from public.recipes where id = 'aaaaaaaa-0000-0000-0000-000000000001'), '사진관케이',
          'recipes: creator_nickname synced from profile');

-- media / collections / banners (public reads)
select pg_temp.login_anon();
select is((select count(*) from public.media_assets where id = 'cccccccc-0000-0000-0000-000000000001'), 1::bigint,
          'media: anon sees media of a live recipe');
select is((select count(*) from public.banners) + (select count(*) from public.collection_items), 8::bigint,
          'banners (4 active) + live collection items (4) readable by anon');

select * from finish();
rollback;
