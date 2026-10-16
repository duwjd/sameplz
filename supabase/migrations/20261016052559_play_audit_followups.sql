-- W7 audit follow-ups (payment-auditor / security-auditor on PR #42). Each function is its latest
-- definition with one change.
-- 1 FM-17 / D12: a submit whose outcome is unknown (begin_cell_submit ran right before the provider call,
--   then the lease ran out before mark_cell_submitted) is never resubmitted and counts as spent; the sweeper's 10-minute give-up and the hourly expiry book it too.
-- 2 F3-8: playground runs of a received recipe use the version the member received.
-- 3 INV-C18: no past-month grant once a later month was granted.
-- 4 Lock order device → account in complete_signup_credits (as in grant_monthly_credits).
-- 5 F3-5: downloads rate limited per member.

alter table public.play_cells add column submit_pending_at timestamptz;

-- Called right before the provider call (not at claim): a claim that dies earlier is simply retried.
create or replace function public.begin_cell_submit(p_cell uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.play_cells set submit_pending_at = now() where id = p_cell and status = 'queued';
  return found;
end;
$$;
revoke execute on function public.begin_cell_submit(uuid) from public, anon, authenticated;
grant execute on function public.begin_cell_submit(uuid) to service_role;

create or replace function public.claim_cell_submit(p_cell uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.play_cells%rowtype;
  m public.models%rowtype;
  r public.play_runs%rowtype;
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select * into c from public.play_cells where id = p_cell for update;
  if not found or c.status <> 'queued' or c.next_attempt_at > now() then
    return jsonb_build_object('ok', false, 'reason', 'NOT_QUEUED');
  end if;
  -- The previous attempt's lease ran out with no known outcome: the provider job may exist. Never submit
  -- again (no double billing); end it with the credits back and the budget booked as spent (D12).
  if c.submit_pending_at is not null then
    perform public.finish_cell(p_cell, 'failed', 'PROVIDER_ERROR', null, true);
    return jsonb_build_object('ok', false, 'reason', 'OUTCOME_UNKNOWN');
  end if;
  if c.attempts >= 3 then
    perform public.finish_cell(p_cell, 'failed', 'PROVIDER_UNAVAILABLE');
    return jsonb_build_object('ok', false, 'reason', 'EXHAUSTED');
  end if;
  update public.play_cells
     set attempts = attempts + 1, webhook_token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex'),
         next_attempt_at = now() + interval '5 minutes'   -- lease: a crash before mark_cell_submitted retries later
   where id = p_cell;
  select * into m from public.models where id = c.model_id;
  select * into r from public.play_runs where id = c.run_id;
  return jsonb_build_object('ok', true, 'token', token, 'provider', m.provider, 'kind', m.kind,
    'endpoint', case when cardinality(r.reference_ids) > 0 then m.ref_endpoint else m.endpoint end,
    'ref_param', case when cardinality(r.reference_ids) > 0 then m.ref_param end,
    'model_id', c.model_id, 'params', c.params, 'run_id', c.run_id, 'user_id', c.user_id,
    'reference_ids', to_jsonb(r.reference_ids), 'attempt', c.attempts + 1);
end;
$$;

create or replace function public.mark_cell_submitted(p_cell uuid, p_provider_request_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.play_cells c
     set status = 'submitted', submit_pending_at = null, provider_request_id = coalesce(c.provider_request_id, p_provider_request_id),
         submitted_at = now(),
         deadline_at = now() + make_interval(secs => (select m.deadline_seconds from public.models m where m.id = c.model_id))
   where c.id = p_cell and c.status = 'queued';
  return found;
end;
$$;

create or replace function public.requeue_cell(p_cell uuid, p_error_code text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.play_cells
     set submit_pending_at = null, next_attempt_at = now() + make_interval(mins => greatest(attempts, 1)),
         error_code = case when p_error_code ~ '^[A-Z_]{2,40}$' then p_error_code
                           when p_error_code is not null then 'PROVIDER_ERROR' end
   where id = p_cell and status = 'queued';
  return found;
end;
$$;

create or replace function public.sweep_targets()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'finish', (select coalesce(jsonb_agg(jsonb_build_object('cell', s.id, 'status', s.st, 'error_code', s.code,
                                                            'billed', s.billed)
                                         order by s.created_at), '[]'::jsonb)
                 from (select id, created_at, 'failed' as st, 'PROVIDER_UNAVAILABLE' as code,
                              submit_pending_at is not null as billed from public.play_cells
                        where status = 'queued' and created_at < now() - interval '10 minutes' and next_attempt_at <= now()
                       union all
                       select id, created_at, 'expired', 'TIMEOUT', provider_request_id is not null from public.play_cells
                        where status in ('submitted', 'running') and deadline_at < now() - interval '24 hours'
                       order by created_at limit 100) s),
    'resubmit', (select coalesce(jsonb_agg(id order by next_attempt_at), '[]'::jsonb) from (
                   select id, next_attempt_at from public.play_cells
                    where status = 'queued' and next_attempt_at <= now()
                      and created_at >= now() - interval '10 minutes'
                    order by next_attempt_at limit 50) s),
    'poll', (select coalesce(jsonb_agg(jsonb_build_object('cell', s.id, 'provider_request_id', s.provider_request_id,
                                                          'endpoint', s.endpoint, 'provider', s.provider,
                                                          'deadline_at', s.deadline_at) order by s.deadline_at), '[]'::jsonb)
               from (select c.id, c.provider_request_id, c.deadline_at, m.provider,
                            case when cardinality(r.reference_ids) > 0 then m.ref_endpoint else m.endpoint end as endpoint
                       from public.play_cells c join public.models m on m.id = c.model_id
                       join public.play_runs r on r.id = c.run_id
                      where c.status in ('submitted', 'running') and c.deadline_at < now()
                      order by c.deadline_at limit 50) s),
    'expired_refs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', path)), '[]'::jsonb)
                       from (select id, path from public.play_refs where delete_after <= now()
                              order by delete_after limit 100) s),
    'expired_results', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', result_path)), '[]'::jsonb)
                          from (select id, result_path from public.play_cells
                                 where result_path is not null and saved_at is null and delete_after <= now()
                                 order by delete_after limit 100) s))
