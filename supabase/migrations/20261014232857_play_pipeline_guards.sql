-- PLAY pipeline guards (PR F security / payment review).
--   1. play_precheck: cheap per-user limit + gate before the costly moderation calls.
--   2. attach_provider_request: an early webhook moves a queued cell to submitted (no resubmit,
--      no 10-minute failure for a job that is really running).
--   3. claim_play_sweep: at most one sweeper run per minute window.
--   4. expire_stale_play_cells: pg_cron-only fallback so holds never stay forever when the HTTP
--      sweeper is not configured or down.

-- ---------------------------------------------------------------- 1. pre-check (before moderation)
-- 10 run attempts per user per minute (the authoritative 5/min in check_run_allowed counts only
-- attempts that reach start_run). Returns null when allowed, otherwise the refusal code.
create or replace function public.play_precheck(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null) then
    return 'LOGIN_REQUIRED';
  end if;
  if exists (select 1 from public.credit_accounts where user_id = p_user and generation_suspended_at is not null) then
    return 'GENERATION_SUSPENDED';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and ai_notice_ack_at is not null) then
    return 'AI_NOTICE_REQUIRED';
  end if;
  if not private.hit_rate_limit('play_precheck:user:' || p_user, 10, interval '1 minute') then
    return 'RATE_LIMITED';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------- 2. early webhook (FM-10)
create or replace function public.attach_provider_request(p_cell uuid, p_provider_request_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.play_cells c
     set provider_request_id = p_provider_request_id,
         status = case when c.status = 'queued' then 'submitted' else c.status end,
         submitted_at = coalesce(c.submitted_at, now()),
         deadline_at = coalesce(c.deadline_at,
           now() + make_interval(secs => (select m.deadline_seconds from public.models m where m.id = c.model_id)))
   where c.id = p_cell and c.provider_request_id is null and c.status in ('queued', 'submitted', 'running');
  return found;
end;
$$;

-- ---------------------------------------------------------------- 3. one sweep per minute
create or replace function public.claim_play_sweep()
returns boolean
language sql
security definer
set search_path = ''
as $$ select private.hit_rate_limit('play_sweep', 1, interval '1 minute') $$;

-- ---------------------------------------------------------------- 4. SQL-only fallback (FM-7/17)
-- Generous windows so it never races the HTTP sweeper: queued for over 1 hour, or 25 hours past the
-- deadline. One cell per transaction (commit per row, same lock-order rule as finish_cell). A cell
-- that reached the provider counts as billed (D12).
create or replace procedure private.expire_stale_play_cells()
language plpgsql
as $$
declare
  c record;
begin
  for c in select id, status, provider_request_id from public.play_cells
            where (status = 'queued' and created_at < now() - interval '1 hour')
               or (status in ('submitted', 'running') and deadline_at < now() - interval '25 hours')
            order by created_at limit 200
  loop
    begin
      perform public.finish_cell(c.id,
        case when c.status = 'queued' then 'failed' else 'expired' end,
        case when c.status = 'queued' then 'PROVIDER_UNAVAILABLE' else 'TIMEOUT' end,
        null, c.provider_request_id is not null);
    exception when others then
      insert into public.abuse_signals (kind, detail)
      values ('play_expire_failed', jsonb_build_object('cell', c.id, 'sqlstate', sqlstate));
    end;
    commit;
  end loop;
end;
$$;

revoke execute on function public.play_precheck(uuid), public.claim_play_sweep() from public, anon, authenticated;
grant execute on function public.play_precheck(uuid), public.claim_play_sweep() to service_role;
revoke execute on procedure private.expire_stale_play_cells() from public, anon, authenticated;
select cron.schedule('sameplz-play-expire', '*/5 * * * *', 'call private.expire_stale_play_cells()');
