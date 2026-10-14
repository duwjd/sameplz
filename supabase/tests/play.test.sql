-- Playground SQL (W5, PR E, money path — written before the implementation): quote, start_run prechecks,
-- atomic holds, settlement via finish_cell, submit/webhook/sweeper RPCs, retention, authorization, Realtime.
-- Plan: docs/plans/PLAY.md. Ledger: 20261013110529_create_credit_ledger.sql. Failure matrix: FM-n (generation-pipeline skill).
-- Credits are ceil(usd × 805) (D17); every expected number below is worked out in a comment.
begin;
create extension if not exists pgtap with schema extensions;
select plan(245);

-- ---------------------------------------------------------------- helpers
create or replace function pg_temp.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create or replace function pg_temp.login_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;
create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end $$;

-- Users A..L. A owns recipe 04 and holds recipe 12 (free); B is a stranger; C has not acknowledged the AI notice;
-- D has only 10C; E hits the rate limit; F the budget; G the daily limit; H the atomic rollback; I settlement;
-- J sweeper; K has not confirmed 18+; L the submit/webhook RPCs; M the whole-run shortfall.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-00000000c' || lpad(n::text, 3, '0'))::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'play-' || n || '@sameplz.test', '{"provider":"email"}', '{"name":"플레이테스트"}'
from generate_series(1, 13) n;

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated, service_role;
insert into t
select chr(64 + n), ('00000000-0000-0000-0000-00000000c' || lpad(n::text, 3, '0')) from generate_series(1, 13) n;
create or replace function pg_temp.u(k text) returns uuid language sql as $$ select v::uuid from t where t.k = $1 $$;

create temp table res (k text primary key, v jsonb);
grant all on res to anon, authenticated, service_role;
create temp table sn (k text primary key, s text);

-- Everyone finished signup and acknowledged the AI notice, except C (no notice) and K (no 18+ check).
update public.profiles set terms_version = '2026-10-v1', terms_accepted_at = now(), adult_confirmed_at = now(),
                           ai_notice_ack_at = now()
 where id in (select v::uuid from t where k not in ('C', 'K'));
update public.profiles set terms_version = '2026-10-v1', terms_accepted_at = now(), adult_confirmed_at = now()
 where id = pg_temp.u('C');
update public.profiles set terms_version = '2026-10-v1', terms_accepted_at = now(), ai_notice_ack_at = now()
 where id = pg_temp.u('K');

insert into public.credit_accounts (user_id, grant_eligible) select v::uuid, true from t;
select private.grant_monthly_credits(v::uuid, private.kst_month()) from t where k not in ('D', 'K');
-- D: only a 10C promo lot.
insert into public.credit_lots (id, user_id, kind, amount, remaining, expires_at)
values ('11111111-0000-0000-0000-0000000000d1', pg_temp.u('D'), 'promo', 10, 10, now() + interval '30 days');
insert into public.credit_ledger (user_id, lot_id, entry_type, delta, idem_key)
values (pg_temp.u('D'), '11111111-0000-0000-0000-0000000000d1', 'grant', 10, 'test:play:d1');
update public.credit_accounts set available = 10 where user_id = pg_temp.u('D');

insert into public.generation_budget (month, cap_credits, state) values (private.kst_month(), 100000, 'open')
on conflict (month) do update set cap_credits = 100000, reserved = 0, spent = 0, state = 'open', alerted_80_at = null;

-- A owns seed recipe 04 (version …04); A holds seed recipe 12 (free) and had recipe 13 revoked.
update public.recipes set owner_id = pg_temp.u('A') where id = 'aaaaaaaa-0000-0000-0000-000000000004';
insert into public.entitlements (user_id, recipe_id, version_id, source)
values (pg_temp.u('A'), 'aaaaaaaa-0000-0000-0000-000000000012', 'bbbbbbbb-0000-0000-0000-000000000012', 'free');
insert into public.entitlements (user_id, recipe_id, version_id, source, revoked_at)
values (pg_temp.u('A'), 'aaaaaaaa-0000-0000-0000-000000000013', 'bbbbbbbb-0000-0000-0000-000000000013', 'free', now());
-- A also holds seed recipe 15, which is stopped (status 'stopped'): free mode needs recipes.status = 'live'.
insert into public.entitlements (user_id, recipe_id, version_id, source)
values (pg_temp.u('A'), 'aaaaaaaa-0000-0000-0000-000000000015', 'bbbbbbbb-0000-0000-0000-000000000015', 'free');

-- Own fixture models and prices (no dependence on seed models). USD → credits = ceil(usd × 805).
-- Reference support: ref_endpoint/ref_param/ref_max > 0 (edit / image-to-video endpoint); null/null/0 = takes no reference.
insert into public.models (id, provider, endpoint, ref_endpoint, ref_param, ref_max, kind, label, params, deadline_seconds, enabled, sort) values
 ('test-image', 'mock', 'mock/test-image', null, null, 0, 'image', '테스트 이미지',
  '{"image_size":{"values":["square_hd","portrait_4_3"],"default":"square_hd"},"quality":{"values":["low","medium","high"],"default":"medium"}}',
  90, true, 9001),
 ('test-tiny', 'mock', 'mock/test-tiny', 'mock/test-tiny-edit', 'image_urls', 4, 'image', '테스트 소형',
  '{"quality":{"values":["low","high"],"default":"low"}}', 60, true, 9002),
 ('test-video', 'mock', 'mock/test-video', null, null, 0, 'video', '테스트 영상',
  '{"duration":{"values":[5,10],"default":5},"resolution":{"values":["480p","720p"],"default":"480p"},"generate_audio":{"values":[false,true],"default":false}}',
  600, true, 9003),
 ('test-video-ref', 'mock', 'mock/test-video-ref', 'mock/test-video-ref-i2v', 'image_url', 1, 'video', '테스트 영상 참조',
  '{"duration":{"values":[5,10],"default":5},"resolution":{"values":["480p","720p"],"default":"480p"},"generate_audio":{"values":[false,true],"default":false}}',
  600, true, 9004),
 ('test-reprice', 'mock', 'mock/test-reprice', null, null, 0, 'image', '테스트 재가격',
  '{"quality":{"values":["low"],"default":"low"}}', 60, true, 9005),
 ('test-off', 'mock', 'mock/test-off', null, null, 0, 'image', '테스트 꺼짐',
  '{"quality":{"values":["low"],"default":"low"}}', 60, false, 9006),
 -- default changes between quote and run (same price_version): p_expected_total catches it
 ('test-drift', 'mock', 'mock/test-drift', null, null, 0, 'image', '테스트 기본값',
  '{"quality":{"values":["low","high"],"default":"low"}}', 60, true, 9007),
 -- unit second without a duration param: unpriceable
 ('test-persec', 'mock', 'mock/test-persec', null, null, 0, 'video', '테스트 초당',
  '{"resolution":{"values":["480p"],"default":"480p"}}', 600, true, 9008);
insert into public.model_prices (model_id, price_version, rule, active) values
 -- test-image (unit image), key order quality|image_size:
 --   low|square_hd 0.01 → 8.05 → 9      low|portrait_4_3 0.012 → 9.66 → 10
 --   medium|square_hd 0.053 → 42.665 → 43   medium|portrait_4_3 0.06 → 48.3 → 49
 --   high|square_hd 0.2 → 161 exactly → 161   high|portrait_4_3 0.25 → 201.25 → 202
 ('test-image', 1, '{"unit":"image","keys":["quality","image_size"],"usd":{"low|square_hd":0.01,"low|portrait_4_3":0.012,"medium|square_hd":0.053,"medium|portrait_4_3":0.06,"high|square_hd":0.2,"high|portrait_4_3":0.25}}', true),
 -- test-tiny: low 0.0001 → 0.0805 → 1;  high 0 → minimum 1;  per reference 0.01:
 --   low + 1 ref 0.0101 → 8.1305 → 9;  low + 2 refs 0.0201 → 16.1805 → 17 (ceil of the sum, not the sum of ceils)
 ('test-tiny', 1, '{"unit":"image","keys":["quality"],"usd":{"low":0.0001,"high":0},"per_reference_usd":0.01}', true),
 -- test-video (unit second, usd per second, key order resolution|generate_audio):
 ('test-video', 1, '{"unit":"second","keys":["resolution","generate_audio"],"usd":{"480p|false":0.05,"480p|true":0.08,"720p|false":0.1,"720p|true":0.13}}', true),
 ('test-video-ref', 1, '{"unit":"second","keys":["resolution","generate_audio"],"usd":{"480p|false":0.05,"480p|true":0.08,"720p|false":0.1,"720p|true":0.13},"per_reference_usd":0.02}', true),
 ('test-reprice', 1, '{"unit":"image","keys":["quality"],"usd":{"low":0.01}}', true),
 ('test-off', 1, '{"unit":"image","keys":["quality"],"usd":{"low":0.01}}', true),
 -- test-drift: low 0.01 → 8.05 → 9;  high 0.2 → 161
 ('test-drift', 1, '{"unit":"image","keys":["quality"],"usd":{"low":0.01,"high":0.2}}', true),
 ('test-persec', 1, '{"unit":"second","keys":["resolution"],"usd":{"480p":0.05}}', true);

-- References: ra (A, fresh), rb (B, fresh), re (A, 25 hours old = expired). delete_after is created_at + 24h by
-- default or generated; the DO block also pushes it back for the plain-column case.
insert into public.play_refs (id, user_id, path, mime, size) values
 ('f0000000-0000-0000-0000-000000000001', pg_temp.u('A'), pg_temp.u('A') || '/f0000000-0000-0000-0000-000000000001.png', 'image/png', 1000),
 ('f0000000-0000-0000-0000-000000000002', pg_temp.u('B'), pg_temp.u('B') || '/f0000000-0000-0000-0000-000000000002.png', 'image/png', 1000);
insert into public.play_refs (id, user_id, path, mime, size, created_at) values
 ('f0000000-0000-0000-0000-000000000003', pg_temp.u('A'), pg_temp.u('A') || '/f0000000-0000-0000-0000-000000000003.png', 'image/png', 1000,
  now() - interval '25 hours');
do $$ begin
  update public.play_refs set delete_after = now() - interval '1 hour' where id = 'f0000000-0000-0000-0000-000000000003';
exception when sqlstate '428C9' then null;   -- generated column: already created_at + 24h
end $$;

create or replace function pg_temp.h(s text) returns text language sql as $$ select md5($1 || 'a') || md5($1 || 'b') $$;
create or replace function pg_temp.cid(n int) returns uuid language sql as $$
  select ('d0000000-0000-0000-0000-' || lpad($1::text, 12, '0'))::uuid $$;