$$;

create or replace procedure private.expire_stale_play_cells()
language plpgsql
as $$
declare
  c record;
begin
  for c in select id, status, provider_request_id, submit_pending_at from public.play_cells
            where (status = 'queued' and created_at < now() - interval '1 hour')
               or (status in ('submitted', 'running') and deadline_at < now() - interval '25 hours')
            order by created_at limit 200
  loop
    begin
      perform public.finish_cell(c.id,
        case when c.status = 'queued' then 'failed' else 'expired' end,
        case when c.status = 'queued' then 'PROVIDER_UNAVAILABLE' else 'TIMEOUT' end,
        null, c.provider_request_id is not null or c.submit_pending_at is not null);
    exception when others then
      insert into public.abuse_signals (kind, detail)
      values ('play_expire_failed', jsonb_build_object('cell', c.id, 'sqlstate', sqlstate));
    end;
    commit;
  end loop;
end;
$$;

create or replace function public.start_run(
  p_user uuid, p_client_request_id uuid, p_mode text, p_recipe_version_id uuid, p_variables jsonb,
  p_cells jsonb, p_price_versions jsonb, p_reference_ids uuid[], p_face_consent boolean,
  p_rendered_prompt text, p_ip_hash text, p_device_hash text, p_expected_total integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid;
  v_cell uuid;
  ids uuid[] := '{}';
  refs integer := coalesce(cardinality(p_reference_ids), 0);
  q jsonb;
  total integer;
  reason text;
  c jsonb;
  i integer;
  hold jsonb;
  detail text;
begin
  if p_user is null or p_client_request_id is null or p_rendered_prompt is null
     or char_length(btrim(p_rendered_prompt)) = 0 or char_length(p_rendered_prompt) > 8000
     or p_mode is null or p_mode not in ('own', 'free', 'blank')
     or (p_variables is not null and jsonb_typeof(p_variables) <> 'object') then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_PARAMS');
  end if;

  -- One run per (user, client_request_id): serialize the user's starts on the account row.
  perform private.ensure_credit_account(p_user);
  perform 1 from public.credit_accounts where user_id = p_user for update;
  select id into v_run from public.play_runs where user_id = p_user and client_request_id = p_client_request_id;
  if v_run is not null then
    return jsonb_build_object('ok', true, 'existing', true, 'run_id', v_run,
      'cell_ids', (select coalesce(jsonb_agg(id order by created_at, id), '[]'::jsonb)
                     from public.play_cells where run_id = v_run));
  end if;

  if not exists (select 1 from public.profiles where id = p_user and ai_notice_ack_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'AI_NOTICE_REQUIRED');
  end if;

  -- Mode: own recipe / received free recipe / blank prompt. Only prompt recipes run here.
  if p_mode = 'blank' then
    if p_recipe_version_id is not null then
      return jsonb_build_object('ok', false, 'reason', 'NOT_ENTITLED');
    end if;
  elsif p_mode = 'own' then
    if not exists (select 1 from public.recipe_versions v join public.recipes r on r.id = v.recipe_id
                    where v.id = p_recipe_version_id and r.owner_id = p_user and r.category = 'prompt') then
      return jsonb_build_object('ok', false, 'reason', 'NOT_ENTITLED');
    end if;
  else
    if not exists (select 1 from public.recipe_versions v
                     join public.recipes r on r.id = v.recipe_id
                     join public.entitlements e on e.recipe_id = r.id
                    where v.id = p_recipe_version_id and v.review_status = 'approved' and r.category = 'prompt'
                      and r.status = 'live' and e.user_id = p_user and e.revoked_at is null
                      and e.version_id = v.id) then  -- F3-8: the version they received
      return jsonb_build_object('ok', false, 'reason', 'NOT_ENTITLED');
    end if;
  end if;

  if refs > 0 then
    if refs > 4 or (select count(distinct x) from unnest(p_reference_ids) x) <> refs
       or (select count(*) from public.play_refs f
            where f.id = any (p_reference_ids) and f.user_id = p_user and f.delete_after > now()) <> refs
       or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_cells) = 'array' then p_cells else '[]' end) e
                   left join public.models m on m.id = e ->> 'model'
                   where m.id is null or m.ref_max < refs) then
      return jsonb_build_object('ok', false, 'reason', 'INVALID_REFERENCE');
    end if;
    if not coalesce(p_face_consent, false) then
      return jsonb_build_object('ok', false, 'reason', 'FACE_CONSENT_REQUIRED');
    end if;
  end if;

  begin
    q := private.quote_cells(p_cells, refs);
  exception when sqlstate 'P0001' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_PARAMS');
  end;
  if p_price_versions is null or q -> 'price_versions' <> p_price_versions then
    return jsonb_build_object('ok', false, 'reason', 'PRICE_CHANGED');
  end if;
  total := (q ->> 'total')::integer;
  -- The quote the user saw (F4-1): also catches a changed default or allowed value within a price version.
  if p_expected_total is not null and p_expected_total <> total then
    return jsonb_build_object('ok', false, 'reason', 'PRICE_CHANGED');
  end if;

  reason := private.check_run_allowed(p_user, total, p_ip_hash, p_device_hash);   -- rate buckets persist
  if reason is not null then
    if reason = 'INSUFFICIENT_CREDITS' then
      return jsonb_build_object('ok', false, 'reason', reason,
                                'shortfall', total - private.spendable_credits(p_user));
    end if;
    return jsonb_build_object('ok', false, 'reason', reason);
  end if;

  -- All or nothing: any failed hold rolls the whole block back (run, cells, prompt, holds, budget).
  begin
    insert into public.play_runs (user_id, mode, recipe_version_id, client_request_id, variables,
                                  reference_ids, face_consent_at)
    values (p_user, p_mode, p_recipe_version_id, p_client_request_id, coalesce(p_variables, '{}'::jsonb),
            coalesce(p_reference_ids, '{}'), case when refs > 0 then now() end)
    returning id into v_run;
    insert into private.play_prompts (run_id, rendered) values (v_run, p_rendered_prompt);
    if refs > 0 then
      insert into public.face_consents (run_id, ref_id, user_id) select v_run, x, p_user from unnest(p_reference_ids) x;
    end if;
    for c in select * from jsonb_array_elements(q -> 'cells') loop
      for i in 1 .. (c ->> 'count')::integer loop
        insert into public.play_cells (run_id, user_id, model_id, params, price_credits, price_version)
        values (v_run, p_user, c ->> 'model', c -> 'params', (c ->> 'credits')::integer,
                (q -> 'price_versions' ->> (c ->> 'model'))::integer)
        returning id into v_cell;
        hold := private.place_hold(v_cell, p_user, (c ->> 'credits')::integer);
        if not coalesce((hold ->> 'ok')::boolean, false) then
          raise exception using errcode = 'P0001', message = 'HOLD_FAILED', detail = hold::text;
        end if;
        ids := ids || v_cell;
      end loop;
    end loop;
  exception when sqlstate 'P0001' then
    get stacked diagnostics detail = pg_exception_detail;
    if sqlerrm = 'HOLD_FAILED' then
      if detail::jsonb ->> 'reason' = 'INSUFFICIENT_CREDITS' then   -- shortfall for the whole run
        return jsonb_build_object('ok', false, 'reason', 'INSUFFICIENT_CREDITS',
                                  'shortfall', greatest(total - private.spendable_credits(p_user), 1));
      end if;
      return jsonb_build_object('ok', false, 'reason', detail::jsonb ->> 'reason');
    end if;
    raise;
  end;
  return jsonb_build_object('ok', true, 'existing', false, 'run_id', v_run, 'cell_ids', to_jsonb(ids),
                            'total', total);
