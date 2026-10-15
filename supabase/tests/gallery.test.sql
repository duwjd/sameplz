-- W6 GAL: SAME 인증 posting (server), feed, fork origin, reports, blank prompt text.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- jiwoo (…01) holds …03 (live). Upload objects for jiwoo.
insert into storage.objects (bucket_id, name, owner_id) values
  ('recipe-media-draft', '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000ga101.png', '00000000-0000-0000-0000-000000000001'),
  ('recipe-media-draft', '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000ga102.png', '00000000-0000-0000-0000-000000000001');
create temp table r (k text primary key, v jsonb);

insert into r select 'ok', public.post_same_cert('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000ga101.png', 'image', '1/1', '결과', '따라 해 봤어요', null, 'visible');
select is((select v ->> 'ok' from r where k = 'ok'), 'true', 'F6-1 a holder posts a SAME 인증 through the server');
select is((select g.kind || '/' || g.status || '/' || g.generated_here from public.gallery_posts g
            where g.id = (select (v ->> 'post_id')::uuid from r where k = 'ok')), 'same_cert/visible/false',
          'F6-1 it is a visible same_cert, not generated here');
select is((select id from public.gallery_feed(null, null, null, 1)), (select (v ->> 'post_id')::uuid from r where k = 'ok'),
          'GAL-01 a new SAME 인증 lands on top of the gallery');
select is(public.post_same_cert('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000ga102.png', 'image', '1/1', '', '안 받은 레시피', null, 'visible') ->> 'reason',
  'NOT_ENTITLED', 'F6-1 no entitlement, no SAME 인증');
select is(public.post_same_cert('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002/00000000-0000-0000-0000-0000000ga199.png', 'image', '1/1', '', '남의 이미지', null, 'visible') ->> 'reason',
  'MEDIA_NOT_UPLOADED', 'F6-1 only the user''s own upload can be posted');
select is(public.post_same_cert('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000ga102.png', 'image', '1/1', '', '남의 플레이 결과',
  gen_random_uuid(), 'visible') ->> 'reason', 'NOT_ENTITLED', 'F4-11 「여기서 생성」 needs the user''s own result of this recipe');
select throws_ok($$ select public.post_same_cert('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000ga102.png', 'image', '1/1', '', 'x', null, 'hidden') $$,
  'P0001', 'INVALID_STATUS', 'F6-3 the server only posts visible or pending_review');

-- Pending review (moderation unavailable) is hidden from the feed.
insert into r select 'pend', public.post_same_cert('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000ga102.png', 'image', '1/1', '', '검토 중', null, 'pending_review');
select ok(not exists (select 1 from public.gallery_feed(null, null, null, 48) f where f.id = (select (v ->> 'post_id')::uuid from r where k = 'pend')),
          'F6-3 a post under review is hidden');

-- Feed filters and cursor.
select ok((select bool_and(kind = 'same_cert') from public.gallery_feed('same_cert', null, null, 48)), 'GAL EX SAME 인증만 보기');
select ok((select count(*) from public.gallery_feed(null,
            (select created_at from public.gallery_feed(null, null, null, 1)),
            (select id from public.gallery_feed(null, null, null, 1)), 48)) =
          (select count(*) from public.gallery_feed(null, null, null, 48)) - 1,
          'GAL-01 the cursor continues after the last row');
select ok((select bool_and(recipe_id = 'aaaaaaaa-0000-0000-0000-000000000003')
             from public.gallery_feed(null, null, null, 48, 'aaaaaaaa-0000-0000-0000-000000000003')),
          'GAL a recipe''s own results for the detail section');

-- Fork origin.
insert into public.recipes (id, public_id, owner_id, category, prompt_kind, title, summary, status, creator_nickname, job_codes)
values ('00000000-0000-0000-0000-0000000f0001', 'rforktest1', '00000000-0000-0000-0000-000000000001', 'prompt', 'image',
        '포크 시험', '요약', 'live', '지우', array['commerce']);
