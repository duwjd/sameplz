-- Detail (F1-7, F2-1~F2-5): public payload hides non-public recipes and originals, similar recipes,
-- viewer state, free claim (idempotent, refusals), share-link clicks (F2-3, counts only).
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

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

-- ---------------------------------------------------------------- public payload
select pg_temp.login_anon();
select is(public.get_recipe_public('rlinkedin01') ->> 'status', 'live', 'F2-1 live recipe detail is public');
select is(public.get_recipe_public('rinreview01'), null, 'F1-7 in_review recipe is 404');
select is(public.get_recipe_public('rprivate001'), null, 'F1-7 private recipe is 404');
select is(public.get_recipe_public('rrejected01'), null, 'F1-7 rejected recipe is 404');
select is(public.get_recipe_public('zz99'), null, 'F1-7 missing recipe is 404');
select is(public.get_recipe_public('rstopped001') ->> 'stopped_reason', 'creator_request', 'F2-4 stopped recipe shows its reason');
select ok(not exists (select 1 from public.recipes r where public.get_recipe_public(r.public_id)::text like '%SAMEPLZ-SECRET%'),
          'F2-2 no original text in any public payload');
select is(jsonb_array_length(public.get_recipe_public('rtranslate1') -> 'files'), 3, 'SKL-05 file names are listed');
select ok(not (public.get_recipe_public('rtranslate1') -> 'files' -> 0 ? 'path')
          and public.get_recipe_public('rtranslate1')::text not like '%seed/02/%',
          'SKL-05 storage paths are not exposed');
select is((public.get_recipe_public('rmjposter01') -> 'tools' -> 0 ->> 'has_api')::boolean, false,
          'F2-5 Midjourney-only recipe reports a tool without API');
select is(public.get_recipe_public('rtaxcheck01') -> 'version' -> 'meta' ->> 'regulated', 'tax', 'F2-6 regulated flag');

select ok((select count(*) from public.similar_recipes('rstopped001')) between 1 and 4, 'STOP-03 similar recipes');
select is((select count(*) from public.similar_recipes('rlinkedin01', 12)
           where public_id in ('rlinkedin01', 'rstopped001', 'rinreview01', 'rprivate001', 'rrejected01')),
          0::bigint, 'similar recipes: live only, never itself');

-- ---------------------------------------------------------------- viewer state
select throws_ok($$ select public.my_recipe_state('aaaaaaaa-0000-0000-0000-000000000001') $$, '42501', null,
                 'viewer state needs login');
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select isnt(public.my_recipe_state('aaaaaaaa-0000-0000-0000-000000000015') -> 'entitlement', 'null'::jsonb,
            'F2-4 holder of a stopped recipe sees the entitlement');
select is(public.my_recipe_state('aaaaaaaa-0000-0000-0000-000000000019'), null, 'F1-7 no state for others'' private recipe');
select pg_temp.login_as('00000000-0000-0000-0000-000000000002');
select is((public.my_recipe_state('aaaaaaaa-0000-0000-0000-000000000015') ->> 'is_owner')::boolean, true, 'owner flag');

-- ---------------------------------------------------------------- free claim
select pg_temp.login_anon();
select throws_ok($$ select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000001') $$, '42501', null,
                 'claim needs login');

select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select is((public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000001') ->> 'created')::boolean, true, 'F2-1 free claim');
select is((public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000001') ->> 'created')::boolean, false, 'claim is idempotent');
select is((select count(*) from public.entitlements where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint,
          'one entitlement after two claims');
select throws_ok($$ select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000015') $$, 'P0001', 'RECIPE_UNAVAILABLE',
                 'F2-4 stopped recipe cannot be claimed');
select throws_ok($$ select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000019') $$, 'P0001', 'RECIPE_UNAVAILABLE',
                 'private recipe cannot be claimed');
select pg_temp.login_as('00000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000001') $$, 'P0001', 'OWN_RECIPE',
                 'owner cannot claim own recipe');

select pg_temp.as_postgres();
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'new@sameplz.test', '{"provider":"email"}', '{"name":"새 회원"}');
update public.recipes set price_krw = 1000 where id = 'aaaaaaaa-0000-0000-0000-000000000004';
select pg_temp.login_as('00000000-0000-0000-0000-000000000099');
select throws_ok($$ select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000001') $$, 'P0001', 'SIGNUP_INCOMPLETE',
                 'F7-9 claim needs finished signup');
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000004') $$, 'P0001', 'NOT_FREE',
                 'MVP: paid recipe cannot be claimed for free');

select pg_temp.login_as('00000000-0000-0000-0000-000000000003');
select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000001', 'demo01');
select pg_temp.as_postgres();
select is((select share_link_id from public.entitlements
           where user_id = '00000000-0000-0000-0000-000000000003' and recipe_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
          'ffffffff-0000-0000-0000-000000000001'::uuid, 'F2-3 claim keeps the share link (record only)');

-- ---------------------------------------------------------------- share-link clicks (F2-3)
select pg_temp.login_anon();
select throws_ok($$ select public.record_share_click('rlinkedin01', 'demo01', repeat('c', 64)) $$, '42501', null,
                 'F2-3 clients cannot record clicks directly (server derives the visitor)');
select throws_ok($$ select count(*) from public.share_link_clicks $$, '42501', null, 'clicks are not readable by clients');
select throws_ok($$ select count(*) from public.share_links $$, '42501', null, 'share links: anon cannot read');
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select throws_ok($$ insert into public.share_links (recipe_id, creator_id, code)
                    values ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'mine01') $$,
                 '42501', null, 'share links: no client insert (W4 seller center)');

select pg_temp.as_postgres();
select is(public.record_share_click('rlinkedin01', 'demo01', repeat('a', 64)), '사진관K', 'F2-3 click returns the creator nickname');
select public.record_share_click('rlinkedin01', 'demo01', repeat('a', 64));
select public.record_share_click('rlinkedin01', 'demo01', repeat('b', 64));
select is(public.record_share_click('rcafetone01', 'demo01', repeat('a', 64)), null, 'code must belong to this recipe');
select is(public.record_share_click('rlinkedin01', 'demo01', 'not-a-hash'), null, 'malformed visitor hash is ignored');
select is((select count(*) from public.share_link_clicks where visitor_hash in (repeat('a', 64), repeat('b', 64))),
          2::bigint, 'F2-3 one click per visitor per 24h');

-- ---------------------------------------------------------------- storage + frozen files
select is((select public from storage.buckets where id = 'recipe-files'), false, 'recipe-files bucket is private');
select throws_ok($$ insert into public.recipe_version_files (version_id, filename, storage_path, size_bytes)
                    values ('bbbbbbbb-0000-0000-0000-000000000002', 'extra.md', 'x/extra.md', 10) $$,
                 'P0001', 'VERSION_FROZEN', 'approved version file set is frozen');
select throws_ok($$ insert into public.recipe_version_files (version_id, filename, storage_path, size_bytes)
                    values ('bbbbbbbb-0000-0000-0000-000000000016', '../evil', 'x/evil', 10) $$,
                 '23514', null, 'file names cannot traverse');

select * from finish();
rollback;
