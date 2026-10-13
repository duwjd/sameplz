-- W2 schema v1 · 2/6: reference data (jobs, tools), profiles, consent ledger, signup trigger.
-- Keys are auth.users.id. Email is never copied: Kakao has none, Naver has a placeholder (D4).

-- ---------------------------------------------------------------- jobs (9, content baseline)
create table public.jobs (
  code text primary key check (code ~ '^[a-z_]{2,20}$'),
  label text not null,
  sort smallint not null
);
alter table public.jobs enable row level security;
create policy jobs_select_all on public.jobs for select to anon, authenticated using (true);

insert into public.jobs (code, label, sort) values
  ('commerce',  '커머스·셀러',   1),
  ('marketing', '마케팅·SNS',    2),
  ('content',   '콘텐츠·영상',   3),
  ('design',    '디자인',        4),
  ('office',    '사무·기획',     5),
  ('tax',       '세무·회계',     6),
  ('hr',        '인사·채용',     7),
  ('cs',        'CS·고객응대',   8),
  ('dev',       '개발·데이터',   9);

-- ---------------------------------------------------------------- tools
create table public.tools (
  code text primary key check (code ~ '^[a-z0-9_]{2,30}$'),
  label text not null,
  kind text not null check (kind in ('generator', 'assistant', 'runner', 'integration')),
  has_api boolean not null default true,   -- false → playground run button disabled with reason
  sort smallint not null
);
alter table public.tools enable row level security;
create policy tools_select_all on public.tools for select to anon, authenticated using (true);

insert into public.tools (code, label, kind, has_api, sort) values
  ('midjourney',    'Midjourney',      'generator',   false, 1),
  ('seedream',      'Seedream',        'generator',   true,  2),
  ('flux',          'FLUX',            'generator',   true,  3),
  ('nano_banana',   'Nano Banana',     'generator',   true,  4),
  ('veo',           'Veo',             'generator',   true,  5),
  ('kling',         'Kling',           'generator',   true,  6),
  ('seedance',      'Seedance',        'generator',   true,  7),
  ('runway',        'Runway',          'generator',   false, 8),
  ('chatgpt',       'ChatGPT',         'assistant',   true,  20),
  ('claude',        'Claude',          'assistant',   true,  21),
  ('gemini',        'Gemini',          'assistant',   true,  22),
  ('codex',         'Codex',           'assistant',   false, 23),
  ('cursor',        'Cursor',          'assistant',   false, 24),
  ('gemini_cli',    'Gemini CLI',      'assistant',   false, 25),
  ('n8n',           'n8n',             'runner',      false, 40),
  ('make',          'Make',            'runner',      false, 41),
  ('smartstore',    '스마트스토어',    'integration', false, 60),
  ('coupang',       '쿠팡',            'integration', false, 61),
  ('google_sheets', '구글 시트',       'integration', false, 62),
  ('notion',        '노션',            'integration', false, 63),
  ('slack',         '슬랙',            'integration', false, 64);

-- job_codes arrays must reference jobs (check constraints cannot query tables).
create or replace function private.assert_job_codes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.job_codes is not null and exists (
    select 1 from unnest(new.job_codes) c where c not in (select code from public.jobs)
  ) then
    raise exception using errcode = '23514', message = 'UNKNOWN_JOB_CODE';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle extensions.citext not null unique check (handle::text ~ '^[a-z0-9_]{3,15}$'),  -- ::text: citext ~ ignores case
  nickname text not null check (char_length(nickname) between 2 and 12),
  bio text check (char_length(bio) <= 60),
  avatar_url text,
  job_codes text[] not null default '{}' check (cardinality(job_codes) <= 2),
  role text not null default 'user' check (role in ('user', 'staff', 'admin')),
  terms_version text,
  terms_accepted_at timestamptz,
  adult_confirmed_at timestamptz,
  ai_notice_ack_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger profiles_job_codes before insert or update of job_codes on public.profiles
  for each row execute function private.assert_job_codes();

