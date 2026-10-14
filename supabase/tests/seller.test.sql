-- Seller center (W4 SELL / UP-08, F5-6, F5-7): 「고쳐서 다시 제출」 and 「새 버전 올리기」 load the
-- owner's latest version. The edit payload never carries originals; originals come from a separate
-- owner-only function read only in src/data/secrets.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

create or replace function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

-- Seed: recipe 20 (rejected prompt, owner 04), recipe 19 (private prompt, owner 03).
insert into public.review_queue (version_id, recipe_id, reason, requested_visibility, state, reject_code, reject_note, decided_at)
values ('bbbbbbbb-0000-0000-0000-000000000020', 'aaaaaaaa-0000-0000-0000-000000000020', 'auto_check', 'public',
        'rejected', 'R09', '대량 후기 생성은 올릴 수 없어요', now());

select ok(not has_function_privilege('anon', 'public.my_recipe_for_edit(uuid)', 'execute'), 'anon cannot call my_recipe_for_edit');
select ok(not has_function_privilege('anon', 'public.my_recipe_original(uuid)', 'execute'), 'anon cannot call my_recipe_original');

select pg_temp.login_as('00000000-0000-0000-0000-000000000004');
select is(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000020') ->> 'category', 'prompt', 'F5-6 owner loads the rejected recipe');
select is(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000020') -> 'reject' ->> 'code', 'R09', 'F5-6 the rejection reason comes along');
select is(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000020') ->> 'title', '블로그 체험단 후기 대량 생성', 'header of the latest version');
select ok(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000020')::text !~ 'SAMEPLZ-SECRET-SAMPLE',
  'the edit payload never contains the original');
select ok(public.my_recipe_original('aaaaaaaa-0000-0000-0000-000000000020') ->> 'prompt_body' ~ 'SAMEPLZ-SECRET-SAMPLE',
  'owner can read their own latest original');

select pg_temp.login_as('00000000-0000-0000-0000-000000000003');
select throws_ok($$select public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000020')$$, 'P0001', 'NOT_FOUND',
  'another user cannot load someone else''s recipe');
select throws_ok($$select public.my_recipe_original('aaaaaaaa-0000-0000-0000-000000000020')$$, 'P0001', 'NOT_FOUND',
  'another user cannot read someone else''s original');
select is(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000019') ->> 'status', 'private', 'owner loads a private recipe');
select is(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000019') -> 'reject', 'null'::jsonb, 'no rejection on a private recipe');
select is(jsonb_typeof(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000019') -> 'media'), 'array', 'media list for prefill');

select is(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000019') ->> 'title', '사내 공지 말투 다듬기',
  'seed rows without a version header fall back to the recipe header');

-- A live recipe whose new version (v2) was rejected: the live row stays live (v1 keeps serving), but
-- the owner must see the v2 rejection both in the edit payload and in the dashboard list.
reset role;
insert into public.recipe_versions (id, recipe_id, version_no, changelog, review_status, public_meta, header)
values ('bbbbbbbb-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-000000000001', 9, '배경 변수 추가', 'rejected',
        '{"variables":[{"name":"배경","description":"뒤 배경","example":"사무실"}]}',
        '{"title":"v2 링크드인 사진","summary":"새 설명","search_tags":[],"job_codes":["hr"],"tool_codes":[],"filters":{}}');
insert into public.recipe_version_secrets (version_id, prompt_body)
values ('bbbbbbbb-0000-0000-0000-0000000000f2', 'V2-ORIGINAL-MARKER [배경]');
insert into public.review_queue (version_id, recipe_id, reason, requested_visibility, state, reject_code, reject_note, decided_at)
values ('bbbbbbbb-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-000000000001', 'auto_check', 'public',
        'rejected', 'R05', '쓰임새를 더 적어 주세요', now());

select pg_temp.login_as('00000000-0000-0000-0000-000000000005');
select is(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000001') ->> 'status', 'live', 'the recipe stays live while v1 serves');
select is((public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000001') ->> 'version_no')::int, 9, 'edit starts from the latest (rejected) version');
select is(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000001') ->> 'title', 'v2 링크드인 사진', 'header of the rejected version, not the live one');
select is(public.my_recipe_for_edit('aaaaaaaa-0000-0000-0000-000000000001') -> 'reject' ->> 'code', 'R05',
  'a rejected new version of a live recipe shows its reason');
select is((select reject_code from public.my_recipes(30) where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'R05',
  'the dashboard list shows the rejected new version too');
select ok(public.my_recipe_original('aaaaaaaa-0000-0000-0000-000000000001') ->> 'prompt_body' ~ 'V2-ORIGINAL-MARKER',
  'the original comes from the latest version');

select pg_temp.login_as('00000000-0000-0000-0000-000000000004');
select is((select reject_code from public.my_recipes(30) where recipe_id = 'aaaaaaaa-0000-0000-0000-000000000020'), 'R09',
  'a rejected first version still shows its reason in the list');

reset role;
set local role anon;
select throws_ok($$select public.my_recipe_original('aaaaaaaa-0000-0000-0000-000000000020')$$, '42501', null,
  'anon calls are refused');

select * from finish();
rollback;
