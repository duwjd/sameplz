-- Accounts: jobs/tools reference data, profiles column exposure + own update, signup trigger,
-- consent ledger and accept_signup_terms (F7-9, D5). Uses seed users.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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

-- reference data
select pg_temp.login_anon();
select is((select count(*) from public.jobs), 9::bigint, 'jobs: 9 job codes readable by anon');
select ok((select count(*) from public.tools) > 0, 'tools: readable by anon');

-- profiles: public columns yes, consent/role no
select is((select nickname from public.profiles where id = '00000000-0000-0000-0000-000000000001'), '지우',
          'profiles: anon reads public nickname');
select throws_ok($$ select terms_accepted_at from public.profiles $$, '42501', null,
          'profiles: anon cannot read consent timestamps');
select throws_ok($$ update public.profiles set nickname = '익명수정' $$, '42501', null,
          'profiles: anon cannot update');

select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select lives_ok($$ update public.profiles set nickname = '지우지우' where id = '00000000-0000-0000-0000-000000000001' $$,
          'profiles: user updates own nickname');
update public.profiles set nickname = '남이바꿈' where id = '00000000-0000-0000-0000-000000000002';
select throws_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001' $$, '42501', null,
          'profiles: user cannot change own role');
select throws_ok($$ update public.profiles set handle = 'Bad-Handle' where id = '00000000-0000-0000-0000-000000000001' $$, '23514', null,
          'profiles: handle format enforced');
select throws_ok($$ update public.profiles set handle = 'JIWOO2' where id = '00000000-0000-0000-0000-000000000001' $$, '23514', null,
          'profiles: handle must be lowercase (citext compared as text)');

select pg_temp.as_postgres();
select is((select nickname from public.profiles where id = '00000000-0000-0000-0000-000000000002'), '상세장인',
          'profiles: user cannot update another profile');

-- signup trigger (auth.users insert → profile, no email copied)
insert into auth.users (id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'n_abc@naver.users.sameplz.invalid',
        '{"name":"새로온네이버친구이름이아주길어요"}'),
       ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', null, '{"name":"김"}');
select is((select nickname from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), '새로온네이버친구이름이아',
          'signup: nickname from provider name, cut to 12 chars');
select is((select nickname from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'), '새 회원',
          'signup: 1-char provider name falls back to 새 회원');
select is((select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'profiles' and column_name ilike '%email%'), 0::bigint,
          'signup: profiles never stores email (placeholder or real)');

-- accept_signup_terms (F7-9)
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
select is((select signup_complete from public.my_account_status()), false, 'F7-9 before consent: signup incomplete');
select public.accept_signup_terms('2026-10-v1');
select public.accept_signup_terms('2026-10-v1');
select is((select signup_complete from public.my_account_status()), true, 'F7-9 terms + 18+ recorded → signup complete');
select is((select count(*) from public.consent_events), 3::bigint,
          'F7-9 consent rows written once (idempotent), visible to owner');

select pg_temp.login_as('00000000-0000-0000-0000-000000000002');
select is((select count(*) from public.consent_events where user_id = '00000000-0000-0000-0000-0000000000a1'), 0::bigint,
          'consent_events: other user cannot read');

select pg_temp.login_anon();
select throws_ok($$ select public.accept_signup_terms('x') $$, '42501', null, 'accept_signup_terms: anon cannot execute');

select pg_temp.as_postgres();
select throws_ok($$ update public.consent_events set version = 'x' $$, 'P0001', 'APPEND_ONLY',
          'consent_events: append-only (update rejected)');
select throws_ok($$ delete from auth.users where id = '00000000-0000-0000-0000-000000000001' $$, '23503', null,
          'withdrawal is soft delete: consent proof blocks hard account deletion');

select * from finish();
rollback;
