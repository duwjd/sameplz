-- Credit ledger (W4, money path — written before the implementation): F4-14 monthly grant,
-- F4-15 budget, F4-16 limits, D13 abuse rules, INV-C1~6, C10, C11, C15, C17~21 (credit-ledger skill).
-- start_run / price_version (INV-C13, C16) arrive with the playground in W5.
begin;
create extension if not exists pgtap with schema extensions;
select plan(75);

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

-- Fresh users: A, B, D, E finished signup; C did not. D shares A's device.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000a' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'credit-' || n || '@sameplz.test', '{"provider":"email"}', '{"name":"크레딧테스트"}'
from generate_series(1, 7) n;
update public.profiles set terms_version = '2026-10-v1', terms_accepted_at = now(), adult_confirmed_at = now()
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
              '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a5');

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;
insert into t values ('A', '00000000-0000-0000-0000-0000000000a1'), ('B', '00000000-0000-0000-0000-0000000000a2'),
                     ('C', '00000000-0000-0000-0000-0000000000a3'), ('D', '00000000-0000-0000-0000-0000000000a4'),
                     ('E', '00000000-0000-0000-0000-0000000000a5'), ('F', '00000000-0000-0000-0000-0000000000a6'),
                     ('G', '00000000-0000-0000-0000-0000000000a7');
create or replace function pg_temp.u(k text) returns uuid language sql as $$ select v::uuid from t where t.k = $1 $$;

-- A, B, D, E passed the signup checks (complete_signup_credits); G finished signup but never passed them.
update public.profiles set terms_version = '2026-10-v1', terms_accepted_at = now(), adult_confirmed_at = now()
 where id = '00000000-0000-0000-0000-0000000000a7';
insert into public.credit_accounts (user_id, grant_eligible)
select v::uuid, true from t where k in ('A', 'B', 'D', 'E');

-- ---------------------------------------------------------------- F4-14 monthly grant
select is((private.grant_monthly_credits(pg_temp.u('A'), private.kst_month()) ->> 'granted')::boolean, true,
          'F4-14 monthly grant for a finished signup');
select is(private.grant_monthly_credits(pg_temp.u('A'), private.kst_month()) ->> 'reason', 'ALREADY_GRANTED',
          'INV-C18 second grant in the same month is a noop');
select is((select count(*) from public.credit_lots where user_id = pg_temp.u('A') and kind = 'monthly_grant'), 1::bigint,
          'INV-C18 one monthly_grant lot per (user, month)');
select ok((select amount = 270 and remaining = 270 and expires_at = private.next_reset_at()
           from public.credit_lots where user_id = pg_temp.u('A')), 'F4-14 D11 270C lot expiring at the next KST reset');
select is((select available from public.credit_accounts where user_id = pg_temp.u('A')), 270, 'F4-14 account available 270');
select is(private.grant_monthly_credits(pg_temp.u('C'), private.kst_month()) ->> 'reason', 'SIGNUP_INCOMPLETE',
          'F4-14 no grant before signup is finished');

select is(private.grant_monthly_credits(pg_temp.u('G'), private.kst_month()) ->> 'reason', 'NOT_ELIGIBLE',
          'D13 no grant without passing the signup checks');
select throws_ok($$ select private.grant_monthly_credits('00000000-0000-0000-0000-0000000000a1',
                                                         (private.kst_month() + interval '1 month')::date) $$,
                 'P0001', 'INVALID_MONTH', 'INV-C18 future months cannot be granted early');

select private.record_device(pg_temp.u('A'), repeat('d', 64), repeat('1', 64));
select private.record_device(pg_temp.u('D'), repeat('d', 64), repeat('1', 64));
select is(private.grant_monthly_credits(pg_temp.u('D'), private.kst_month()) ->> 'reason', 'SHARED_DEVICE',
          'D13 second account on the same device gets no monthly grant');
select is((select count(*) from public.abuse_signals where user_id = pg_temp.u('D') and kind = 'shared_device_grant'),
          1::bigint, 'D13 shared device is recorded as an abuse signal');
select private.grant_monthly_credits(pg_temp.u('D'), private.kst_month());
select is((select count(*) from public.abuse_signals where user_id = pg_temp.u('D') and kind = 'shared_device_grant'),
          1::bigint, 'D13 shared-device signal recorded once per user per month');
