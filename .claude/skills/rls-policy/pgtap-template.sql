-- pgTAP 템플릿: supabase/tests/<area>.test.sql 로 복사해 쓴다.
-- 실행: supabase test db
-- 이름 규약: 테스트 설명에 요구사항 ID 또는 아이템 ID를 넣는다 (예: 'F3-6 …').

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);  -- 테스트 개수에 맞게 바꾼다

-- ---------------------------------------------------------------
-- 준비: 사용자 둘(A=소유자, B=다른 사용자). auth.users에 직접 넣는다(로컬 테스트 DB 전용).
-- ---------------------------------------------------------------
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- 테스트 데이터는 postgres 역할로 넣는다(RLS 우회). 예:
-- insert into public.recipe_drafts (id, user_id, step, data)
-- values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 1, '{}');

-- 역할 전환 도우미
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

-- ---------------------------------------------------------------
-- 1. 구조
-- ---------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.recipe_drafts'::regclass),
  'recipe_drafts: RLS 켜짐'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'recipe_version_secrets'),
  0,
  'F2-2 recipe_version_secrets: 정책 0개'
);

-- 돈 RPC는 anon/authenticated 실행 권한 없음
-- select function_privs_are('private', 'refund_order', array['uuid'], 'authenticated', array[]::text[], 'F3-6 refund_order: authenticated 실행 불가');

-- ---------------------------------------------------------------
-- 2. 허용(주인) / 거부(다른 사용자) / 거부(anon)
-- ---------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.recipe_drafts), 0, 'A: 자기 초안만 보임 (데이터 넣은 뒤 기대값 조정)');

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.recipe_drafts where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
          'B는 A의 초안을 못 읽는다');
select is((select count(*)::int from public.recipe_version_secrets), 0, 'B는 원문을 못 읽는다');

select throws_ok(
  $$ insert into public.recipe_drafts (user_id, step, data) values ('00000000-0000-0000-0000-00000000000a', 1, '{}') $$,
  '42501', null,
  'B는 A 이름으로 초안을 못 만든다'
);

select pg_temp.login_anon();
select is((select count(*)::int from public.recipe_drafts), 0, 'anon은 초안을 못 읽는다');
select is((select count(*)::int from public.recipe_version_secrets), 0, 'anon은 원문을 못 읽는다');

-- ---------------------------------------------------------------
-- 3. 돈 함수 (예시 형태)
--   - 성공: 상태가 바뀌고 원장에 행이 생긴다
--   - 실패: 사유 코드로 거절 (throws_ok(..., 'P0001', 'REFUND_WINDOW_CLOSED', ...))
--   - 멱등: 같은 키로 두 번 → 두 번째 noop, 원장 행 수 그대로
--   - 경합: 열기 후 환불 → 거절 (같은 권리 행 잠금). 진짜 동시성은 dblink 두 세션 또는 앱 레벨 테스트로 보완
-- ---------------------------------------------------------------

select * from finish();
rollback;
