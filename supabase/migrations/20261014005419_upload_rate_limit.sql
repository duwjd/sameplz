-- W4 UP: upload limits (security review H5 / M4). Counters live in the credit ledger's
-- rate_limit_buckets (pruned after 2 days).
--
-- hit_upload_limit — asked before every submit, which runs paid layer 2 checks:
--   per user 20 / hour and 40 / day → 'RATE_LIMITED' (refuse);
--   all users 2,000 judge runs / day → 'JUDGE_BUDGET' (submit still allowed, layer 2 skipped → human review);
--   null when allowed.
create or replace function public.hit_upload_limit(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ok_hour boolean := private.hit_rate_limit('upload:user:' || p_user, 20, interval '1 hour');
  ok_day boolean := private.hit_rate_limit('upload:user-day:' || p_user, 40, interval '1 day');
begin
  if not (ok_hour and ok_day) then
    return 'RATE_LIMITED';
  end if;
  if not private.hit_rate_limit('upload:all-day', 2000, interval '1 day') then
    return 'JUDGE_BUDGET';
  end if;
  return null;
end;
$$;
revoke execute on function public.hit_upload_limit(uuid) from public, anon, authenticated;
grant execute on function public.hit_upload_limit(uuid) to service_role;

-- hit_upload_target_limit — asked before minting a signed upload URL (each can store up to the
-- bucket limit): 60 per user per hour. Unsubmitted objects are cleaned up with D18.
create or replace function public.hit_upload_target_limit(p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.hit_rate_limit('upload-target:user:' || p_user, 60, interval '1 hour')
$$;
revoke execute on function public.hit_upload_target_limit(uuid) from public, anon, authenticated;
grant execute on function public.hit_upload_target_limit(uuid) to service_role;
