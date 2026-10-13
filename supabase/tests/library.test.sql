-- Library (LIB, F3-5, F3-8): own received recipes only, open original (first open recorded once),
-- per-entitlement update with history, file download path for holders of that exact version.
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

-- jiwoo: 감성 카페 메뉴 사진 톤 (v1, v2 out) + 쿠팡 로켓 상세 문구 (stopped)
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select is((select count(*) from public.my_library()), 2::bigint, 'LIB lists received recipes');
select ok((select update_available and version_no = 1 and latest_version_no = 2
           from public.my_library() where public_id = 'rcafetone01'), 'LIB-01 update available on v1');
select is((select status from public.my_library() where public_id = 'rstopped001'), 'stopped', 'LIB-02 stopped recipe stays');

select pg_temp.login_as('00000000-0000-0000-0000-000000000005');
select is((select count(*) from public.my_library() l join public.recipes r on r.id = l.recipe_id
           where r.owner_id = '00000000-0000-0000-0000-000000000005'), 0::bigint, 'own recipes are not in the library');

-- open original
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
create temp table ent on commit drop as
  select id, recipe_id from public.entitlements where user_id = '00000000-0000-0000-0000-000000000001';
grant select on ent to anon, authenticated;
select ok((select (o ->> 'first_open')::boolean and o ->> 'prompt_body' like 'SAMEPLZ-SECRET-SAMPLE-03 %'
           from public.open_original((select id from ent where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000003')) o),
          'F3-5 first open returns the pinned original');
select is((select opened_at is not null from public.my_library() where public_id = 'rcafetone01'), true, 'F3-5 opened_at recorded');
select is((public.open_original((select id from ent where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000003')) ->> 'first_open')::boolean,
          false, 'F3-5 second open is not a first open');
select ok(public.open_original((select id from ent where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000015')) ->> 'prompt_body' is not null,
          'F2-4 stopped recipe original still opens for the holder');

select pg_temp.login_as('00000000-0000-0000-0000-000000000002');
select throws_ok(format('select public.open_original(%L)', (select id from ent where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000003')),
                 'P0001', 'NOT_FOUND', 'someone else''s entitlement cannot be opened');
select pg_temp.login_anon();
select throws_ok(format('select public.open_original(%L)', (select id from ent where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000003')),
                 '42501', null, 'anon cannot open');

-- apply update (F3-8)
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select is((public.apply_update((select id from ent where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000003')) ->> 'updated')::boolean,
          true, 'F3-8 apply_update moves to the latest version');
select ok((select not update_available and version_no = 2 from public.my_library() where public_id = 'rcafetone01'),
          'F3-8 row is on v2');
select ok(public.open_original((select id from ent where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000003')) ->> 'prompt_body' like '%03v2%',
          'F3-8 opens the new version');
select is((public.apply_update((select id from ent where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000003')) ->> 'updated')::boolean,
          false, 'apply_update is a no-op when current');
select is((select count(*) from public.entitlement_version_history), 1::bigint, 'F3-8 history row');
select pg_temp.login_as('00000000-0000-0000-0000-000000000002');
select is((select count(*) from public.entitlement_version_history), 0::bigint, 'history is private');

-- files
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000002');
select is((select storage_path from public.file_for_download('bbbbbbbb-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001')),
          'seed/02/SKILL.md', 'F3-5 holder gets the file path');
select is((select count(*) from public.file_for_download('bbbbbbbb-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0000-000000000004')),
          0::bigint, 'no file path without the entitlement');
select throws_ok($$ select count(*) from public.recipe_version_files $$, '42501', null, 'file rows are not readable by clients');

select * from finish();
rollback;
