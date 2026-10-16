-- W6 ADM (F8-1~3): minimal /admin. Takedown (taken_down) next to stop, admin decisions with a reason
-- in admin_actions, report resolution, gallery post hiding, and 24h review / 20h report SLA alerts.
-- MVP: the admin is profiles.role = 'admin' checked by the server (JWT claim hook + MFA come with F8-4).

-- ---------------------------------------------------------------- takedown status (F8-3)
-- stopped: holders keep using what they received. taken_down: hidden from everyone, holders included.
alter table public.recipes drop constraint recipes_status_check,
  add constraint recipes_status_check
    check (status in ('in_review', 'live', 'rejected', 'private', 'stopped', 'taken_down'));
-- What a takedown replaced ({status, stopped_reason, stopped_at}); restore puts it back as it was,
-- so a private or creator-stopped recipe never becomes public through ops.
alter table public.recipes add column takedown_prior jsonb;

-- Only admin_set_recipe_status('restore') lifts a takedown. Every other path (a review approved later,
-- the visibility toggle, withdrawal) keeps it.
create or replace function private.guard_taken_down()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'taken_down' and new.status is distinct from 'taken_down'
     and coalesce(current_setting('sameplz.admin_restore', true), '') <> 'on' then
    new.status := 'taken_down';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_taken_down() from public, anon, authenticated;
create trigger recipes_guard_taken_down before update of status on public.recipes
  for each row execute function private.guard_taken_down();

-- A version of a taken-down recipe cannot be approved (it may still be rejected to close the queue),
-- and only an active admin decides.
create or replace function private.guard_review_taken_down()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- admin_decide_review predates assert_admin: a withdrawn admin cannot decide either.
  if new.state <> 'open' and old.state = 'open' and new.decided_by is not null
     and not exists (select 1 from public.profiles p
                      where p.id = new.decided_by and p.role = 'admin' and p.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'NOT_ADMIN';
  end if;
  if new.state = 'approved' and old.state = 'open'
     and exists (select 1 from public.recipes r where r.id = new.recipe_id and r.status = 'taken_down') then
    raise exception using errcode = 'P0001', message = 'RECIPE_TAKEN_DOWN';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_review_taken_down() from public, anon, authenticated;
create trigger review_queue_guard_taken_down before update of state on public.review_queue
  for each row execute function private.guard_review_taken_down();

-- No new versions for a taken-down recipe (submit_recipe_version inserts the version row).
create or replace function private.guard_version_taken_down()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.recipes r where r.id = new.recipe_id and r.status = 'taken_down') then
    raise exception using errcode = 'P0001', message = 'RECIPE_TAKEN_DOWN';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_version_taken_down() from public, anon, authenticated;
create trigger recipe_versions_guard_taken_down before insert on public.recipe_versions
  for each row execute function private.guard_version_taken_down();