select throws_ok($$ insert into public.credit_lots (user_id, kind, amount, remaining, expires_at)
                    values ('00000000-0000-0000-0000-0000000000a1', 'paid', 100, 100, now() + interval '5 years') $$,
                 '23514', null, 'INV-C15 MVP has no paid lots');

-- ---------------------------------------------------------------- holds and settlement
insert into public.generation_budget (month, cap_credits, state) values (private.kst_month(), 1000, 'open')
on conflict (month) do update set cap_credits = 1000, reserved = 0, spent = 0, state = 'open', alerted_80_at = null;

select ok((select (r ->> 'ok')::boolean = false and r ->> 'reason' = 'INSUFFICIENT_CREDITS' and (r ->> 'shortfall')::int = 1
           from private.place_hold('c0000000-0000-0000-0000-000000000001', pg_temp.u('A'), 271) r),
          'INV-C1 hold above the balance: nothing held, shortfall 1');
select is((select count(*) from public.credit_holds where cell_id = 'c0000000-0000-0000-0000-000000000001'), 0::bigint,
          'INV-C1 no hold row for the refused cell');
select is((private.place_hold('c0000000-0000-0000-0000-000000000002', pg_temp.u('A'), 100) ->> 'ok')::boolean, true,
          'hold 100C');
select ok((select available = 170 and held = 100 from public.credit_accounts where user_id = pg_temp.u('A')),
          'hold moves available → held');
select is((select reserved from public.generation_budget where month = private.kst_month()), 100,
          'INV-C20 budget reserved with the hold');
select is((private.place_hold('c0000000-0000-0000-0000-000000000002', pg_temp.u('A'), 100) ->> 'ok')::boolean, true,
          'same cell again returns the existing hold');
select is((select available from public.credit_accounts where user_id = pg_temp.u('A')), 170, 'no second hold for the same cell');

select is((private.settle_cell('c0000000-0000-0000-0000-000000000002', 'success') ->> 'captured')::int, 100,
          'success captures the hold');
select ok((select reserved = 0 and spent = 100 from public.generation_budget where month = private.kst_month()),
          'INV-C20 settle trues reservation up to spent');
create temp table n_ledger as select count(*) as n from public.credit_ledger where user_id = '00000000-0000-0000-0000-0000000000a1';
select is((private.settle_cell('c0000000-0000-0000-0000-000000000002', 'success') ->> 'settled')::boolean, false,
          'INV-C3 second settle is a noop');
select is((select count(*) from public.credit_ledger where user_id = pg_temp.u('A')), (select n from n_ledger),
          'INV-C3 no ledger rows from the second settle');

select private.place_hold('c0000000-0000-0000-0000-000000000003', pg_temp.u('A'), 50);
select private.settle_cell('c0000000-0000-0000-0000-000000000003', 'model_error');
select ok((select remaining = 170 and held = 0 from public.credit_lots where user_id = pg_temp.u('A') and kind = 'monthly_grant'),
          'INV-C4 model error releases back to the same lot');
select ok((select available = 170 and held = 0 from public.credit_accounts where user_id = pg_temp.u('A')),
          'INV-C4 account restored after model error');
select private.place_hold('c0000000-0000-0000-0000-000000000004', pg_temp.u('A'), 30);
select throws_ok($$ select private.settle_cell('c0000000-0000-0000-0000-000000000004', 'timeout') $$,
                 'P0001', 'OUTCOME_NOT_FINAL', 'INV-C20 timeout is not final: look up the provider, then settle');
select throws_ok($$ select private.place_hold('c0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a2', 30) $$,
                 'P0001', 'CELL_CONFLICT', 'a cell id cannot be reused by another user');
select is((private.settle_cell('c0000000-0000-0000-0000-000000000004', 'safety_blocked') ->> 'captured')::int, 0,
          'INV-C6 safety block deducts nothing');
select ok((select reserved = 0 and spent = 100 from public.generation_budget where month = private.kst_month()),
          'INV-C20 release returns the reservation');

