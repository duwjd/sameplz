-- Upload rate limits (W4 UP, security review H5 / M4): every submit runs paid layer 2 checks and
-- every signed upload URL can store up to 50MB, so both are capped. Service role only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select ok(has_function_privilege('service_role', 'public.hit_upload_limit(uuid)', 'execute'),
  'service_role can call hit_upload_limit');
select ok(not has_function_privilege('authenticated', 'public.hit_upload_limit(uuid)', 'execute'),
  'authenticated cannot call hit_upload_limit');
select ok(not has_function_privilege('anon', 'public.hit_upload_limit(uuid)', 'execute'),
  'anon cannot call hit_upload_limit');
select ok(has_function_privilege('service_role', 'public.hit_upload_target_limit(uuid)', 'execute'),
  'service_role can call hit_upload_target_limit');
select ok(not has_function_privilege('authenticated', 'public.hit_upload_target_limit(uuid)', 'execute'),
  'authenticated cannot call hit_upload_target_limit');

select is((select count(*) from generate_series(1, 20) where public.hit_upload_limit('00000000-0000-0000-0000-0000000000c1') is null),
  20::bigint, 'first 20 submits in an hour are allowed');
select is(public.hit_upload_limit('00000000-0000-0000-0000-0000000000c1'), 'RATE_LIMITED', 'the 21st in the hour is refused');
select is(public.hit_upload_limit('00000000-0000-0000-0000-0000000000c2'), null, 'other users have their own bucket');

-- Daily cap per user (fixed hourly windows allow bursts at the boundary).
insert into public.rate_limit_buckets (key, window_start, count)
values ('upload:user-day:00000000-0000-0000-0000-0000000000c3',
        to_timestamp(floor(extract(epoch from now()) / 86400) * 86400), 40);
select is(public.hit_upload_limit('00000000-0000-0000-0000-0000000000c3'), 'RATE_LIMITED', 'over 40 submits a day is refused');

-- Global daily judge budget: over it, submits still go through but skip layer 2 (human review).
insert into public.rate_limit_buckets (key, window_start, count)
values ('upload:all-day', to_timestamp(floor(extract(epoch from now()) / 86400) * 86400), 2000)
on conflict (key, window_start) do update set count = 2000;
select is(public.hit_upload_limit('00000000-0000-0000-0000-0000000000c4'), 'JUDGE_BUDGET', 'over the global daily budget → JUDGE_BUDGET');

select is((select count(*) from generate_series(1, 60) where public.hit_upload_target_limit('00000000-0000-0000-0000-0000000000c5')),
  60::bigint, 'first 60 signed upload URLs in an hour are allowed');
select is(public.hit_upload_target_limit('00000000-0000-0000-0000-0000000000c5'), false, 'the 61st is refused');

select * from finish();
rollback;