select ok(public.set_recipe_fork('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000f0001',
          'aaaaaaaa-0000-0000-0000-000000000004'), 'F6-2 a new recipe remembers the recipe it was forked from');
select is((select forked_from_version_id from public.recipes where id = '00000000-0000-0000-0000-0000000f0001'),
          (select current_version_id from public.recipes where id = 'aaaaaaaa-0000-0000-0000-000000000004'),
          'F6-2 the origin version is the one current at fork time');
select ok(not public.set_recipe_fork('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000f0001',
          'aaaaaaaa-0000-0000-0000-000000000005'), 'F6-2 the origin is set once');
update public.recipes set fork_allowed = false where id = 'aaaaaaaa-0000-0000-0000-000000000006';
update public.recipes set forked_from_recipe_id = null, forked_from_version_id = null where id = '00000000-0000-0000-0000-0000000f0001';
select ok(not public.set_recipe_fork('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000f0001',
          'aaaaaaaa-0000-0000-0000-000000000006'), 'F6-2 a recipe that blocks forks cannot be an origin');

-- Reports.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(public.create_report('recipe', 'aaaaaaaa-0000-0000-0000-000000000001', 'misleading', '설명과 달라요') ->> 'ok', 'true',
          'F6-3 a member reports a recipe');
select is(public.create_report('recipe', 'aaaaaaaa-0000-0000-0000-000000000001', 'misleading', '') ->> 'reason', 'ALREADY_REPORTED',
          'F6-3 one open report per target');
select is(public.create_report('recipe', 'aaaaaaaa-0000-0000-0000-000000000019', 'rights', '') ->> 'reason', 'NOT_FOUND',
          'F6-3 a private recipe cannot be reported (and its existence is not revealed)');
select is(public.create_report('post', gen_random_uuid(), 'nonsense', '') ->> 'reason', 'INVALID_INPUT', 'F6-3 the reason is one of four');
select is((select count(*)::int from public.reports), 1, 'ACTV-04 a member sees only their own reports');
select throws_ok($$ insert into public.gallery_posts (author_id, recipe_id, kind, title)
                    values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'same_cert', 'x') $$,
                 '42501', null, 'F6-1 SCN 5 a direct API insert is refused by RLS');
reset role;

-- Blank prompt text: own blank runs only.
insert into public.play_runs (id, user_id, mode, client_request_id)
values ('00000000-0000-0000-0000-0000000fb001', '00000000-0000-0000-0000-000000000001', 'blank', gen_random_uuid());
select ok(public.set_run_prompt_text('00000000-0000-0000-0000-0000000fb001', '00000000-0000-0000-0000-000000000001', '내 프롬프트')
          and public.set_run_prompt_text('00000000-0000-0000-0000-0000000fb001', '00000000-0000-0000-0000-000000000002', 'x') is null,
          'F4-11 the blank prompt is kept for its owner only');

-- prompt_text is server-only; deleted authors leave the feed; action limits.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$ select prompt_text from public.play_runs $$, '42501', null,
                 'F4-11 the kept blank prompt is not client-readable');
reset role;
-- SCN 12 (W6 NOTI-my): a withdrawn member's SAME 인증 stays, shown under the anonymized nickname.
update public.profiles set deleted_at = now(), nickname = '탈퇴한 회원' where id = '00000000-0000-0000-0000-000000000001';
select ok(exists (select 1 from public.gallery_feed(null, null, null, 48) f
                   where f.author_id is null and f.author_handle is null and f.author_nickname = '탈퇴한 회원'),
          'SCN 12 posts of a withdrawn member stay as 「탈퇴한 회원」 without the old id or handle');
update public.profiles set deleted_at = null where id = '00000000-0000-0000-0000-000000000001';
select is((select count(*)::int from generate_series(1, 10) g
            where public.hit_gallery_limit('00000000-0000-0000-0000-000000000001', 'draft')), 10,
          'GAL ten drafts from results per hour');
select ok(not public.hit_gallery_limit('00000000-0000-0000-0000-000000000001', 'draft'),
          'GAL the 11th draft in an hour is refused before any copy');

select * from finish();
rollback;