-- INV-C5: a lot expiring sooner is used first.
insert into public.credit_lots (id, user_id, kind, amount, remaining, expires_at)
values ('11111111-0000-0000-0000-000000000001', pg_temp.u('A'), 'promo', 20, 20, now() + interval '1 day');
insert into public.credit_ledger (user_id, lot_id, entry_type, delta, idem_key)
values (pg_temp.u('A'), '11111111-0000-0000-0000-000000000001', 'grant', 20, 'test:promo:a1');
update public.credit_accounts set available = available + 20 where user_id = pg_temp.u('A');
select private.place_hold('c0000000-0000-0000-0000-000000000005', pg_temp.u('A'), 30);
select is((select held from public.credit_lots where id = '11111111-0000-0000-0000-000000000001'), 20,
          'INV-C5 soonest-expiring lot used first');
select is((select held from public.credit_lots where user_id = pg_temp.u('A') and kind = 'monthly_grant'), 10,
          'INV-C5 rest from the later lot');
select private.settle_cell('c0000000-0000-0000-0000-000000000005', 'success');
select ok((select a.available + a.held = (select sum(remaining) from public.credit_lots l where l.user_id = a.user_id)
           from public.credit_accounts a where a.user_id = pg_temp.u('A')), 'INV-C2 available + held = Σ lot remaining');
select ok((select a.available = (select sum(delta) from public.credit_ledger g where g.user_id = a.user_id)
           from public.credit_accounts a where a.user_id = pg_temp.u('A')), 'INV-C2 Σ ledger delta = available');

-- ---------------------------------------------------------------- expiry (INV-C17)
update public.credit_lots set expires_at = now() - interval '1 second' where user_id = pg_temp.u('A');
select ok(private.expire_bonus() >= 1, 'INV-C17 expire_bonus expires lapsed lots');
select is(private.expire_bonus(), 0, 'INV-C17 second run is a noop');
select ok((select available = 0 and available = (select sum(delta) from public.credit_ledger g where g.user_id = a.user_id)
           from public.credit_accounts a where a.user_id = pg_temp.u('A')), 'INV-C2 still holds after expiry');

-- ---------------------------------------------------------------- monthly reset (INV-C18 reset path)
-- B's last-month lot is still "open" (we are just before the reset), 100C of it held by a running cell.
select private.grant_monthly_credits(pg_temp.u('B'), (private.kst_month() - interval '1 month')::date);
update public.credit_lots set expires_at = now() + interval '1 hour' where user_id = pg_temp.u('B');
insert into public.credit_lots (id, user_id, kind, amount, remaining, expires_at)
values ('11111111-0000-0000-0000-000000000002', pg_temp.u('B'), 'promo', 50, 50, now() + interval '90 days');
insert into public.credit_ledger (user_id, lot_id, entry_type, delta, idem_key)
values (pg_temp.u('B'), '11111111-0000-0000-0000-000000000002', 'grant', 50, 'test:promo:a2');
update public.credit_accounts set available = available + 50 where user_id = pg_temp.u('B');
select private.place_hold('c0000000-0000-0000-0000-000000000010', pg_temp.u('B'), 100);
select is((private.grant_monthly_credits(pg_temp.u('B'), private.kst_month()) ->> 'granted')::boolean, true,
          'F4-14 this month grants after last month');
select ok((select remaining = 100 and held = 100 from public.credit_lots
           where user_id = pg_temp.u('B') and grant_month = (private.kst_month() - interval '1 month')::date),
          'INV-C18 reset expires the unheld remainder; the held part survives');
select is((select delta from public.credit_ledger g join public.credit_lots l on l.id = g.lot_id
           where g.entry_type = 'expire' and l.user_id = pg_temp.u('B') and l.grant_month = (private.kst_month() - interval '1 month')::date),
          -170, 'INV-C18 reset writes an expire row for the old remainder');
select is((select remaining from public.credit_lots where id = '11111111-0000-0000-0000-000000000002'), 50,
          'D11 reset does not expire an unexpired promo lot');
-- The old lot lapses while the cell runs; the released credits must never become spendable.
update public.credit_lots set expires_at = now() - interval '1 second'
 where user_id = pg_temp.u('B') and grant_month = (private.kst_month() - interval '1 month')::date;