create or replace function pg_temp.pv(variadic m text[]) returns jsonb language plpgsql as $$
begin
  return coalesce((select jsonb_object_agg(p.model_id, p.price_version) from public.model_prices p
                    where p.active and p.model_id = any(m)), '{}'::jsonb);
end $$;
-- Named-argument call pins the start_run interface; every call gets fresh ip/device hashes.
create or replace function pg_temp.run(who text, cid_n int, mode text, ver uuid, cells jsonb, models text[],
                                       refs uuid[] default '{}', face boolean default false,
                                       prompt text default 'rendered prompt', vars jsonb default '{}', exp int default null)
returns jsonb language plpgsql as $$
begin
  return public.start_run(p_user => pg_temp.u(who), p_client_request_id => pg_temp.cid(cid_n), p_mode => mode,
                          p_recipe_version_id => ver, p_variables => vars, p_cells => cells,
                          p_price_versions => pg_temp.pv(variadic models), p_reference_ids => refs,
                          p_face_consent => face, p_rendered_prompt => prompt,
                          p_ip_hash => pg_temp.h(gen_random_uuid()::text), p_device_hash => pg_temp.h(gen_random_uuid()::text),
                          p_expected_total => exp);
end $$;
create or replace function pg_temp.cell(k text, i int) returns uuid language sql as $$
  select (v -> 'cell_ids' ->> $2)::uuid from res where res.k = $1 $$;
create or replace function pg_temp.runid(k text) returns uuid language sql as $$
  select (v ->> 'run_id')::uuid from res where res.k = $1 $$;

create or replace function pg_temp.snap() returns text language plpgsql as $$
begin
  return format('%s|%s|%s|%s|%s|%s|%s|%s',
    (select count(*) from public.play_runs), (select count(*) from public.play_cells),
    (select count(*) from public.credit_holds), (select count(*) from public.credit_ledger),
    (select count(*) from public.face_consents), (select count(*) from private.play_prompts),
    (select coalesce(sum(reserved), 0) || '/' || coalesce(sum(spent), 0) from public.generation_budget),
    (select coalesce(sum(available), 0) || '/' || coalesce(sum(held), 0) from public.credit_accounts));
end $$;
-- A refused start_run: reason as expected, and runs, cells, holds, ledger, consents, prompts, budget, balances unchanged.
-- (rate_limit_buckets are deliberately not in the snapshot: their increment stays.)
create or replace function pg_temp.fail_case(d text, who text, cid_n int, mode text, ver uuid, cells jsonb, models text[],
                                             refs uuid[], face boolean, reason text, stale_pv jsonb default null, exp int default null)
returns setof text language plpgsql as $$
declare v jsonb;
begin
  insert into sn values (d, pg_temp.snap()) on conflict (k) do update set s = excluded.s;
  if stale_pv is null then
    v := pg_temp.run(who, cid_n, mode, ver, cells, models, refs, face, exp => exp);
  else
    v := public.start_run(p_user => pg_temp.u(who), p_client_request_id => pg_temp.cid(cid_n), p_mode => mode,
                          p_recipe_version_id => ver, p_variables => '{}', p_cells => cells, p_price_versions => stale_pv,
                          p_reference_ids => refs, p_face_consent => face, p_rendered_prompt => 'rendered prompt',
                          p_ip_hash => pg_temp.h(gen_random_uuid()::text), p_device_hash => pg_temp.h(gen_random_uuid()::text),
                          p_expected_total => exp);
  end if;
  insert into res values (d, v) on conflict (k) do update set v = excluded.v;
  return next is(coalesce(v ->> 'ok', '?') || ':' || coalesce(v ->> 'reason', '-'), 'false:' || reason, d || ' → ' || reason);
  return next is(pg_temp.snap(), (select s from sn where sn.k = d), d || ' leaves no trace');
end $$;

create or replace function pg_temp.inv_ledger() returns boolean language plpgsql as $$
begin
  return coalesce((select bool_and(a.available = coalesce((select sum(g.delta) from public.credit_ledger g
                                                           where g.user_id = a.user_id), 0))
                     from public.credit_accounts a where a.user_id in (select v::uuid from t)), false);
end $$;
create or replace function pg_temp.inv_held() returns boolean language plpgsql as $$
begin
  return coalesce((select bool_and(a.held = coalesce((select sum(h.credits) from public.credit_holds h
                                                      where h.user_id = a.user_id and h.state = 'held'), 0))
                     from public.credit_accounts a where a.user_id in (select v::uuid from t)), false);
end $$;
create or replace function pg_temp.inv_budget() returns boolean language plpgsql as $$
begin
  return coalesce((select b.reserved = coalesce((select sum(h.credits) from public.credit_holds h
                                                 where h.state = 'held' and private.kst_month(h.created_at) = b.month), 0)
                     from public.generation_budget b where b.month = private.kst_month()), false);
end $$;
create or replace function pg_temp.attempt(q text) returns void language plpgsql as $$
begin execute q; exception when others then null; end $$;
create or replace function pg_temp.cnt(q text) returns bigint language plpgsql as $$
declare n bigint;
begin execute q into n; return n; exception when insufficient_privilege then return 0; end $$;

-- ---------------------------------------------------------------- schema shape
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where c.relrowsecurity and ((n.nspname = 'public' and c.relname in ('models', 'model_prices', 'play_runs',
                  'play_cells', 'play_refs', 'face_consents', 'generation_webhook_inbox'))
                  or (n.nspname = 'private' and c.relname = 'play_prompts'))), 8::bigint,
          'PLAY-schema every new table has RLS enabled');
select is((select count(*) from pg_policies where schemaname = 'private' and tablename = 'play_prompts'), 0::bigint,
          'PLAY-schema private.play_prompts has no policies (secrets pattern)');
select throws_ok($$ insert into public.model_prices (model_id, price_version, rule, active)
                    values ('test-image', 2, '{"unit":"image","keys":[],"usd":{}}', true) $$,
                 '23505', null, 'PLAY-schema at most one active price row per model');
select ok((select not public and file_size_limit = 10485760
             and not exists (select 1 from unnest(allowed_mime_types) m where m not like 'image/%')
           from storage.buckets where id = 'play-refs'),
          'PLAY-schema play-refs bucket: private, 10MB, images only');
select ok((select not public and file_size_limit = 52428800
             and exists (select 1 from unnest(allowed_mime_types) m where m like 'image/%')
             and exists (select 1 from unnest(allowed_mime_types) m where m like 'video/%')
           from storage.buckets where id = 'play-results'),
          'PLAY-schema play-results bucket: private, 50MB, images and video');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.play_cells'::regclass and contype = 'f'
                   and confrelid = 'public.model_prices'::regclass),
          'PLAY-schema play_cells (model_id, price_version) references model_prices');
select throws_ok($$ update public.model_prices set rule = '{"unit":"image","keys":[],"usd":{}}' where model_id = 'test-image' $$,
                 'P0001', 'PRICE_IMMUTABLE', 'PLAY-schema a price rule cannot be edited (insert a new version)');
select throws_ok($$ update public.model_prices set price_version = 7 where model_id = 'test-off' $$,
                 'P0001', 'PRICE_IMMUTABLE', 'PLAY-schema a price_version cannot be renumbered');
select throws_ok($$ update public.model_prices set model_id = 'test-tiny' where model_id = 'test-off' $$,
                 'P0001', 'PRICE_IMMUTABLE', 'PLAY-schema a price row cannot move to another model');
select lives_ok($$ update public.model_prices set active = false where model_id = 'test-off'; update public.model_prices set active = true where model_id = 'test-off' $$,
                'PLAY-schema toggling active is allowed');
select ok(exists (select 1 from public.admin_actions where action = 'budget_init' and target_type = 'generation_budget'
                   and (detail ->> 'cap_credits')::int = 40250)
          and not exists (select 1 from public.admin_actions where action = 'budget_set'),
          'D12 the production budget row is logged as budget_init (only when it was inserted)');
select is((select schedule from cron.job where jobname = 'sameplz-play-sweeper'), '* * * * *',
          'PLAY-cron sweeper runs every minute');
select ok((select command like '%call_play_sweeper%' from cron.job where jobname = 'sameplz-play-sweeper'),
          'PLAY-cron sweeper job calls private.call_play_sweeper');
select lives_ok($$ select private.call_play_sweeper() $$, 'PLAY-cron sweeper does nothing without vault secrets (local)');
select ok(exists (select 1 from public.generation_budget where month = (private.kst_month() + interval '1 month')::date),
          'D12 next KST month budget row exists');

-- ---------------------------------------------------------------- quote (F4-1, D17)
select pg_temp.login_as(pg_temp.u('A'));
select is((public.quote_play(jsonb_build_array(jsonb_build_object('model', 'test-image',
             'params', jsonb_build_object('quality', q, 'image_size', s), 'count', 1))) ->> 'total')::int, c,
          'quote image ' || q || ' ' || s || ' = ceil(usd×805) = ' || c)
from (values ('low', 'square_hd', 9), ('low', 'portrait_4_3', 10), ('medium', 'square_hd', 43),
             ('medium', 'portrait_4_3', 49), ('high', 'square_hd', 161), ('high', 'portrait_4_3', 202)) v(q, s, c);
select is((public.quote_play(jsonb_build_array(jsonb_build_object('model', 'test-video',
             'params', jsonb_build_object('duration', d, 'resolution', r, 'generate_audio', a), 'count', 1))) ->> 'total')::int, c,
          'quote video ' || d || 's ' || r || ' audio=' || a || ' = ' || c)
from (values (5, '480p', false, 202), (10, '480p', false, 403), (5, '480p', true, 322), (10, '480p', true, 644),
             (5, '720p', false, 403), (10, '720p', false, 805), (5, '720p', true, 524), (10, '720p', true, 1047)) v(d, r, a, c);
-- 5s 480p silent 0.25 → 201.25 → 202; 10s 0.5 → 402.5 → 403; 480p audio 5s 0.4 → 322, 10s 0.8 → 644;
-- 720p 5s 0.5 → 402.5 → 403, 10s 1.0 → 805 exactly; 720p audio 5s 0.65 → 523.25 → 524, 10s 1.3 → 1046.5 → 1047.
select is((public.quote_play('[{"model":"test-image","params":{},"count":1}]') -> 'cells' -> 0 -> 'params'),
          '{"image_size":"square_hd","quality":"medium"}'::jsonb, 'quote missing params are filled with defaults');
select is((public.quote_play('[{"model":"test-video","params":{},"count":1}]') ->> 'total')::int, 202,
          'quote all-default video = 5s 480p silent = 202');
select is(public.quote_play('[{"model":"test-image","params":{},"count":3}]') -> 'price_versions', '{"test-image":1}'::jsonb,
          'quote carries the active price_version per model');
