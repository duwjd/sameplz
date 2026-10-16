-- F8-4 MVP: sanction ladder chosen by an admin (terms §6: warning → seller suspension → account
-- suspension → ban, no automatic escalation), lifting an automatic generation suspension, credit
-- adjustments as adjust rows (money rules), linked accounts by device / IP hash (D13, probabilistic).
-- Every action: service_role only, private.assert_admin, a reason, an admin_actions row, a notification.

-- ---------------------------------------------------------------- sanctions
create table public.account_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  level text not null check (level in ('warning', 'seller_suspended', 'account_suspended', 'banned')),
  reason_code text not null check (reason_code in ('policy_violation', 'rights_claim', 'abuse', 'spam', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,                    -- null: until lifted
  lifted_at timestamptz,
  lifted_by uuid references public.profiles (id),
  lift_note text check (char_length(lift_note) <= 500),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index account_sanctions_open_idx on public.account_sanctions (user_id) where lifted_at is null;
alter table public.account_sanctions enable row level security;
revoke all on public.account_sanctions from anon, authenticated;
grant select on public.account_sanctions to authenticated;
create policy account_sanctions_select_own on public.account_sanctions for select to authenticated
  using (user_id = (select auth.uid()));

-- A sanction is never rewritten or deleted; it is lifted once (lifted_at / lifted_by / lift_note).
create or replace function private.guard_account_sanctions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.lifted_at is null and new.lifted_at is not null
     and (to_jsonb(new) - 'lifted_at' - 'lifted_by' - 'lift_note')
       = (to_jsonb(old) - 'lifted_at' - 'lifted_by' - 'lift_note') then
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.profiles p where p.id = old.user_id) then
    return old;   -- the profile itself is going away (cascade)
  end if;
  raise exception using errcode = 'P0001', message = 'SANCTION_IMMUTABLE';
end;
$$;
create trigger account_sanctions_guard before update or delete on public.account_sanctions
  for each row execute function private.guard_account_sanctions();

create or replace function private.sanction_rank(p_level text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_level when 'banned' then 4 when 'account_suspended' then 3
                      when 'seller_suspended' then 2 when 'warning' then 1 else 0 end
$$;

-- The heaviest sanction in force now; an ended one simply stops counting (no job).
create or replace function private.active_sanction(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.level from public.account_sanctions s
   where s.user_id = p_user and s.lifted_at is null and s.starts_at <= now()
     and (s.ends_at is null or s.ends_at > now())
   order by private.sanction_rank(s.level) desc, s.created_at desc
   limit 1
$$;
-- Only security definer code reads these (members must not look up anyone's level).
revoke execute on function private.active_sanction(uuid), private.sanction_rank(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- gates
-- One guard on every member write path, whether it comes through RLS or a security definer RPC.
-- tg_argv[0]: the column holding the acting member ('recipe' = the recipe's owner);
-- tg_argv[1]: 'seller' (uploads: seller suspension and up) or 'account' (account suspension and up).
create or replace function private.guard_sanctioned_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row jsonb := to_jsonb(new);
  v_user uuid;
  rank integer;
begin
  if tg_table_name = 'entitlements' and row ->> 'source' = 'owner' then
    return new;
  end if;
  if tg_argv[0] = 'recipe' then
    select r.owner_id into v_user from public.recipes r where r.id = (row ->> 'recipe_id')::uuid;
  else
    v_user := (row ->> tg_argv[0])::uuid;
  end if;
  rank := private.sanction_rank(private.active_sanction(v_user));
  if rank >= 3 then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_SUSPENDED';
  end if;
  if rank = 2 and tg_argv[1] = 'seller' then
    raise exception using errcode = 'P0001', message = 'SELLER_SUSPENDED';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_sanctioned_actor() from public, anon, authenticated;

create trigger recipe_versions_sanction before insert on public.recipe_versions
  for each row execute function private.guard_sanctioned_actor('recipe', 'seller');
create trigger recipe_drafts_sanction before insert or update on public.recipe_drafts
  for each row execute function private.guard_sanctioned_actor('owner_id', 'seller');
create trigger entitlements_sanction before insert on public.entitlements
  for each row execute function private.guard_sanctioned_actor('user_id', 'account');
create trigger gallery_posts_sanction before insert on public.gallery_posts
  for each row execute function private.guard_sanctioned_actor('author_id', 'account');
create trigger reports_sanction before insert on public.reports
  for each row execute function private.guard_sanctioned_actor('reporter_id', 'account');
create trigger play_runs_sanction before insert on public.play_runs
  for each row execute function private.guard_sanctioned_actor('user_id', 'account');
create trigger follows_sanction before insert on public.follows
  for each row execute function private.guard_sanctioned_actor('follower_id', 'account');
create trigger recipe_likes_sanction before insert on public.recipe_likes
  for each row execute function private.guard_sanctioned_actor('user_id', 'account');
create trigger post_likes_sanction before insert on public.post_likes
  for each row execute function private.guard_sanctioned_actor('user_id', 'account');
create trigger creator_waitlist_sanction before insert on public.creator_waitlist
  for each row execute function private.guard_sanctioned_actor('user_id', 'account');
create trigger share_links_sanction before insert on public.share_links
  for each row execute function private.guard_sanctioned_actor('creator_id', 'seller');

-- The member's own changes only (auth.uid() = the row's owner); admin RPCs and withdrawal run without
-- a member uid and pass. Republishing (private → live, set_recipe_visibility) counts as uploading.
create or replace function private.guard_sanctioned_owner_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rank integer;
begin
  if tg_table_name = 'recipes' then
    if new.status is distinct from 'live' or old.status = 'live' or auth.uid() is distinct from new.owner_id then
      return new;
    end if;
    rank := private.sanction_rank(private.active_sanction(new.owner_id));
    if rank >= 3 then
      raise exception using errcode = 'P0001', message = 'ACCOUNT_SUSPENDED';
    elsif rank = 2 then
      raise exception using errcode = 'P0001', message = 'SELLER_SUSPENDED';
    end if;
  else  -- profiles: the public profile is 「글쓰기」 too
    if auth.uid() is distinct from old.id
       or (new.nickname, new.bio, new.handle, new.avatar_url, new.job_codes)
          is not distinct from (old.nickname, old.bio, old.handle, old.avatar_url, old.job_codes) then
      return new;
    end if;
    if private.sanction_rank(private.active_sanction(old.id)) >= 3 then
      raise exception using errcode = 'P0001', message = 'ACCOUNT_SUSPENDED';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_sanctioned_owner_update() from public, anon, authenticated;
create trigger recipes_sanction_republish before update of status on public.recipes
  for each row execute function private.guard_sanctioned_owner_update();
create trigger profiles_sanction_edit before update on public.profiles
  for each row execute function private.guard_sanctioned_owner_update();

-- start_run reports the reason instead of failing on the play_runs guard (latest definition + one check).
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
  if private.sanction_rank(private.active_sanction(p_user)) >= 3 then
    return 'ACCOUNT_SUSPENDED';
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

-- The app reads the sanction with the account status (banner, /blocked).
drop function public.my_account_status();
create function public.my_account_status()
returns table (
  role text,
  terms_version text,
  terms_accepted_at timestamptz,
  adult_confirmed_at timestamptz,
  signup_complete boolean,
  sanction_level text,
  sanction_ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.role, p.terms_version, p.terms_accepted_at, p.adult_confirmed_at,
         (p.terms_accepted_at is not null and p.adult_confirmed_at is not null and p.deleted_at is null),
         s.level, s.ends_at
  from public.profiles p
  left join lateral (
    select x.level, x.ends_at from public.account_sanctions x
     where x.user_id = p.id and x.lifted_at is null and x.starts_at <= now()
       and (x.ends_at is null or x.ends_at > now())
     order by private.sanction_rank(x.level) desc, x.created_at desc
     limit 1) s on true
  where p.id = auth.uid()
$$;
revoke execute on function public.my_account_status() from public, anon;
grant execute on function public.my_account_status() to authenticated;

-- ---------------------------------------------------------------- notifications
alter table public.notifications drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (kind in (
    'version_update', 'same_cert', 'new_recipe', 'new_follower',             -- optional
    'review_passed', 'review_rejected', 'recipe_stopped', 'recipe_taken_down',
    'report_received', 'report_answered', 'account_sanctioned', 'credit_adjusted'));   -- required

create or replace function private.sanction_reason_label(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_code when 'policy_violation' then '운영 정책 위반' when 'rights_claim' then '권리 침해'
                     when 'abuse' then '부정 이용' when 'spam' then '스팸·도배' else '기타 운영 사유' end
$$;

-- ---------------------------------------------------------------- admin RPCs
create or replace function public.admin_sanction(p_actor uuid, p_user uuid, p_level text, p_reason text,
                                                 p_note text, p_days integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_ends timestamptz;
  v_until text;
  v_why text;
  v_prior boolean;
begin
  perform private.assert_admin(p_actor);
  if p_level is null or p_level not in ('warning', 'seller_suspended', 'account_suspended', 'banned') then
    raise exception using errcode = 'P0001', message = 'INVALID_LEVEL';
  end if;
  if p_reason is null or p_reason not in ('policy_violation', 'rights_claim', 'abuse', 'spam', 'other') then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception using errcode = 'P0001', message = 'NOTE_TOO_LONG';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin') then
    raise exception using errcode = 'P0001', message = 'CANNOT_SANCTION_ADMIN';
  end if;
  perform 1 from public.profiles p where p.id = p_user and p.deleted_at is null for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if p_level in ('seller_suspended', 'account_suspended') then
    if p_days is not null and (p_days < 1 or p_days > 365) then
      raise exception using errcode = 'P0001', message = 'INVALID_DAYS';
    end if;
    v_ends := case when p_days is null then null else now() + make_interval(days => p_days) end;
  end if;

  insert into public.account_sanctions (user_id, level, reason_code, note, ends_at, created_by)
  values (p_user, p_level, p_reason, coalesce(p_note, ''), v_ends, p_actor)
  returning id into v_id;
  if p_level = 'banned' then
    perform private.ensure_credit_account(p_user);
    select grant_eligible into v_prior from public.credit_accounts where user_id = p_user for update;
    update public.credit_accounts set grant_eligible = false, updated_at = now() where user_id = p_user;
    -- Out now, not at the next login: end every session (refresh tokens go with them). An access token
    -- already issued lives out its hour, and every write it tries is refused by the guards above.
    delete from auth.sessions where user_id = p_user;
    -- Their live recipes stop selling; holders keep the version they received (terms §3). A lifted ban
    -- does not republish them: the admin restores recipes one by one in /admin/recipes.
    update public.recipes set status = 'stopped', stopped_reason = 'policy_violation', stopped_at = now()
     where owner_id = p_user and status = 'live';
  end if;
  insert into public.admin_actions (actor_id, action, target_type, target_id, reason, detail)
  values (p_actor, 'user_' || p_level, 'user', p_user::text, private.sanction_reason_label(p_reason),
          jsonb_build_object('sanction', v_id, 'days', p_days, 'note', nullif(p_note, ''),
                             'prior_grant_eligible', v_prior));

  v_why := '사유: ' || private.sanction_reason_label(p_reason) || '. ';
  v_until := case when v_ends is null then '해제될 때까지 '
                  else to_char(v_ends at time zone 'Asia/Seoul', 'YYYY-MM-DD') || '까지 ' end;
  perform private.notify(p_user, 'account_sanctioned',
    case p_level when 'warning' then '운영 정책 위반으로 경고를 받았어요'
                 when 'seller_suspended' then '레시피 올리기가 멈췄어요'
                 when 'account_suspended' then '계정 이용이 멈췄어요'
                 else '계정 이용이 제한됐어요' end,
    v_why || case p_level
      when 'warning' then '같은 일이 반복되면 이용이 제한될 수 있어요.'
      when 'seller_suspended' then v_until || '새 레시피와 새 버전을 올릴 수 없어요.'
      when 'account_suspended' then v_until || '받기·만들기·올리기·글쓰기를 할 수 없어요. 받은 레시피는 계속 열 수 있어요.'
      else '서비스를 더 쓸 수 없어요.' end || ' 이의는 고객센터로 알려 주세요.',
    '/my/account');
  return jsonb_build_object('ok', true, 'id', v_id, 'ends_at', v_ends);
end;
$$;

create or replace function public.admin_lift_sanction(p_actor uuid, p_sanction uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.account_sanctions%rowtype;
begin
  perform private.assert_admin(p_actor);
  if coalesce(btrim(p_note), '') = '' then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  if char_length(p_note) > 500 then
    raise exception using errcode = 'P0001', message = 'NOTE_TOO_LONG';
  end if;
  select * into s from public.account_sanctions where id = p_sanction for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if s.lifted_at is not null then
    raise exception using errcode = 'P0001', message = 'ALREADY_LIFTED';
  end if;
  update public.account_sanctions set lifted_at = now(), lifted_by = p_actor, lift_note = p_note where id = s.id;
  -- A lifted ban gives back the monthly grant only to someone who had it before.
  -- A lifted ban gives back exactly the eligibility recorded when it was set.
  if s.level = 'banned' and private.sanction_rank(private.active_sanction(s.user_id)) < 4 then
    update public.credit_accounts a
       set grant_eligible = coalesce((select (x.detail ->> 'prior_grant_eligible')::boolean from public.admin_actions x
                                       where x.action = 'user_banned' and x.detail ->> 'sanction' = s.id::text
                                       order by x.created_at desc limit 1), false),
           updated_at = now()
     where a.user_id = s.user_id;
  end if;
  insert into public.admin_actions (actor_id, action, target_type, target_id, reason, detail)
  values (p_actor, 'user_lift', 'user', s.user_id::text, p_note, jsonb_build_object('sanction', s.id, 'level', s.level));
  perform private.notify(s.user_id, 'account_sanctioned',
    case s.level when 'warning' then '경고를 거뒀어요' else '이용 제한을 풀었어요' end,
    case s.level when 'warning' then '확인해 보니 경고할 일이 아니었어요.'
                 else '다시 이용할 수 있어요. 불편을 드려 죄송해요.' end,
    '/my/account');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_lift_generation_suspension(p_actor uuid, p_user uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  if coalesce(btrim(p_note), '') = '' then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  update public.credit_accounts set generation_suspended_at = null, updated_at = now()
   where user_id = p_user and generation_suspended_at is not null;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_SUSPENDED';
  end if;
  insert into public.admin_actions (actor_id, action, target_type, target_id, reason)
  values (p_actor, 'user_generation_resume', 'user', p_user::text, left(p_note, 500));
  return jsonb_build_object('ok', true);
end;
$$;

-- +n: a promo lot that lapses at this month's reset (no carry-over, D11) and an adjust row.
-- −n: from the soonest-expiring lots, never the held part, never below zero; one adjust row per lot.
-- Ledger sum = available holds either way. Idempotent per p_idem (unique idem_key 'adjust:<idem>:0').
create or replace function public.admin_adjust_credits(p_actor uuid, p_user uuid, p_amount integer, p_reason text,
                                                       p_idem text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := 'adjust:' || coalesce(p_idem, '');
  v_lot uuid;
  need integer;
  take integer;
  i integer := 0;
  l record;
begin
  perform private.assert_admin(p_actor);
  if coalesce(btrim(p_reason), '') = '' then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000 then
    raise exception using errcode = 'P0001', message = 'INVALID_AMOUNT';
  end if;
  if p_idem is null or char_length(p_idem) not between 1 and 80 then
    raise exception using errcode = 'P0001', message = 'INVALID_IDEM';
  end if;
  -- Profile first (like withdraw_account), so a withdrawal cannot slip in between.
  perform 1 from public.profiles p where p.id = p_user and p.deleted_at is null for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  perform private.ensure_credit_account(p_user);
  perform 1 from public.credit_accounts where user_id = p_user for update;
  if exists (select 1 from public.credit_ledger where idem_key = v_key || ':0') then
    -- The same request again is fine; the same key with another member or amount is a mistake.
    if not exists (select 1 from public.admin_actions x
                    where x.action = 'credit_adjust' and x.detail ->> 'idem' = p_idem
                      and x.target_id = p_user::text and (x.detail ->> 'amount')::integer = p_amount) then
      raise exception using errcode = 'P0001', message = 'IDEM_CONFLICT';
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true,
      'available', (select available from public.credit_accounts where user_id = p_user));
  end if;

  if p_amount > 0 then
    insert into public.credit_lots (user_id, kind, amount, remaining, expires_at)
    values (p_user, 'promo', p_amount, p_amount, private.month_end_at(private.kst_month()))
    returning id into v_lot;
    insert into public.credit_ledger (user_id, lot_id, entry_type, delta, idem_key)
    values (p_user, v_lot, 'adjust', p_amount, v_key || ':0');
  else
    need := -p_amount;
    if private.spendable_credits(p_user) < need then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT';
    end if;
    for l in select id, remaining - held as free from public.credit_lots
              where user_id = p_user and expires_at > now() and remaining > held
              order by expires_at, created_at, id
              for update
    loop
      exit when need = 0;
      take := least(need, l.free);
      update public.credit_lots set remaining = remaining - take where id = l.id;
      insert into public.credit_ledger (user_id, lot_id, entry_type, delta, idem_key)
      values (p_user, l.id, 'adjust', -take, v_key || ':' || i);
      i := i + 1;
      need := need - take;
    end loop;
  end if;
  update public.credit_accounts set available = available + p_amount, updated_at = now() where user_id = p_user;

  insert into public.admin_actions (actor_id, action, target_type, target_id, reason, detail)
  values (p_actor, 'credit_adjust', 'user', p_user::text, left(p_reason, 500),
          jsonb_build_object('amount', p_amount, 'idem', p_idem));
  perform private.notify(p_user, 'credit_adjusted',
    case when p_amount > 0 then '크레딧 ' || p_amount || 'C를 받았어요'
         else '크레딧 ' || (-p_amount) || 'C가 조정됐어요' end,
    '사유: ' || left(p_reason, 150), '/my/credits');
  return jsonb_build_object('ok', true, 'duplicate', false,
    'available', (select available from public.credit_accounts where user_id = p_user));
end;
$$;

-- Accounts sharing a device or IP hash with p_user (probabilistic, D13 / runbook 07) and the member's
-- recent abuse signals. Hash values are never returned.
create or replace function public.admin_linked_accounts(p_actor uuid, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  return jsonb_build_object(
    'accounts', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', o.user_id, 'nickname', p.nickname, 'handle', p.handle::text, 'created_at', p.created_at,
                   'withdrawn', p.deleted_at is not null, 'sanction', private.active_sanction(o.user_id),
                   'via', o.via) order by p.created_at), '[]'::jsonb)
                 from (select other.user_id,
                              array_agg(distinct case when other.device_hash = mine.device_hash then 'device' else 'ip' end) as via
                         from public.account_devices mine
                         join public.account_devices other
                           on other.user_id <> mine.user_id
                          and (other.device_hash = mine.device_hash
                               or (mine.ip_hash is not null and other.ip_hash = mine.ip_hash))
                        where mine.user_id = p_user
                        group by other.user_id) o
                 join public.profiles p on p.id = o.user_id),
    'signals', (select coalesce(jsonb_agg(jsonb_build_object('kind', s.kind, 'created_at', s.created_at,
                                                             'detail', s.detail) order by s.created_at desc), '[]'::jsonb)
                from (select kind, created_at, detail from public.abuse_signals
                       where user_id = p_user order by created_at desc limit 20) s));
end;
$$;

revoke execute on function public.admin_sanction(uuid, uuid, text, text, text, integer),
  public.admin_lift_sanction(uuid, uuid, text), public.admin_lift_generation_suspension(uuid, uuid, text),
  public.admin_adjust_credits(uuid, uuid, integer, text, text), public.admin_linked_accounts(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_sanction(uuid, uuid, text, text, text, integer),
  public.admin_lift_sanction(uuid, uuid, text), public.admin_lift_generation_suspension(uuid, uuid, text),
  public.admin_adjust_credits(uuid, uuid, integer, text, text), public.admin_linked_accounts(uuid, uuid)
  to service_role;


-- ---------------------------------------------------------------- D13 stays about signup devices
-- Devices seen at login / on a run feed the linked-account view only; the one-free-grant-per-device rule
-- (D13) keeps counting signup devices, as before (a family sharing a browser keeps their grants).
alter table public.account_devices add column source text not null default 'signup'
  check (source in ('signup', 'seen'));

create or replace function private.record_device(p_user uuid, p_device_hash text, p_ip_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.account_devices (user_id, device_hash, ip_hash, source) values (p_user, p_device_hash, p_ip_hash, 'signup')
  on conflict (user_id, device_hash) do update set ip_hash = coalesce(excluded.ip_hash, public.account_devices.ip_hash),
                                                   source = 'signup'
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
  -- F8-4: a ban stops the free grant whatever grant_eligible says.
  if private.sanction_rank(private.active_sanction(p_user)) >= 4 then
    return jsonb_build_object('granted', false, 'lot_id', null, 'reason', 'NOT_ELIGIBLE');
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
              and other.source = 'signup'
             join public.credit_lots l
               on l.user_id = other.user_id and l.kind = 'monthly_grant' and l.grant_month = p_month
             where mine.user_id = p_user and mine.source = 'signup') then
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
  -- F8-4: sending the signup action again never re-opens the grant for a banned member.
  if private.sanction_rank(private.active_sanction(p_user)) >= 4 then
    return jsonb_build_object('granted', false, 'reason', 'NOT_ELIGIBLE');
  end if;
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

-- ---------------------------------------------------------------- device records beyond signup
-- Linked-account matching needs the devices members actually use, not only the signup one: the
-- server records them at login and on each playground run (hashes only, D13).
create or replace function public.record_member_device(p_user uuid, p_device_hash text, p_ip_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_device_hash is null or not exists (select 1 from public.profiles p where p.id = p_user and p.deleted_at is null) then
    return;
  end if;
  insert into public.account_devices (user_id, device_hash, ip_hash, source)
  values (p_user, p_device_hash, p_ip_hash, 'seen')
  on conflict (user_id, device_hash) do update set ip_hash = coalesce(excluded.ip_hash, public.account_devices.ip_hash);
end;
$$;
revoke execute on function public.record_member_device(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_member_device(uuid, text, text) to service_role;
