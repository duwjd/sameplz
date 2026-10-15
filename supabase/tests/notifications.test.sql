-- W6 NOTI · PRF · ACC: notifications from triggers, settings, read state, handle check, withdrawal.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Creator C (owner of a live recipe), member M (holder).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c0c0', 'noti-c@example.test'),
  ('00000000-0000-0000-0000-00000000a0a0', 'noti-m@example.test');
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now(), nickname = '만든이', handle = 'noti_creator'
 where id = '00000000-0000-0000-0000-00000000c0c0';
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now(), nickname = '받은이', handle = 'noti_member'
 where id = '00000000-0000-0000-0000-00000000a0a0';
insert into public.recipes (id, public_id, owner_id, category, prompt_kind, title, summary, status, creator_nickname, job_codes, published_at)
values ('00000000-0000-0000-0000-00000000c001', 'rnotitest1', '00000000-0000-0000-0000-00000000c0c0', 'prompt', 'image',
        '알림 시험', '요약', 'live', '만든이', array['commerce'], now());
insert into public.recipe_versions (id, recipe_id, version_no, changelog, review_status, public_meta, approved_at)
values ('00000000-0000-0000-0000-00000000c011', '00000000-0000-0000-0000-00000000c001', 1, '첫 버전', 'approved', '{}', now());
update public.recipes set current_version_id = '00000000-0000-0000-0000-00000000c011' where id = '00000000-0000-0000-0000-00000000c001';
insert into public.entitlements (user_id, recipe_id, version_id, source)
values ('00000000-0000-0000-0000-00000000a0a0', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c011', 'free');

create function pg_temp.n(p_user text, p_kind text) returns integer language sql as
  $$ select count(*)::integer from public.notifications where user_id = p_user::uuid and kind = p_kind $$;

-- SAME 인증 → creator; own post → nothing.
insert into public.gallery_posts (author_id, recipe_id, kind, title, status)
values ('00000000-0000-0000-0000-00000000a0a0', '00000000-0000-0000-0000-00000000c001', 'same_cert', '따라 했어요', 'visible');
select is(pg_temp.n('00000000-0000-0000-0000-00000000c0c0', 'same_cert'), 1, 'NOTI-01 a SAME 인증 notifies the creator');
insert into public.gallery_posts (author_id, recipe_id, kind, title, status)
values ('00000000-0000-0000-0000-00000000c0c0', '00000000-0000-0000-0000-00000000c001', 'original', '원작', 'visible');
select is(pg_temp.n('00000000-0000-0000-0000-00000000c0c0', 'same_cert'), 1, 'NOTI-01 an original post notifies nobody');
insert into public.gallery_posts (author_id, recipe_id, kind, title, status)
values ('00000000-0000-0000-0000-00000000a0a0', '00000000-0000-0000-0000-00000000c001', 'same_cert', '검토 중', 'pending_review');
select is(pg_temp.n('00000000-0000-0000-0000-00000000c0c0', 'same_cert'), 1, 'NOTI-01 a post under review notifies nobody yet');

-- Follow → followee.
insert into public.follows (follower_id, followee_id) values ('00000000-0000-0000-0000-00000000a0a0', '00000000-0000-0000-0000-00000000c0c0');
select is(pg_temp.n('00000000-0000-0000-0000-00000000c0c0', 'new_follower'), 1, 'NOTI-01 a new follower notifies');

-- Settings: optional kinds can be turned off; required kinds still arrive.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000c0c0","role":"authenticated"}';
select ok(public.set_notification_setting('same_cert', false), 'ACC-03 a member turns SAME 인증 alerts off');
select ok(not public.set_notification_setting('review_passed', false), 'ACC-03 required kinds cannot be switched');
reset role;
insert into public.gallery_posts (author_id, recipe_id, kind, title, status)
values ('00000000-0000-0000-0000-00000000a0a0', '00000000-0000-0000-0000-00000000c001', 'same_cert', '또 했어요', 'visible');
select is(pg_temp.n('00000000-0000-0000-0000-00000000c0c0', 'same_cert'), 1, 'ACC-03 a switched-off kind does not arrive');
insert into public.recipe_versions (id, recipe_id, version_no, changelog, review_status, public_meta)
values ('00000000-0000-0000-0000-00000000c012', '00000000-0000-0000-0000-00000000c001', 2, '고침', 'pending_review', '{}');
update public.recipe_versions set review_status = 'rejected' where id = '00000000-0000-0000-0000-00000000c012';
select is(pg_temp.n('00000000-0000-0000-0000-00000000c0c0', 'review_rejected'), 1, 'F7-3 a review result always arrives (required)');

-- New current version → holders; stop → owner.
update public.recipe_versions set review_status = 'approved', approved_at = now() where id = '00000000-0000-0000-0000-00000000c012';
update public.recipes set current_version_id = '00000000-0000-0000-0000-00000000c012' where id = '00000000-0000-0000-0000-00000000c001';
select is(pg_temp.n('00000000-0000-0000-0000-00000000a0a0', 'version_update'), 1, 'NOTI-01 holders hear about a new version');
update public.recipes set status = 'stopped', stopped_reason = 'policy_violation', stopped_at = now()
 where id = '00000000-0000-0000-0000-00000000c001';
select is(pg_temp.n('00000000-0000-0000-0000-00000000c0c0', 'recipe_stopped'), 1, 'NOTI-01 the owner hears about a stop');

-- Realtime: the user channel carries the kind only, for the owner only.
select ok(exists (select 1 from realtime.messages m where m.topic = 'user:00000000-0000-0000-0000-00000000c0c0'
                   and m.private and (m.payload - 'id') = '{"kind":"recipe_stopped"}'::jsonb),
          'F7-3 a notification is broadcast on the private user channel with the kind only');

-- Read state and privacy.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000c0c0","role":"authenticated"}';
select ok(public.unread_notification_count() >= 3, 'NOTI-02 unread notifications are counted');
select ok(public.mark_all_notifications_read() >= 3, 'NOTI-02 opening the list reads everything');
select is(public.unread_notification_count(), 0, 'NOTI-02 the GNB count goes to 0');
select ok(not exists (select 1 from public.notifications where user_id <> '00000000-0000-0000-0000-00000000c0c0'),
          'NOTI a member sees only their own notifications');
-- Realtime authorizes per subscribed topic (realtime.topic()): asking for M's channel as C sees nothing.
set local realtime.topic to 'user:00000000-0000-0000-0000-00000000a0a0';
select ok((select count(*) from realtime.messages where topic = 'user:00000000-0000-0000-0000-00000000a0a0') = 0,
          'F7-3 another member''s user channel is not readable');

-- Handle check.
select is(public.check_handle('noti_member'), 'TAKEN', 'F7-4 a taken handle');
select is(public.check_handle('Bad Handle'), 'INVALID', 'F7-4 an invalid handle');
select is(public.check_handle('noti_creator'), 'OK', 'F7-4 one''s own handle is fine');
reset role;

-- Withdrawal.
select is(public.withdraw_account('00000000-0000-0000-0000-00000000a0a0') ->> 'ok', 'true', 'F7-6 a member withdraws');
select ok((select deleted_at is not null and nickname = '탈퇴한 회원' and handle::text like 'gone\_%' from public.profiles
            where id = '00000000-0000-0000-0000-00000000a0a0')
          and not exists (select 1 from public.entitlements where user_id = '00000000-0000-0000-0000-00000000a0a0' and revoked_at is null)
          and not exists (select 1 from public.follows where follower_id = '00000000-0000-0000-0000-00000000a0a0')
          and exists (select 1 from public.gallery_posts where author_id = '00000000-0000-0000-0000-00000000a0a0'),
          'F7-6 anonymized, entitlements and follows end, SAME 인증 stay as 「탈퇴한 회원」');

-- Withdrawal guards.
insert into public.recipes (id, public_id, owner_id, category, prompt_kind, title, summary, status, creator_nickname, job_codes)
values ('00000000-0000-0000-0000-00000000a001', 'rnotiwd001', '00000000-0000-0000-0000-00000000c0c0', 'prompt', 'image',
        '탈퇴 전 비공개', '요약', 'private', '만든이', array['commerce']);
select is(public.withdraw_account('00000000-0000-0000-0000-00000000c0c0') ->> 'ok', 'true', 'F7-6 a creator withdraws');
select throws_ok($$ update public.recipes set status = 'live' where id = '00000000-0000-0000-0000-00000000a001' $$,
                 'P0001', 'OWNER_WITHDRAWN', 'F7-6 a withdrawn creator''s private recipe can never go live');
select is((select status from public.recipes where id = '00000000-0000-0000-0000-00000000c001'), 'stopped',
          'F7-6 the creator''s recipes stay stopped');
select throws_ok($$ update public.profiles set handle = 'gone_abcdef0123' where id = '00000000-0000-0000-0000-000000000002' $$,
                 'P0001', 'HANDLE_RESERVED', 'F7-6 gone_ handles are reserved (nobody can block a withdrawal)');
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000c0c0","role":"authenticated"}';
select is((select signup_complete from public.my_account_status()), false, 'F7-6 a withdrawn session is not a member any more');
select is(public.check_handle('gone_abc'), 'INVALID', 'F7-4 gone_ handles cannot be checked out');
reset role;
select ok(not public.withdraw_account('00000000-0000-0000-0000-00000000c0c0') ? 'expired_credits',
          'F7-6 a second withdrawal is refused (idempotent retry happens in the action)');

select * from finish();
rollback;
