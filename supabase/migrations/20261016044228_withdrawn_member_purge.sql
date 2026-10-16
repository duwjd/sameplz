-- F7-7 privacy policy (2026-10-16 user decision): one year after withdrawal, delete what is still tied to
-- the withdrawn member — consent records, credit records, gallery posts, playground runs and results,
-- reports they filed, entitlements, waitlist, share links. Credit holds stay (user_id points at the
-- anonymized profile, no personal data) so generation_budget still reconciles with them (INV-C20). Login identifiers are already scrambled at
-- withdrawal (auth soft delete). Their recipes stay as 「탈퇴한 회원」, stopped, for people who received
-- them (terms §3). The anonymized profile row stays as the recipes' owner.
-- Files: gallery media rows are dropped so the hourly orphan scan removes them (orphan_uploads);
-- playground results are marked expired so the sweeper removes them (purge_play_files), and the run rows
-- go on a later day once no stored result is left.

alter table public.profiles add column purged_at timestamptz;

-- Append-only exception for the purge only (consent_events, credit_ledger, face_consents): a DELETE
-- passes when the purge flag is on, the role is the owner inside the security definer purge, the session
-- is postgres (pg_cron; the API connects as authenticator), and the row belongs to a member who left
-- over a year ago. admin_actions and entitlement_version_history keep the strict reject_update_delete().
create or replace function private.purge_may_delete(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('sameplz.member_purge', true), '') = 'on'
     and current_user = 'postgres' and session_user = 'postgres'
     and exists (select 1 from public.profiles p
                  where p.id = p_user and p.deleted_at < now() - interval '1 year')
$$;
revoke execute on function private.purge_may_delete(uuid) from public, anon, authenticated;

create or replace function private.reject_update_delete_unless_purge()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.purge_may_delete(old.user_id) then
    return old;
  end if;
  raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
end;
$$;
drop trigger consent_events_append_only on public.consent_events;
create trigger consent_events_append_only before update or delete on public.consent_events
  for each row execute function private.reject_update_delete_unless_purge();
drop trigger credit_ledger_append_only on public.credit_ledger;
create trigger credit_ledger_append_only before update or delete on public.credit_ledger
  for each row execute function private.reject_update_delete_unless_purge();

-- face_consents.ref_id is `on delete set null`: removing an expired reference (F4-8, 24 hours) updates
-- the consent row, which the append-only trigger rejected — purge_play_files failed for the whole batch
-- and face uploads outlived 24 hours. Only that one change (ref_id → null, nothing else) is allowed.
create or replace function private.guard_face_consents()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.ref_id is not null and new.ref_id is null
     and (to_jsonb(new) - 'ref_id') = (to_jsonb(old) - 'ref_id') then
    return new;
  end if;
  if tg_op = 'DELETE' and private.purge_may_delete(old.user_id) then
    return old;
  end if;
  raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
end;
$$;
drop trigger face_consents_append_only on public.face_consents;
create trigger face_consents_append_only before update or delete on public.face_consents
  for each row execute function private.guard_face_consents();
create trigger face_consents_no_truncate before truncate on public.face_consents
  for each statement execute function private.reject_update_delete();

create or replace function private.purge_withdrawn_member(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending integer;
begin
  perform 1 from public.profiles
   where id = p_user and deleted_at < now() - interval '1 year' and purged_at is null
   for update;
  if not found then
    return false;
  end if;

  -- Gallery posts and their media (media still used by a recipe version stays with the recipe).
  delete from public.gallery_posts where author_id = p_user;
  delete from public.media_assets m
   where m.owner_id = p_user
     and not exists (select 1 from public.recipe_version_media vm where vm.media_id = m.id)
     and not exists (select 1 from public.gallery_posts g where g.media_id = m.id)
     and not exists (select 1 from public.banners b where b.media_id = m.id);

  -- Playground: expire every stored result and reference (the sweeper deletes the files), then drop
  -- the runs whose results are gone.
  update public.play_cells set saved_at = null, delete_after = now()
   where user_id = p_user and result_path is not null;
  update public.play_refs set delete_after = now() where user_id = p_user;
  perform set_config('sameplz.member_purge', 'on', true);
  delete from public.play_runs r
   where r.user_id = p_user
     and not exists (select 1 from public.play_cells c where c.run_id = r.id and c.result_path is not null);
  select count(*) into v_pending from public.play_cells where user_id = p_user and result_path is not null;
  v_pending := v_pending + (select count(*) from public.play_refs where user_id = p_user);

  delete from public.reports where reporter_id = p_user;
  delete from public.entitlements where user_id = p_user;
  delete from public.creator_waitlist where user_id = p_user;
  delete from public.share_links where creator_id = p_user;
  delete from public.notification_settings where user_id = p_user;
  delete from public.consent_events where user_id = p_user;
  delete from public.credit_ledger where user_id = p_user;
  delete from public.credit_lots where user_id = p_user;
  delete from public.credit_accounts where user_id = p_user;
  perform set_config('sameplz.member_purge', 'off', true);

  -- Done only when no playground file is left; otherwise the next run finishes the rows.
  if v_pending = 0 then
    update public.profiles set purged_at = now() where id = p_user;
  end if;
  return v_pending = 0;
end;
$$;

create or replace function private.purge_withdrawn_members()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  n integer := 0;
begin
  for v_user in
    select id from public.profiles
     where deleted_at < now() - interval '1 year' and purged_at is null
     order by deleted_at limit 200
  loop
    -- One member failing must not stall everyone after them (the retention period is a promise).
    begin
      if private.purge_withdrawn_member(v_user) then
        n := n + 1;
      end if;
    exception when others then
      insert into public.abuse_signals (kind, detail)
      values ('member_purge_failed', jsonb_build_object('user', v_user, 'sqlstate', sqlstate));
    end;
  end loop;
  return n;
end;
$$;
revoke execute on function private.purge_withdrawn_member(uuid), private.purge_withdrawn_members()
  from public, anon, authenticated;

select cron.schedule('sameplz-purge-withdrawn', '15 16 * * *', 'select private.purge_withdrawn_members()');
