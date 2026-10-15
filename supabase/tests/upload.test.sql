-- Upload / review / seller dashboard (W4, F5-1~7, F5-10, F5-14, D10): server-only submit, R01,
-- failed checks never stored, storage paths verified, agents/scripts to human review, versions,
-- review decisions, visibility, share links, drafts and waitlist RLS, views.
begin;
create extension if not exists pgtap with schema extensions;
select plan(63);

create or replace function pg_temp.login_as(uid uuid, admin boolean default false) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'admin', admin)::text, true);
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

-- Creators X (b1), Y (b2) with finished signup; uploaded objects under their folders.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000b' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'upload-' || n || '@sameplz.test', '{"provider":"email"}', '{"name":"올리기테스트"}'
from generate_series(1, 2) n;
update public.profiles set terms_version = '2026-10-v1', terms_accepted_at = now(), adult_confirmed_at = now()
 where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
insert into storage.objects (bucket_id, name)
select 'recipe-media', '00000000-0000-0000-0000-0000000000b1/m' || n || '.png' from generate_series(1, 9) n;
insert into storage.objects (bucket_id, name) values
  ('recipe-media', '00000000-0000-0000-0000-0000000000b2/y1.png'),
  ('recipe-files', '00000000-0000-0000-0000-0000000000b1/skill/SKILL.md');

create or replace function pg_temp.payload(p_category text, p_media text, p_extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object(
    'category', p_category, 'prompt_kind', case when p_category = 'prompt' then 'image' end,
    'title', '테스트 레시피 ' || p_category, 'summary', '요약', 'search_tags', jsonb_build_array('테스트'),
    'job_codes', jsonb_build_array('design'), 'tool_codes', jsonb_build_array('chatgpt'),
    'visibility', 'public', 'public_meta', '{"variables":[{"name":"제품","example":"컵"}]}'::jsonb,
    'secret', jsonb_build_object('prompt_body', 'UPLOAD-SECRET [제품]'),
    'media', jsonb_build_array(jsonb_build_object('path', p_media, 'kind', 'image', 'ratio', '1/1', 'alt', '결과')),
    'checks', jsonb_build_array(jsonb_build_object('layer', 1, 'result', 'pass', 'checker', 'rules'),
                                jsonb_build_object('layer', 2, 'result', 'pass', 'checker', 'mock'))
  ) || p_extra
$$;

-- ---------------------------------------------------------------- server-only submit
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m1.png')) $$,
                 '42501', null, 'F5-3 clients cannot submit (checks run on the server)');
select pg_temp.as_postgres();

create temp table r (k text primary key, v jsonb);
grant select on r to anon, authenticated;
insert into r values ('prompt', public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                                 pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m1.png')));
select is((select v ->> 'status' from r where k = 'prompt'), 'live', 'UP-01 prompt passing checks goes live');
select isnt(public.get_recipe_public((select v ->> 'public_id' from r where k = 'prompt')), null,
            'SCN 7 the new recipe has a public detail page');
select ok((select approved_at is not null and review_status = 'approved' from public.recipe_versions
           where id = (select (v ->> 'version_id')::uuid from r where k = 'prompt')), 'version approved');
select is((select count(*) from public.recipe_version_media where version_id = (select (v ->> 'version_id')::uuid from r where k = 'prompt')),
          1::bigint, 'UP-05 result media attached');
select is((select count(*) from public.auto_checks where version_id = (select (v ->> 'version_id')::uuid from r where k = 'prompt')),
          2::bigint, 'UP-07 both check layers recorded');
select ok((select prompt_body = 'UPLOAD-SECRET [제품]' from public.recipe_version_secrets
           where version_id = (select (v ->> 'version_id')::uuid from r where k = 'prompt')), 'original stored in secrets');
select ok(public.get_recipe_public((select v ->> 'public_id' from r where k = 'prompt'))::text not like '%UPLOAD-SECRET%',
          'F2-2 original never in the public payload');

select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m2.png', '{"media": []}')) $$,
                 'P0001', 'R01', 'F5-2 R01 at least one result');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m2.png',
                      '{"checks": [{"layer": 1, "result": "fail"}]}')) $$,
                 'P0001', 'CHECK_FAILED', 'F5-3 a failed check never reaches the database');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m2.png', '{"checks": []}')) $$,
                 'P0001', 'CHECKS_MISSING', 'F5-3 layer 1 is required');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m2.png',
                      '{"checks": [{"layer": 1, "result": "pass"}]}')) $$,
                 'P0001', 'CHECKS_MISSING', 'F5-4 layer 2 is required (unavailable = review)');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m2.png',
                      '{"checks": [{"layer": 1}, {"layer": 2, "result": "pass"}]}')) $$,
                 'P0001', 'CHECK_FAILED', 'F5-3 a check without a result counts as failed');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m2.png', '{"job_codes": ["design", null]}')) $$,
                 'P0001', 'INVALID_JOB_CODES', 'null or unknown job codes are refused');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m2.png', '{"tool_codes": ["chatgpt", "chatgpt"]}')) $$,
                 'P0001', 'INVALID_TOOL_CODES', 'duplicate tool codes are refused');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m2.png', '{"search_tags": ["", "x"]}')) $$,
                 'P0001', 'INVALID_TAGS', 'empty search tags are refused');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m2.png', '{"public_meta": "str"}')) $$,
                 'P0001', 'INVALID_PAYLOAD', 'public_meta must be an object');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m2.png', '{"secret": {}}')) $$,
                 'P0001', 'ORIGINAL_REQUIRED', 'a prompt needs its prompt body');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', 'recipe-files/../00000000-0000-0000-0000-0000000000b1/skill/SKILL.md')) $$,
                 'P0001', 'MEDIA_NOT_UPLOADED', 'path tricks cannot attach files from another place');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/nope.png')) $$,
                 'P0001', 'MEDIA_NOT_UPLOADED', 'media must exist in storage');