select ok((select (q ->> 'total')::int = 129 and (q -> 'cells' -> 0 ->> 'credits')::int = 43 and (q -> 'cells' -> 0 ->> 'count')::int = 3
             and (q -> 'cells' -> 0 ->> 'model') = 'test-image'
           from (select public.quote_play('[{"model":"test-image","params":{},"count":3}]') q) x),
          'quote total = credits × count (43 × 3 = 129), cell echoes model, credits, count');
select is((public.quote_play('[{"model":"test-image","params":{"quality":"low"},"count":1},{"model":"test-tiny","params":{},"count":1},{"model":"test-video","params":{},"count":1}]') ->> 'total')::int,
          212, 'quote three models = 9 + 1 + 202');
select is((public.quote_play('[{"model":"test-tiny","params":{},"count":4},{"model":"test-image","params":{"quality":"low"},"count":4},{"model":"test-reprice","params":{},"count":4}]') ->> 'total')::int,
          4 * 1 + 4 * 9 + 4 * 9, 'quote exactly 12 cells over 3 models is allowed (4×1 + 4×9 + 4×9 = 76)');
select throws_ok($$ select public.quote_play('[{"model":"test-tiny","params":{},"count":5}]') $$,
                 'P0001', 'INVALID_PARAMS', 'quote more than 4 images of one model is refused (ceiling of 12 cells = 3 models × 4)');
select throws_ok($$ select public.quote_play('[{"model":"test-image","params":{},"count":1},{"model":"test-tiny","params":{},"count":1},{"model":"test-video","params":{},"count":1},{"model":"test-video-ref","params":{},"count":1}]') $$,
                 'P0001', 'INVALID_PARAMS', 'quote a 4th model is refused');
select throws_ok($$ select public.quote_play('[{"model":"test-image","params":{"flavor":"x"},"count":1}]') $$,
                 'P0001', 'INVALID_PARAMS', 'quote unknown param key is INVALID_PARAMS');
select throws_ok($$ select public.quote_play('[{"model":"test-image","params":{"quality":"ultra"},"count":1}]') $$,
                 'P0001', 'INVALID_PARAMS', 'quote value outside params.values is INVALID_PARAMS');
select throws_ok($$ select public.quote_play('[{"model":"test-video","params":{"duration":7},"count":1}]') $$,
                 'P0001', 'INVALID_PARAMS', 'quote video duration 7s is INVALID_PARAMS');
select throws_ok($$ select public.quote_play('[{"model":"test-off","params":{},"count":1}]') $$,
                 'P0001', 'INVALID_PARAMS', 'quote disabled model is INVALID_PARAMS');
select throws_ok($$ select public.quote_play('[{"model":"test-persec","params":{},"count":1}]') $$,
                 'P0001', 'INVALID_PARAMS', 'quote a per-second model without a duration param is INVALID_PARAMS');
select throws_ok($$ select public.quote_play('[{"model":"test-tiny","params":{},"count":2.5}]') $$,
                 'P0001', 'INVALID_PARAMS', 'quote count 2.5 is INVALID_PARAMS');
select throws_ok($$ select public.quote_play('[{"model":"test-tiny","params":{},"count":1e10}]') $$,
                 'P0001', 'INVALID_PARAMS', 'quote count 1e10 is INVALID_PARAMS, not a numeric overflow');
select ok((select q ->> 'daily_limit' = '135' and q ->> 'remaining_today' = '135' and q ->> 'exceeds_remaining' = 'false'
           from (select public.quote_play('[{"model":"test-image","params":{"quality":"medium"},"count":3}]') q) x),
          'F4-16 quote carries daily_limit 135, remaining_today 135 and exceeds_remaining false (129 ≤ 135)');
select is(public.quote_play('[{"model":"test-image","params":{"quality":"medium"},"count":4}]') ->> 'exceeds_remaining', 'true',
          'F4-16 quote 4 × 43 = 172 exceeds the remaining 135');
select ok((select q -> 'cells' -> 0 ->> 'exceeds_daily_limit' = 'false' and q -> 'cells' -> 1 ->> 'exceeds_daily_limit' = 'true'
           from (select public.quote_play('[{"model":"test-image","params":{"quality":"medium"},"count":1},{"model":"test-video","params":{},"count":1}]') q) x),
          'F4-16 per-cell exceeds_daily_limit: 43C no, a 202C video yes');
select throws_ok($$ select * from private.quote_cell('test-tiny', '{}'::jsonb, 0) $$, '42501', null,
                 'PLAY-authz clients cannot call private.quote_cell');
select pg_temp.as_postgres();
select is((select credits from private.quote_cell('test-tiny', '{}'::jsonb, 0)), 1, 'quote ceil(0.0805) = 1');
select is((select credits from private.quote_cell('test-tiny', '{"quality":"high"}'::jsonb, 0)), 1, 'quote minimum is 1 credit (usd 0)');
select is((select credits from private.quote_cell('test-tiny', '{}'::jsonb, 1)), 9, 'quote one reference: (0.0001 + 0.01) × 805 = 8.1305 → 9');
select is((select credits from private.quote_cell('test-tiny', '{}'::jsonb, 2)), 17,
          'quote two references: 0.0201 × 805 = 16.1805 → 17 (ceil of the sum, not 9 + 9)');
select is((select price_version from private.quote_cell('test-tiny', '{}'::jsonb, 0)), 1, 'quote returns the price_version');

-- ---------------------------------------------------------------- start_run prechecks (no trace on every refusal)
-- F4-8/F4-9 order: AI notice first (C also passes a version in blank mode, which would be NOT_ENTITLED).
select * from pg_temp.fail_case('FM-pre AI_NOTICE_REQUIRED', 'C', 1, 'blank', 'bbbbbbbb-0000-0000-0000-000000000004',
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], '{}', false, 'AI_NOTICE_REQUIRED');
select * from pg_temp.fail_case('FM-pre NOT_ENTITLED own on someone else''s recipe', 'B', 2, 'own', 'bbbbbbbb-0000-0000-0000-000000000004',
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], '{}', false, 'NOT_ENTITLED');
select * from pg_temp.fail_case('FM-pre NOT_ENTITLED free without the entitlement', 'B', 3, 'free', 'bbbbbbbb-0000-0000-0000-000000000004',
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], '{}', false, 'NOT_ENTITLED');
select * from pg_temp.fail_case('FM-pre NOT_ENTITLED free with a revoked entitlement', 'A', 4, 'free', 'bbbbbbbb-0000-0000-0000-000000000013',
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], '{}', false, 'NOT_ENTITLED');
select * from pg_temp.fail_case('FM-pre NOT_ENTITLED blank must not carry a version', 'A', 5, 'blank', 'bbbbbbbb-0000-0000-0000-000000000004',
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], '{}', false, 'NOT_ENTITLED');
select * from pg_temp.fail_case('FM-pre INVALID_REFERENCE someone else''s reference', 'A', 6, 'blank', null,
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], array['f0000000-0000-0000-0000-000000000002']::uuid[], false, 'INVALID_REFERENCE');
select * from pg_temp.fail_case('FM-pre INVALID_REFERENCE expired reference', 'A', 7, 'blank', null,
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], array['f0000000-0000-0000-0000-000000000003']::uuid[], true, 'INVALID_REFERENCE');
select * from pg_temp.fail_case('FM-pre INVALID_REFERENCE model that takes no reference', 'A', 8, 'blank', null,
  '[{"model":"test-image","params":{},"count":1}]', array['test-image'], array['f0000000-0000-0000-0000-000000000001']::uuid[], true, 'INVALID_REFERENCE');
select * from pg_temp.fail_case('F4-8 FACE_CONSENT_REQUIRED', 'A', 9, 'blank', null,
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], array['f0000000-0000-0000-0000-000000000001']::uuid[], false, 'FACE_CONSENT_REQUIRED');
select * from pg_temp.fail_case('FM-pre INVALID_PARAMS', 'A', 10, 'blank', null,
  '[{"model":"test-image","params":{"quality":"ultra"},"count":1}]', array['test-image'], '{}', false, 'INVALID_PARAMS');

select * from pg_temp.fail_case('FM-pre NOT_ENTITLED free of a stopped recipe', 'A', 17, 'free', 'bbbbbbbb-0000-0000-0000-000000000015',
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], '{}', false, 'NOT_ENTITLED');
select * from pg_temp.fail_case('FM-pre INVALID_PARAMS count 2.5', 'A', 19, 'blank', null,
  '[{"model":"test-tiny","params":{},"count":2.5}]', array['test-tiny'], '{}', false, 'INVALID_PARAMS');
select * from pg_temp.fail_case('FM-pre INVALID_PARAMS count 1e10', 'A', 20, 'blank', null,
  '[{"model":"test-tiny","params":{},"count":1e10}]', array['test-tiny'], '{}', false, 'INVALID_PARAMS');

-- FM-20 price changed between quote and run.
update public.model_prices set active = false where model_id = 'test-reprice' and price_version = 1;
insert into public.model_prices (model_id, price_version, rule, active)
values ('test-reprice', 2, '{"unit":"image","keys":["quality"],"usd":{"low":0.02}}', true);
select * from pg_temp.fail_case('FM-20 PRICE_CHANGED', 'A', 11, 'blank', null,
  '[{"model":"test-reprice","params":{},"count":1}]', array['test-reprice'], '{}', false, 'PRICE_CHANGED', '{"test-reprice":1}'::jsonb);
select is((select count(*) from public.play_cells where model_id = 'test-reprice'), 0::bigint, 'FM-20 no cell was created at the old price');

-- FM-20 same price_version, but the default param changed (low → high) after the quote said 9C.
update public.models set params = '{"quality":{"values":["low","high"],"default":"high"}}' where id = 'test-drift';
select * from pg_temp.fail_case('FM-20 PRICE_CHANGED via p_expected_total', 'A', 18, 'blank', null,
  '[{"model":"test-drift","params":{},"count":1}]', array['test-drift'], '{}', false, 'PRICE_CHANGED', null, 9);

select * from pg_temp.fail_case('F4-16 ADULT_REQUIRED', 'K', 12, 'blank', null,
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], '{}', false, 'ADULT_REQUIRED');
-- G: 4 × medium square_hd = 4 × 43 = 172 > 135 daily limit.
select * from pg_temp.fail_case('INV-C21 DAILY_LIMIT', 'G', 13, 'blank', null,
  '[{"model":"test-image","params":{"quality":"medium"},"count":4}]', array['test-image'], '{}', false, 'DAILY_LIMIT');
-- D: 10C, one medium cell costs 43C → shortfall 33.
select * from pg_temp.fail_case('FM-1 INSUFFICIENT_CREDITS', 'D', 14, 'blank', null,
  '[{"model":"test-image","params":{"quality":"medium"},"count":1}]', array['test-image'], '{}', false, 'INSUFFICIENT_CREDITS');
