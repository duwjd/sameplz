-- W6 ADM (F8-1~3): admin-only decisions with reasons, takedown vs stop, report resolution, SLA alerts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

-- Admin A (seed admin), creator C (live recipe), holder H, reporter R.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000adc0c', 'adm-c@example.test'),
  ('00000000-0000-0000-0000-0000000adb0b', 'adm-h@example.test'),
  ('00000000-0000-0000-0000-0000000ad0e0', 'adm-r@example.test');
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now(), nickname = '만든이', handle = 'adm_creator'
 where id = '00000000-0000-0000-0000-0000000adc0c';
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now(), nickname = '받은이', handle = 'adm_holder'
 where id = '00000000-0000-0000-0000-0000000adb0b';
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now(), nickname = '신고자', handle = 'adm_reporter'
 where id = '00000000-0000-0000-0000-0000000ad0e0';
insert into public.recipes (id, public_id, owner_id, category, prompt_kind, title, summary, status, creator_nickname, job_codes, published_at)
values ('00000000-0000-0000-0000-0000000ad001', 'radmtest01', '00000000-0000-0000-0000-0000000adc0c', 'prompt', 'image',
        '운영 시험', '요약', 'live', '만든이', array['commerce'], now());
insert into public.recipe_versions (id, recipe_id, version_no, changelog, review_status, public_meta, approved_at)
values ('00000000-0000-0000-0000-0000000ad011', '00000000-0000-0000-0000-0000000ad001', 1, '첫 버전', 'draft', '{}', null);
insert into public.recipe_version_secrets (version_id, prompt_body) values ('00000000-0000-0000-0000-0000000ad011', '원문 샘플');
insert into public.recipe_version_files (id, version_id, filename, storage_path, size_bytes)
values ('00000000-0000-0000-0000-0000000adf01', '00000000-0000-0000-0000-0000000ad011', 'guide.md', 'adm/guide.md', 10);
update public.recipe_versions set review_status = 'approved', approved_at = now() where id = '00000000-0000-0000-0000-0000000ad011';
update public.recipes set current_version_id = '00000000-0000-0000-0000-0000000ad011' where id = '00000000-0000-0000-0000-0000000ad001';
insert into public.entitlements (id, user_id, recipe_id, version_id, source)
values ('00000000-0000-0000-0000-0000000ade01', '00000000-0000-0000-0000-0000000adb0b',
        '00000000-0000-0000-0000-0000000ad001', '00000000-0000-0000-0000-0000000ad011', 'free');

create function pg_temp.n(p_user text, p_kind text) returns integer language sql as
  $$ select count(*)::integer from public.notifications where user_id = p_user::uuid and kind = p_kind $$;
create function pg_temp.status() returns text language sql as
  $$ select status from public.recipes where id = '00000000-0000-0000-0000-0000000ad001' $$;

-- Who can decide.
select throws_ok($$ select public.admin_set_recipe_status('00000000-0000-0000-0000-0000000adc0c',
                    '00000000-0000-0000-0000-0000000ad001', 'takedown', 'rights_claim', '테스트') $$,
                 'P0001', 'NOT_ADMIN', 'F8-3 a member who is not an admin cannot take down');
select throws_ok($$ select public.admin_set_recipe_status('00000000-0000-0000-0000-000000000010',
                    '00000000-0000-0000-0000-0000000ad001', 'stop', 'quality', null) $$,
                 'P0001', 'NOT_ADMIN', 'F8-3 staff is not an admin');
select throws_ok($$ select public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011',
                    '00000000-0000-0000-0000-0000000ad001', 'takedown', null, null) $$,
                 'P0001', 'REASON_REQUIRED', 'F8-3 every action needs a reason');
select throws_ok($$ select public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011',
                    '00000000-0000-0000-0000-0000000ad001', 'stop', 'creator_request', null) $$,
                 'P0001', 'REASON_REQUIRED', 'F8-3 ops cannot use the creator''s own reason');
