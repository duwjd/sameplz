-- Upload rate limits (W4 UP, security review H5 / M4): every submit runs paid layer 2 checks and
-- every signed upload URL can store up to 50MB, so both are capped. Service role only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Counters written by local e2e runs must not leak into these assertions.
delete from public.rate_limit_buckets where key like 'upload%';

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

-- Global daily judge budget is counted only right before a paid judge call (round 2, M4), so
-- submits that fail layer 1 cannot drain it.
select ok(has_function_privilege('service_role', 'public.hit_judge_budget()', 'execute'),
  'service_role can call hit_judge_budget');
select ok(not has_function_privilege('authenticated', 'public.hit_judge_budget()', 'execute'),
  'authenticated cannot call hit_judge_budget');
select is(public.hit_upload_limit('00000000-0000-0000-0000-0000000000c4'), null, 'per-user check does not touch the global budget');
select is((select count(*) from public.rate_limit_buckets where key = 'upload:all-day'), 0::bigint,
  'no global budget row after a per-user check');
insert into public.rate_limit_buckets (key, window_start, count)
values ('upload:all-day', to_timestamp(floor(extract(epoch from now()) / 86400) * 86400), 2000);
select is(public.hit_judge_budget(), false, 'over the global daily budget the judge is skipped');

select is((select count(*) from generate_series(1, 60) where public.hit_upload_target_limit('00000000-0000-0000-0000-0000000000c5')),
  60::bigint, 'first 60 signed upload URLs in an hour are allowed');
select is(public.hit_upload_target_limit('00000000-0000-0000-0000-0000000000c5'), false, 'the 61st is refused');

-- Byte cap (round 2, H5): over 300MB uploaded in the last day under the user's folders, no new URLs.
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('recipe-media', '00000000-0000-0000-0000-0000000000c6/' || gen_random_uuid() || '.mp4', null,
        jsonb_build_object('size', 300 * 1024 * 1024 + 1, 'mimetype', 'video/mp4'));
select is(public.hit_upload_target_limit('00000000-0000-0000-0000-0000000000c6'), false,
  'over 300MB uploaded in a day → no more upload URLs');

select * from finish();
rollback;