select is((select (v ->> 'shortfall')::int from res where k = 'FM-1 INSUFFICIENT_CREDITS'), 33, 'FM-1 shortfall = 43 − 10 = 33');
select is((select sum(count) from public.rate_limit_buckets where key = 'run:user:' || pg_temp.u('D')), 1::bigint,
          'F4-16 a refusal that reached the limiter keeps its bucket increment');
-- F: budget cap 0, then paused.
update public.generation_budget set cap_credits = 0 where month = private.kst_month();
select * from pg_temp.fail_case('INV-C19 BUDGET_EXHAUSTED cap 0', 'F', 15, 'blank', null,
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], '{}', false, 'BUDGET_EXHAUSTED');
update public.generation_budget set cap_credits = 100000, state = 'paused' where month = private.kst_month();
select * from pg_temp.fail_case('INV-C19 BUDGET_EXHAUSTED paused', 'F', 16, 'blank', null,
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], '{}', false, 'BUDGET_EXHAUSTED');
update public.generation_budget set state = 'open' where month = private.kst_month();

-- ---------------------------------------------------------------- success, idempotency, free/blank (A)
-- A: own mode, test-tiny low with one reference = 9C, face consent.
insert into res select 'a_own', pg_temp.run('A', 21, 'own', 'bbbbbbbb-0000-0000-0000-000000000004',
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], array['f0000000-0000-0000-0000-000000000001']::uuid[], true,
  'SECRET-RENDERED-A1', '{"배경":"카페"}', exp => 9);
select ok((select (v ->> 'ok')::boolean and (v ->> 'total')::int = 9 and jsonb_array_length(v -> 'cell_ids') = 1
                  and v ->> 'run_id' is not null from res where k = 'a_own'),
          'PLAY-run start_run returns ok, run_id, one cell id and total 9 (tiny + 1 reference)');
select ok((select r.mode = 'own' and r.recipe_version_id = 'bbbbbbbb-0000-0000-0000-000000000004' and r.user_id = pg_temp.u('A')
                  and r.client_request_id = pg_temp.cid(21) and r.variables = '{"배경":"카페"}'::jsonb
                  and r.reference_ids = array['f0000000-0000-0000-0000-000000000001']::uuid[] and r.face_consent_at is not null
           from public.play_runs r where r.id = pg_temp.runid('a_own')),
          'PLAY-run play_runs row holds mode, version, variables, references, face consent time');
select ok((select c.status = 'queued' and c.model_id = 'test-tiny' and c.params = '{"quality":"low"}'::jsonb and c.price_credits = 9
                  and c.price_version = 1 and c.attempts = 0 and c.webhook_token_hash is null and c.deadline_at is null
                  and c.user_id = pg_temp.u('A')
           from public.play_cells c where c.id = pg_temp.cell('a_own', 0)),
          'PLAY-run play_cells row: queued, filled params, price 9 @ v1, no attempts yet');
select ok((select h.state = 'held' and h.credits = 9 and h.user_id = pg_temp.u('A')
           from public.credit_holds h where h.cell_id = pg_temp.cell('a_own', 0))
          and (select count(*) = 1 and min(delta) = -9 from public.credit_ledger where cell_id = pg_temp.cell('a_own', 0) and entry_type = 'hold'),
          'PLAY-run one hold of 9C with one ledger hold row per cell');
select is((select available || '/' || held from public.credit_accounts where user_id = pg_temp.u('A')), '261/9',
          'PLAY-run balance 270 → available 261, held 9');
select is((select count(*) from public.face_consents where run_id = pg_temp.runid('a_own') and ref_id = 'f0000000-0000-0000-0000-000000000001'
                  and user_id = pg_temp.u('A') and consented_at is not null), 1::bigint,
          'F4-8 face consent recorded per run and reference');
select is((select rendered from private.play_prompts where run_id = pg_temp.runid('a_own')), 'SECRET-RENDERED-A1',
          'hidden-content rendered prompt is stored server-side per run');
select is((select notice_version from public.face_consents where run_id = pg_temp.runid('a_own')), 'play-face-v1',
          'F4-8 face consent stores the notice version shown');
select throws_ok($$ update public.face_consents set consented_at = now() $$, 'P0001', 'APPEND_ONLY', 'F4-8 face consents cannot be updated');
select throws_ok($$ delete from public.face_consents $$, 'P0001', 'APPEND_ONLY', 'F4-8 face consents cannot be deleted');
select is(public.play_prompt_for_submit(pg_temp.cell('a_own', 0)), 'SECRET-RENDERED-A1',
          'hidden-content play_prompt_for_submit returns the rendered prompt for the cell');

-- FM-18: same client_request_id → same run, one hold.
select is(public.start_run(p_user => pg_temp.u('A'), p_client_request_id => pg_temp.cid(21), p_mode => 'own',
            p_recipe_version_id => 'bbbbbbbb-0000-0000-0000-000000000004', p_variables => '{"배경":"카페"}',
            p_cells => '[{"model":"test-tiny","params":{},"count":1}]', p_price_versions => pg_temp.pv('test-tiny'),
            p_reference_ids => array['f0000000-0000-0000-0000-000000000001']::uuid[], p_face_consent => true,
            p_rendered_prompt => 'SECRET-RENDERED-A1', p_ip_hash => pg_temp.h('x1'), p_device_hash => pg_temp.h('x2'))
          - 'cell_ids' - 'total',
          jsonb_build_object('ok', true, 'run_id', pg_temp.runid('a_own'), 'existing', true),
          'FM-18 same client_request_id returns the existing run');
select ok((select count(*) = 1 from public.play_runs where user_id = pg_temp.u('A') and client_request_id = pg_temp.cid(21))
          and (select count(*) = 1 from public.credit_holds where cell_id = pg_temp.cell('a_own', 0))
          and (select count(*) = 1 from public.credit_ledger where cell_id = pg_temp.cell('a_own', 0) and entry_type = 'hold')
          and (select available from public.credit_accounts where user_id = pg_temp.u('A')) = 261,
          'FM-18 the retry made no second run, hold, or ledger row');
-- another user may reuse the same client_request_id (unique per user).
insert into res select 'b_blank', pg_temp.run('B', 21, 'blank', null, '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny']);
select ok((select (v ->> 'ok')::boolean and coalesce((v ->> 'existing')::boolean, false) = false
                  and v ->> 'run_id' <> pg_temp.runid('a_own')::text from res where k = 'b_blank'),
          'FM-18 client_request_id is unique per user, not global');

insert into res select 'a_free', pg_temp.run('A', 22, 'free', 'bbbbbbbb-0000-0000-0000-000000000012',
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny']);
select ok((select (v ->> 'ok')::boolean from res where k = 'a_free') and (select mode = 'free' from public.play_runs where id = pg_temp.runid('a_free')),
          'PLAY-run free mode with an active entitlement starts');
insert into res select 'a_blank', pg_temp.run('A', 23, 'blank', null, '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny']);
select ok((select (v ->> 'ok')::boolean from res where k = 'a_blank')
          and (select mode = 'blank' and recipe_version_id is null from public.play_runs where id = pg_temp.runid('a_blank')),
          'PLAY-run blank mode without a version starts');
select ok(pg_temp.inv_ledger() and pg_temp.inv_held() and pg_temp.inv_budget(),
          'INV-C2/C20 after prechecks and starts: Σ ledger = available, held = held holds, reserved = held holds');

-- Acknowledging the AI notice opens the gate for C.
select pg_temp.login_as(pg_temp.u('C'));
select public.ack_ai_notice();
select pg_temp.as_postgres();
select isnt((select ai_notice_ack_at from public.profiles where id = pg_temp.u('C')), null, 'F4-9 ack_ai_notice records the acknowledgement');
select ok((pg_temp.run('C', 24, 'blank', null, '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny']) ->> 'ok')::boolean,
          'F4-9 after the acknowledgement C can start a run');

-- ---------------------------------------------------------------- daily limit success path (G)
insert into res select 'g_run', pg_temp.run('G', 31, 'blank', null, '[{"model":"test-image","params":{"quality":"medium"},"count":3}]', array['test-image']);
select ok((select (v ->> 'ok')::boolean and (v ->> 'total')::int = 129 from res where k = 'g_run')
          and (select held from public.credit_accounts where user_id = pg_temp.u('G')) = 129,
          'INV-C21 3 × 43 = 129 ≤ 135 holds 129C');

select pg_temp.login_as(pg_temp.u('G'));
select ok((select q ->> 'remaining_today' = '6' and q ->> 'exceeds_remaining' = 'true'
           from (select public.quote_play('[{"model":"test-image","params":{"quality":"low"},"count":1}]') q) x),
          'F4-16 after 129C used: remaining_today 6, a 9C quote exceeds it');
select is(public.quote_play('[{"model":"test-tiny","params":{},"count":1}]') ->> 'exceeds_remaining', 'false',
          'F4-16 a 1C quote fits the remaining 6');
select pg_temp.as_postgres();

-- ---------------------------------------------------------------- F4-16 rate limit (E): five runs, the sixth is refused
-- check_run_allowed also counts per user, so distinct ip/device hashes do not help.
select is((select count(*) from generate_series(1, 5) i
            where (pg_temp.run('E', 100 + i, 'blank', null, '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny']) ->> 'ok')::boolean),
          5::bigint, 'F4-16 five runs a minute are allowed');
select * from pg_temp.fail_case('F4-16 RATE_LIMITED sixth run', 'E', 106, 'blank', null,
  '[{"model":"test-tiny","params":{},"count":1}]', array['test-tiny'], '{}', false, 'RATE_LIMITED');
select is((select sum(count) from public.rate_limit_buckets where key = 'run:user:' || pg_temp.u('E')), 6::bigint,
          'F4-16 the refused sixth run still counted in the user bucket');
select ok(pg_temp.inv_ledger() and pg_temp.inv_held() and pg_temp.inv_budget(), 'INV-C2/C20 after the rate-limit scenario');

-- ---------------------------------------------------------------- atomicity (H)
-- A concurrent change makes the third hold fail after two succeeded: a trigger suspends the account after the second hold.
create or replace function public.zz_suspend_after_two() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.credit_holds where user_id = new.user_id) = 2 then
    update public.credit_accounts set generation_suspended_at = now() where user_id = new.user_id;
  end if;
  return null;
end $$;
create trigger zz_suspend_after_two after insert on public.credit_holds for each row execute function public.zz_suspend_after_two();
select * from pg_temp.fail_case('FM-atomic third hold fails', 'H', 41, 'blank', null,
  '[{"model":"test-tiny","params":{},"count":3}]', array['test-tiny'], '{}', false, 'GENERATION_SUSPENDED');
