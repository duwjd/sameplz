-- W6 NOTI · MY · PRF · ACC (F7-2~6): in-app notifications broadcast on the private user:{uid}
-- channel, per-kind settings (required kinds cannot be turned off), handle checks, withdrawal.
-- MVP: in-app + Realtime only (email / 알림톡 come with the paid phase).

-- ---------------------------------------------------------------- notifications
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'version_update', 'same_cert', 'new_recipe', 'new_follower',             -- optional
    'review_passed', 'review_rejected', 'recipe_stopped', 'report_received', 'report_answered')), -- required
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 200),
  href text not null check (href ~ '^/[A-Za-z0-9/_?=&%.-]*$'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

-- Optional kinds can be turned off; required ones always arrive (F7-3).
create table public.notification_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  version_update boolean not null default true,
  same_cert boolean not null default true,
  follow boolean not null default true,     -- new_recipe + new_follower
  updated_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon, authenticated;
grant select on public.notification_settings to authenticated;
create policy notification_settings_select_own on public.notification_settings for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text, p_href text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.notification_settings%rowtype;
  v_id bigint;
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user and deleted_at is null) then
    return;
  end if;
  select * into s from public.notification_settings where user_id = p_user;
  if found and ((p_kind = 'version_update' and not s.version_update)
             or (p_kind = 'same_cert' and not s.same_cert)
             or (p_kind in ('new_recipe', 'new_follower') and not s.follow)) then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, href)
  values (p_user, p_kind, left(p_title, 80), left(coalesce(p_body, ''), 200), p_href)
  returning id into v_id;
  begin   -- a UI hint: never let a failed broadcast undo the change that caused it
    perform realtime.send(jsonb_build_object('kind', p_kind), 'notification', 'user:' || p_user::text, true);
  exception when others then
    null;
  end;
end;
$$;
revoke execute on function private.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- Only the owner receives their user channel.
create policy user_channel_owner_receives on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast'
         and (select realtime.topic()) = 'user:' || (select auth.uid())::text);

-- ---------------------------------------------------------------- triggers that create notifications
-- SAME 인증 visible on someone's recipe → the creator.
create or replace function private.notify_same_cert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recipes%rowtype;
begin
  if new.kind <> 'same_cert' or new.status <> 'visible'
     or (tg_op = 'UPDATE' and old.status = 'visible') then
    return null;
  end if;
  select * into r from public.recipes where id = new.recipe_id;
  if r.owner_id is distinct from new.author_id then
    perform private.notify(r.owner_id, 'same_cert', '「' || r.title || '」에 SAME 인증이 올라왔어요',
                           left(new.title, 120), '/r/' || r.public_id);
  end if;
  return null;
end;
$$;
create trigger gallery_posts_notify_same after insert or update of status on public.gallery_posts
  for each row execute function private.notify_same_cert();

create or replace function private.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(new.followee_id, 'new_follower',
    coalesce((select nickname from public.profiles where id = new.follower_id), '누군가') || '님이 나를 팔로우해요',
    '', '/my/activity?tab=following');
  return null;
end;
$$;
create trigger follows_notify after insert on public.follows
  for each row execute function private.notify_new_follower();

-- A recipe goes live for the first time → followers; a new current version → holders;
-- a stop → the owner (required).
create or replace function private.notify_recipe_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
begin
  if new.status = 'live' and old.published_at is null and new.published_at is not null then
    for f in select follower_id from public.follows where followee_id = new.owner_id loop
      perform private.notify(f.follower_id, 'new_recipe', new.creator_nickname || '님이 새 레시피를 올렸어요',
                             new.title, '/r/' || new.public_id);
    end loop;
  end if;
  if new.status = 'live' and old.current_version_id is not null
     and new.current_version_id is distinct from old.current_version_id then
    for f in select distinct e.user_id from public.entitlements e
              where e.recipe_id = new.id and e.revoked_at is null and e.user_id <> new.owner_id loop
      perform private.notify(f.user_id, 'version_update', '「' || new.title || '」 새 버전이 나왔어요',
                             '라이브러리에서 골라서 업데이트할 수 있어요.', '/my/library');
    end loop;
  end if;
  if new.status = 'stopped' and old.status is distinct from 'stopped' then
    perform private.notify(new.owner_id, 'recipe_stopped', '「' || new.title || '」 판매를 멈췄어요',
                           '받은 사람은 받은 버전을 계속 써요. 자세한 사유는 판매자 센터에서 봐요.', '/my/seller');
  end if;
  return null;