select ok(not has_function_privilege('authenticated', 'public.admin_set_recipe_status(uuid, uuid, text, text, text)', 'execute')
          and not has_function_privilege('anon', 'public.admin_resolve_report(uuid, uuid, text, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.admin_hide_post(uuid, uuid, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.pending_sla_alerts()', 'execute')
          and not has_function_privilege('authenticated', 'public.mark_sla_alerts(text, text[])', 'execute'),
          'ADM admin RPCs are server-only');

-- Stop: holders keep using it.
select is(public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000ad001',
          'stop', 'quality', '설명과 결과가 달라요') ->> 'status', 'stopped', 'F8-3 an admin stops a live recipe');
select is(pg_temp.n('00000000-0000-0000-0000-0000000adc0c', 'recipe_stopped'), 1, 'F8-3 the creator hears about the stop');
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000adb0b","role":"authenticated"}';
select is(public.open_original('00000000-0000-0000-0000-0000000ade01') ->> 'prompt_body', '원문 샘플',
          'F8-3 a holder still opens a stopped recipe');
reset role;

-- Takedown: hidden from everyone, holders included.
select is(public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000ad001',
          'takedown', 'rights_claim', '저작권 신고 접수') ->> 'status', 'taken_down', 'F8-3 an admin takes a recipe down');
select is(pg_temp.n('00000000-0000-0000-0000-0000000adc0c', 'recipe_taken_down'), 1, 'F8-3 the creator hears about the takedown');
select is((select stopped_reason from public.recipes where id = '00000000-0000-0000-0000-0000000ad001'), 'rights_claim',
          'F8-3 the takedown reason is kept');
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000adb0b","role":"authenticated"}';
select throws_ok($$ select public.open_original('00000000-0000-0000-0000-0000000ade01') $$,
                 'P0001', 'NOT_FOUND', 'F8-3 a holder cannot open a taken-down recipe');
select throws_ok($$ select public.apply_update('00000000-0000-0000-0000-0000000ade01') $$,
                 'P0001', 'NOT_FOUND', 'F8-3 a holder cannot update a taken-down recipe');
select is((select count(*)::integer from public.file_for_download('00000000-0000-0000-0000-0000000ad011',
                                                                    '00000000-0000-0000-0000-0000000adf01')), 0,
          'F8-3 a holder cannot download a taken-down recipe''s files');
select is(public.get_recipe_public('radmtest01'), null, 'F8-3 the detail is gone for everyone');
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000adc0c","role":"authenticated"}';
select is((select count(*)::integer from public.file_for_download('00000000-0000-0000-0000-0000000ad011',
                                                                    '00000000-0000-0000-0000-0000000adf01')), 1,
          'F8-3 the owner keeps their own files');
reset role;

-- Nothing but restore lifts it.
update public.recipes set status = 'live' where id = '00000000-0000-0000-0000-0000000ad001';
select is(pg_temp.status(), 'taken_down', 'F8-3 a direct status change does not lift a takedown');
select throws_ok($$ insert into public.recipe_versions (recipe_id, version_no, changelog, review_status, public_meta)
                    values ('00000000-0000-0000-0000-0000000ad001', 3, '또 고침', 'draft', '{}') $$,
                 'P0001', 'RECIPE_TAKEN_DOWN', 'F8-3 a taken-down recipe takes no new version');
select throws_ok($$ select public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011',
                    '00000000-0000-0000-0000-0000000ad001', 'restore', null, null) $$,
                 'P0001', 'REASON_REQUIRED', 'F8-3 a restore needs a note');
select is(public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000ad001',
          'restore', null, '권리자 확인 끝') ->> 'status', 'stopped', 'F8-3 restore brings it back as stopped');
select is(pg_temp.n('00000000-0000-0000-0000-0000000adc0c', 'recipe_stopped'), 2, 'F8-3 the creator hears about the restore');
select is(public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000ad001',
          'restore', null, '판매 재개') ->> 'status', 'live', 'F8-3 a second restore reopens sales');