end;
$$;

create or replace function private.grant_monthly_credits(p_user uuid, p_month date default private.kst_month())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pol record;
  v_lot uuid;
  old record;
begin
  select * into pol from private.credit_policy();
  -- Only the current or a past month; never pre-grant (an early grant would expire this month's lot).
  if p_month is null or extract(day from p_month) <> 1 or p_month > private.kst_month() then
    raise exception using errcode = 'P0001', message = 'INVALID_MONTH';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = p_user and p.deleted_at is null
                   and p.terms_accepted_at is not null and p.adult_confirmed_at is not null) then
    return jsonb_build_object('granted', false, 'lot_id', null, 'reason', 'SIGNUP_INCOMPLETE');
  end if;

  -- Serialize grants per device first (D13 race: two accounts on one device granting at once),
  -- then per user.
  perform pg_advisory_xact_lock(hashtextextended('device:' || d.device_hash, 0))
     from (select device_hash from public.account_devices where user_id = p_user order by device_hash) d;
  perform private.ensure_credit_account(p_user);
  perform 1 from public.credit_accounts where user_id = p_user for update;
  -- INV-C18: never back-fill a month once a later month was granted (it would be an expired lot that
  -- inflates available until expire_bonus runs).
  if exists (select 1 from public.credit_lots l where l.user_id = p_user and l.grant_month > p_month) then
    return jsonb_build_object('granted', false, 'lot_id', null, 'reason', 'SUPERSEDED');
  end if;
  if not (select grant_eligible from public.credit_accounts where user_id = p_user) then
    return jsonb_build_object('granted', false, 'lot_id', null, 'reason', 'NOT_ELIGIBLE');
  end if;

  select id into v_lot from public.credit_lots
   where user_id = p_user and kind = 'monthly_grant' and grant_month = p_month;
  if v_lot is not null then
    return jsonb_build_object('granted', false, 'lot_id', v_lot, 'reason', 'ALREADY_GRANTED');
  end if;

  -- D13: one free grant per device per month.
  if exists (select 1
             from public.account_devices mine
             join public.account_devices other
               on other.device_hash = mine.device_hash and other.user_id <> mine.user_id
             join public.credit_lots l
               on l.user_id = other.user_id and l.kind = 'monthly_grant' and l.grant_month = p_month
             where mine.user_id = p_user) then
    if not exists (select 1 from public.abuse_signals
                   where user_id = p_user and kind = 'shared_device_grant' and detail ->> 'month' = p_month::text) then
      insert into public.abuse_signals (user_id, kind, detail)
      values (p_user, 'shared_device_grant', jsonb_build_object('month', p_month));
    end if;
    return jsonb_build_object('granted', false, 'lot_id', null, 'reason', 'SHARED_DEVICE');
  end if;

  -- Reset: older monthly lots' unheld remainder expires (no carry-over, D11); other lots only once lapsed.
  for old in select id from public.credit_lots
             where user_id = p_user and remaining > held
               and ((kind = 'monthly_grant' and grant_month < p_month) or expires_at <= now())
             order by created_at
  loop
    perform private.expire_lot(old.id);
  end loop;

  insert into public.credit_lots (user_id, kind, grant_month, amount, remaining, expires_at)
  values (p_user, 'monthly_grant', p_month, pol.monthly_grant, pol.monthly_grant, private.month_end_at(p_month))
  returning id into v_lot;
  insert into public.credit_ledger (user_id, lot_id, entry_type, delta, idem_key)
  values (p_user, v_lot, 'grant', pol.monthly_grant, 'grant:' || p_user || ':' || p_month);
  update public.credit_accounts set available = available + pol.monthly_grant, updated_at = now()
   where user_id = p_user;
  return jsonb_build_object('granted', true, 'lot_id', v_lot, 'reason', null);