-- Holders cannot open, update or download a taken-down recipe (same NOT_FOUND as a missing one).
create or replace function public.open_original(p_entitlement_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ent public.entitlements%rowtype;
  first_open boolean;
  out jsonb;
begin
  select e.* into ent from public.entitlements e
   join public.recipes r on r.id = e.recipe_id
   where e.id = p_entitlement_id and e.user_id = auth.uid() and e.revoked_at is null
     and r.status <> 'taken_down'
   for update of e;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  first_open := ent.opened_at is null;
  if first_open then
    update public.entitlements set opened_at = now() where id = ent.id returning * into ent;
  end if;

  select jsonb_build_object(
           'version_no', v.version_no,
           'prompt_body', s.prompt_body,
           'skill_md', s.skill_md,
           'agent_config', s.agent_config,
           'opened_at', ent.opened_at,
           'claimed_at', ent.created_at,
           'first_open', first_open)
    into out
  from public.recipe_versions v
  left join public.recipe_version_secrets s on s.version_id = v.id
  where v.id = ent.version_id;
  return out;
end;
$$;
revoke execute on function public.open_original(uuid) from public, anon;
grant execute on function public.open_original(uuid) to authenticated;

create or replace function public.apply_update(p_entitlement_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ent public.entitlements%rowtype;
  latest uuid;
begin
  select e.* into ent from public.entitlements e
   join public.recipes r on r.id = e.recipe_id
   where e.id = p_entitlement_id and e.user_id = auth.uid() and e.revoked_at is null
     and r.status <> 'taken_down'
   for update of e;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select v.id into latest
  from public.recipes r
  join public.recipe_versions v on v.id = r.current_version_id and v.approved_at is not null
  join public.recipe_versions pinned on pinned.id = ent.version_id
  where r.id = ent.recipe_id
    and v.version_no > pinned.version_no;  -- forward only

  if latest is null or latest = ent.version_id then
    return jsonb_build_object('updated', false, 'version_id', ent.version_id);
  end if;

  insert into public.entitlement_version_history (entitlement_id, user_id, from_version_id, to_version_id)
  values (ent.id, ent.user_id, ent.version_id, latest);
  update public.entitlements set version_id = latest where id = ent.id;
  return jsonb_build_object('updated', true, 'version_id', latest);
end;
$$;
revoke execute on function public.apply_update(uuid) from public, anon;
grant execute on function public.apply_update(uuid) to authenticated;

create or replace function public.file_for_download(p_version_id uuid, p_file_id uuid)
returns table (storage_path text, filename text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.storage_path, f.filename
  from public.recipe_version_files f
  join public.recipe_versions v on v.id = f.version_id
  join public.recipes r on r.id = v.recipe_id
  where f.id = p_file_id
    and f.version_id = p_version_id
    and auth.uid() is not null
    and (r.owner_id = auth.uid()
         or (r.status <> 'taken_down'
             and exists (select 1 from public.entitlements e
                         where e.user_id = auth.uid() and e.recipe_id = r.id
                           and e.version_id = p_version_id and e.revoked_at is null)))
$$;
revoke execute on function public.file_for_download(uuid, uuid) from public, anon;
grant execute on function public.file_for_download(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- notifications for takedown / restore
alter table public.notifications drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (kind in (
    'version_update', 'same_cert', 'new_recipe', 'new_follower',             -- optional
    'review_passed', 'review_rejected', 'recipe_stopped', 'recipe_taken_down',
    'report_received', 'report_answered'));                                  -- required

create or replace function private.notify_recipe_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
  why text := case new.stopped_reason
    when 'creator_request' then '크리에이터 요청으로 멈췄어요.'
    when 'rights_claim' then '권리 침해 신고가 들어와 확인하고 있어요.'
    when 'policy_violation' then '운영 정책에 맞지 않아요.'
    when 'misleading' then '설명과 결과가 달라요.'
    when 'quality' then '결과가 안정적으로 나오지 않아요.'
    else '운영 사정이 있어요.' end;
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
  if new.status = 'taken_down' and old.status is distinct from 'taken_down' then
    perform private.notify(new.owner_id, 'recipe_taken_down', '「' || left(new.title, 30) || '」 게시를 중단했어요',
                           '사유: ' || why || ' 받은 사람도 열 수 없게 모두에게 숨겼어요. 이의는 고객센터로 알려 주세요.',
                           '/my/seller');
  elsif old.status = 'taken_down' and new.status is distinct from 'taken_down' then
    perform private.notify(new.owner_id, 'recipe_stopped', '「' || left(new.title, 30) || '」 게시중단을 풀었어요',
                           '게시중단 전 상태로 돌아갔어요. 받은 사람은 다시 쓸 수 있어요.', '/my/seller');
  elsif new.status = 'stopped' and old.status is distinct from 'stopped' then
    perform private.notify(new.owner_id, 'recipe_stopped', '「' || new.title || '」 판매를 멈췄어요',
                           '사유: ' || why || ' 받은 사람은 받은 버전을 계속 써요.', '/my/seller');
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------- admin decisions (F8-1~3)
create or replace function private.assert_admin(p_actor uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor is null or not exists (select 1 from public.profiles p
                                     where p.id = p_actor and p.role = 'admin' and p.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'NOT_ADMIN';
  end if;
end;
$$;
revoke execute on function private.assert_admin(uuid) from public, anon, authenticated;

-- stop: live → stopped (holders keep using). takedown: hidden from everyone, the prior state kept.
-- restore: taken_down → exactly the prior state; stopped → live (only an ops stop with an approved
-- current version).
create or replace function public.admin_set_recipe_status(p_actor uuid, p_recipe uuid, p_action text,
                                                          p_reason text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.recipes%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform private.assert_admin(p_actor);
  if p_action is null or p_action not in ('stop', 'takedown', 'restore') then
    raise exception using errcode = 'P0001', message = 'INVALID_ACTION';
  end if;
  if p_action <> 'restore' and (p_reason is null or p_reason = 'creator_request'
      or p_reason not in ('rights_claim', 'policy_violation', 'misleading', 'quality', 'other')) then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  if char_length(coalesce(v_note, '')) > 500 then
    raise exception using errcode = 'P0001', message = 'NOTE_TOO_LONG';
  end if;
  if p_action = 'restore' and v_note is null then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  select * into rec from public.recipes where id = p_recipe for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  if p_action = 'stop' then
    if rec.status <> 'live' then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';
    end if;
    update public.recipes set status = 'stopped', stopped_reason = p_reason, stopped_at = now() where id = rec.id;
  elsif p_action = 'takedown' then
    if rec.status not in ('live', 'stopped', 'private', 'in_review') then
      raise exception using errcode = 'P0001', message = 'INVALID_STATE';
    end if;
    update public.recipes
       set status = 'taken_down', stopped_reason = p_reason, stopped_at = now(),
           takedown_prior = jsonb_build_object('status', rec.status, 'stopped_reason', rec.stopped_reason,
                                               'stopped_at', rec.stopped_at)
     where id = rec.id;
  elsif p_action = 'restore' and rec.status = 'taken_down' then
    perform set_config('sameplz.admin_restore', 'on', true);
    update public.recipes
       set status = coalesce(rec.takedown_prior ->> 'status', 'stopped'),
           stopped_reason = case when rec.takedown_prior is null then rec.stopped_reason
                                 else rec.takedown_prior ->> 'stopped_reason' end,
           stopped_at = case when rec.takedown_prior is null then rec.stopped_at
                             else (rec.takedown_prior ->> 'stopped_at')::timestamptz end,
           takedown_prior = null
     where id = rec.id;
    perform set_config('sameplz.admin_restore', 'off', true);
  elsif p_action = 'restore' and rec.status = 'stopped' then
    -- A creator's own stop (or a withdrawal) is theirs to lift, not ops'.
    if rec.stopped_reason = 'creator_request' then
      raise exception using errcode = 'P0001', message = 'CREATOR_STOPPED';
    end if;
    if not exists (select 1 from public.recipe_versions v where v.id = rec.current_version_id and v.approved_at is not null) then
      raise exception using errcode = 'P0001', message = 'NO_APPROVED_VERSION';
    end if;
    update public.recipes set status = 'live', stopped_reason = null, stopped_at = null,
                              published_at = coalesce(published_at, now())
     where id = rec.id;
  else
    raise exception using errcode = 'P0001', message = 'INVALID_STATE';
  end if;

  insert into public.admin_actions (actor_id, action, target_type, target_id, reason, detail)
  values (p_actor, 'recipe_' || p_action, 'recipe', rec.id::text, coalesce(v_note, p_reason),
          jsonb_build_object('from', rec.status, 'reason', p_reason));
  select * into rec from public.recipes where id = rec.id;
  return jsonb_build_object('recipe_id', rec.id, 'public_id', rec.public_id, 'status', rec.status);
end;
$$;
revoke execute on function public.admin_set_recipe_status(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_recipe_status(uuid, uuid, text, text, text) to service_role;

-- Gallery post → hidden (its public media is recomputed by the D18 queue trigger).
create or replace function public.admin_hide_post(p_actor uuid, p_post uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  g public.gallery_posts%rowtype;
begin
  perform private.assert_admin(p_actor);
  if char_length(v_reason) not between 1 and 500 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  select * into g from public.gallery_posts where id = p_post for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  update public.gallery_posts set status = 'hidden' where id = g.id;
  insert into public.admin_actions (actor_id, action, target_type, target_id, reason, detail)
  values (p_actor, 'post_hide', 'gallery_post', g.id::text, v_reason,
          jsonb_build_object('from', g.status, 'recipe_id', g.recipe_id));
  return jsonb_build_object('post_id', g.id, 'recipe_id', g.recipe_id, 'status', 'hidden');
end;
$$;
revoke execute on function public.admin_hide_post(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_hide_post(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------- report resolution (F8-2)
alter table public.reports
  add column resolved_by uuid references public.profiles (id) on delete set null,
  add column outcome text check (outcome in ('dismissed', 'actioned'));
-- Rows resolved by hand before this migration (Studio) get an outcome so the check holds.
update public.reports set outcome = 'dismissed' where status = 'resolved' and outcome is null;
alter table public.reports
  add constraint reports_resolved_has_outcome check ((status = 'resolved') = (outcome is not null));

-- One answer closes every open report on the same target; each reporter gets it (report_answered).
create or replace function public.admin_resolve_report(p_actor uuid, p_report uuid, p_outcome text, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_answer text := btrim(coalesce(p_answer, ''));
  rep public.reports%rowtype;
  n integer;
begin
  perform private.assert_admin(p_actor);
  if p_outcome is null or p_outcome not in ('dismissed', 'actioned') then
    raise exception using errcode = 'P0001', message = 'INVALID_OUTCOME';
  end if;
  -- The reporter's notification body holds 200 characters.
  if char_length(v_answer) not between 1 and 200 then
    raise exception using errcode = 'P0001', message = 'ANSWER_REQUIRED';
  end if;
  select * into rep from public.reports where id = p_report;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  -- Lock every open report on the target in one order (two admins answering two of them never
  -- wait on each other), then read this one again.
  perform 1 from public.reports
   where target_type = rep.target_type and target_id = rep.target_id and status = 'open'
   order by id for update;
  select * into rep from public.reports where id = p_report;
  if rep.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'NOT_OPEN';
  end if;
  update public.reports
     set status = 'resolved', answer = v_answer, outcome = p_outcome, resolved_at = now(), resolved_by = p_actor
   where target_type = rep.target_type and target_id = rep.target_id and status = 'open';
  get diagnostics n = row_count;
  insert into public.admin_actions (actor_id, action, target_type, target_id, reason, detail)
  values (p_actor, 'report_' || p_outcome, 'report', rep.id::text, v_answer,
          jsonb_build_object('target_type', rep.target_type, 'target_id', rep.target_id, 'closed', n));
  return jsonb_build_object('closed', n);
end;
$$;
revoke execute on function public.admin_resolve_report(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_resolve_report(uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------- SLA alerts (F8-1 24h, F8-2 20h)
create table private.ops_sla_alerts (
  kind text not null check (kind in ('review_24h', 'report_20h')),
  target_id text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, target_id)
);
alter table private.ops_sla_alerts enable row level security;
revoke all on private.ops_sla_alerts from public, anon, authenticated;

create or replace function public.pending_sla_alerts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'id', x.id, 'since', x.since) order by x.since), '[]'::jsonb)
  from (
    select 'review_24h' as kind, q.version_id::text as id, q.created_at as since
      from public.review_queue q
     where q.state = 'open' and q.created_at < now() - interval '24 hours'
       and not exists (select 1 from public.recipes r where r.id = q.recipe_id and r.status = 'taken_down')
       and not exists (select 1 from private.ops_sla_alerts a where a.kind = 'review_24h' and a.target_id = q.version_id::text)
    union all
    select 'report_20h', r.id::text, r.created_at
      from public.reports r
     where r.status = 'open' and r.created_at < now() - interval '20 hours'
       and not exists (select 1 from private.ops_sla_alerts a where a.kind = 'report_20h' and a.target_id = r.id::text)
    order by since
    limit 100
  ) x
$$;

-- Marked only after the webhook answered 2xx (same as budget alerts).
create or replace function public.mark_sla_alerts(p_kind text, p_ids text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_kind not in ('review_24h', 'report_20h') then
    raise exception using errcode = 'P0001', message = 'INVALID_KIND';
  end if;
  insert into private.ops_sla_alerts (kind, target_id)
  select p_kind, i from unnest(coalesce(p_ids, '{}')) as i
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.pending_sla_alerts(), public.mark_sla_alerts(text, text[])
  from public, anon, authenticated;
grant execute on function public.pending_sla_alerts(), public.mark_sla_alerts(text, text[]) to service_role;