select is((select count(*)::integer from public.admin_actions
            where target_id = '00000000-0000-0000-0000-0000000ad001' and action like 'recipe_%'), 4,
          'ADM every decision is logged in admin_actions');

-- Reports: one answer closes every open report on the target and tells each reporter.
insert into public.reports (id, reporter_id, target_type, target_id, reason)
values ('00000000-0000-0000-0000-0000000ad901', '00000000-0000-0000-0000-0000000ad0e0', 'recipe',
        '00000000-0000-0000-0000-0000000ad001', 'rights'),
       ('00000000-0000-0000-0000-0000000ad902', '00000000-0000-0000-0000-0000000adb0b', 'recipe',
        '00000000-0000-0000-0000-0000000ad001', 'misleading');
select throws_ok($$ select public.admin_resolve_report('00000000-0000-0000-0000-000000000011',
                    '00000000-0000-0000-0000-0000000ad901', 'dismissed', '  ') $$,
                 'P0001', 'ANSWER_REQUIRED', 'F8-2 an answer is required');
select is(public.admin_resolve_report('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000ad901',
          'actioned', '확인 뒤 게시를 중단했어요.') ->> 'closed', '2', 'F8-2 both open reports on the target close');
select is(pg_temp.n('00000000-0000-0000-0000-0000000ad0e0', 'report_answered')
          + pg_temp.n('00000000-0000-0000-0000-0000000adb0b', 'report_answered'), 2, 'F8-2 each reporter gets the answer');
select ok((select outcome = 'actioned' and resolved_by = '00000000-0000-0000-0000-000000000011' and resolved_at is not null
             from public.reports where id = '00000000-0000-0000-0000-0000000ad902'),
          'F8-2 the outcome and who decided are kept');
select throws_ok($$ select public.admin_resolve_report('00000000-0000-0000-0000-000000000011',
                    '00000000-0000-0000-0000-0000000ad901', 'dismissed', '다시') $$,
                 'P0001', 'NOT_OPEN', 'F8-2 a closed report cannot be answered twice');

-- Gallery post hiding.
insert into public.gallery_posts (id, author_id, recipe_id, kind, title, status)
values ('00000000-0000-0000-0000-0000000ad701', '00000000-0000-0000-0000-0000000adb0b',
        '00000000-0000-0000-0000-0000000ad001', 'same_cert', '따라 했어요', 'visible');
select is(public.admin_hide_post('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000ad701',
          '남의 결과물') ->> 'status', 'hidden', 'F8-2 an admin hides a gallery post');

-- SLA alerts: 24h reviews and 20h reports, each once.
insert into public.reports (id, reporter_id, target_type, target_id, reason, created_at)
values ('00000000-0000-0000-0000-0000000ad903', '00000000-0000-0000-0000-0000000ad0e0', 'post',
        '00000000-0000-0000-0000-0000000ad701', 'rights', now() - interval '21 hours');
insert into public.review_queue (version_id, recipe_id, reason, requested_visibility, created_at)
values ('00000000-0000-0000-0000-0000000ad011', '00000000-0000-0000-0000-0000000ad001', 'agent', 'public',
        now() - interval '25 hours');
select ok((select count(*) from jsonb_array_elements(public.pending_sla_alerts()) a
            where (a ->> 'kind' = 'review_24h' and a ->> 'id' = '00000000-0000-0000-0000-0000000ad011')
               or (a ->> 'kind' = 'report_20h' and a ->> 'id' = '00000000-0000-0000-0000-0000000ad903')) = 2,
          'F8-1 F8-2 a 24h review and a 20h report are pending alerts');
select is(public.mark_sla_alerts('report_20h', array['00000000-0000-0000-0000-0000000ad903']), 1,
          'F8-2 an alert is marked after it was sent');
select ok(not exists (select 1 from jsonb_array_elements(public.pending_sla_alerts()) a
                       where a ->> 'id' = '00000000-0000-0000-0000-0000000ad903'),
          'F8-2 a sent alert is not sent again');

