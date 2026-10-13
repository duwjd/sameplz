-- W4 credit ledger (MVP: free monthly credits only, D11 · D12 · D13 · D17).
-- Money-path rules: .claude/rules/money.md, credit-ledger skill. All ledger functions are private,
-- security definer, search_path '', never callable by clients. Paid lots / top-ups / refunds do not exist.
-- Sign convention (check constraint): grant +a, hold −x, release +x, capture 0, expire −x
--   ⇒  Σ ledger.delta = available.

-- ---------------------------------------------------------------- policy constants (D11 · D13 · D17)
create or replace function private.credit_policy()
returns table (monthly_grant integer, daily_limit integer, run_per_minute integer,
               signups_per_ip_day integer, moderation_blocks_24h integer)
language sql
immutable
set search_path = ''
as $$ select 270, 135, 5, 3, 3 $$;

-- First day of the KST month, and the next reset (1st of next KST month, 00:00 KST).
create or replace function private.kst_month(p_ts timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$ select date_trunc('month', p_ts at time zone 'Asia/Seoul')::date $$;

create or replace function private.month_end_at(p_month date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select ((p_month + interval '1 month')::timestamp at time zone 'Asia/Seoul') $$;

create or replace function private.next_reset_at(p_ts timestamptz default now())
returns timestamptz
language sql
stable
set search_path = ''
as $$ select private.month_end_at(private.kst_month(p_ts)) $$;

create or replace function private.kst_day_start(p_ts timestamptz default now())
returns timestamptz
language sql
stable
set search_path = ''
as $$ select (date_trunc('day', p_ts at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') $$;

revoke execute on function private.credit_policy(), private.kst_month(timestamptz), private.month_end_at(date),
  private.next_reset_at(timestamptz), private.kst_day_start(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------- tables
create table public.credit_accounts (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  available integer not null default 0 check (available >= 0),
  held integer not null default 0 check (held >= 0),
  generation_suspended_at timestamptz,
  -- Set only by complete_signup_credits (server, after the D13 signup checks). Monthly grants
  -- require it, so calling accept_signup_terms directly never yields credits.
  grant_eligible boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.credit_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null check (kind in ('monthly_grant', 'promo')),   -- MVP: no paid lots (INV-C15)
  grant_month date,
  amount integer not null check (amount > 0),
  remaining integer not null check (remaining >= 0),
  held integer not null default 0 check (held >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (held <= remaining),
  check (remaining <= amount),
  check ((kind = 'monthly_grant') = (grant_month is not null)),
  check (grant_month is null or extract(day from grant_month) = 1)
);
create unique index credit_lots_monthly_key on public.credit_lots (user_id, grant_month) where kind = 'monthly_grant';
create index credit_lots_user_expiry_idx on public.credit_lots (user_id, expires_at);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete restrict,
  lot_id uuid references public.credit_lots (id) on delete restrict,
  entry_type text not null check (entry_type in ('grant', 'hold', 'capture', 'release', 'expire', 'adjust')),
  delta integer not null,
  cell_id uuid,
  idem_key text not null unique,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at);
create index credit_ledger_lot_idx on public.credit_ledger (lot_id);
alter table public.credit_ledger add constraint credit_ledger_sign check (
  (entry_type = 'grant' and delta > 0) or (entry_type = 'hold' and delta < 0) or (entry_type = 'capture' and delta = 0)
  or (entry_type = 'release' and delta > 0) or (entry_type = 'expire' and delta < 0) or entry_type = 'adjust');
create trigger credit_ledger_append_only before update or delete on public.credit_ledger
  for each row execute function private.reject_update_delete();
create trigger credit_ledger_no_truncate before truncate on public.credit_ledger
  for each statement execute function private.reject_update_delete();

-- cell_id gets its FK to play_cells with the playground (W5).
create table public.credit_holds (
  cell_id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete restrict,
  credits integer not null check (credits > 0),
  allocations jsonb not null,
  state text not null default 'held' check (state in ('held', 'captured', 'released')),
  outcome text check (outcome in ('success', 'model_error', 'safety_blocked', 'canceled', 'timeout')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index credit_holds_user_day_idx on public.credit_holds (user_id, created_at);

create table public.generation_budget (
  month date primary key,
  cap_credits integer not null check (cap_credits >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  spent integer not null default 0 check (spent >= 0),
  state text not null default 'open' check (state in ('open', 'paused')),
  alerted_80_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.rate_limit_buckets (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
create index rate_limit_buckets_window_idx on public.rate_limit_buckets (window_start);

create table public.abuse_signals (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  key_hash text check (key_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (char_length(kind) between 1 and 40),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index abuse_signals_user_kind_idx on public.abuse_signals (user_id, kind, created_at);

create table public.account_devices (
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$'),
  first_seen timestamptz not null default now(),
  primary key (user_id, device_hash)
);
create index account_devices_device_idx on public.account_devices (device_hash);

create table public.admin_actions (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null check (char_length(action) between 1 and 40),
  target_type text not null,
  target_id text not null,
  reason text not null check (char_length(btrim(reason)) >= 1),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create trigger admin_actions_append_only before update or delete on public.admin_actions
  for each row execute function private.reject_update_delete();
create trigger admin_actions_no_truncate before truncate on public.admin_actions
  for each statement execute function private.reject_update_delete();

-- ---------------------------------------------------------------- RLS + grants
alter table public.credit_accounts enable row level security;
alter table public.credit_lots enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_holds enable row level security;
alter table public.generation_budget enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.abuse_signals enable row level security;
alter table public.account_devices enable row level security;
alter table public.admin_actions enable row level security;

revoke all on public.credit_accounts, public.credit_lots, public.credit_ledger, public.credit_holds,
  public.generation_budget, public.rate_limit_buckets, public.abuse_signals, public.account_devices,
  public.admin_actions from anon, authenticated;
grant select on public.credit_accounts, public.credit_lots, public.credit_ledger, public.credit_holds,
  public.admin_actions to authenticated;
revoke all on sequence public.credit_ledger_id_seq, public.abuse_signals_id_seq, public.admin_actions_id_seq
  from anon, authenticated;

create policy credit_accounts_select_own on public.credit_accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy credit_lots_select_own on public.credit_lots
  for select to authenticated using (user_id = (select auth.uid()));
create policy credit_ledger_select_own on public.credit_ledger
  for select to authenticated using (user_id = (select auth.uid()));
create policy credit_holds_select_own on public.credit_holds
  for select to authenticated using (user_id = (select auth.uid()));
create policy admin_actions_select_admin on public.admin_actions
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------- internal helpers
create or replace function private.ensure_credit_account(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$ insert into public.credit_accounts (user_id) values (p_user) on conflict (user_id) do nothing $$;

-- Expire the unheld remainder of one lot. Caller must hold the account row lock.
create or replace function private.expire_lot(p_lot uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.credit_lots%rowtype;
  x integer;
  n integer;
begin
  select * into l from public.credit_lots where id = p_lot for update;
  x := l.remaining - l.held;
  if x <= 0 then
    return 0;
  end if;
  update public.credit_lots set remaining = held where id = p_lot;
  select count(*) into n from public.credit_ledger where lot_id = p_lot and entry_type = 'expire';
  insert into public.credit_ledger (user_id, lot_id, entry_type, delta, idem_key)
  values (l.user_id, p_lot, 'expire', -x, 'expire:' || p_lot || ':' || n);
  update public.credit_accounts set available = available - x, updated_at = now() where user_id = l.user_id;
  return x;
end;
$$;

-- Credits a user can spend now: unexpired lots' unheld remainder.
create or replace function private.spendable_credits(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.remaining - l.held), 0)::integer
  from public.credit_lots l
  where l.user_id = p_user and l.expires_at > now()
$$;

-- Today's (KST) usage: credits currently held or captured from holds placed today.
create or replace function private.used_today(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(h.credits), 0)::integer
  from public.credit_holds h
  where h.user_id = p_user and h.state in ('held', 'captured') and h.created_at >= private.kst_day_start()
$$;

-- ---------------------------------------------------------------- grant (F4-14, INV-C18, D13)
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

-- ---------------------------------------------------------------- hold (INV-C1, C5, C19, C20)
create or replace function private.place_hold(p_cell uuid, p_user uuid, p_credits integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing integer;
  spendable integer;
  b public.generation_budget%rowtype;
  need integer := p_credits;
  take integer;
  alloc jsonb := '[]'::jsonb;
  l record;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_CREDITS';
  end if;

  perform private.ensure_credit_account(p_user);
  perform 1 from public.credit_accounts where user_id = p_user for update;

  select credits into existing from public.credit_holds where cell_id = p_cell;
  if existing is not null then
    if exists (select 1 from public.credit_holds where cell_id = p_cell and (user_id <> p_user or credits <> p_credits)) then
      raise exception using errcode = 'P0001', message = 'CELL_CONFLICT';
    end if;
    return jsonb_build_object('ok', true, 'credits', existing);
  end if;

  -- Authoritative checks under the account lock (check_run_allowed is only a pre-check, INV-C21).
  if not exists (select 1 from public.profiles p where p.id = p_user and p.deleted_at is null
                   and p.terms_accepted_at is not null and p.adult_confirmed_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'ADULT_REQUIRED');
  end if;
  if exists (select 1 from public.credit_accounts a where a.user_id = p_user and a.generation_suspended_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'GENERATION_SUSPENDED');
  end if;
  if private.used_today(p_user) + p_credits > (select daily_limit from private.credit_policy()) then
    return jsonb_build_object('ok', false, 'reason', 'DAILY_LIMIT');
  end if;

  -- Lock the user's spendable lots, soonest-expiring first (INV-C5; all MVP lots are bonus-type).
  perform 1 from public.credit_lots
   where user_id = p_user and expires_at > now() and remaining > held
   order by expires_at, created_at, id
   for update;
  spendable := private.spendable_credits(p_user);
  if spendable < p_credits then
    return jsonb_build_object('ok', false, 'reason', 'INSUFFICIENT_CREDITS', 'shortfall', p_credits - spendable);
  end if;

  select * into b from public.generation_budget where month = private.kst_month() for update;
  if not found or b.state <> 'open' or b.reserved + b.spent + p_credits > b.cap_credits then
    return jsonb_build_object('ok', false, 'reason', 'BUDGET_EXHAUSTED');
  end if;

  for l in select id, remaining, held from public.credit_lots
           where user_id = p_user and expires_at > now() and remaining > held
           order by expires_at, created_at, id
  loop
    take := least(l.remaining - l.held, need);
    update public.credit_lots set held = held + take where id = l.id;
    insert into public.credit_ledger (user_id, lot_id, entry_type, delta, cell_id, idem_key)
    values (p_user, l.id, 'hold', -take, p_cell, 'hold:' || p_cell || ':' || l.id);
    alloc := alloc || jsonb_build_array(jsonb_build_object('lot_id', l.id, 'credits', take));
    need := need - take;
    exit when need = 0;
  end loop;

  insert into public.credit_holds (cell_id, user_id, credits, allocations)
  values (p_cell, p_user, p_credits, alloc);
  update public.credit_accounts
     set available = available - p_credits, held = held + p_credits, updated_at = now()
   where user_id = p_user;
  update public.generation_budget
     set reserved = reserved + p_credits,
         alerted_80_at = case when alerted_80_at is null
                                   and (reserved + p_credits + spent) * 10 >= cap_credits * 8
                              then now() else alerted_80_at end,
         updated_at = now()
   where month = b.month;
  return jsonb_build_object('ok', true, 'credits', p_credits);
end;
$$;

-- ---------------------------------------------------------------- settle (INV-C3, C4, C6, C20)
create or replace function private.settle_cell(p_cell uuid, p_outcome text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.credit_holds%rowtype;
  a record;
  ok boolean := p_outcome = 'success';
begin
  -- timeout is not an outcome: the caller looks the job up at the provider, then settles success
  -- or model_error (credit-ledger skill), so the budget never misses a generation that ran.
  if p_outcome = 'timeout' then
    raise exception using errcode = 'P0001', message = 'OUTCOME_NOT_FINAL';
  end if;
  if p_outcome is null or p_outcome not in ('success', 'model_error', 'safety_blocked', 'canceled') then
    raise exception using errcode = 'P0001', message = 'INVALID_OUTCOME';
  end if;
  select * into h from public.credit_holds where cell_id = p_cell;
  if not found then
    return jsonb_build_object('settled', false, 'captured', 0);
  end if;
  -- Same lock order as place_hold: account, then the hold.
  perform 1 from public.credit_accounts where user_id = h.user_id for update;
  select * into h from public.credit_holds where cell_id = p_cell for update;
  if h.state <> 'held' then
    return jsonb_build_object('settled', false, 'captured', 0);   -- exactly once (INV-C3)
  end if;

  for a in select (e ->> 'lot_id')::uuid as lot_id, (e ->> 'credits')::integer as credits
           from jsonb_array_elements(h.allocations) e
  loop
    if ok then
      update public.credit_lots set remaining = remaining - a.credits, held = held - a.credits where id = a.lot_id;
      insert into public.credit_ledger (user_id, lot_id, entry_type, delta, cell_id, idem_key)
      values (h.user_id, a.lot_id, 'capture', 0, p_cell, 'capture:' || p_cell || ':' || a.lot_id);
    else
      update public.credit_lots set held = held - a.credits where id = a.lot_id;   -- same lot (INV-C4)
      insert into public.credit_ledger (user_id, lot_id, entry_type, delta, cell_id, idem_key)
      values (h.user_id, a.lot_id, 'release', a.credits, p_cell, 'release:' || p_cell || ':' || a.lot_id);
    end if;
  end loop;

  update public.credit_accounts
     set held = held - h.credits,
         available = available + case when ok then 0 else h.credits end,
         updated_at = now()
   where user_id = h.user_id;
  -- Released into a lot that lapsed meanwhile: expire it now so it is never shown as spendable.
  if not ok then
    perform private.expire_lot(x.lot_id)
       from (select (e ->> 'lot_id')::uuid as lot_id from jsonb_array_elements(h.allocations) e) x
       join public.credit_lots l on l.id = x.lot_id
      where l.expires_at <= now();
  end if;
  update public.generation_budget
     set reserved = reserved - h.credits,   -- a negative result violates the check (never mask drift)
         spent = spent + case when ok then h.credits else 0 end,
         updated_at = now()
   where month = private.kst_month(h.created_at);
  update public.credit_holds
     set state = case when ok then 'captured' else 'released' end, outcome = p_outcome, settled_at = now()
   where cell_id = p_cell;
  return jsonb_build_object('settled', true, 'captured', case when ok then h.credits else 0 end);
end;
$$;

-- ---------------------------------------------------------------- expiry (INV-C17)
create or replace function private.expire_bonus()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  n integer := 0;
begin
  for l in select id, user_id from public.credit_lots
           where expires_at <= now() and remaining > held
           order by user_id, expires_at
  loop
    perform 1 from public.credit_accounts where user_id = l.user_id for update;
    if private.expire_lot(l.id) > 0 then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------- limits (F4-16, D13)
create or replace function private.hit_rate_limit(p_key text, p_limit integer, p_window interval,
                                                  p_window_start timestamptz default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  secs double precision := extract(epoch from p_window);
  v_start timestamptz := coalesce(p_window_start, to_timestamp(floor(extract(epoch from now()) / secs) * secs));
  c integer;
begin
  insert into public.rate_limit_buckets (key, window_start, count) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set count = public.rate_limit_buckets.count + 1
  returning count into c;
  return c <= p_limit;
end;
$$;

-- W5 start_run calls this before any hold. null = allowed; otherwise the first failing code.
create or replace function private.check_run_allowed(p_user uuid, p_credits integer, p_ip_hash text, p_device_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pol record;
  b public.generation_budget%rowtype;
  allowed boolean := true;
begin
  select * into pol from private.credit_policy();
  if not exists (select 1 from public.profiles p where p.id = p_user and p.deleted_at is null
                   and p.terms_accepted_at is not null and p.adult_confirmed_at is not null) then
    return 'ADULT_REQUIRED';
  end if;
  if exists (select 1 from public.credit_accounts a where a.user_id = p_user and a.generation_suspended_at is not null) then
    return 'GENERATION_SUSPENDED';
  end if;
  if private.used_today(p_user) + p_credits > pol.daily_limit then
    return 'DAILY_LIMIT';
  end if;
  allowed := private.hit_rate_limit('run:user:' || p_user, pol.run_per_minute, interval '1 minute') and allowed;
  if p_ip_hash is not null then
    allowed := private.hit_rate_limit('run:ip:' || p_ip_hash, pol.run_per_minute, interval '1 minute') and allowed;
  end if;
  if p_device_hash is not null then
    allowed := private.hit_rate_limit('run:device:' || p_device_hash, pol.run_per_minute, interval '1 minute') and allowed;
  end if;
  if not allowed then
    return 'RATE_LIMITED';
  end if;
  select * into b from public.generation_budget where month = private.kst_month();
  if not found or b.state <> 'open' or b.reserved + b.spent + p_credits > b.cap_credits then
    return 'BUDGET_EXHAUSTED';
  end if;
  if private.spendable_credits(p_user) < p_credits then
    return 'INSUFFICIENT_CREDITS';
  end if;
  return null;
end;
$$;

create or replace function private.record_device(p_user uuid, p_device_hash text, p_ip_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.account_devices (user_id, device_hash, ip_hash) values (p_user, p_device_hash, p_ip_hash)
  on conflict (user_id, device_hash) do update set ip_hash = coalesce(excluded.ip_hash, public.account_devices.ip_hash)
$$;

create or replace function private.check_signup_allowed(p_ip_hash text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  -- KST calendar day, same as the daily credit limit.
  select private.hit_rate_limit('signup:ip:' || p_ip_hash,
                                (select signups_per_ip_day from private.credit_policy()), interval '1 day',
                                private.kst_day_start())
$$;

create or replace function private.record_moderation_block(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.abuse_signals (user_id, kind) values (p_user, 'moderation_block');
  select count(*) into n from public.abuse_signals
   where user_id = p_user and kind = 'moderation_block' and created_at > now() - interval '24 hours';
  if n >= (select moderation_blocks_24h from private.credit_policy()) then
    perform private.ensure_credit_account(p_user);
    update public.credit_accounts set generation_suspended_at = coalesce(generation_suspended_at, now()), updated_at = now()
     where user_id = p_user;
    return true;
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------- budget admin (F4-15, D12)
create or replace function private.admin_set_budget(p_actor uuid, p_month date, p_cap integer, p_state text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  insert into public.generation_budget (month, cap_credits, state) values (p_month, p_cap, p_state)
  on conflict (month) do update
    set cap_credits = excluded.cap_credits, state = excluded.state, updated_at = now(),
        alerted_80_at = case when public.generation_budget.cap_credits <> excluded.cap_credits
                             then null else public.generation_budget.alerted_80_at end;
  insert into public.admin_actions (actor_id, action, target_type, target_id, reason, detail)
  values (p_actor, 'budget_update', 'generation_budget', p_month::text, p_reason,
          jsonb_build_object('cap_credits', p_cap, 'state', p_state));
end;
$$;

-- Budget rows for this and next KST month, copied from the latest cap (D12: auto-resume on the 1st).
-- No row at all (fresh production) means no generation until an operator sets a cap.
create or replace function private.prepare_budget_months()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.generation_budget (month, cap_credits, state)
  select m.month, latest.cap_credits, 'open'
  from (values (private.kst_month()), ((private.kst_month() + interval '1 month')::date)) m(month)
  cross join lateral (select b.cap_credits from public.generation_budget b order by b.month desc limit 1) latest
  on conflict (month) do nothing
$$;

-- Daily cron (00:00 KST): expire lapsed lots, prepare budgets, grant this month to every eligible
-- account. One commit per user so a failure or a lock never holds everyone back.
-- No SECURITY DEFINER / SET search_path here: PostgreSQL forbids COMMIT in procedures with either.
-- Runs as postgres from pg_cron only (execute revoked below); every object is schema-qualified.
create or replace procedure private.run_monthly_grants()
language plpgsql
as $$
declare
  v_month date := private.kst_month();
  u record;
begin
  perform private.expire_bonus();
  perform private.prepare_budget_months();
  commit;
  for u in select a.user_id from public.credit_accounts a
           join public.profiles p on p.id = a.user_id
           where a.grant_eligible and p.deleted_at is null
             and p.terms_accepted_at is not null and p.adult_confirmed_at is not null
             and not exists (select 1 from public.credit_lots l
                             where l.user_id = a.user_id and l.kind = 'monthly_grant' and l.grant_month = v_month)
           order by a.user_id
  loop
    begin
      perform private.grant_monthly_credits(u.user_id, v_month);
    exception when others then
      insert into public.abuse_signals (user_id, kind, detail)
      values (u.user_id, 'grant_failed', jsonb_build_object('month', v_month, 'sqlstate', sqlstate));
    end;
    commit;
  end loop;
  delete from public.rate_limit_buckets where window_start < now() - interval '2 days';
end;
$$;

revoke execute on function private.ensure_credit_account(uuid), private.expire_lot(uuid), private.spendable_credits(uuid),
  private.used_today(uuid), private.grant_monthly_credits(uuid, date), private.place_hold(uuid, uuid, integer),
  private.settle_cell(uuid, text), private.expire_bonus(), private.hit_rate_limit(text, integer, interval, timestamptz),
  private.check_run_allowed(uuid, integer, text, text), private.record_device(uuid, text, text),
  private.check_signup_allowed(text), private.record_moderation_block(uuid),
  private.admin_set_budget(uuid, date, integer, text, text), private.prepare_budget_months()
  from public, anon, authenticated;
revoke execute on procedure private.run_monthly_grants() from public, anon, authenticated;

-- ---------------------------------------------------------------- server-only signup grant (secret key)
-- acceptSignupTerms calls this after accept_signup_terms: IP-per-KST-day signup limit (first time only),
-- device record, then this month's grant (D13). The only path that makes an account grant-eligible.
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
revoke execute on function public.complete_signup_credits(uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_signup_credits(uuid, text, text) to service_role;

-- ---------------------------------------------------------------- CRD read-only summary
create or replace function public.my_credit_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'available', private.spendable_credits(auth.uid()),
    'held', coalesce((select a.held from public.credit_accounts a where a.user_id = auth.uid()), 0),
    'next_reset_at', private.next_reset_at(),
    'daily_limit', (select daily_limit from private.credit_policy()),
    'used_today', private.used_today(auth.uid()),
    'remaining_today', greatest((select daily_limit from private.credit_policy()) - private.used_today(auth.uid()), 0),
    'suspended', coalesce((select a.generation_suspended_at is not null from public.credit_accounts a
                           where a.user_id = auth.uid()), false))
  where auth.uid() is not null
$$;
revoke execute on function public.my_credit_summary() from public, anon;
grant execute on function public.my_credit_summary() to authenticated;

-- ---------------------------------------------------------------- existing members (deploy)
-- Members who finished signup before this migration are eligible (no device on record; runbook 07).
insert into public.credit_accounts (user_id, grant_eligible)
select p.id, true from public.profiles p
 where p.deleted_at is null and p.terms_accepted_at is not null and p.adult_confirmed_at is not null
on conflict (user_id) do update set grant_eligible = true;

-- ---------------------------------------------------------------- cron
select cron.schedule('sameplz-monthly-grant', '0 15 * * *', 'call private.run_monthly_grants()');