select throws_ok($$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b2/y1.png')) $$,
                 'P0001', 'MEDIA_NOT_UPLOADED', 'someone else''s upload cannot be attached');

-- ---------------------------------------------------------------- review routing (D10)
insert into r values ('agent', public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
  pg_temp.payload('agent', '00000000-0000-0000-0000-0000000000b1/m3.png',
    '{"secret": {"agent_config": {"steps": 3}}, "tool_codes": ["claude"]}')));
select is((select v ->> 'status' from r where k = 'agent'), 'in_review', 'F5-6 agents always wait for a human');
select is((select reason from public.review_queue where recipe_id = (select (v ->> 'recipe_id')::uuid from r where k = 'agent')),
          'agent', 'F5-6 queued with reason agent');
select is(public.get_recipe_public((select v ->> 'public_id' from r where k = 'agent')), null, 'F1-7 in review stays hidden');

insert into r values ('skill', public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
  pg_temp.payload('skill', '00000000-0000-0000-0000-0000000000b1/m4.png',
    '{"has_scripts": true, "tool_codes": ["claude"], "secret": {"skill_md": "# skill"},
      "files": [{"filename": "SKILL.md", "path": "00000000-0000-0000-0000-0000000000b1/skill/SKILL.md", "size": 10}]}')));
select is((select reason from public.review_queue where recipe_id = (select (v ->> 'recipe_id')::uuid from r where k = 'skill')),
          'scripts', 'F5-5 scripted skills wait for a human');
select is((select count(*) from public.recipe_version_files where version_id = (select (v ->> 'version_id')::uuid from r where k = 'skill')),
          1::bigint, 'F5-5 skill files attached before approval');

insert into r values ('review', public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
  pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m5.png',
    '{"checks": [{"layer": 1, "result": "pass"}, {"layer": 2, "result": "review", "checker": "llm"}]}')));
select is((select v ->> 'status' from r where k = 'review'), 'in_review', 'F5-4 ambiguous layer 2 goes to pending_review');
insert into r values ('private', public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
  pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m6.png', '{"visibility": "private"}')));
select is((select v ->> 'status' from r where k = 'private'), 'private', 'UP-06 private save');

-- ---------------------------------------------------------------- new versions (F5-7)
select throws_ok(format($f$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m7.png', '{"recipe_id": "%s"}')) $f$,
                    (select v ->> 'recipe_id' from r where k = 'prompt')),
                 'P0001', 'CHANGELOG_REQUIRED', 'F5-7 a new version needs a changelog');
select throws_ok(format($f$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('skill', '00000000-0000-0000-0000-0000000000b1/m7.png', '{"recipe_id": "%s", "changelog": "x"}')) $f$,
                    (select v ->> 'recipe_id' from r where k = 'prompt')),
                 'P0001', 'CATEGORY_LOCKED', 'F5-7 category cannot change');