-- Column-level exposure: consent timestamps and role are not public.
revoke all on public.profiles from anon, authenticated;
grant select (id, handle, nickname, bio, avatar_url, job_codes, created_at)
  on public.profiles to anon, authenticated;
grant update (handle, nickname, bio, avatar_url, job_codes) on public.profiles to authenticated;

create policy profiles_select_active on public.profiles
  for select to anon, authenticated
  using (deleted_at is null or id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------- consent ledger (D5, F7-9)
create table public.consent_events (
  id bigint generated always as identity primary key,
  -- restrict: consent proof outlives the account. Withdrawal = anonymizing soft delete (profiles.deleted_at);
  -- a hard delete of auth.users fails while consent rows exist (by design, needs an admin procedure).
  user_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null check (kind in ('terms', 'privacy', 'adult', 'marketing')),
  version text not null check (char_length(version) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.consent_events enable row level security;
create index consent_events_user_id_idx on public.consent_events (user_id);

create trigger consent_events_append_only before update or delete on public.consent_events
  for each row execute function private.reject_update_delete();
create trigger consent_events_no_truncate before truncate on public.consent_events
  for each statement execute function private.reject_update_delete();

revoke all on public.consent_events from anon, authenticated;
grant select on public.consent_events to authenticated;
create policy consent_events_select_own on public.consent_events
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- signup trigger
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  nick text;
  base_handle text;
begin
  nick := left(btrim(coalesce(
    nullif(meta ->> 'name', ''),
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'preferred_username', ''),
    ''
  )), 12);
  if char_length(nick) < 2 then
    nick := '새 회원';
  end if;

  -- Default handle user_<last 10 hex of id>; on the rare clash fall back to random hex.
  base_handle := 'user_' || right(replace(new.id::text, '-', ''), 10);
  if exists (select 1 from public.profiles where handle = base_handle) then
    base_handle := 'user_' || left(md5(gen_random_uuid()::text), 10);
  end if;

  insert into public.profiles (id, handle, nickname, avatar_url)
  values (
    new.id,
    base_handle,
    nick,
    nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- caller-scoped RPCs
-- Signup completion (F7-9): terms + privacy + 18+ self-check recorded once. Idempotent.
create or replace function public.accept_signup_terms(p_terms_version text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
begin
  if uid is null then
    raise exception using errcode = 'P0001', message = 'NOT_SIGNED_IN';
  end if;
  if p_terms_version is null or char_length(p_terms_version) not between 1 and 40 then
    raise exception using errcode = 'P0001', message = 'INVALID_TERMS_VERSION';
  end if;

  select * into prof from public.profiles where id = uid for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND';
  end if;

  if prof.terms_version is distinct from p_terms_version
     or prof.terms_accepted_at is null or prof.adult_confirmed_at is null then
    insert into public.consent_events (user_id, kind, version)
    values (uid, 'terms', p_terms_version), (uid, 'privacy', p_terms_version), (uid, 'adult', p_terms_version);

    update public.profiles
       set terms_version = p_terms_version,
           terms_accepted_at = now(),
           adult_confirmed_at = coalesce(adult_confirmed_at, now())
     where id = uid;
  end if;

  return jsonb_build_object('terms_version', p_terms_version, 'signup_complete', true);
end;
$$;

revoke execute on function public.accept_signup_terms(text) from public, anon;
grant execute on function public.accept_signup_terms(text) to authenticated;

-- Own account state (consent + role), which column grants hide from the public profile.
create or replace function public.my_account_status()
returns table (
  role text,
  terms_version text,
  terms_accepted_at timestamptz,
  adult_confirmed_at timestamptz,
  signup_complete boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.role, p.terms_version, p.terms_accepted_at, p.adult_confirmed_at,
         (p.terms_accepted_at is not null and p.adult_confirmed_at is not null)
  from public.profiles p
  where p.id = auth.uid()
$$;

revoke execute on function public.my_account_status() from public, anon;
grant execute on function public.my_account_status() to authenticated;
