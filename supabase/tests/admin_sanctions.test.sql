-- F8-4 MVP (money path for adjustments — written before the implementation): sanction ladder chosen by an
-- admin (warning → seller suspension → account suspension → ban), generation-suspension lift, credit
-- adjustments as adjust rows, linked accounts by device / IP hash (D13, probabilistic).
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- S is sanctioned; T shares S's device and gets credit adjustments. A is the seed admin (…0011).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000b801', 'sanc-s@example.test'),
  ('00000000-0000-0000-0000-00000000b802', 'sanc-t@example.test');
update public.profiles set terms_version = '2026-10-v1', terms_accepted_at = now(), adult_confirmed_at = now(),
                           ai_notice_ack_at = now()
 where id in ('00000000-0000-0000-0000-00000000b801', '00000000-0000-0000-0000-00000000b802');
insert into public.credit_accounts (user_id, grant_eligible) values
  ('00000000-0000-0000-0000-00000000b801', true), ('00000000-0000-0000-0000-00000000b802', true);
select private.grant_monthly_credits('00000000-0000-0000-0000-00000000b802', private.kst_month());
insert into public.account_devices (user_id, device_hash, ip_hash) values
  ('00000000-0000-0000-0000-00000000b801', repeat('e', 64), repeat('f', 64)),
  ('00000000-0000-0000-0000-00000000b802', repeat('e', 64), null);
-- S's own private recipe (for the seller-suspension version check).
insert into public.recipes (id, public_id, owner_id, category, prompt_kind, title, summary, status, creator_nickname, job_codes)
values ('00000000-0000-0000-0000-00000000b810', 'rsanc00001', '00000000-0000-0000-0000-00000000b801',
        'prompt', 'image', '제재 시험', '요약', 'private', '제재', array['commerce']);

create function pg_temp.login_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;
create function pg_temp.level() returns text language sql as $$
  select private.active_sanction('00000000-0000-0000-0000-00000000b801') $$;
create function pg_temp.sanction(p_level text, p_days integer default null) returns jsonb language sql as $$
  select public.admin_sanction('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-00000000b801',
                               p_level, 'policy_violation', '시험 메모', p_days) $$;
create function pg_temp.adjust(p_amount integer, p_idem text) returns jsonb language sql as $$
  select public.admin_adjust_credits('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-00000000b802',
                                     p_amount, '이벤트 보상', p_idem) $$;
create function pg_temp.avail() returns integer language sql as $$
  select available from public.credit_accounts where user_id = '00000000-0000-0000-0000-00000000b802' $$;
create temp table res (k text primary key, v jsonb);
grant all on res to authenticated;

-- ---------------------------------------------------------------- who and why
select throws_ok($$ select public.admin_sanction('00000000-0000-0000-0000-00000000b802', '00000000-0000-0000-0000-00000000b801',
                    'warning', 'policy_violation', '', null) $$, 'P0001', 'NOT_ADMIN', 'F8-4 only an admin sanctions');
select throws_ok($$ select public.admin_sanction('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-00000000b801',
                    'warning', null, '', null) $$, 'P0001', 'REASON_REQUIRED', 'F8-4 every sanction has a reason');
select throws_ok($$ select public.admin_sanction('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000011',
                    'warning', 'other', '', null) $$, 'P0001', 'CANNOT_SANCTION_ADMIN', 'F8-4 admins cannot be sanctioned here');

-- ---------------------------------------------------------------- warning blocks nothing
select pg_temp.sanction('warning');
select is(pg_temp.level(), 'warning', 'F8-4 a warning is active');
select pg_temp.login_as('00000000-0000-0000-0000-00000000b801');
select lives_ok($$ select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000001') $$,
                'F8-4 a warned member still receives recipes');
select pg_temp.as_postgres();

-- ---------------------------------------------------------------- seller suspension: uploads only
insert into res select 'seller', pg_temp.sanction('seller_suspended', 7);
select throws_ok($$ insert into public.recipe_drafts (owner_id, category, payload)
                    values ('00000000-0000-0000-0000-00000000b801', 'prompt', '{}') $$,
                 'P0001', 'SELLER_SUSPENDED', 'F8-4 a seller suspension refuses new drafts');
