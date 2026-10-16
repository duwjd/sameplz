-- F7-7 privacy policy: one year after withdrawal the member's remaining records are deleted; their recipes
-- stay (stopped, 「탈퇴한 회원」) for the people who received them. Append-only tables stay append-only
-- for everyone else.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- W withdraws (credits, consent, a recipe H received, a gallery post, a playground run with a face
-- consent and a stored result, a report). R withdrew recently. H is an active holder.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f101', 'purge-w@example.test'),
  ('00000000-0000-0000-0000-00000000f102', 'purge-r@example.test'),
  ('00000000-0000-0000-0000-00000000f103', 'purge-h@example.test');
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now()
 where id in ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f102',
              '00000000-0000-0000-0000-00000000f103');
insert into public.consent_events (user_id, kind, version) values
  ('00000000-0000-0000-0000-00000000f101', 'terms', 'test'),
  ('00000000-0000-0000-0000-00000000f102', 'terms', 'test');
select private.ensure_credit_account(id) from public.profiles
 where id in ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f102');
update public.credit_accounts set grant_eligible = true
 where user_id in ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f102');
select private.grant_monthly_credits('00000000-0000-0000-0000-00000000f101');
select private.grant_monthly_credits('00000000-0000-0000-0000-00000000f102');

insert into public.recipes (id, public_id, owner_id, category, prompt_kind, title, summary, status, creator_nickname, job_codes, published_at)
values ('00000000-0000-0000-0000-00000000f110', 'rpurge0001', '00000000-0000-0000-0000-00000000f101',
        'prompt', 'image', '정리 시험', '요약', 'live', '정리', array['commerce'], now());
insert into public.recipe_versions (id, recipe_id, version_no, changelog, review_status, public_meta)
values ('00000000-0000-0000-0000-00000000f111', '00000000-0000-0000-0000-00000000f110', 1, '첫 버전', 'draft', '{}');
insert into public.media_assets (id, owner_id, storage_path, kind, ratio) values
  ('00000000-0000-0000-0000-00000000f112', '00000000-0000-0000-0000-00000000f101', 'purge/recipe.png', 'image', '1/1'),
  ('00000000-0000-0000-0000-00000000f113', '00000000-0000-0000-0000-00000000f101', 'purge/post.png', 'image', '1/1');
insert into public.recipe_version_media (version_id, media_id, role, sort)
values ('00000000-0000-0000-0000-00000000f111', '00000000-0000-0000-0000-00000000f112', 'result', 0);
update public.recipe_versions set review_status = 'approved', approved_at = now() where id = '00000000-0000-0000-0000-00000000f111';
update public.recipes set current_version_id = '00000000-0000-0000-0000-00000000f111' where id = '00000000-0000-0000-0000-00000000f110';
insert into public.entitlements (user_id, recipe_id, version_id, source)
values ('00000000-0000-0000-0000-00000000f103', '00000000-0000-0000-0000-00000000f110',
        '00000000-0000-0000-0000-00000000f111', 'free');
insert into public.gallery_posts (id, author_id, recipe_id, kind, media_id, title, status)
values ('00000000-0000-0000-0000-00000000f114', '00000000-0000-0000-0000-00000000f101',
        '00000000-0000-0000-0000-00000000f110', 'original', '00000000-0000-0000-0000-00000000f113', '원작', 'visible');

insert into public.play_runs (id, user_id, mode, client_request_id)
values ('00000000-0000-0000-0000-00000000f120', '00000000-0000-0000-0000-00000000f101', 'blank', gen_random_uuid());
insert into public.play_refs (id, user_id, path, mime, size)
values ('00000000-0000-0000-0000-00000000f121', '00000000-0000-0000-0000-00000000f101', 'purge/ref.png', 'image/png', 10);
insert into public.face_consents (run_id, ref_id, user_id)
values ('00000000-0000-0000-0000-00000000f120', '00000000-0000-0000-0000-00000000f121', '00000000-0000-0000-0000-00000000f101');
insert into public.play_cells (id, run_id, user_id, model_id, params, price_credits, price_version, status, result_path, saved_at)
values ('00000000-0000-0000-0000-00000000f122', '00000000-0000-0000-0000-00000000f120', '00000000-0000-0000-0000-00000000f101',
        'gpt-image-2', '{}', 5, 1, 'succeeded', 'purge/result.png', now());