select private.settle_cell('c0000000-0000-0000-0000-000000000010', 'model_error');
select ok((select a.available = 320 and a.available = private.spendable_credits(a.user_id)
           from public.credit_accounts a where a.user_id = pg_temp.u('B')),
          'INV-C4 release into an expired lot is expired again, never spendable');

-- ---------------------------------------------------------------- ledger integrity
select throws_ok($$ update public.credit_ledger set delta = 0 where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
                 'P0001', 'APPEND_ONLY', 'INV-C10 ledger rows cannot be updated');
select throws_ok($$ delete from public.credit_ledger where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
                 'P0001', 'APPEND_ONLY', 'INV-C10 ledger rows cannot be deleted');
select throws_ok($$ insert into public.credit_ledger (user_id, entry_type, delta, idem_key)
                    values ('00000000-0000-0000-0000-0000000000a1', 'adjust', 1, 'test:promo:a1') $$,
                 '23505', null, 'INV-C11 idem_key is unique');

-- ---------------------------------------------------------------- budget (F4-15, INV-C19)
select private.grant_monthly_credits(pg_temp.u('E'), private.kst_month());
update public.generation_budget set cap_credits = 150, reserved = 0, spent = 0, alerted_80_at = null
 where month = private.kst_month();
select private.place_hold('c0000000-0000-0000-0000-000000000006', pg_temp.u('B'), 120);
select isnt((select alerted_80_at from public.generation_budget where month = private.kst_month()), null,
            'F4-15 80% of the budget raises the operator alert');
select is(private.place_hold('c0000000-0000-0000-0000-000000000007', pg_temp.u('E'), 50) ->> 'reason', 'BUDGET_EXHAUSTED',
          'INV-C19 hold over the budget is refused');
select ok((select count(*) = 0 from public.credit_holds where cell_id = 'c0000000-0000-0000-0000-000000000007')
          and (select reserved = 120 from public.generation_budget where month = private.kst_month()),
          'INV-C19 refused hold leaves no hold and no reservation');
-- E has no usage today, so the daily limit (checked first) does not mask the budget.
select is(private.check_run_allowed(pg_temp.u('E'), 50, null, null), 'BUDGET_EXHAUSTED',
          'F4-15 run check refuses before any hold');
select private.settle_cell('c0000000-0000-0000-0000-000000000006', 'model_error');
update public.generation_budget set cap_credits = 100000, state = 'paused' where month = private.kst_month();
select is(private.place_hold('c0000000-0000-0000-0000-000000000011', pg_temp.u('E'), 10) ->> 'reason', 'BUDGET_EXHAUSTED',
          'F4-15 paused budget refuses holds');
update public.generation_budget set state = 'open' where month = private.kst_month();

-- ---------------------------------------------------------------- daily limit (INV-C21), rate limit, suspension
select private.grant_monthly_credits(pg_temp.u('E'), private.kst_month());
select is(private.check_run_allowed(pg_temp.u('E'), 135, null, null), null, 'INV-C21 exactly the daily limit is allowed');
select private.place_hold('c0000000-0000-0000-0000-000000000008', pg_temp.u('E'), 100);
select private.settle_cell('c0000000-0000-0000-0000-000000000008', 'success');
select is(private.check_run_allowed(pg_temp.u('E'), 35, null, null), null, 'INV-C21 used 100 + 35 = 135 is allowed');
select is(private.check_run_allowed(pg_temp.u('E'), 36, null, null), 'DAILY_LIMIT', 'INV-C21 one credit over the daily limit');
select is(private.place_hold('c0000000-0000-0000-0000-000000000012', pg_temp.u('E'), 36) ->> 'reason', 'DAILY_LIMIT',
          'INV-C21 place_hold re-checks the daily limit under the account lock');

select is((select count(*) from generate_series(1, 5) i
           where private.check_run_allowed(pg_temp.u('B'), 1, repeat('a', 64), repeat('b', 64)) is null), 5::bigint,
          'F4-16 five runs a minute are allowed');
select is(private.check_run_allowed(pg_temp.u('B'), 1, repeat('a', 64), repeat('b', 64)), 'RATE_LIMITED',
          'F4-16 the sixth run in a minute is rate limited');
