-- W4 UP: upload limits (security review H5 / M4). Counters live in the credit ledger's
-- rate_limit_buckets (pruned after 2 days).
--
-- hit_upload_limit — asked before every submit: per user 20 / hour and 40 / day.
-- 'RATE_LIMITED' refuses the submit; null allows it.
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
  return case when ok_hour and ok_day then null else 'RATE_LIMITED' end;
end;
$$;
revoke execute on function public.hit_upload_limit(uuid) from public, anon, authenticated;
grant execute on function public.hit_upload_limit(uuid) to service_role;

-- hit_judge_budget — asked right before the paid layer 2 calls (after layer 1 passed), so cheap
-- failing submits cannot drain it: 2,000 judge runs per day for everyone. false → layer 2 is skipped
-- and the version goes to human review.
create or replace function public.hit_judge_budget()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.hit_rate_limit('upload:all-day', 2000, interval '1 day')
$$;
revoke execute on function public.hit_judge_budget() from public, anon, authenticated;
grant execute on function public.hit_judge_budget() to service_role;

-- hit_upload_target_limit — asked before minting a signed upload URL or inspecting a zip:
-- 60 per user per hour, and no new URLs once the user's folders received over 300MB in the last
-- day (Free plan storage is 1GB). Unsubmitted objects are cleaned up with D18.
create or replace function public.hit_upload_target_limit(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bytes bigint;
begin
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) into v_bytes
    from storage.objects o
   where o.bucket_id in ('recipe-media', 'recipe-files')
     and o.name like p_user::text || '/%'
     and o.created_at > now() - interval '1 day';
  if v_bytes > 300 * 1024 * 1024 then
    return false;
  end if;
  return private.hit_rate_limit('upload-target:user:' || p_user, 60, interval '1 hour');
end;
$$;
revoke execute on function public.hit_upload_target_limit(uuid) from public, anon, authenticated;
grant execute on function public.hit_upload_target_limit(uuid) to service_role;