select throws_ok(format($f$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b2',
                    pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b2/y1.png', '{"recipe_id": "%s", "changelog": "x"}')) $f$,
                    (select v ->> 'recipe_id' from r where k = 'prompt')),
                 'P0001', 'NOT_FOUND', 'only the owner can add versions');
insert into r values ('v2', public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
  pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m7.png',
    jsonb_build_object('recipe_id', (select v ->> 'recipe_id' from r where k = 'prompt'), 'changelog', '조명 옵션 추가'))));
select ok((select (v ->> 'version_no')::int = 2 and v ->> 'status' = 'live' from r where k = 'v2'), 'UP-08 version 2 goes live');
select throws_ok($$ update public.recipe_versions set public_meta = '{}' where id =
                    (select (v ->> 'version_id')::uuid from r where k = 'v2') $$,
                 'P0001', 'VERSION_FROZEN', 'F5-7 approved versions are frozen');
-- A v3 that needs review must not touch the live header, and a rejection keeps v2 serving.
insert into r values ('v3', public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
  pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m9.png',
    jsonb_build_object('recipe_id', (select v ->> 'recipe_id' from r where k = 'prompt'), 'changelog', '스크립트 추가',
                       'has_scripts', true, 'title', '바뀐 제목'))));
select ok((select title = '테스트 레시피 prompt' and status = 'live'
                  and current_version_id = (select (v ->> 'version_id')::uuid from r where k = 'v2')
           from public.recipes where id = (select (v ->> 'recipe_id')::uuid from r where k = 'prompt')),
          'D10 a version waiting for review does not change the live header');
select public.admin_decide_review('00000000-0000-0000-0000-000000000011', (select (v ->> 'version_id')::uuid from r where k = 'v3'),
                                  'reject', 'R08', null);
select ok((select title = '테스트 레시피 prompt' and status = 'live'
                  and current_version_id = (select (v ->> 'version_id')::uuid from r where k = 'v2')
           from public.recipes where id = (select (v ->> 'recipe_id')::uuid from r where k = 'prompt')),
          'D10 rejecting a new version keeps the approved one live');
select throws_ok(format($f$ select public.admin_decide_review('00000000-0000-0000-0000-000000000011', '%s', 'approve') $f$,
                    (select v ->> 'version_id' from r where k = 'v3')),
                 'P0001', 'NOT_IN_QUEUE', 'a decision is made once');
insert into r values ('private_v2', public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
  pg_temp.payload('prompt', '00000000-0000-0000-0000-0000000000b1/m8.png',
    jsonb_build_object('recipe_id', (select v ->> 'recipe_id' from r where k = 'private'), 'changelog', '고침')) - 'visibility'));
select is((select v ->> 'status' from r where k = 'private_v2'), 'private', 'a new version keeps a private recipe private');
select throws_ok(format($f$ select public.submit_recipe_version('00000000-0000-0000-0000-0000000000b1',
                    pg_temp.payload('agent', '00000000-0000-0000-0000-0000000000b1/m8.png', '{"recipe_id": "%s", "changelog": "x"}')) $f$,
                    (select v ->> 'recipe_id' from r where k = 'agent')),
                 'P0001', 'REVIEW_PENDING', 'no new version while one waits for review');

-- ---------------------------------------------------------------- review decisions
select throws_ok(format($f$ select public.admin_decide_review('00000000-0000-0000-0000-0000000000b2', '%s', 'approve') $f$,
                    (select v ->> 'version_id' from r where k = 'agent')),
                 'P0001', 'NOT_ADMIN', 'only admins decide');
select is(public.admin_decide_review('00000000-0000-0000-0000-000000000011', (select (v ->> 'version_id')::uuid from r where k = 'agent'),
                                     'approve') ->> 'status', 'live', 'F5-6 approved agent goes live');
select throws_ok(format($f$ select public.admin_decide_review('00000000-0000-0000-0000-000000000011', '%s', 'reject') $f$,
                    (select v ->> 'version_id' from r where k = 'skill')),
                 'P0001', 'REJECT_CODE_REQUIRED', 'rejection needs an R code');
select is(public.admin_decide_review('00000000-0000-0000-0000-000000000011', (select (v ->> 'version_id')::uuid from r where k = 'skill'),
                                     'reject', 'R08', '숨은 지시문이 있어요') ->> 'status', 'rejected', 'F5-6 rejected skill');
select is((select count(*) from public.admin_actions where action like 'review_%'), 3::bigint, 'decisions are logged');