select is(private.check_run_allowed(pg_temp.u('C'), 1, null, null), 'ADULT_REQUIRED', 'F4-16 18+ self-check before anything');

select private.record_moderation_block(pg_temp.u('E'));
select private.record_moderation_block(pg_temp.u('E'));
select is(private.record_moderation_block(pg_temp.u('E')), true, 'D13 third moderation block in 24h suspends generation');
select is(private.check_run_allowed(pg_temp.u('E'), 1, null, null), 'GENERATION_SUSPENDED', 'D13 suspended account cannot run');

select is((select count(*) from generate_series(1, 4) i where private.check_signup_allowed(repeat('9', 64))), 3::bigint,
          'D13 three signups per IP per KST day');
select is((select schedule from cron.job where jobname = 'sameplz-monthly-grant'), '0 15 * * *',
          'F4-14 monthly grant cron runs at 00:00 KST');
select private.prepare_budget_months();
select ok(exists (select 1 from public.generation_budget where month = (private.kst_month() + interval '1 month')::date),
          'F4-15 next month budget row is prepared ahead of the reset');

select throws_ok($$ select private.admin_set_budget('00000000-0000-0000-0000-000000000011', private.kst_month(), 5000, 'open', '') $$,
                 'P0001', 'REASON_REQUIRED', 'F4-15 manual budget change needs a reason');
select private.admin_set_budget('00000000-0000-0000-0000-000000000011', private.kst_month(), 5000, 'open', '베타 확대');
select ok((select cap_credits = 5000 from public.generation_budget where month = private.kst_month())
          and (select count(*) = 1 from public.admin_actions where action = 'budget_update'),
          'F4-15 budget change is logged in admin_actions');

-- ---------------------------------------------------------------- client access
select pg_temp.login_as(pg_temp.u('A'));
select ok((select count(*) > 0 from public.credit_lots) and (select count(*) = 0 from public.credit_lots where user_id <> pg_temp.u('A')),
          'users see only their own lots');
select throws_ok($$ select count(*) from public.generation_budget $$, '42501', null, 'budget is not readable by clients');
select throws_ok($$ update public.credit_accounts set available = 99999 $$, '42501', null, 'clients cannot write balances');
select throws_ok($$ select private.place_hold('c0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000a1', 1) $$,
                 '42501', null, 'clients cannot call ledger functions');
select is((public.my_credit_summary() ->> 'daily_limit')::int, 135, 'CRD summary shows the daily limit');
select throws_ok($$ select public.complete_signup_credits('00000000-0000-0000-0000-0000000000a1', null, null) $$,
                 '42501', null, 'clients cannot run the signup grant');
select pg_temp.login_as(pg_temp.u('B'));
select ok((select count(*) = 0 from public.credit_ledger where user_id = pg_temp.u('A'))
          and (select count(*) = 0 from public.credit_holds where user_id = pg_temp.u('A'))
          and (select count(*) = 0 from public.credit_accounts where user_id = pg_temp.u('A')),
          'B cannot read A''s ledger, holds or account');
select pg_temp.login_anon();
select throws_ok($$ select count(*) from public.credit_ledger $$, '42501', null, 'anon cannot read the ledger');
select throws_ok($$ select public.my_credit_summary() $$, '42501', null, 'anon cannot read a credit summary');

-- Signup grant (F4-14 "가입 때 그달 몫") only through the server path that runs the D13 checks.
select pg_temp.login_as(pg_temp.u('F'));
select public.accept_signup_terms('2026-10-v1');
select pg_temp.as_postgres();
select is((select count(*) from public.credit_lots where user_id = pg_temp.u('F')), 0::bigint,
          'D13 accepting terms alone (direct RPC) grants nothing');
select is((public.complete_signup_credits(pg_temp.u('F'), repeat('e', 64), repeat('f', 64)) ->> 'granted')::boolean, true,
          'F4-14 server signup path grants this month');
select public.complete_signup_credits(pg_temp.u('F'), repeat('e', 64), repeat('f', 64));
select is((select sum(count) from public.rate_limit_buckets where key like 'signup:ip:' || repeat('f', 64) || '%'), 1::bigint,
          'D13 repeating the signup path does not consume the IP quota again');

select * from finish();
rollback;