insert into public.reports (reporter_id, target_type, target_id, reason)
values ('00000000-0000-0000-0000-00000000f101', 'recipe', '00000000-0000-0000-0000-00000000f110', 'misleading');

select public.withdraw_account('00000000-0000-0000-0000-00000000f101');
select public.withdraw_account('00000000-0000-0000-0000-00000000f102');
insert into public.credit_holds (cell_id, user_id, credits, allocations, state, outcome, settled_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-00000000f101', 5, '[]', 'captured', 'success', now());
update public.profiles set deleted_at = now() - interval '400 days' where id = '00000000-0000-0000-0000-00000000f101';
update public.profiles set deleted_at = now() - interval '30 days' where id = '00000000-0000-0000-0000-00000000f102';

create function pg_temp.n(p_table text, p_col text, p_user text) returns integer language plpgsql as $$
declare v integer;
begin
  execute format('select count(*)::integer from public.%I where %I = %L', p_table, p_col, p_user) into v;
  return v;
end $$;

-- Still append-only for everyone, including the owner role without the purge.
select throws_ok($$ delete from public.consent_events where user_id = '00000000-0000-0000-0000-00000000f101' $$,
                 'P0001', 'APPEND_ONLY', 'F7-7 consent records stay append-only outside the purge');
select throws_ok($$ delete from public.credit_ledger where user_id = '00000000-0000-0000-0000-00000000f101' $$,
                 'P0001', 'APPEND_ONLY', 'F7-7 the credit ledger stays append-only outside the purge');

-- First run: everything but the playground rows still holding a file is gone; not marked done yet.
select is(private.purge_withdrawn_members(), 0, 'F7-7 a member with playground files left is not done on the first run');
select is(pg_temp.n('consent_events', 'user_id', '00000000-0000-0000-0000-00000000f101'), 0, 'F7-7 consent records are deleted');
select is(pg_temp.n('credit_ledger', 'user_id', '00000000-0000-0000-0000-00000000f101')
          + pg_temp.n('credit_lots', 'user_id', '00000000-0000-0000-0000-00000000f101')
          + pg_temp.n('credit_accounts', 'user_id', '00000000-0000-0000-0000-00000000f101'), 0,
          'F7-7 credit records are deleted');
select is(pg_temp.n('gallery_posts', 'author_id', '00000000-0000-0000-0000-00000000f101'), 0, 'F7-7 gallery posts are deleted');
select ok(not exists (select 1 from public.media_assets where id = '00000000-0000-0000-0000-00000000f113'),
          'F7-7 gallery-only media rows are dropped (the orphan scan removes the file)');
select ok(exists (select 1 from public.media_assets where id = '00000000-0000-0000-0000-00000000f112'),
          'F7-7 media of the recipe stays');
select is(pg_temp.n('reports', 'reporter_id', '00000000-0000-0000-0000-00000000f101'), 0, 'F7-7 reports they filed are deleted');
select ok((select saved_at is null and delete_after <= now() from public.play_cells where id = '00000000-0000-0000-0000-00000000f122'),
          'F7-7 a saved playground result is expired for the sweeper');
select ok((select delete_after <= now() from public.play_refs where id = '00000000-0000-0000-0000-00000000f121'),
          'F7-7 a reference upload is expired for the sweeper');
select ok(exists (select 1 from public.play_runs where id = '00000000-0000-0000-0000-00000000f120'),
          'F7-7 a run whose result file is not removed yet stays');

-- The recipe stays for the holder.
select is((select status from public.recipes where id = '00000000-0000-0000-0000-00000000f110'), 'stopped',
          'F7-7 the recipe stays, stopped');
select is(pg_temp.n('entitlements', 'user_id', '00000000-0000-0000-0000-00000000f103'), 1,
          'F7-7 the holder keeps the recipe they received');
select is((select nickname from public.profiles where id = '00000000-0000-0000-0000-00000000f101'), '탈퇴한 회원',
          'F7-7 the anonymized profile stays as the recipe owner');

-- The sweeper removes the files (purge_play_files), then the next run finishes the member.
select public.purge_play_files(array['00000000-0000-0000-0000-00000000f121']::uuid[],
                               array['00000000-0000-0000-0000-00000000f122']::uuid[]);
select is(private.purge_withdrawn_members(), 1, 'F7-7 the member is done once the files are gone');
select ok(not exists (select 1 from public.play_runs where user_id = '00000000-0000-0000-0000-00000000f101'),
          'F7-7 playground runs are deleted');
select is(pg_temp.n('face_consents', 'user_id', '00000000-0000-0000-0000-00000000f101'), 0, 'F7-7 face consents are deleted');
select ok((select purged_at is not null from public.profiles where id = '00000000-0000-0000-0000-00000000f101'),
          'F7-7 the member is marked purged');

-- A recent leaver keeps everything until the year is up.
select is(pg_temp.n('consent_events', 'user_id', '00000000-0000-0000-0000-00000000f102')
          + pg_temp.n('credit_ledger', 'user_id', '00000000-0000-0000-0000-00000000f102') > 0, true,
          'F7-7 a member who left 30 days ago keeps their records');

select ok(not has_function_privilege('authenticated', 'private.purge_withdrawn_members()', 'execute'),
          'F7-7 members cannot run the purge');
select ok((select count(*) = 1 from cron.job where jobname = 'sameplz-purge-withdrawn'),
          'F7-7 the purge is scheduled daily');

-- F4-8 regression: an expired face reference is removed even though a consent points at it; the
-- consent row itself still cannot be edited otherwise.
insert into public.play_runs (id, user_id, mode, client_request_id)
values ('00000000-0000-0000-0000-00000000f130', '00000000-0000-0000-0000-00000000f103', 'blank', gen_random_uuid());
insert into public.play_refs (id, user_id, path, mime, size, delete_after)
values ('00000000-0000-0000-0000-00000000f131', '00000000-0000-0000-0000-00000000f103', 'purge/ref2.png', 'image/png', 10, now());
insert into public.face_consents (run_id, ref_id, user_id)
values ('00000000-0000-0000-0000-00000000f130', '00000000-0000-0000-0000-00000000f131', '00000000-0000-0000-0000-00000000f103');
select lives_ok($$ select public.purge_play_files(array['00000000-0000-0000-0000-00000000f131']::uuid[], '{}') $$,
                'F4-8 an expired face reference with a consent is removed');
select ok((select ref_id is null from public.face_consents where run_id = '00000000-0000-0000-0000-00000000f130'),
          'F4-8 the consent stays and only loses the reference link');
select throws_ok($$ update public.face_consents set notice_version = 'x' where run_id = '00000000-0000-0000-0000-00000000f130' $$,
                 'P0001', 'APPEND_ONLY', 'F4-8 face consents stay append-only otherwise');

-- INV-C10: the purge flag alone opens nothing for active members or the admin log.
select set_config('sameplz.member_purge', 'on', true);
select throws_ok($$ delete from public.consent_events where user_id = '00000000-0000-0000-0000-00000000f102' $$,
                 'P0001', 'APPEND_ONLY', 'INV-C10 the purge flag cannot delete consents of a member who left 30 days ago');
select throws_ok($$ delete from public.credit_ledger where user_id = '00000000-0000-0000-0000-000000000001' $$,
                 'P0001', 'APPEND_ONLY', 'INV-C10 the purge flag cannot delete ledger rows of an active member');
insert into public.admin_actions (actor_id, action, target_type, target_id, reason)
values ('00000000-0000-0000-0000-000000000011', 'test', 'user', 'x', '시험');
select throws_ok($$ delete from public.admin_actions where action = 'test' $$,
                 'P0001', 'APPEND_ONLY', 'INV-C10 admin_actions stays append-only even with the purge flag');
select set_config('sameplz.member_purge', 'off', true);
-- INV-C20: holds stay so the budget still reconciles.
select is(pg_temp.n('credit_holds', 'user_id', '00000000-0000-0000-0000-00000000f101'), 1,
          'INV-C20 a purged member''s captured hold stays so the budget still reconciles');

select * from finish();
rollback;
