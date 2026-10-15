-- F4-15 / D12: operator alerts at 80% and 100% of the monthly generation budget, each once.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

update public.generation_budget
   set cap_credits = 1000, reserved = 0, spent = 0, state = 'open', alerted_80_at = null,
       notified_80_at = null, notified_100_at = null
 where month = private.kst_month();

select is(public.pending_budget_alerts(), '[]'::jsonb, 'F4-15 nothing is due under 80%');

update public.generation_budget set spent = 800, alerted_80_at = now() where month = private.kst_month();
select is((select jsonb_agg(e ->> 'level') from jsonb_array_elements(public.pending_budget_alerts()) e),
          '["80"]'::jsonb, 'F4-15 the 80% alert is due once alerted_80_at is set');
select is((public.pending_budget_alerts() -> 0 ->> 'used')::int, 800, 'F4-15 the alert carries the usage');
select ok(public.mark_budget_alert(private.kst_month(), 80), 'F4-15 marking the 80% alert sent');
select ok(not public.mark_budget_alert(private.kst_month(), 80), 'F4-15 a level is marked only once');
select is(public.pending_budget_alerts(), '[]'::jsonb, 'F4-15 a sent level is not due again');

update public.generation_budget set spent = 1000 where month = private.kst_month();
select is((select jsonb_agg(e ->> 'level') from jsonb_array_elements(public.pending_budget_alerts()) e),
          '["100"]'::jsonb, 'F4-15 the 100% alert is due when the cap is used up');
update public.generation_budget set spent = 10, state = 'paused' where month = private.kst_month();
select is((select jsonb_agg(e ->> 'level') from jsonb_array_elements(public.pending_budget_alerts()) e),
          '["100"]'::jsonb, 'F4-15 a paused budget also counts as closed');

set local role authenticated;
select throws_ok($$ select public.pending_budget_alerts() $$, '42501', null,
                 'F4-15 clients cannot read or mark budget alerts');
reset role;

select * from finish();
rollback;