drop trigger zz_suspend_after_two on public.credit_holds;
drop function public.zz_suspend_after_two();
update public.credit_accounts set generation_suspended_at = null where user_id = pg_temp.u('H');
select ok((select count(*) = 0 from public.play_runs where user_id = pg_temp.u('H'))
          and (select count(*) = 0 from public.play_cells where user_id = pg_temp.u('H'))
          and (select count(*) = 0 from public.credit_holds where user_id = pg_temp.u('H'))
          and (select count(*) = 0 from public.credit_ledger where user_id = pg_temp.u('H') and entry_type = 'hold')
          and (select available = 270 and held = 0 from public.credit_accounts where user_id = pg_temp.u('H')),
          'FM-atomic nothing of H remains: no run, cell, hold, ledger row, or reservation');
select ok(pg_temp.inv_budget(), 'INV-C20 the failed run left no budget reservation');
select ok(coalesce(pg_temp.run('H', 41, 'blank', null, '[{"model":"test-tiny","params":{},"count":3}]', array['test-tiny']) ->> 'existing', 'false') = 'false',
          'FM-atomic retry with the same client_request_id is a fresh run (the failed one left no row)');
select is((select count(*) from public.credit_holds where user_id = pg_temp.u('H') and state = 'held'), 3::bigint,
          'FM-atomic the retry holds all three cells');

-- ---------------------------------------------------------------- whole-run shortfall (M)
-- After two holds a concurrent spend leaves only 4C spendable: the third 9C hold fails. Run total 27, spendable 4 → 23.
create or replace function public.zz_drain_after_two() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.credit_holds where user_id = new.user_id) = 2 then
    update public.credit_lots set remaining = held + 4 where user_id = new.user_id and kind = 'monthly_grant';
  end if;
  return null;
end $$;
create trigger zz_drain_after_two after insert on public.credit_holds for each row execute function public.zz_drain_after_two();
select * from pg_temp.fail_case('FM-1 hold failure mid-run', 'M', 61, 'blank', null,
  '[{"model":"test-image","params":{"quality":"low"},"count":3}]', array['test-image'], '{}', false, 'INSUFFICIENT_CREDITS');
drop trigger zz_drain_after_two on public.credit_holds;
drop function public.zz_drain_after_two();
select ok((select (v ->> 'shortfall')::int >= 1 from res where k = 'FM-1 hold failure mid-run'),
          'FM-1 a mid-run hold failure reports a positive shortfall (exact whole-run value cannot be pinned: the trigger''s drain is rolled back with the block)');

-- ---------------------------------------------------------------- settlement (I): FM-4/5/6/9/14
-- I: cells [image low 9C, image low 9C, tiny 1C] = 19C.
insert into res select 'i_run1', pg_temp.run('I', 51, 'blank', null,
  '[{"model":"test-image","params":{"quality":"low"},"count":2},{"model":"test-tiny","params":{},"count":1}]', array['test-image', 'test-tiny']);
insert into res values ('spent0', (select to_jsonb(spent) from public.generation_budget where month = private.kst_month()));
select is((select available || '/' || held from public.credit_accounts where user_id = pg_temp.u('I')), '251/19',
          'FM-14 3 cells held: 270 − 19 = 251 available, 19 held');
select is(public.finish_cell(p_cell => pg_temp.cell('i_run1', 0), p_status => 'succeeded', p_error_code => null,
                             p_result_path => pg_temp.u('I') || '/r0.png'),
          '{"finished":true,"captured":9}'::jsonb, 'FM-14 cell 1 succeeded captures 9C');
select is((select available || '/' || held from public.credit_accounts where user_id = pg_temp.u('I')), '251/10',
          'INV-C3 capture: available unchanged, held 19 → 10');
select ok((select h.state = 'captured' and h.outcome = 'success' from public.credit_holds h where h.cell_id = pg_temp.cell('i_run1', 0))
          and (select count(*) = 1 and min(delta) = 0 from public.credit_ledger where cell_id = pg_temp.cell('i_run1', 0) and entry_type = 'capture'),
          'FM-14 captured hold, outcome success, capture ledger row (delta 0)');
select ok((select c.status = 'succeeded' and c.finished_at is not null and c.result_path = pg_temp.u('I') || '/r0.png'
                  and c.delete_after = c.created_at + interval '30 days'
           from public.play_cells c where c.id = pg_temp.cell('i_run1', 0)),
          'D19 succeeded result is kept 30 days (delete_after = created_at + 30 days)');
select is(public.finish_cell(p_cell => pg_temp.cell('i_run1', 1), p_status => 'failed', p_error_code => 'PROVIDER_ERROR', p_result_path => null),
          '{"finished":true,"captured":0}'::jsonb, 'FM-5 failed cell releases');
select is((select available || '/' || held from public.credit_accounts where user_id = pg_temp.u('I')), '260/1',
          'FM-5 release: 9C back to available, held 10 → 1');
select ok((select h.state = 'released' and h.outcome = 'model_error' from public.credit_holds h where h.cell_id = pg_temp.cell('i_run1', 1))
          and (select c.status = 'failed' and c.error_code = 'PROVIDER_ERROR' and c.delete_after is null
               from public.play_cells c where c.id = pg_temp.cell('i_run1', 1)),
          'FM-5 failed → model_error release, error code kept, no retention clock');
select is((select count(*) from public.abuse_signals where user_id = pg_temp.u('I') and kind = 'moderation_block'), 0::bigint,
          'FM-4 no moderation signal before any block');
select is(public.finish_cell(p_cell => pg_temp.cell('i_run1', 2), p_status => 'blocked', p_error_code => 'SAFETY_BLOCKED', p_result_path => null),
          '{"finished":true,"captured":0}'::jsonb, 'FM-4 blocked cell captures nothing');
select ok((select h.state = 'released' and h.outcome = 'safety_blocked' from public.credit_holds h where h.cell_id = pg_temp.cell('i_run1', 2))
          and (select available || '/' || held from public.credit_accounts where user_id = pg_temp.u('I')) = '261/0',
          'FM-4/6 blocked → safety_blocked release, balance back to 261 (only the success was charged)');
select is((select count(*) from public.abuse_signals where user_id = pg_temp.u('I') and kind = 'moderation_block'), 1::bigint,
          'FM-4/6 a block records abuse_signals moderation_block');