-- Restore puts back exactly what the takedown replaced: a private recipe never turns public.
insert into public.recipes (id, public_id, owner_id, category, prompt_kind, title, summary, status, creator_nickname, job_codes)
values ('00000000-0000-0000-0000-0000000ad002', 'radmtest02', '00000000-0000-0000-0000-0000000adc0c', 'prompt', 'image',
        '비공개 시험', '요약', 'private', '만든이', array['commerce']);
insert into public.recipe_versions (id, recipe_id, version_no, changelog, review_status, public_meta)
values ('00000000-0000-0000-0000-0000000ad021', '00000000-0000-0000-0000-0000000ad002', 1, '첫 버전', 'pending_review', '{}');
insert into public.review_queue (version_id, recipe_id, reason, requested_visibility)
values ('00000000-0000-0000-0000-0000000ad021', '00000000-0000-0000-0000-0000000ad002', 'agent', 'public');
select is(public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000ad002',
          'takedown', 'policy_violation', null) ->> 'status', 'taken_down', 'F8-3 a private recipe can be taken down');
select throws_ok($$ select public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011',
                    '00000000-0000-0000-0000-0000000ad002', 'takedown', 'quality', null) $$,
                 'P0001', 'INVALID_STATE', 'F8-3 a taken-down recipe cannot be taken down twice');
select throws_ok($$ select public.admin_decide_review('00000000-0000-0000-0000-000000000011',
                    '00000000-0000-0000-0000-0000000ad021', 'approve') $$,
                 'P0001', 'RECIPE_TAKEN_DOWN', 'F8-3 a version of a taken-down recipe cannot be approved');
select ok(not exists (select 1 from jsonb_array_elements(public.pending_sla_alerts()) a
                       where a ->> 'id' = '00000000-0000-0000-0000-0000000ad021'),
          'F8-1 a taken-down recipe''s review raises no SLA alert');
select is(public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000ad002',
          'restore', null, '오해였어요') ->> 'status', 'private', 'F8-3 restore returns a private recipe to private');
select ok((select stopped_reason is null and takedown_prior is null from public.recipes
            where id = '00000000-0000-0000-0000-0000000ad002'),
          'F8-3 restore clears the takedown reason and the kept state');

-- Guards on input and on who decides.
select throws_ok($$ select public.admin_set_recipe_status('00000000-0000-0000-0000-000000000011',
                    '00000000-0000-0000-0000-0000000ad002', null, 'quality', null) $$,
                 'P0001', 'INVALID_ACTION', 'ADM a missing action is refused');
select throws_ok($$ select public.admin_resolve_report('00000000-0000-0000-0000-000000000011',
                    '00000000-0000-0000-0000-0000000ad903', null, '답') $$,
                 'P0001', 'INVALID_OUTCOME', 'ADM a missing outcome is refused');
select throws_ok($$ select public.admin_resolve_report('00000000-0000-0000-0000-000000000011',
                    '00000000-0000-0000-0000-0000000ad903', 'dismissed', repeat('가', 201)) $$,
                 'P0001', 'ANSWER_REQUIRED', 'F8-2 an answer fits the 200-character notification');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000adaaa', 'adm-gone@example.test');
update public.profiles set role = 'admin', deleted_at = now() where id = '00000000-0000-0000-0000-0000000adaaa';
select throws_ok($$ select public.admin_decide_review('00000000-0000-0000-0000-0000000adaaa',
                    '00000000-0000-0000-0000-0000000ad021', 'reject', 'R01', null) $$,
                 'P0001', 'NOT_ADMIN', 'ADM a withdrawn admin cannot decide a review');
select is(public.mark_sla_alerts('report_20h', array['00000000-0000-0000-0000-0000000ad903']), 0,
          'F8-2 marking the same alert again does nothing');
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000adc0c","role":"authenticated"}';
select throws_ok($$ select * from private.ops_sla_alerts $$, '42501', null, 'ADM members cannot read the SLA log');
reset role;

select * from finish();
rollback;