select throws_ok($$ insert into public.recipe_versions (recipe_id, version_no, changelog, review_status, public_meta)
                    values ('00000000-0000-0000-0000-00000000b810', 1, '첫 버전', 'draft', '{}') $$,
                 'P0001', 'SELLER_SUSPENDED', 'F8-4 a seller suspension refuses new versions');
select pg_temp.login_as('00000000-0000-0000-0000-00000000b801');
select lives_ok($$ insert into public.recipe_likes (user_id, recipe_id)
                   values ('00000000-0000-0000-0000-00000000b801', 'aaaaaaaa-0000-0000-0000-000000000002') $$,
                'F8-4 a seller-suspended member can still like');
select pg_temp.as_postgres();
select is(public.admin_lift_sanction('00000000-0000-0000-0000-000000000011',
            (select (v ->> 'id')::uuid from res where k = 'seller'), '소명 확인') ->> 'ok', 'true',
          'F8-4 an admin lifts a sanction');
select is(pg_temp.level(), 'warning', 'F8-4 after the lift only the warning is left');

-- ---------------------------------------------------------------- account suspension
insert into res select 'account', pg_temp.sanction('account_suspended', 30);
select is(pg_temp.level(), 'account_suspended', 'F8-4 the heaviest active level wins');
select pg_temp.login_as('00000000-0000-0000-0000-00000000b801');
select throws_ok($$ select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000003') $$,
                 'P0001', 'ACCOUNT_SUSPENDED', 'F8-4 a suspended member cannot receive recipes');
select throws_ok($$ insert into public.follows (follower_id, followee_id)
                    values ('00000000-0000-0000-0000-00000000b801', '00000000-0000-0000-0000-000000000006') $$,
                 'P0001', 'ACCOUNT_SUSPENDED', 'F8-4 a suspended member cannot follow');
select lives_ok($$ select public.open_original((select id from public.entitlements
                    where user_id = '00000000-0000-0000-0000-00000000b801' and recipe_id = 'aaaaaaaa-0000-0000-0000-000000000001')) $$,
                'F8-4 a suspended member still opens what they received');
select pg_temp.as_postgres();
select is(private.check_run_allowed('00000000-0000-0000-0000-00000000b801', 9, null, null), 'ACCOUNT_SUSPENDED',
          'F8-4 a suspended member cannot generate');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason)
                    values ('00000000-0000-0000-0000-00000000b801', 'recipe', 'aaaaaaaa-0000-0000-0000-000000000002', 'misleading') $$,
                 'P0001', 'ACCOUNT_SUSPENDED', 'F8-4 a suspended member cannot report');