select is((select spent - (select (v #>> '{}')::int from res where k = 'spent0') from public.generation_budget where month = private.kst_month()), 9,
          'INV-C20 budget spent grew by the 9C captured only');
select ok(pg_temp.inv_ledger() and pg_temp.inv_held() and pg_temp.inv_budget(),
          'FM-14 partial success: Σ ledger = available, held = held holds, reserved = held holds');
-- FM-9 second finish is a noop, even with a different status.
insert into res values ('led1', (select to_jsonb(count(*)::text) from public.credit_ledger where user_id = pg_temp.u('I')));
select is(public.finish_cell(p_cell => pg_temp.cell('i_run1', 0), p_status => 'failed', p_error_code => 'LATE', p_result_path => null) ->> 'finished',
          'false', 'FM-9 second finish_cell is a noop');
select ok((select status = 'succeeded' and error_code is null from public.play_cells where id = pg_temp.cell('i_run1', 0))
          and (select count(*)::text from public.credit_ledger where user_id = pg_temp.u('I')) = (select v #>> '{}' from res where k = 'led1')
          and (select available || '/' || held from public.credit_accounts where user_id = pg_temp.u('I')) = '261/0',
          'FM-9 the late finish changed neither the cell, the ledger, nor the balance');
-- canceled and expired.
insert into res select 'i_run2', pg_temp.run('I', 52, 'blank', null, '[{"model":"test-tiny","params":{},"count":2}]', array['test-tiny']);
select is(public.finish_cell(p_cell => pg_temp.cell('i_run2', 0), p_status => 'canceled', p_error_code => null, p_result_path => null),
          '{"finished":true,"captured":0}'::jsonb, 'FM-settle canceled releases');
select is(public.finish_cell(p_cell => pg_temp.cell('i_run2', 1), p_status => 'expired', p_error_code => 'DEADLINE', p_result_path => null),
          '{"finished":true,"captured":0}'::jsonb, 'FM-8 expired releases');
select ok((select h.outcome = 'canceled' from public.credit_holds h where h.cell_id = pg_temp.cell('i_run2', 0))
          and (select h.outcome = 'model_error' from public.credit_holds h where h.cell_id = pg_temp.cell('i_run2', 1))
          and (select available || '/' || held from public.credit_accounts where user_id = pg_temp.u('I')) = '261/0',
          'FM-settle canceled → canceled, expired → model_error, both released');
select ok(pg_temp.inv_ledger() and pg_temp.inv_held() and pg_temp.inv_budget(), 'INV-C2/C20 after canceled and expired');

-- ---------------------------------------------------------------- Realtime payload and access
-- realtime.send adds an id key; nothing else (no prompt, params, result_path, signed url) may be in the payload.
select is((select count(*) from realtime.messages where topic = 'run:' || pg_temp.runid('i_run1')), 3::bigint,
          'PLAY-realtime one message per finished cell, none for the noop finish (FM-9)');
select ok((select bool_and(array(select jsonb_object_keys(payload) order by 1) = array['cell_id', 'error_code', 'id', 'status'])
             and bool_and(event = 'cell') and bool_and(private)
           from realtime.messages where topic = 'run:' || pg_temp.runid('i_run1')),
          'PLAY-realtime payload keys are exactly {cell_id,error_code,id,status}, event cell, private channel');
select is((select payload - 'id' from realtime.messages
            where topic = 'run:' || pg_temp.runid('i_run1') and payload ->> 'cell_id' = pg_temp.cell('i_run1', 1)::text),
          jsonb_build_object('cell_id', pg_temp.cell('i_run1', 1), 'status', 'failed', 'error_code', 'PROVIDER_ERROR'),
          'PLAY-realtime payload carries the cell id, status and error code');
select pg_temp.login_as(pg_temp.u('I'));
select set_config('realtime.topic', 'run:' || pg_temp.runid('i_run1'), true);
select is((select count(*) from realtime.messages where topic = 'run:' || pg_temp.runid('i_run1')), 3::bigint, 'PLAY-realtime the owner reads the messages of their own run topic');
select pg_temp.login_as(pg_temp.u('A'));
select set_config('realtime.topic', 'run:' || pg_temp.runid('i_run1'), true);
select is(pg_temp.cnt('select count(*) from realtime.messages where topic = ' || quote_literal('run:' || pg_temp.runid('i_run1'))), 0::bigint, 'PLAY-realtime another user cannot read someone else''s run topic');
select pg_temp.login_anon();
select set_config('realtime.topic', 'run:' || pg_temp.runid('i_run1'), true);
select is(pg_temp.cnt('select count(*) from realtime.messages where topic = ' || quote_literal('run:' || pg_temp.runid('i_run1'))), 0::bigint, 'PLAY-realtime anon cannot read run topics');
select pg_temp.as_postgres();

-- ---------------------------------------------------------------- provider-billed failures, prompt cleanup (I, third run)
-- 3 × tiny (1C each). m0 blocked & billed, m1 failed & not billed, m2 failed & billed with a provider error text.
insert into res select 'i_run3', pg_temp.run('I', 53, 'blank', null, '[{"model":"test-tiny","params":{},"count":3}]', array['test-tiny'],
  prompt => 'SECRET-I3');
insert into res values ('spent3', (select to_jsonb(spent) from public.generation_budget where month = private.kst_month()));
select public.finish_cell(p_cell => pg_temp.cell('i_run3', 0), p_status => 'blocked', p_error_code => 'SAFETY_BLOCKED',
                          p_result_path => null, p_provider_billed => true);
select ok((select h.state = 'released' and h.outcome = 'safety_blocked' from public.credit_holds h where h.cell_id = pg_temp.cell('i_run3', 0))
          and (select spent - (select (v #>> '{}')::int from res where k = 'spent3') from public.generation_budget where month = private.kst_month()) = 1,
          'F4-15 blocked & provider-billed: the user is released, the budget still books the 1C as spent');
select ok(pg_temp.inv_ledger() and pg_temp.inv_held() and pg_temp.inv_budget(),
          'INV-C20 after a billed release: reserved is back to Σ held holds');
select public.finish_cell(p_cell => pg_temp.cell('i_run3', 1), p_status => 'failed', p_error_code => 'PROVIDER_ERROR',
                          p_result_path => null, p_provider_billed => false);
select is((select spent - (select (v #>> '{}')::int from res where k = 'spent3') from public.generation_budget where month = private.kst_month()), 1,
          'F4-15 failed & not billed: spent unchanged');
select ok((select count(*) = 1 from private.play_prompts where run_id = pg_temp.runid('i_run3'))
          and public.play_prompt_for_submit(pg_temp.cell('i_run3', 2)) = 'SECRET-I3',
          'hidden-content the rendered prompt stays while any cell of the run is not terminal');
insert into res select 'i3_fin', public.finish_cell(p_cell => pg_temp.cell('i_run3', 2), p_status => 'failed',
  p_error_code => 'content_policy_violation', p_result_path => null, p_provider_billed => true);
select ok((select (v ->> 'finished')::boolean from res where k = 'i3_fin')
          and (select error_code = 'PROVIDER_ERROR' from public.play_cells where id = pg_temp.cell('i_run3', 2)),
          'FM-pre a provider error text that is not ^[A-Z_]{2,40}$ is stored as PROVIDER_ERROR and the finish succeeds');
select is((select spent - (select (v #>> '{}')::int from res where k = 'spent3') from public.generation_budget where month = private.kst_month()), 2,
          'F4-15 second billed failure books another 1C');
select is((select count(*) from private.play_prompts where run_id = pg_temp.runid('i_run3')), 0::bigint,
          'hidden-content the rendered prompt row is deleted once the last cell is terminal');
select is(public.play_prompt_for_submit(pg_temp.cell('i_run3', 2)), null, 'hidden-content play_prompt_for_submit returns null afterwards');
select ok(pg_temp.inv_ledger() and pg_temp.inv_held() and pg_temp.inv_budget(), 'INV-C2/C20 after the billed scenario');

-- ---------------------------------------------------------------- submit / webhook RPCs (L)
insert into res select 'l_run', pg_temp.run('L', 300, 'blank', null, '[{"model":"test-tiny","params":{},"count":2}]', array['test-tiny']);
insert into res select 'l1_claim', public.claim_cell_submit(p_cell => pg_temp.cell('l_run', 0));
select ok((select (v ->> 'ok')::boolean and length(v ->> 'token') >= 16 from res where k = 'l1_claim'),
          'FM-11 claim_cell_submit returns a webhook token');
select ok((select v @> jsonb_build_object('endpoint', 'mock/test-tiny', 'provider', 'mock', 'model_id', 'test-tiny', 'kind', 'image',
                             'params', '{"quality":"low"}'::jsonb, 'run_id', pg_temp.runid('l_run'), 'user_id', pg_temp.u('L'))
             and not (v ? 'prompt') and not (v ? 'rendered') from res where k = 'l1_claim'),
          'FM-21 claim_cell_submit returns endpoint, provider, model, kind, params, run and user — and never the prompt');
select ok((select c.attempts = 1 and c.webhook_token_hash is not null and c.webhook_token_hash <> (select v ->> 'token' from res where k = 'l1_claim')
           from public.play_cells c where c.id = pg_temp.cell('l_run', 0))
          and not exists (select 1 from public.play_cells c where c::text like '%' || (select v ->> 'token' from res where k = 'l1_claim') || '%'),
          'FM-11 only a hash of the token is stored, attempts becomes 1');
select ok((select v @> jsonb_build_object('ok', true, 'status', 'queued', 'provider_request_id', null, 'run_id', pg_temp.runid('l_run'),
                             'user_id', pg_temp.u('L'), 'model_id', 'test-tiny', 'kind', 'image')
           from (select public.verify_cell_token(pg_temp.cell('l_run', 0), (select v ->> 'token' from res where k = 'l1_claim')) v) x),
          'FM-11 verify_cell_token with the right token returns the cell facts');
select is(public.verify_cell_token(pg_temp.cell('l_run', 0), 'wrong-token'), '{"ok":false}'::jsonb, 'FM-11 wrong token is rejected');
select is(public.verify_cell_token(pg_temp.cell('l_run', 1), (select v ->> 'token' from res where k = 'l1_claim')), '{"ok":false}'::jsonb,
          'FM-11 a token from another cell is rejected (also before the cell was ever claimed)');
select is((select next_attempt_at from public.play_cells where id = pg_temp.cell('l_run', 0)), now() + interval '5 minutes',
          'FM-17 claim_cell_submit takes a 5-minute lease (next_attempt_at = now() + 5 min)');
-- FM-10 webhook before the provider id is known.
select public.attach_provider_request(p_cell => pg_temp.cell('l_run', 0), p_provider_request_id => 'req-l1');
select public.attach_provider_request(p_cell => pg_temp.cell('l_run', 0), p_provider_request_id => 'req-other');
select is((select provider_request_id from public.play_cells where id = pg_temp.cell('l_run', 0)), 'req-l1',
          'FM-10 attach_provider_request fills the id once and never overwrites it');
-- backoff: requeue, not due yet, due again.
select public.requeue_cell(p_cell => pg_temp.cell('l_run', 0), p_error_code => 'RATE_LIMITED');
select ok((select status = 'queued' and next_attempt_at = now() + interval '1 minute' from public.play_cells where id = pg_temp.cell('l_run', 0)),
          'FM-21 requeue_cell stays queued and backs off 1 minute × attempts (1)');
select is(public.claim_cell_submit(p_cell => pg_temp.cell('l_run', 0)), '{"ok":false,"reason":"NOT_QUEUED"}'::jsonb,
          'FM-21 claim before next_attempt_at is NOT_QUEUED');
update public.play_cells set next_attempt_at = now() where id = pg_temp.cell('l_run', 0);
insert into res select 'l1_claim2', public.claim_cell_submit(p_cell => pg_temp.cell('l_run', 0));
select ok((select (v ->> 'ok')::boolean and v ->> 'token' <> (select v ->> 'token' from res where k = 'l1_claim') from res where k = 'l1_claim2')
          and (select attempts = 2 from public.play_cells where id = pg_temp.cell('l_run', 0)),
          'FM-21 second claim issues a new token, attempts 2');
select ok((public.verify_cell_token(pg_temp.cell('l_run', 0), (select v ->> 'token' from res where k = 'l1_claim2')) ->> 'ok')::boolean
          and not (public.verify_cell_token(pg_temp.cell('l_run', 0), (select v ->> 'token' from res where k = 'l1_claim') ) ->> 'ok')::boolean,
          'FM-11 the old token stops working once a new one is issued');
select public.mark_cell_submitted(p_cell => pg_temp.cell('l_run', 0), p_provider_request_id => 'req-l1');
select ok((select status = 'submitted' and provider_request_id = 'req-l1' and submitted_at is not null and deadline_at = now() + interval '60 seconds'
           from public.play_cells where id = pg_temp.cell('l_run', 0)),
          'FM-7 mark_cell_submitted: submitted, deadline_at = now() + models.deadline_seconds (60s)');
select public.mark_cell_running(p_cell => pg_temp.cell('l_run', 0));
select public.mark_cell_running(p_cell => pg_temp.cell('l_run', 1));
select ok((select status = 'running' from public.play_cells where id = pg_temp.cell('l_run', 0))
          and (select status = 'queued' from public.play_cells where id = pg_temp.cell('l_run', 1)),
          'FM-7 mark_cell_running moves only submitted cells');
select public.finish_cell(p_cell => pg_temp.cell('l_run', 0), p_status => 'succeeded', p_error_code => null, p_result_path => pg_temp.u('L') || '/l1.png');
select public.mark_cell_submitted(p_cell => pg_temp.cell('l_run', 0), p_provider_request_id => 'req-late');
select ok((select status = 'succeeded' and provider_request_id = 'req-l1' from public.play_cells where id = pg_temp.cell('l_run', 0)),
          'FM-9 mark_cell_submitted on a finished cell is a noop');
select is(public.record_webhook_event(p_provider => 'fal', p_event_key => 'evt-1', p_cell => pg_temp.cell('l_run', 0)), true,
          'FM-9 first webhook event is new');
select is(public.record_webhook_event(p_provider => 'fal', p_event_key => 'evt-1', p_cell => pg_temp.cell('l_run', 0)), false,
          'FM-9 the same event again is a duplicate');
select ok((select count(*) = 1 from public.generation_webhook_inbox where provider = 'fal' and event_key = 'evt-1')
          and public.record_webhook_event('mock', 'evt-1', pg_temp.cell('l_run', 0)),
          'FM-9 the inbox keeps one row per (provider, event_key); another provider is separate');
-- FM-21 exhaustion on the second cell: three claims, the fourth fails the cell.
select public.claim_cell_submit(pg_temp.cell('l_run', 1));
select public.requeue_cell(pg_temp.cell('l_run', 1), 'submit failed');
select is((select error_code from public.play_cells where id = pg_temp.cell('l_run', 1)), 'PROVIDER_ERROR',
          'FM-pre requeue_cell stores an error text that is not ^[A-Z_]{2,40}$ as PROVIDER_ERROR');
update public.play_cells set next_attempt_at = now() where id = pg_temp.cell('l_run', 1);
select public.claim_cell_submit(pg_temp.cell('l_run', 1));
select public.requeue_cell(pg_temp.cell('l_run', 1), 'SUBMIT_FAILED');
select is((select next_attempt_at from public.play_cells where id = pg_temp.cell('l_run', 1)), now() + interval '2 minutes',
          'FM-21 second requeue backs off 2 minutes');
update public.play_cells set next_attempt_at = now() where id = pg_temp.cell('l_run', 1);
select public.claim_cell_submit(pg_temp.cell('l_run', 1));
select public.requeue_cell(pg_temp.cell('l_run', 1), 'SUBMIT_FAILED');
update public.play_cells set next_attempt_at = now() where id = pg_temp.cell('l_run', 1);
select is(public.claim_cell_submit(pg_temp.cell('l_run', 1)), '{"ok":false,"reason":"EXHAUSTED"}'::jsonb,
          'FM-21 the fourth claim is EXHAUSTED');
select ok((select status = 'failed' and error_code = 'PROVIDER_UNAVAILABLE' and attempts = 3 from public.play_cells where id = pg_temp.cell('l_run', 1))
          and (select state = 'released' and outcome = 'model_error' from public.credit_holds where cell_id = pg_temp.cell('l_run', 1))
          and (select available || '/' || held from public.credit_accounts where user_id = pg_temp.u('L')) = '269/0',
          'FM-21 exhausted cell: failed / PROVIDER_UNAVAILABLE, hold released (L pays only the success: 270 − 1)');
select ok(pg_temp.inv_ledger() and pg_temp.inv_held() and pg_temp.inv_budget(), 'INV-C2/C20 after the submit scenario');

-- ---------------------------------------------------------------- retention: save / unsave (cell i_run1 #0 succeeded, owner I)
select pg_temp.login_as(pg_temp.u('I'));
select public.save_play_cell(p_cell => pg_temp.cell('i_run1', 0), p_saved => true);
select public.save_play_cell(p_cell => pg_temp.cell('i_run1', 1), p_saved => true);
select pg_temp.as_postgres();
select ok((select saved_at is not null and delete_after is null from public.play_cells where id = pg_temp.cell('i_run1', 0)),
          'D19 saving a result sets saved_at and clears delete_after');
select ok((select saved_at is null from public.play_cells where id = pg_temp.cell('i_run1', 1)),
          'D19 a failed cell cannot be saved');
select pg_temp.login_as(pg_temp.u('B'));
select pg_temp.attempt($$ select public.save_play_cell(p_cell => '$$ || pg_temp.cell('i_run1', 0) || $$', p_saved => false) $$);
select pg_temp.as_postgres();
select ok((select saved_at is not null and delete_after is null from public.play_cells where id = pg_temp.cell('i_run1', 0)),
          'D19 IDOR: another user cannot unsave someone else''s cell');
select pg_temp.login_as(pg_temp.u('I'));
select public.save_play_cell(p_cell => pg_temp.cell('i_run1', 0), p_saved => false);
select pg_temp.as_postgres();
select ok((select saved_at is null and delete_after = created_at + interval '30 days' from public.play_cells where id = pg_temp.cell('i_run1', 0)),
          'D19 unsaving restores delete_after = created_at + 30 days');

update public.play_cells set created_at = now() - interval '40 days' where id = pg_temp.cell('i_run1', 0);
select pg_temp.login_as(pg_temp.u('I'));
select public.save_play_cell(pg_temp.cell('i_run1', 0), true);
select public.save_play_cell(pg_temp.cell('i_run1', 0), false);
select pg_temp.as_postgres();
select is((select delete_after from public.play_cells where id = pg_temp.cell('i_run1', 0)), now() + interval '1 day',
          'D19 unsaving an old result gives one more day: delete_after = greatest(created_at + 30d, now() + 1 day)');

-- ---------------------------------------------------------------- sweeper (J)
-- J cells (4 × tiny, 4 × image low; index = cell_ids order): j0 succeeded & past delete_after, j1 succeeded & saved,
-- j2 queued 11 minutes (stale), j3 submitted 1h past deadline (poll only), j4 queued & due (resubmit),
-- j5 submitted with time left, j6 queued 11 minutes but claimed (lease in the future), j7 submitted 25h past deadline.
insert into res select 'j_run', pg_temp.run('J', 400, 'blank', null, '[{"model":"test-tiny","params":{},"count":4},{"model":"test-image","params":{"quality":"low"},"count":4}]', array['test-tiny', 'test-image']);
select public.finish_cell(pg_temp.cell('j_run', 0), 'succeeded', null, 'j/0.png');
select public.finish_cell(pg_temp.cell('j_run', 1), 'succeeded', null, 'j/1.png');
select pg_temp.login_as(pg_temp.u('J'));
select public.save_play_cell(pg_temp.cell('j_run', 1), true);
select pg_temp.as_postgres();
update public.play_cells set delete_after = now() - interval '1 day' where id = pg_temp.cell('j_run', 0);
update public.play_cells set created_at = now() - interval '11 minutes' where id = pg_temp.cell('j_run', 2);
select public.mark_cell_submitted(pg_temp.cell('j_run', 3), 'req-j3');
update public.play_cells set deadline_at = now() - interval '1 hour' where id = pg_temp.cell('j_run', 3);
select public.mark_cell_submitted(pg_temp.cell('j_run', 5), 'req-j5');
update public.play_cells set created_at = now() - interval '11 minutes', next_attempt_at = now() + interval '5 minutes'
 where id = pg_temp.cell('j_run', 6);
select public.mark_cell_submitted(pg_temp.cell('j_run', 7), 'req-j7');
update public.play_cells set deadline_at = now() - interval '25 hours' where id = pg_temp.cell('j_run', 7);
insert into res select 'sweep', public.sweep_targets();
select ok((select (v -> 'poll')::text like '%' || pg_temp.cell('j_run', 3)::text || '%' and (v -> 'poll')::text not like '%' || pg_temp.cell('j_run', 5)::text || '%'
          from res where k = 'sweep'),
          'FM-7/8 a submitted cell past its deadline is a poll target; one with time left is not');
select ok((select e @> '{"provider_request_id":"req-j3","endpoint":"mock/test-tiny","provider":"mock"}'::jsonb
           from res, jsonb_array_elements(v -> 'poll') e where k = 'sweep' and e ->> 'cell' = pg_temp.cell('j_run', 3)::text),
          'FM-7 poll target carries provider_request_id, endpoint, provider');
select ok((select (v -> 'resubmit')::text like '%' || pg_temp.cell('j_run', 4)::text || '%'
          and (v -> 'resubmit')::text not like '%' || pg_temp.cell('j_run', 0)::text || '%'
          from res where k = 'sweep'),
          'FM-17 a due queued cell is resubmitted; finished cells are not');
select ok((select (v -> 'finish') @> jsonb_build_array(jsonb_build_object('cell', pg_temp.cell('j_run', 2),
                      'status', 'failed', 'error_code', 'PROVIDER_UNAVAILABLE')) from res where k = 'sweep'),
          'FM-17 a cell queued over 10 minutes with an expired lease is listed in finish as failed / PROVIDER_UNAVAILABLE');
select ok((select status = 'queued' from public.play_cells where id = pg_temp.cell('j_run', 2))
          and (select state = 'held' from public.credit_holds where cell_id = pg_temp.cell('j_run', 2)),
          'FM-17 sweep_targets finishes nothing itself: the stale cell is still queued and held');
select ok((select (v -> 'finish')::text not like '%' || pg_temp.cell('j_run', 6)::text || '%' from res where k = 'sweep'),
          'M2 a queued cell older than 10 minutes but claimed within its lease is not in finish');
select ok((select (v -> 'finish') @> jsonb_build_array(jsonb_build_object('cell', pg_temp.cell('j_run', 7),
                      'status', 'expired', 'error_code', 'TIMEOUT')) from res where k = 'sweep'),
          'FM-7 a cell 25 hours past its deadline is in finish as expired / TIMEOUT');
select ok((select (v -> 'finish')::text not like '%' || pg_temp.cell('j_run', 3)::text || '%'
          and (v -> 'poll')::text like '%' || pg_temp.cell('j_run', 3)::text || '%' from res where k = 'sweep'),
          'FM-7 a cell 1 hour past its deadline is only a poll target');
select public.finish_cell(pg_temp.cell('j_run', 2), 'failed', 'PROVIDER_UNAVAILABLE');
select public.finish_cell(pg_temp.cell('j_run', 7), 'expired', 'TIMEOUT');
select ok((select state = 'released' and outcome = 'model_error' from public.credit_holds where cell_id = pg_temp.cell('j_run', 2))
          and (select state = 'released' and outcome = 'model_error' from public.credit_holds where cell_id = pg_temp.cell('j_run', 7)),
          'FM-17/7 the app finishes the listed cells with finish_cell, which releases the holds');
select ok((select (v -> 'expired_refs') @> jsonb_build_array(jsonb_build_object('id', 'f0000000-0000-0000-0000-000000000003',
                       'path', pg_temp.u('A') || '/f0000000-0000-0000-0000-000000000003.png'))
          and (v -> 'expired_refs')::text not like '%f0000000-0000-0000-0000-000000000001%'
          and exists (select 1 from public.play_refs where id = 'f0000000-0000-0000-0000-000000000003')
          from res where k = 'sweep'),
          'F4-8 sweep lists expired references as {id,path} and does not delete yet; fresh ones are not listed');
select ok((select (v -> 'expired_results') @> jsonb_build_array(jsonb_build_object('id', pg_temp.cell('j_run', 0), 'path', 'j/0.png'))
          and (v -> 'expired_results')::text not like '%j/1.png%'
          and (select result_path = 'j/0.png' from public.play_cells where id = pg_temp.cell('j_run', 0))
          from res where k = 'sweep'),
          'D19 sweep lists unsaved results past delete_after as {id,path}; saved ones are not listed; nothing cleared yet');
select public.purge_play_files(array['f0000000-0000-0000-0000-000000000001']::uuid[], array[pg_temp.cell('j_run', 1)]);
select ok(exists (select 1 from public.play_refs where id = 'f0000000-0000-0000-0000-000000000001')
          and (select result_path = 'j/1.png' and saved_at is not null from public.play_cells where id = pg_temp.cell('j_run', 1)),
          'F4-8/D19 purge_play_files ignores a fresh reference and a saved result');
select public.purge_play_files(array['f0000000-0000-0000-0000-000000000003']::uuid[], array[pg_temp.cell('j_run', 0)]);
select ok(not exists (select 1 from public.play_refs where id = 'f0000000-0000-0000-0000-000000000003')
          and (select result_path is null from public.play_cells where id = pg_temp.cell('j_run', 0))
          and exists (select 1 from public.play_refs where id = 'f0000000-0000-0000-0000-000000000001')
          and (select result_path = 'j/1.png' from public.play_cells where id = pg_temp.cell('j_run', 1)),
          'F4-8/D19 purge_play_files deletes the expired reference row and clears the expired unsaved result only');
select ok((select jsonb_array_length(v -> 'expired_refs') = 0 and jsonb_array_length(v -> 'expired_results') = 0
             and (v -> 'poll')::text like '%' || pg_temp.cell('j_run', 3)::text || '%'
             and (v -> 'finish')::text not like '%' || pg_temp.cell('j_run', 2)::text || '%'
             and (v -> 'finish')::text not like '%' || pg_temp.cell('j_run', 7)::text || '%'
           from (select public.sweep_targets() v) x),
          'FM-9 after the purge and the finishes a second sweep lists nothing to delete or finish; the overdue cell stays a poll target');
-- webhook inbox keeps 30 days; any purge call trims it.
insert into public.generation_webhook_inbox (provider, event_key, cell_id, received_at) values
  ('fal', 'old-evt', null, now() - interval '31 days'), ('fal', 'recent-evt', null, now() - interval '29 days');
select public.purge_play_files('{}'::uuid[], '{}'::uuid[]);
select ok(not exists (select 1 from public.generation_webhook_inbox where event_key = 'old-evt')
          and exists (select 1 from public.generation_webhook_inbox where event_key = 'recent-evt')
          and exists (select 1 from public.generation_webhook_inbox where event_key = 'evt-1' and provider = 'fal'),
          'FM-9 purge_play_files deletes webhook inbox rows older than 30 days and keeps newer ones');
select ok(pg_temp.inv_ledger() and pg_temp.inv_held() and pg_temp.inv_budget(), 'INV-C2/C20 after the sweep');

-- ---------------------------------------------------------------- reference upload slots (create_play_ref)
insert into res select 'ref1', public.create_play_ref(p_user => pg_temp.u('L'), p_ext => 'png', p_mime => 'image/png', p_size => 2048);
select ok((select (v ->> 'ok')::boolean and v ->> 'path' = pg_temp.u('L') || '/' || (v ->> 'id') || '.png' from res where k = 'ref1')
          and (select r.user_id = pg_temp.u('L') and r.path = (select v ->> 'path' from res where k = 'ref1') and r.mime = 'image/png'
                      and r.size = 2048 and r.delete_after = r.created_at + interval '24 hours'
               from public.play_refs r where r.id = (select (v ->> 'id')::uuid from res where k = 'ref1')),
          'F4-8 create_play_ref: path <user>/<uuid>.<ext>, row inserted, delete_after = created_at + 24h');
select is(public.create_play_ref(pg_temp.u('L'), 'gif', 'image/gif', 100) ->> 'reason', 'INVALID_FILE',
          'F4-8 create_play_ref refuses a gif');
select is((select count(*) from generate_series(1, 29) i
            where (public.create_play_ref(pg_temp.u('L'), 'jpg', 'image/jpeg', 100) ->> 'ok')::boolean), 29::bigint,
          'F4-8 create_play_ref: 30 slots per hour are allowed');
select is(public.create_play_ref(pg_temp.u('L'), 'png', 'image/png', 100) ->> 'reason', 'RATE_LIMITED',
          'F4-8 create_play_ref: the 31st slot within the hour is RATE_LIMITED');

-- ---------------------------------------------------------------- authorization
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public'
                         and p.proname = any (array['start_run', 'claim_cell_submit', 'mark_cell_submitted', 'requeue_cell',
                              'mark_cell_running', 'finish_cell', 'verify_cell_token', 'attach_provider_request',
                              'record_webhook_event', 'sweep_targets', 'play_prompt_for_submit', 'purge_play_files', 'create_play_ref'])
                         and has_function_privilege('anon', p.oid, 'execute')),
          'PLAY-authz anon cannot execute any server-only RPC (incl. purge_play_files, create_play_ref)');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public'
                         and p.proname = any (array['start_run', 'claim_cell_submit', 'mark_cell_submitted', 'requeue_cell',
                              'mark_cell_running', 'finish_cell', 'verify_cell_token', 'attach_provider_request',
                              'record_webhook_event', 'sweep_targets', 'play_prompt_for_submit', 'purge_play_files', 'create_play_ref'])
                         and has_function_privilege('authenticated', p.oid, 'execute')),
          'PLAY-authz authenticated cannot execute any server-only RPC');
select is((select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname = any (array['start_run', 'claim_cell_submit', 'mark_cell_submitted', 'requeue_cell',
                   'mark_cell_running', 'finish_cell', 'verify_cell_token', 'attach_provider_request',
                   'record_webhook_event', 'sweep_targets', 'play_prompt_for_submit', 'purge_play_files', 'create_play_ref'])
              and has_function_privilege('service_role', p.oid, 'execute')), 13::bigint,
          'PLAY-authz service_role can execute all 13 server-only RPCs');
select is((select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (array['quote_play', 'save_play_cell', 'ack_ai_notice'])
              and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')), 3::bigint,
          'PLAY-authz quote_play, save_play_cell, ack_ai_notice are authenticated-only');

select pg_temp.as_service();
select is(public.start_run(p_user => pg_temp.u('A'), p_client_request_id => pg_temp.cid(21), p_mode => 'own',
            p_recipe_version_id => 'bbbbbbbb-0000-0000-0000-000000000004', p_variables => '{}',
            p_cells => '[{"model":"test-tiny","params":{},"count":1}]', p_price_versions => '{"test-tiny":1}',
            p_reference_ids => '{}', p_face_consent => false, p_rendered_prompt => 'x', p_ip_hash => null, p_device_hash => null) ->> 'existing',
          'true', 'PLAY-authz service_role can call start_run');
select pg_temp.login_as(pg_temp.u('A'));
select throws_ok($$ select public.start_run(p_user => '00000000-0000-0000-0000-00000000c001', p_client_request_id => gen_random_uuid(),
                      p_mode => 'blank', p_recipe_version_id => null, p_variables => '{}',
                      p_cells => '[{"model":"test-tiny","params":{},"count":1}]', p_price_versions => '{"test-tiny":1}',
                      p_reference_ids => '{}', p_face_consent => false, p_rendered_prompt => 'x', p_ip_hash => null, p_device_hash => null) $$,
                 '42501', null, 'PLAY-authz authenticated cannot call start_run');
select throws_ok($$ select public.finish_cell(p_cell => gen_random_uuid(), p_status => 'succeeded', p_error_code => null, p_result_path => null) $$,
                 '42501', null, 'PLAY-authz authenticated cannot call finish_cell (IDOR on someone else''s cell)');
select throws_ok($$ select public.play_prompt_for_submit(gen_random_uuid()) $$, '42501', null,
                 'hidden-content authenticated cannot read a rendered prompt');
select throws_ok($$ select count(*) from private.play_prompts $$, '42501', null, 'hidden-content authenticated cannot select private.play_prompts');
select throws_ok($$ select count(*) from public.model_prices $$, '42501', null, 'PLAY-authz authenticated cannot select model_prices');
select throws_ok($$ select webhook_token_hash from public.play_cells $$, '42501', null, 'PLAY-authz authenticated cannot read webhook_token_hash');
select throws_ok($$ select provider_request_id from public.play_cells $$, '42501', null, 'PLAY-authz authenticated cannot read provider_request_id');
select throws_ok($$ select attempts from public.play_cells $$, '42501', null, 'PLAY-authz authenticated cannot read attempts');
select throws_ok($$ select count(*) from public.face_consents $$, '42501', null, 'PLAY-authz authenticated cannot read face_consents');
select throws_ok($$ select count(*) from public.generation_webhook_inbox $$, '42501', null, 'PLAY-authz authenticated cannot read the webhook inbox');
select throws_ok($$ select nextval('public.face_consents_id_seq') $$, '42501', null, 'PLAY-authz authenticated cannot use face_consents_id_seq');
select ok((select count(*) = 1 from public.models where id = 'test-image')
          and (select count(*) = 0 from public.models where id = 'test-off'),
          'PLAY-authz clients see enabled models only');
select ok((select count(*) >= 3 from public.play_runs where user_id = pg_temp.u('A'))
          and (select count(*) = 0 from public.play_runs where user_id <> pg_temp.u('A'))
          and (select count(*) >= 3 from public.play_cells)
          and not exists (select 1 from public.play_cells c where not exists (select 1 from public.play_runs r where r.id = c.run_id and r.user_id = pg_temp.u('A'))),
          'PLAY-authz A sees only A''s runs and cells');
select ok((select count(*) = 1 from public.play_refs) and (select count(*) = 1 from public.play_refs where id = 'f0000000-0000-0000-0000-000000000001'),
          'PLAY-authz A sees only A''s references (the expired one was swept)');
select throws_ok($$ insert into public.play_runs (user_id, mode, client_request_id) values ('00000000-0000-0000-0000-00000000c001', 'blank', gen_random_uuid()) $$,
                 '42501', null, 'PLAY-authz clients cannot insert runs');
select throws_ok($$ update public.play_cells set status = 'succeeded' $$, '42501', null, 'PLAY-authz clients cannot update cells');
select pg_temp.login_as(pg_temp.u('B'));
select ok((select count(*) = 0 from public.play_runs where user_id = pg_temp.u('A'))
          and (select count(*) = 0 from public.play_cells where run_id = pg_temp.runid('a_own'))
          and (select count(*) = 0 from public.play_refs where id = 'f0000000-0000-0000-0000-000000000001')
          and (select count(*) = 0 from public.credit_holds where cell_id = pg_temp.cell('a_own', 0)),
          'PLAY-authz B cannot read A''s runs, cells, references or holds');
select pg_temp.login_anon();
select throws_ok($$ select count(*) from public.play_runs $$, '42501', null, 'PLAY-authz anon cannot read runs');
select throws_ok($$ select count(*) from public.play_cells $$, '42501', null, 'PLAY-authz anon cannot read cells');
select throws_ok($$ select count(*) from public.model_prices $$, '42501', null, 'PLAY-authz anon cannot read model_prices');
select throws_ok($$ select public.quote_play('[{"model":"test-tiny","params":{},"count":1}]') $$, '42501', null, 'PLAY-authz anon cannot quote');
select throws_ok($$ select public.ack_ai_notice() $$, '42501', null, 'PLAY-authz anon cannot acknowledge the AI notice');
select pg_temp.as_postgres();

-- ---------------------------------------------------------------- final invariants over every scenario
select ok(pg_temp.inv_ledger(), 'INV-C2 final: Σ ledger.delta = credit_accounts.available for every test user');
select ok(pg_temp.inv_held(), 'INV-C2 final: credit_accounts.held = Σ held holds for every test user');
select ok(pg_temp.inv_budget(), 'INV-C20 final: generation_budget.reserved = Σ held holds of the month');

select * from finish();
rollback;