-- ---------------------------------------------------------------- owner dashboard + visibility + links
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select is((select status from public.my_recipes() limit 1), 'rejected', 'SELL-03 rejected recipes come first');
select is((select reject_code from public.my_recipes() where status = 'rejected'), 'R08', 'SELL-03 shows the reject code');
select is(public.set_recipe_visibility((select (v ->> 'recipe_id')::uuid from r where k = 'prompt'), 'private') ->> 'status',
          'private', 'owner can unpublish');
select public.set_recipe_visibility((select (v ->> 'recipe_id')::uuid from r where k = 'prompt'), 'public');
select throws_ok(format($f$ select public.set_recipe_visibility('%s', 'public') $f$, (select v ->> 'recipe_id' from r where k = 'review')),
                 'P0001', 'NOT_TOGGLEABLE', 'a recipe in review cannot be published by its owner');
select throws_ok(format($f$ select public.create_share_link('%s', 'demo01') $f$, (select v ->> 'recipe_id' from r where k = 'prompt')),
                 'P0001', 'CODE_TAKEN', 'F5-10 duplicate link name');
select is(public.create_share_link((select (v ->> 'recipe_id')::uuid from r where k = 'prompt'), 'mylink01') ->> 'code', 'mylink01',
          'F5-10 owner creates a share link');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(format($f$ select public.set_recipe_visibility('%s', 'private') $f$, (select v ->> 'recipe_id' from r where k = 'prompt')),
                 'P0001', 'NOT_FOUND', 'others cannot change visibility');
select is((select count(*) from public.auto_checks), 0::bigint, 'others cannot read my check results');
select is((select count(*) from public.my_recipes()), 0::bigint, 'my_recipes shows only my own recipes');
select throws_ok(format($f$ select public.admin_decide_review('00000000-0000-0000-0000-000000000011', '%s', 'approve') $f$,
                    (select v ->> 'version_id' from r where k = 'review')), '42501', null, 'clients cannot decide reviews');
select throws_ok($$ select public.record_recipe_view('rlinkedin01', repeat('a', 64)) $$, '42501', null, 'clients cannot record views');
select throws_ok($$ truncate public.recipe_drafts $$, '42501', null, 'clients cannot truncate drafts');

-- drafts (F5-1) and waitlist (F5-14)
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
insert into public.recipe_drafts (owner_id, category, step, payload) values ('00000000-0000-0000-0000-0000000000b1', 'prompt', 2, '{"title":"초안"}');
select throws_ok($$ insert into public.recipe_drafts (owner_id, category) values ('00000000-0000-0000-0000-0000000000b1', 'skill') $$,
                 '23505', null, 'F5-1 one draft for a new recipe');
insert into public.creator_waitlist (user_id, categories, consent_version) values ('00000000-0000-0000-0000-0000000000b1', '{prompt}', 'waitlist-2026-10');
select throws_ok($$ insert into public.creator_waitlist (user_id, categories, consent_version)
                    values ('00000000-0000-0000-0000-0000000000b1', '{skill}', 'waitlist-2026-10') $$,
                 '23505', null, 'F5-14 waitlist sign-up only once');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b2');
select ok((select count(*) = 0 from public.recipe_drafts) and (select count(*) = 0 from public.creator_waitlist)
          and (select count(*) = 0 from public.review_queue), 'drafts, waitlist and the review queue are private');
select is_empty($$ update public.recipe_drafts set step = 5 returning 1 $$, 'others cannot edit my draft');
select throws_ok(format($f$ insert into public.recipe_drafts (owner_id, recipe_id) values ('00000000-0000-0000-0000-0000000000b2', '%s') $f$,
                    (select v ->> 'recipe_id' from r where k = 'prompt')), '42501', null, 'no drafts on someone else''s recipe');
select pg_temp.login_anon();
select throws_ok($$ select count(*) from public.recipe_drafts $$, '42501', null, 'anon cannot read drafts');
select pg_temp.login_as('00000000-0000-0000-0000-000000000011', true);
select ok((select count(*) >= 2 from public.review_queue), 'admins see the review queue');

-- views (server only)
select pg_temp.as_postgres();
select public.record_recipe_view((select v ->> 'public_id' from r where k = 'prompt'), repeat('a', 64));
select public.record_recipe_view((select v ->> 'public_id' from r where k = 'prompt'), repeat('a', 64));
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select is((select views from public.my_recipes(7) where public_id = (select v ->> 'public_id' from r where k = 'prompt')), 1::bigint,
          'F5-10 one view per visitor per day');

select * from finish();
rollback;
