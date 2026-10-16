-- P0 ops alerts (architecture §7, runbook 10): credit ledger invariants broken (money rules: ledger sum
-- = available, available + held = Σ lot remaining, nothing negative) and a provider failure-rate spike
-- (failed / expired over 30% of the last hour's finished cells, at least 10). Each kind alerts at most
-- once an hour, marked only after the webhook accepted it (like the budget and SLA alerts).

create or replace function public.ops_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ledger_mismatch', (
      select count(*)::integer from public.credit_accounts a
       where a.available < 0 or a.held < 0
          or a.available <> coalesce((select sum(g.delta) from public.credit_ledger g where g.user_id = a.user_id), 0)
          or a.available + a.held <> coalesce((select sum(l.remaining) from public.credit_lots l where l.user_id = a.user_id), 0)),
    'cells_finished', (
      select count(*)::integer from public.play_cells c
       where c.finished_at > now() - interval '1 hour' and c.status in ('succeeded', 'failed', 'expired')),
    'cells_failed', (
      select count(*)::integer from public.play_cells c
       where c.finished_at > now() - interval '1 hour' and c.status in ('failed', 'expired')))
$$;

-- Hourly window per kind, in rate_limit_buckets (pruned with the others).
create or replace function public.ops_alert_due(p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_kind in ('ledger', 'provider')
     and not exists (select 1 from public.rate_limit_buckets b
                      where b.key = 'ops_alert:' || p_kind
                        and b.window_start = to_timestamp(floor(extract(epoch from now()) / 3600) * 3600))
$$;

create or replace function public.mark_ops_alert(p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.hit_rate_limit('ops_alert:' || p_kind, 1, interval '1 hour') where p_kind in ('ledger', 'provider')
$$;

revoke execute on function public.ops_health(), public.ops_alert_due(text), public.mark_ops_alert(text)
  from public, anon, authenticated;
grant execute on function public.ops_health(), public.ops_alert_due(text), public.mark_ops_alert(text)
  to service_role;
