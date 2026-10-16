-- W7 audit follow-ups (money path, written before the fix): unknown submit outcomes count as spent
-- (FM-17, D12), playground runs are pinned to the received version (F3-8), a past-month grant after
-- this month's is refused (INV-C18), downloads are rate limited.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Users P (holds recipe 03 v1 while v2 is current) and Q (plain runner).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a701', 'audit-p@example.test'),
  ('00000000-0000-0000-0000-00000000a702', 'audit-q@example.test');
update public.profiles set terms_version = '2026-10-v1', terms_accepted_at = now(), adult_confirmed_at = now(),
                           ai_notice_ack_at = now()
 where id in ('00000000-0000-0000-0000-00000000a701', '00000000-0000-0000-0000-00000000a702');
insert into public.credit_accounts (user_id, grant_eligible) values
  ('00000000-0000-0000-0000-00000000a701', true), ('00000000-0000-0000-0000-00000000a702', true);
select private.grant_monthly_credits('00000000-0000-0000-0000-00000000a701', private.kst_month());
select private.grant_monthly_credits('00000000-0000-0000-0000-00000000a702', private.kst_month());
insert into public.generation_budget (month, cap_credits, state) values (private.kst_month(), 100000, 'open')
on conflict (month) do update set cap_credits = 100000, reserved = 0, spent = 0, state = 'open';
insert into public.entitlements (user_id, recipe_id, version_id, source)
values ('00000000-0000-0000-0000-00000000a701', 'aaaaaaaa-0000-0000-0000-000000000003',
        'bbbbbbbb-0000-0000-0000-000000000003', 'free');

-- Own fixture model: 0.01 USD → ceil(8.05) = 9C per image.
insert into public.models (id, provider, endpoint, ref_endpoint, ref_param, ref_max, kind, label, params, deadline_seconds, enabled, sort)
values ('audit-img', 'mock', 'mock/audit-img', null, null, 0, 'image', '감사 이미지',
        '{"quality":{"values":["low"],"default":"low"}}', 60, true, 9101);
insert into public.model_prices (model_id, price_version, rule, active)
values ('audit-img', 1, '{"unit":"image","keys":["quality"],"usd":{"low":0.01}}', true);

create temp table res (k text primary key, v jsonb);
create function pg_temp.run(p_user text, p_n int, p_mode text, p_ver uuid) returns jsonb language sql as $$
  select public.start_run(p_user => p_user::uuid, p_client_request_id => ('e0000000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid,
    p_mode => p_mode, p_recipe_version_id => p_ver, p_variables => '{}',
    p_cells => '[{"model":"audit-img","params":{},"count":1}]', p_price_versions => '{"audit-img":1}',
    p_reference_ids => '{}', p_face_consent => false, p_rendered_prompt => 'rendered prompt',
    p_ip_hash => md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text),
    p_device_hash => md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), p_expected_total => 9)
$$;
create function pg_temp.cell(k text) returns uuid language sql as $$
  select (v -> 'cell_ids' ->> 0)::uuid from res where res.k = $1 $$;
create function pg_temp.spent() returns integer language sql as $$
  select spent from public.generation_budget where month = private.kst_month() $$;
create function pg_temp.avail(p_user text) returns integer language sql as $$
  select available from public.credit_accounts where user_id = p_user::uuid $$;

-- ---------------------------------------------------------------- F3-8 pinned version
select is(pg_temp.run('00000000-0000-0000-0000-00000000a701', 1, 'free', 'bbbbbbbb-0000-0000-0001-000000000003') ->> 'reason',
          'NOT_ENTITLED', 'F3-8 a holder of v1 cannot run v2 without updating');
insert into res values ('p_v1', pg_temp.run('00000000-0000-0000-0000-00000000a701', 2, 'free', 'bbbbbbbb-0000-0000-0000-000000000003'));
select is((select v ->> 'ok' from res where k = 'p_v1'), 'true', 'F3-8 a holder of v1 runs the version they received');

-- ---------------------------------------------------------------- FM-17 unknown submit outcome
insert into res values ('q1', pg_temp.run('00000000-0000-0000-0000-00000000a702', 3, 'blank', null));
insert into res values ('spent0', to_jsonb(pg_temp.spent()));
insert into res values ('avail0', to_jsonb(pg_temp.avail('00000000-0000-0000-0000-00000000a702')));
-- Attempt 1 is claimed and the process dies before mark_cell_submitted: the lease runs out.
select public.claim_cell_submit(pg_temp.cell('q1'));
select ok((select submit_pending_at is not null from public.play_cells where id = pg_temp.cell('q1')),
          'FM-17 a claimed submit is marked pending until its outcome is known');
