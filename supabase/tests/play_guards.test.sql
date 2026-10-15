-- PLAY pipeline guards: pre-moderation limit, early-webhook attach, one sweep per minute.
-- (private.expire_stale_play_cells commits per row, so it cannot run inside this test transaction;
-- its selection is exercised manually and by the sweeper e2e.)
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a7a01', 'guard-a@example.test'),
  ('00000000-0000-0000-0000-0000000a7a02', 'guard-b@example.test');
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now(), ai_notice_ack_at = now()
 where id = '00000000-0000-0000-0000-0000000a7a01';
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now()
 where id = '00000000-0000-0000-0000-0000000a7a02';
select private.ensure_credit_account('00000000-0000-0000-0000-0000000a7a01');
update public.credit_accounts set grant_eligible = true where user_id = '00000000-0000-0000-0000-0000000a7a01';
select private.grant_monthly_credits('00000000-0000-0000-0000-0000000a7a01', private.kst_month());

-- 1. pre-check
select is(public.play_precheck('00000000-0000-0000-0000-0000000a7a01'), null, 'F4-16 precheck allows a ready member');
select is(public.play_precheck('00000000-0000-0000-0000-0000000a7a02'), 'AI_NOTICE_REQUIRED',
          'F4-9 precheck needs the AI notice');
select is(public.play_precheck('00000000-0000-0000-0000-00000000dead'), 'LOGIN_REQUIRED', 'F4-16 unknown user');
select is((select count(*)::int from generate_series(1, 9) g
            where public.play_precheck('00000000-0000-0000-0000-0000000a7a01') is null), 9,
          'F4-16 ten attempts per minute are allowed');
select is(public.play_precheck('00000000-0000-0000-0000-0000000a7a01'), 'RATE_LIMITED',
          'F4-16 the 11th attempt in a minute is refused before moderation');
update public.credit_accounts set generation_suspended_at = now() where user_id = '00000000-0000-0000-0000-0000000a7a01';
select is(public.play_precheck('00000000-0000-0000-0000-0000000a7a01'), 'GENERATION_SUSPENDED',
          'D13 a suspended account is refused first');
update public.credit_accounts set generation_suspended_at = null where user_id = '00000000-0000-0000-0000-0000000a7a01';

-- 2. early webhook attach
insert into public.play_runs (id, user_id, mode, client_request_id)
values ('00000000-0000-0000-0000-0000000a7a10', '00000000-0000-0000-0000-0000000a7a01', 'blank', gen_random_uuid());
insert into public.play_cells (id, run_id, user_id, model_id, params, price_credits, price_version)
values ('00000000-0000-0000-0000-0000000a7a11', '00000000-0000-0000-0000-0000000a7a10',
        '00000000-0000-0000-0000-0000000a7a01', 'gpt-image-2.5-flare', '{"quality":"medium"}', 11, 1);
select ok((private.place_hold('00000000-0000-0000-0000-0000000a7a11', '00000000-0000-0000-0000-0000000a7a01', 11) ->> 'ok')::boolean,
          'fixture hold placed');
select ok(public.attach_provider_request('00000000-0000-0000-0000-0000000a7a11', 'req-early'),
          'FM-10 an early webhook attaches the provider request');
select is((select status from public.play_cells where id = '00000000-0000-0000-0000-0000000a7a11'), 'submitted',
          'FM-10 the queued cell becomes submitted (not resubmitted, not failed at 10 minutes)');
select ok((select deadline_at > now() from public.play_cells where id = '00000000-0000-0000-0000-0000000a7a11'),
          'FM-10 the attached cell gets a deadline');
select ok(not public.attach_provider_request('00000000-0000-0000-0000-0000000a7a11', 'req-other'),
          'FM-10 a second request id never replaces the first');

-- 3. one sweep per minute
select ok(public.claim_play_sweep() and not public.claim_play_sweep(), 'PLAY only one sweeper run per minute window');

-- 3b. grid refresh limit
select is((select count(*)::int from generate_series(1, 60) g
            where public.hit_play_refresh('00000000-0000-0000-0000-0000000a7a01')), 60,
          'PLAY-05 sixty grid refreshes per minute are allowed');
select ok(not public.hit_play_refresh('00000000-0000-0000-0000-0000000a7a01'),
          'PLAY-05 the 61st refresh in a minute is refused');

-- 4. server-only
set local role authenticated;
select throws_ok($$ select public.play_precheck('00000000-0000-0000-0000-0000000a7a01') $$, '42501', null,
                 'PLAY clients cannot call the pre-check or the sweep claim');
reset role;

select * from finish();
rollback;
