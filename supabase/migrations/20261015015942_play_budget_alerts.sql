-- F4-15 / D12: tell the operator when this month's generation budget reaches 80% and 100%.
-- place_hold already stamps alerted_80_at; the minute sweeper reads pending alerts, posts them to
-- the ops webhook (OPS_ALERT_WEBHOOK_URL), and marks each level sent only after a successful post.
alter table public.generation_budget
  add column notified_80_at timestamptz,
  add column notified_100_at timestamptz;

-- Levels due for the current KST month: 80 when alerted_80_at is set, 100 when the cap is used up
-- or generation is paused — each only once.
create or replace function public.pending_budget_alerts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'month', b.month, 'level', lvl.level, 'cap', b.cap_credits,
           'used', b.reserved + b.spent, 'state', b.state)), '[]'::jsonb)
    from public.generation_budget b
    cross join lateral (values (80), (100)) as lvl(level)
   where b.month = private.kst_month()
     and ((lvl.level = 80 and b.alerted_80_at is not null and b.notified_80_at is null)
       or (lvl.level = 100 and b.notified_100_at is null
           and (b.state <> 'open' or b.reserved + b.spent >= b.cap_credits)))
$$;

create or replace function public.mark_budget_alert(p_month date, p_level integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_level = 80 then
    update public.generation_budget set notified_80_at = now() where month = p_month and notified_80_at is null;
  elsif p_level = 100 then
    update public.generation_budget set notified_100_at = now() where month = p_month and notified_100_at is null;
  else
    raise exception using errcode = 'P0001', message = 'INVALID_LEVEL';
  end if;
  return found;
end;
$$;

revoke execute on function public.pending_budget_alerts(), public.mark_budget_alert(date, integer)
  from public, anon, authenticated;
grant execute on function public.pending_budget_alerts(), public.mark_budget_alert(date, integer) to service_role;
