-- W4 UP: submit rate limit. Each submit runs paid layer 2 checks (moderation + LLM judge), so the
-- server action asks this first. 20 submits per user per hour; the counter lives in the credit
-- ledger's rate_limit_buckets (pruned with them).
create or replace function public.hit_upload_limit(p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.hit_rate_limit('upload:user:' || p_user, 20, interval '1 hour')
$$;
revoke execute on function public.hit_upload_limit(uuid) from public, anon, authenticated;
grant execute on function public.hit_upload_limit(uuid) to service_role;
