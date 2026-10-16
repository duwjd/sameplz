-- Runbook 10 P0 alerts: ledger invariants and provider failure rate, each at most once an hour.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select is((public.ops_health() ->> 'ledger_mismatch')::integer, 0, 'P0 the seeded ledger is consistent');

-- Break one account on purpose: available drifts from the ledger.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c901', 'ops@example.test');
insert into public.credit_accounts (user_id, grant_eligible, available) values ('00000000-0000-0000-0000-00000000c901', false, 5);
select is((public.ops_health() ->> 'ledger_mismatch')::integer, 1, 'P0 an account whose balance differs from its ledger is counted');

-- 12 finished cells in the last hour, 5 failed: 41% → over the 30% line.
insert into public.play_runs (id, user_id, mode, client_request_id)
values ('00000000-0000-0000-0000-00000000c910', '00000000-0000-0000-0000-00000000c901', 'blank', gen_random_uuid());
insert into public.play_cells (run_id, user_id, model_id, params, price_credits, price_version, status, finished_at)
select '00000000-0000-0000-0000-00000000c910', '00000000-0000-0000-0000-00000000c901', 'gpt-image-2', '{}', 5, 1,
       case when g <= 5 then 'failed' else 'succeeded' end, now() - interval '5 minutes'
from generate_series(1, 12) g;
select ok((public.ops_health() ->> 'cells_finished')::integer >= 12 and (public.ops_health() ->> 'cells_failed')::integer >= 5,
          'P0 the last hour''s finished and failed cells are counted');

select ok(public.ops_alert_due('ledger'), 'P0 a ledger alert is due before one was sent this hour');
select public.mark_ops_alert('ledger');
select ok(not public.ops_alert_due('ledger'), 'P0 after sending, no second ledger alert this hour');
select ok(public.ops_alert_due('provider'), 'P0 the provider alert has its own window');
select ok(not public.ops_alert_due('anything'), 'P0 unknown kinds are never due');
select ok(not has_function_privilege('authenticated', 'public.ops_health()', 'execute')
          and not has_function_privilege('anon', 'public.mark_ops_alert(text)', 'execute'),
          'P0 only the server reads ops health');

select * from finish();
rollback;