update public.play_cells set next_attempt_at = now() - interval '1 second' where id = pg_temp.cell('q1');
select is(public.claim_cell_submit(pg_temp.cell('q1')) ->> 'reason', 'OUTCOME_UNKNOWN',
          'FM-17 a cell whose submit outcome is unknown is not submitted again');
select is((select status from public.play_cells where id = pg_temp.cell('q1')), 'failed',
          'FM-17 it fails instead');
select is(pg_temp.spent() - (select (v #>> '{}')::int from res where k = 'spent0'), 9,
          'FM-17 D12 the possible provider job counts as spent (9C)');
select is(pg_temp.avail('00000000-0000-0000-0000-00000000a702'), (select (v #>> '{}')::int from res where k = 'avail0') + 9,
          'FM-17 the member gets the 9C back');

-- A known outcome clears the mark: requeue → the next claim submits normally.
insert into res values ('q2', pg_temp.run('00000000-0000-0000-0000-00000000a702', 4, 'blank', null));
select public.claim_cell_submit(pg_temp.cell('q2'));
select public.requeue_cell(pg_temp.cell('q2'), 'PROVIDER_BUSY');
select ok((select submit_pending_at is null from public.play_cells where id = pg_temp.cell('q2')),
          'FM-17 requeue_cell clears the pending mark');
update public.play_cells set next_attempt_at = now() - interval '1 second' where id = pg_temp.cell('q2');
select is(public.claim_cell_submit(pg_temp.cell('q2')) ->> 'ok', 'true', 'FM-17 a requeued cell is submitted again');
select public.mark_cell_submitted(pg_temp.cell('q2'), 'req-audit-2');
select ok((select submit_pending_at is null and status = 'submitted' from public.play_cells where id = pg_temp.cell('q2')),
          'FM-17 mark_cell_submitted clears the pending mark');

-- The sweeper's 10-minute give-up and the hourly expiry count a pending submit as billed.
insert into res values ('q3', pg_temp.run('00000000-0000-0000-0000-00000000a702', 5, 'blank', null));
select public.claim_cell_submit(pg_temp.cell('q3'));
update public.play_cells set created_at = now() - interval '11 minutes', next_attempt_at = now() - interval '1 second'
 where id = pg_temp.cell('q3');
select is((select (e ->> 'billed')::boolean from jsonb_array_elements(public.sweep_targets() -> 'finish') e
            where (e ->> 'cell')::uuid = pg_temp.cell('q3')), true,
          'FM-17 sweep_targets marks a pending submit as billed');
insert into res values ('spent3', to_jsonb(pg_temp.spent()));
update public.play_cells set created_at = now() - interval '2 hours' where id = pg_temp.cell('q3');
call private.expire_stale_play_cells();
select is(pg_temp.spent() - (select (v #>> '{}')::int from res where k = 'spent3'), 9,
          'FM-17 the hourly expiry counts a pending submit as spent');

-- ---------------------------------------------------------------- INV-C18 past month after this month
select is(private.grant_monthly_credits('00000000-0000-0000-0000-00000000a702', (private.kst_month() - interval '1 month')::date) ->> 'reason',
          'SUPERSEDED', 'INV-C18 a past-month grant after this month''s is refused');
select is((select count(*)::integer from public.credit_lots where user_id = '00000000-0000-0000-0000-00000000a702'), 1,
          'INV-C18 no extra lot is created');

-- ---------------------------------------------------------------- downloads are rate limited
insert into public.rate_limit_buckets (key, window_start, count)
values ('file_dl:user:00000000-0000-0000-0000-00000000a701',
        to_timestamp(floor(extract(epoch from now()) / 3600) * 3600), 120);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a701","role":"authenticated"}', true);
select throws_ok($$ select * from public.file_for_download(gen_random_uuid(), gen_random_uuid()) $$,
                 'P0001', 'RATE_LIMITED', 'F3-5 the 121st download in an hour is refused');
reset role;

select ok(not exists (select 1 from public.credit_accounts a
                       where a.user_id in ('00000000-0000-0000-0000-00000000a701', '00000000-0000-0000-0000-00000000a702')
                         and a.available <> coalesce((select sum(g.delta) from public.credit_ledger g where g.user_id = a.user_id), 0)),
          'INV-C2 ledger sum equals the balance after every scenario');

select * from finish();
rollback;