select is((select count(*)::integer from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000b801' and kind = 'account_sanctioned'), 4,
          'F8-4 the member is told of each sanction and lift (warning, seller, lift, account)');
select ok((select body ~ '사유' from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000b801' and kind = 'account_sanctioned'
            order by id desc limit 1), 'F8-4 the notice carries the reason');
select is((select count(*)::integer from public.admin_actions
            where target_id = '00000000-0000-0000-0000-00000000b801' and action like 'user_%'), 4,
          'F8-4 every sanction and lift is in admin_actions');

-- An ended suspension stops applying without any job.
set local session_replication_role = replica;
update public.account_sanctions set starts_at = now() - interval '31 days', ends_at = now() - interval '1 second'
 where id = (select (v ->> 'id')::uuid from res where k = 'account');
set local session_replication_role = origin;
select is(pg_temp.level(), 'warning', 'F8-4 an ended suspension no longer applies');
select pg_temp.login_as('00000000-0000-0000-0000-00000000b801');
select lives_ok($$ select public.claim_free_recipe('aaaaaaaa-0000-0000-0000-000000000003') $$,
                'F8-4 after the suspension ends the member receives again');
select pg_temp.as_postgres();

-- ---------------------------------------------------------------- ban
select pg_temp.sanction('banned');
select is((select grant_eligible from public.credit_accounts where user_id = '00000000-0000-0000-0000-00000000b801'), false,
          'F8-4 a ban stops the monthly free credits');
select is(private.check_run_allowed('00000000-0000-0000-0000-00000000b801', 9, null, null), 'ACCOUNT_SUSPENDED',
          'F8-4 a banned member cannot generate');
select throws_ok($$ update public.account_sanctions set level = 'warning'
                    where user_id = '00000000-0000-0000-0000-00000000b801' and level = 'banned' $$,
                 'P0001', 'SANCTION_IMMUTABLE', 'F8-4 a sanction cannot be rewritten, only lifted');

-- ---------------------------------------------------------------- generation suspension lift
update public.credit_accounts set generation_suspended_at = now() where user_id = '00000000-0000-0000-0000-00000000b802';
select public.admin_lift_generation_suspension('00000000-0000-0000-0000-000000000011',
                                               '00000000-0000-0000-0000-00000000b802', '오탐 확인');
select ok((select generation_suspended_at is null from public.credit_accounts where user_id = '00000000-0000-0000-0000-00000000b802'),
          'F8-4 an admin lifts an automatic generation suspension');

-- ---------------------------------------------------------------- credit adjustments (T has 270C)
select pg_temp.adjust(50, 'adj-1');
select is(pg_temp.avail(), 320, 'F8-4 +50C raises the balance');
select ok((select count(*) = 1 from public.credit_lots
            where user_id = '00000000-0000-0000-0000-00000000b802' and kind = 'promo' and amount = 50
              and expires_at = private.month_end_at(private.kst_month())),
          'F8-4 +50C is a promo lot that lapses at this month''s reset (no carry-over, D11)');
select is(pg_temp.adjust(50, 'adj-1') ->> 'duplicate', 'true', 'F8-4 the same idem key adjusts once');
select is(pg_temp.avail(), 320, 'F8-4 a repeated adjustment changes nothing');
select private.place_hold('c0000000-0000-0000-0000-0000000b8001', '00000000-0000-0000-0000-00000000b802', 20);
select pg_temp.adjust(-100, 'adj-2');
select ok((select remaining = 170 and held = 20 from public.credit_lots
            where user_id = '00000000-0000-0000-0000-00000000b802' and kind = 'monthly_grant'),
          'F8-4 −100C comes off the soonest-expiring lot and leaves the held part alone');
select is(pg_temp.avail(), 200, 'F8-4 −100C lowers the balance (320 − 20 held − 100)');
select throws_ok($$ select pg_temp.adjust(-1001, 'adj-3') $$, 'P0001', 'INVALID_AMOUNT',
                 'F8-4 adjustments stay within ±1000C');
select throws_ok($$ select pg_temp.adjust(-500, 'adj-4') $$, 'P0001', 'INSUFFICIENT',
                 'F8-4 a deduction cannot exceed what the member can spend');
select throws_ok($$ select pg_temp.adjust(0, 'adj-5') $$, 'P0001', 'INVALID_AMOUNT', 'F8-4 a zero adjustment is refused');
select ok((select a.available = (select sum(g.delta) from public.credit_ledger g where g.user_id = a.user_id)
                  and a.held = 20
             from public.credit_accounts a where a.user_id = '00000000-0000-0000-0000-00000000b802'),
          'INV-C2 ledger sum equals the balance and the hold is untouched');
select is((select count(*)::integer from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000b802' and kind = 'credit_adjusted'), 2,
          'F8-4 the member is told of each adjustment');

-- ---------------------------------------------------------------- linked accounts, privileges, RLS
insert into res select 'linked', public.admin_linked_accounts('00000000-0000-0000-0000-000000000011',
                                                             '00000000-0000-0000-0000-00000000b801');
select ok((select v::text ~ '00000000-0000-0000-0000-00000000b802' from res where k = 'linked'),
          'F8-4 an account on the same device is listed');
select ok((select v::text !~ 'eeeeeeeeeeee' from res where k = 'linked'), 'F8-4 the hash itself is never returned');
select ok(not has_function_privilege('authenticated', 'public.admin_sanction(uuid, uuid, text, text, text, integer)', 'execute')
          and not has_function_privilege('authenticated', 'public.admin_adjust_credits(uuid, uuid, integer, text, text)', 'execute'),
          'F8-4 members cannot run the admin RPCs');
select pg_temp.login_as('00000000-0000-0000-0000-00000000b802');
select is((select count(*)::integer from public.account_sanctions where user_id = '00000000-0000-0000-0000-00000000b801'), 0,
          'F8-4 a member cannot see someone else''s sanctions');
select pg_temp.as_postgres();

select * from finish();
rollback;