end;
$$;

create or replace function public.complete_signup_credits(p_user uuid, p_device_hash text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = p_user and p.deleted_at is null
                   and p.terms_accepted_at is not null and p.adult_confirmed_at is not null) then
    return jsonb_build_object('granted', false, 'reason', 'SIGNUP_INCOMPLETE');
  end if;
  -- Same lock order as grant_monthly_credits (device, then account): the 00:00 KST monthly cron and a
  -- signup finishing at the same moment must not deadlock.
  perform pg_advisory_xact_lock(hashtextextended('device:' || d.device_hash, 0))
     from (select device_hash from public.account_devices where user_id = p_user
           union select p_device_hash where p_device_hash is not null
           order by 1) d;
  perform private.ensure_credit_account(p_user);
  perform 1 from public.credit_accounts where user_id = p_user for update;
  if not (select grant_eligible from public.credit_accounts where user_id = p_user) then
    if p_ip_hash is not null and not private.check_signup_allowed(p_ip_hash) then
      insert into public.abuse_signals (user_id, key_hash, kind) values (p_user, p_ip_hash, 'signup_rate_limited');
      return jsonb_build_object('granted', false, 'reason', 'RATE_LIMITED');
    end if;
    update public.credit_accounts set grant_eligible = true, updated_at = now() where user_id = p_user;
  end if;
  if p_device_hash is not null then
    perform private.record_device(p_user, p_device_hash, p_ip_hash);
  end if;
  return private.grant_monthly_credits(p_user, private.kst_month());
end;
$$;

-- Writes (rate limit): call it only through a POST rpc (supabase-js default), never { get: true }.
create or replace function public.file_for_download(p_version_id uuid, p_file_id uuid)
returns table (storage_path text, filename text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  -- 120 signed download URLs per member per hour (counted before the lookup, so probing counts too).
  if not private.hit_rate_limit('file_dl:user:' || auth.uid()::text, 120, interval '1 hour') then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
  return query
  select f.storage_path, f.filename
  from public.recipe_version_files f
  join public.recipe_versions v on v.id = f.version_id
  join public.recipes r on r.id = v.recipe_id
  where f.id = p_file_id
    and f.version_id = p_version_id
    and (r.owner_id = auth.uid()
         or (r.status <> 'taken_down'
             and exists (select 1 from public.entitlements e
                         where e.user_id = auth.uid() and e.recipe_id = r.id
                           and e.version_id = p_version_id and e.revoked_at is null)));
end;
$$;