end;
$$;
create trigger recipes_notify after update of status, current_version_id, published_at on public.recipes
  for each row execute function private.notify_recipe_change();

-- A person's review decision → the creator (required).
create or replace function private.notify_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recipes%rowtype;
begin
  if old.review_status <> 'pending_review' or new.review_status not in ('approved', 'rejected') then
    return null;
  end if;
  select * into r from public.recipes where id = new.recipe_id;
  if new.review_status = 'approved' then
    perform private.notify(r.owner_id, 'review_passed', '「' || r.title || '」 확인을 마쳤어요',
                           'v' || new.version_no || '이(가) 올라갔어요.', '/my/seller');
  else
    perform private.notify(r.owner_id, 'review_rejected', '「' || r.title || '」을(를) 고쳐 주세요',
                           '반려 사유를 판매자 센터에서 확인하고 다시 제출할 수 있어요.', '/my/seller');
  end if;
  return null;
end;
$$;
create trigger recipe_versions_notify after update of review_status on public.recipe_versions
  for each row execute function private.notify_review();

create or replace function private.notify_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify(new.reporter_id, 'report_received', '신고를 접수했어요',
                           '1영업일 안에 첫 답을 드려요.', '/my/activity?tab=reports');
  elsif new.status = 'resolved' and old.status <> 'resolved' then
    perform private.notify(new.reporter_id, 'report_answered', '신고에 답을 드렸어요',
                           left(coalesce(new.answer, '처리를 마쳤어요.'), 200), '/my/activity?tab=reports');
  end if;
  return null;
end;
$$;
create trigger reports_notify after insert or update of status on public.reports
  for each row execute function private.notify_report();

revoke execute on function private.notify_same_cert(), private.notify_new_follower(), private.notify_recipe_change(),
  private.notify_review(), private.notify_report() from public, anon, authenticated;

-- ---------------------------------------------------------------- notification RPCs (authenticated)
-- NOTI-02: opening the list reads everything.
create or replace function public.mark_all_notifications_read()
returns integer
language sql
security definer
set search_path = ''
as $$
  with u as (update public.notifications set read_at = now()
              where user_id = (select auth.uid()) and read_at is null returning 1)
  select count(*)::integer from u
$$;

create or replace function public.unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select count(*)::integer from public.notifications where user_id = (select auth.uid()) and read_at is null $$;

