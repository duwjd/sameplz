-- Access + social: entitlements (own read, no client writes), has_entitlement, gallery insert rules
-- (same_cert needs entitlement, original needs ownership), likes/follows own-only writes,
-- creator waitlist own-only, search log closed. Seed: jiwoo (…01) has recipe …03 only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

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

-- entitlements
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select is((select count(*) from public.entitlements), 1::bigint, 'entitlements: user sees only own row');
select throws_ok($$ insert into public.entitlements (user_id, recipe_id, version_id, source)
                    values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
                            'bbbbbbbb-0000-0000-0000-000000000001', 'free') $$,
          '42501', null, 'entitlements: no client insert (claim RPC only)');
select is(private.has_entitlement('aaaaaaaa-0000-0000-0000-000000000003'), true, 'has_entitlement: true for claimed recipe');
select is(private.has_entitlement('aaaaaaaa-0000-0000-0000-000000000001'), false, 'has_entitlement: false otherwise');

select pg_temp.login_anon();
select is((select count(*) from public.entitlements), 0::bigint, 'entitlements: anon sees nothing');

-- gallery
select ok((select count(*) from public.gallery_posts) > 0, 'gallery: anon sees visible posts');
select throws_ok($$ insert into public.gallery_posts (author_id, recipe_id, kind, title)
                    values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'same_cert', '익명') $$,
          '42501', null, 'gallery: anon cannot post');

select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.gallery_posts (author_id, recipe_id, kind, title)
                   values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'same_cert', '또 해 봤어요') $$,
          'F6 same_cert: allowed with entitlement');
select throws_ok($$ insert into public.gallery_posts (author_id, recipe_id, kind, title)
                    values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'same_cert', '안 받았는데') $$,
          '42501', null, 'F6 same_cert: denied without entitlement');
select throws_ok($$ insert into public.gallery_posts (author_id, recipe_id, kind, title)
                    values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'original', '내 것 아님') $$,
          '42501', null, 'gallery original: denied for non-owner');
select throws_ok($$ insert into public.gallery_posts (author_id, recipe_id, kind, title)
                    values ('00000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'same_cert', '남 이름으로') $$,
          '42501', null, 'gallery: cannot post as another user');
select throws_ok($$ insert into public.gallery_posts (author_id, recipe_id, kind, title, media_id)
                    values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'same_cert', '남의 미디어',
                            'cccccccc-0000-0000-0000-000000000004') $$,
          '42501', null, 'gallery: cannot attach another user''s media (no media IDOR)');
select throws_ok($$ insert into public.gallery_posts (author_id, recipe_id, kind, title, version_id)
                    values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'same_cert', '다른 버전',
                            'bbbbbbbb-0000-0000-0000-000000000001') $$,
          '42501', null, 'gallery: version must belong to the recipe');

select pg_temp.login_as('00000000-0000-0000-0000-000000000005');
select lives_ok($$ insert into public.gallery_posts (author_id, recipe_id, kind, title)
                   values ('00000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'original', '새 결과물') $$,
          'gallery original: allowed for recipe owner');

-- likes / follows
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.recipe_likes (user_id, recipe_id)
                   values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000013')
                   on conflict do nothing $$, 'likes: user likes a live recipe');
select throws_ok($$ insert into public.recipe_likes (user_id, recipe_id)
                    values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000016') $$,
          '42501', null, 'likes: cannot like an invisible (in_review) recipe');
select throws_ok($$ insert into public.follows (follower_id, followee_id)
                    values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003') $$,
          '42501', null, 'follows: cannot follow on behalf of another user');
select throws_ok($$ insert into public.follows (follower_id, followee_id)
                    values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001') $$,
          '23514', null, 'follows: cannot follow yourself');

-- likes on hidden posts: neither readable nor insertable
select pg_temp.as_postgres();
update public.gallery_posts set status = 'hidden' where id = 'dddddddd-0000-0000-0000-000000000004';
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select throws_ok($$ insert into public.post_likes (user_id, post_id)
                    values ('00000000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000004') $$,
          '42501', null, 'post_likes: cannot like a hidden post');

-- F7-9 gate in RLS: unfinished signup cannot write social rows even via PostgREST
select pg_temp.as_postgres();
insert into auth.users (id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', null, '{"name":"미완료회원"}');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ insert into public.follows (follower_id, followee_id)
                    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000005') $$,
          '42501', null, 'F7-9 unfinished signup cannot follow');
select throws_ok($$ insert into public.recipe_likes (user_id, recipe_id)
                    values ('00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
          '42501', null, 'F7-9 unfinished signup cannot like');
select throws_ok($$ insert into public.creator_waitlist (user_id, categories, consent_version)
                    values ('00000000-0000-0000-0000-0000000000c1', '{prompt}', 'w') $$,
          '42501', null, 'F7-9 unfinished signup cannot join the waitlist');
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');

-- creator waitlist
select lives_ok($$ insert into public.creator_waitlist (user_id, categories, consent_version)
                   values ('00000000-0000-0000-0000-000000000001', '{prompt}', 'w-2026-10') $$,
          'F5-14 waitlist: user signs up');
select pg_temp.login_as('00000000-0000-0000-0000-000000000002');
select is((select count(*) from public.creator_waitlist), 0::bigint, 'waitlist: other user cannot see the row');

select pg_temp.login_anon();
select throws_ok($$ insert into public.creator_waitlist (user_id, categories, consent_version)
                    values ('00000000-0000-0000-0000-000000000003', '{skill}', 'w') $$,
          '42501', null, 'waitlist: anon cannot sign up');
select throws_ok($$ select * from public.search_queries $$, '42501', null, 'search_queries: closed to clients');

select * from finish();
rollback;
