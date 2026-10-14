-- Upload submit rate limit (W4 UP): every submit runs paid layer 2 checks, so the server action asks
-- this before running them. Service role only; per user per hour.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select ok(has_function_privilege('service_role', 'public.hit_upload_limit(uuid)', 'execute'),
  'service_role can call hit_upload_limit');
select ok(not has_function_privilege('authenticated', 'public.hit_upload_limit(uuid)', 'execute'),
  'authenticated cannot call hit_upload_limit');
select ok(not has_function_privilege('anon', 'public.hit_upload_limit(uuid)', 'execute'),
  'anon cannot call hit_upload_limit');

select is((select bool_and(public.hit_upload_limit('00000000-0000-0000-0000-0000000000c1'))
             from generate_series(1, 20)), true, 'first 20 submits in an hour are allowed');
select is(public.hit_upload_limit('00000000-0000-0000-0000-0000000000c1'), false, 'the 21st is refused');
select is(public.hit_upload_limit('00000000-0000-0000-0000-0000000000c2'), true, 'other users have their own bucket');

select * from finish();
rollback;