create or replace function public.set_notification_setting(p_kind text, p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or p_kind not in ('version_update', 'same_cert', 'follow') or p_on is null then
    return false;
  end if;
  insert into public.notification_settings (user_id) values (v_user) on conflict (user_id) do nothing;
  update public.notification_settings
     set version_update = case when p_kind = 'version_update' then p_on else version_update end,
         same_cert = case when p_kind = 'same_cert' then p_on else same_cert end,
         follow = case when p_kind = 'follow' then p_on else follow end,
         updated_at = now()
   where user_id = v_user;
  return true;
end;
$$;

revoke execute on function public.mark_all_notifications_read(), public.unread_notification_count(),
  public.set_notification_setting(text, boolean) from public, anon;
grant execute on function public.mark_all_notifications_read(), public.unread_notification_count(),
  public.set_notification_setting(text, boolean) to authenticated;

-- ---------------------------------------------------------------- handle check (PRF, F7-4)
-- Free / taken / invalid, 30 checks per user per hour. Saving checks again (unique index).
create or replace function public.check_handle(p_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    return 'LOGIN_REQUIRED';
  end if;
  if not private.hit_rate_limit('handle_check:user:' || v_user, 30, interval '1 hour') then
    return 'RATE_LIMITED';
  end if;
  if p_handle is null or p_handle !~ '^[a-z0-9_]{3,15}$' then
    return 'INVALID';
  end if;
  if exists (select 1 from public.profiles where handle = p_handle::extensions.citext and id <> v_user) then
    return 'TAKEN';
  end if;
  return 'OK';
end;
$$;
revoke execute on function public.check_handle(text) from public, anon;
grant execute on function public.check_handle(text) to authenticated;

-- ---------------------------------------------------------------- withdrawal (ACC-04, F7-6)
-- Anonymizing soft delete. Free credits expire, entitlements end, drafts / notifications / follows /
-- likes go; the creator's live recipes stop (holders keep their version); SAME 인증 stay as
-- 「탈퇴한 회원」. Consent and ledger history stay (append-only). p_reason is optional feedback, not stored. The auth user is soft-deleted by
-- the server action right after, so the next login starts a new member.
create or replace function public.withdraw_account(p_user uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  v_expired integer := 0;
begin
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null) then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  if exists (select 1 from public.credit_accounts where user_id = p_user and held > 0) then
    return jsonb_build_object('ok', false, 'reason', 'GENERATION_IN_PROGRESS');
  end if;
  perform 1 from public.credit_accounts where user_id = p_user for update;
  for l in select id from public.credit_lots where user_id = p_user and remaining > held loop
    v_expired := v_expired + private.expire_lot(l.id);
  end loop;
  update public.credit_accounts set grant_eligible = false, updated_at = now() where user_id = p_user;

  update public.entitlements set revoked_at = now() where user_id = p_user and revoked_at is null;
  update public.recipes set status = 'stopped', stopped_reason = 'creator_request', stopped_at = now()
   where owner_id = p_user and status = 'live';
  delete from public.recipe_drafts where owner_id = p_user;
  delete from public.notifications where user_id = p_user;
  delete from public.follows where follower_id = p_user or followee_id = p_user;
  delete from public.post_likes where user_id = p_user;
  delete from public.recipe_likes where user_id = p_user;

  update public.profiles
     set nickname = '탈퇴한 회원', handle = 'gone_' || substr(replace(id::text, '-', ''), 1, 10),
         bio = '', avatar_url = null, job_codes = '{}', deleted_at = now(), updated_at = now()
   where id = p_user;
  return jsonb_build_object('ok', true, 'expired_credits', v_expired);
end;
$$;
revoke execute on function public.withdraw_account(uuid, text) from public, anon, authenticated;
grant execute on function public.withdraw_account(uuid, text) to service_role;

-- ---------------------------------------------------------------- gallery: withdrawn authors stay
-- SCN 12: a withdrawn member's SAME 인증 stays in the gallery as 「탈퇴한 회원」 (the profile is
-- anonymized), so the feed no longer hides deleted authors.
create or replace function public.gallery_feed(p_kind text default null, p_before timestamptz default null,
                                               p_before_id uuid default null, p_limit integer default 24,
                                               p_recipe uuid default null)
returns table (
  id uuid, title text, kind text, ratio text, media_kind text, media_path text, alt_text text,
  generated_here boolean, author_id uuid, author_nickname text, author_handle text,
  recipe_id uuid, recipe_title text, recipe_public_id text, fork_allowed boolean,
  likes integer, liked boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.title, g.kind, g.ratio, ma.kind, ma.storage_path, ma.alt_text, g.generated_here,
         a.id, a.nickname, a.handle, r.id, r.title, r.public_id, r.fork_allowed,
         (select count(*) from public.post_likes pl where pl.post_id = g.id)::integer,
         exists (select 1 from public.post_likes pl where pl.post_id = g.id and pl.user_id = (select auth.uid())),
         g.created_at
    from public.gallery_posts g
    join public.recipes r on r.id = g.recipe_id and r.status = 'live'
    join public.profiles a on a.id = g.author_id
    left join public.media_assets ma on ma.id = g.media_id
   where g.status = 'visible'
     and (p_kind is null or g.kind = p_kind)
     and (p_recipe is null or g.recipe_id = p_recipe)
     and (p_before is null or (g.created_at, g.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
   order by g.created_at desc, g.id desc
   limit least(greatest(coalesce(p_limit, 24), 1), 48)
$$;
