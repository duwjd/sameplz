-- D18 (B): results are public only for the current version of live / stopped recipes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Fixture: owner A's recipe with one version and one result; user B for ownership checks.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000d1801', 'd18@example.test'),
  ('00000000-0000-0000-0000-0000000d1802', 'd18b@example.test');
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now()
 where id in ('00000000-0000-0000-0000-0000000d1801', '00000000-0000-0000-0000-0000000d1802');
-- Only this test's recipe in the queue (seed recipes are queued too).
delete from public.media_sync_queue;
insert into public.recipes (id, public_id, owner_id, category, prompt_kind, title, summary, status, creator_nickname, job_codes)
values ('00000000-0000-0000-0000-0000000d1810', 'rd18test01', '00000000-0000-0000-0000-0000000d1801',
        'prompt', 'image', '비공개 결과 시험', '요약', 'in_review', '시험', array['commerce']);
insert into public.recipe_versions (id, recipe_id, version_no, changelog, review_status, public_meta)
values ('00000000-0000-0000-0000-0000000d1811', '00000000-0000-0000-0000-0000000d1810', 1, '첫 버전',
        'pending_review', '{}');
insert into public.media_assets (id, owner_id, storage_path, kind, ratio)
values ('00000000-0000-0000-0000-0000000d1812', '00000000-0000-0000-0000-0000000d1801',
        '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png', 'image', '1/1');
insert into public.recipe_version_media (version_id, media_id, role, sort)
values ('00000000-0000-0000-0000-0000000d1811', '00000000-0000-0000-0000-0000000d1812', 'result', 0);

create temp table claims (k text primary key, v jsonb);
grant all on claims to authenticated;

select ok(exists (select 1 from storage.buckets where id = 'recipe-media-draft' and not public),
          'D18 the draft bucket is private');
select ok(exists (select 1 from public.media_sync_queue where recipe_id = '00000000-0000-0000-0000-0000000d1810'),
          'D18 a new recipe is queued for media sync');

-- Claim: in review → unpublish; leased so a second claim skips it.
insert into claims select 'c1', public.media_sync_claim(10);
select is((select v -> 0 -> 'unpublish' from claims where k = 'c1'),
          '["00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png"]'::jsonb,
          'D18 results of a recipe under review stay private');
select is(public.media_sync_claim(10), '[]'::jsonb, 'D18 a leased recipe is not claimed twice');
select ok((select lease_until > now() from public.media_sync_queue where recipe_id = '00000000-0000-0000-0000-0000000d1810'),
          'D18 the claim takes a lease');

-- A change while leased: done fails on queued_at and only releases the lease.
update public.recipes set status = 'private' where id = '00000000-0000-0000-0000-0000000d1810';
select ok(not public.media_sync_done('00000000-0000-0000-0000-0000000d1810', ((select v -> 0 ->> 'queued_at' from claims where k = 'c1'))::timestamptz),
          'D18 done on an outdated claim keeps the newer queue entry');
select ok((select lease_until is null from public.media_sync_queue where recipe_id = '00000000-0000-0000-0000-0000000d1810'),
          'D18 the outdated claim releases its lease so the recipe runs again');

-- Retry backs off.
insert into claims select 'c2', public.media_sync_claim(10);
select public.media_sync_retry('00000000-0000-0000-0000-0000000d1810');
select ok((select attempts = 1 and next_try_at > now() and lease_until is null from public.media_sync_queue
            where recipe_id = '00000000-0000-0000-0000-0000000d1810'),
          'D18 a failed run is retried later (backoff), not in a loop');
select is(public.media_sync_claim(10), '[]'::jsonb, 'D18 a backed-off recipe is not due yet');
update public.media_sync_queue set next_try_at = now() where recipe_id = '00000000-0000-0000-0000-0000000d1810';
insert into claims select 'c3', public.media_sync_claim(10);
select ok(public.media_sync_done('00000000-0000-0000-0000-0000000d1810', ((select v -> 0 ->> 'queued_at' from claims where k = 'c3'))::timestamptz),
          'D18 done with the current claim removes the queue entry');

-- Goes live with this version: queued again, now public; non-public recipes are claimed first.
update public.recipe_versions set review_status = 'approved', approved_at = now()
 where id = '00000000-0000-0000-0000-0000000d1811';
update public.recipes set status = 'live', current_version_id = '00000000-0000-0000-0000-0000000d1811', published_at = now()
 where id = '00000000-0000-0000-0000-0000000d1810';
insert into public.media_sync_queue (recipe_id) values ('aaaaaaaa-0000-0000-0000-000000000019')   -- seed private recipe
on conflict (recipe_id) do update set queued_at = clock_timestamp();
insert into claims select 'c4', public.media_sync_claim(1);
select is((select v -> 0 ->> 'recipe_id' from claims where k = 'c4'), 'aaaaaaaa-0000-0000-0000-000000000019',
          'D18 non-public recipes are handled before publishing ones');
insert into claims select 'c5', public.media_sync_claim(10);
select is((select v -> 0 -> 'publish' from claims where k = 'c5'),
          '["00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png"]'::jsonb,
          'D18 the current version of a live recipe is public');
select is(public.media_paths_public(array['00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png']),
          '{"00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png": true}'::jsonb,
          'D18 the per-path re-check answers before a move');

-- Same status written again does not re-queue (trigger WHEN).
delete from public.media_sync_queue;
update public.recipes set status = 'live' where id = '00000000-0000-0000-0000-0000000d1810';
select ok(not exists (select 1 from public.media_sync_queue), 'D18 an unchanged status does not queue');

-- Stopped keeps it public; private takes it back.
update public.recipes set status = 'stopped', stopped_reason = 'creator_request', stopped_at = now()
 where id = '00000000-0000-0000-0000-0000000d1810';
select ok(private.media_path_public('00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png'),
          'D18 a stopped recipe keeps its results public (holders still see the page)');
update public.recipes set status = 'private' where id = '00000000-0000-0000-0000-0000000d1810';
select ok(not private.media_path_public('00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png'),
          'D18 a private recipe''s results are not public');

-- Gallery: a visible post of a private recipe does not make its media public; posts queue the recipe.
delete from public.media_sync_queue;
insert into public.gallery_posts (author_id, recipe_id, kind, media_id, title, status)
values ('00000000-0000-0000-0000-0000000d1801', '00000000-0000-0000-0000-0000000d1810', 'original',
        '00000000-0000-0000-0000-0000000d1812', '원작', 'visible');
select ok(exists (select 1 from public.media_sync_queue where recipe_id = '00000000-0000-0000-0000-0000000d1810'),
          'D18 a gallery post queues its recipe');
select ok(not private.media_path_public('00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png'),
          'D18 a visible gallery post of a private recipe stays private');

-- Uploads may sit in either bucket for submit_recipe_version.
insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('recipe-media-draft', '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png',
   '00000000-0000-0000-0000-0000000d1801', '{"size": 1000}'),
  ('recipe-files', '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1815/x.zip',
   '00000000-0000-0000-0000-0000000d1801', '{"size": 1000}'),
  ('recipe-media-draft', '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1816.png',
   '00000000-0000-0000-0000-0000000d1801', '{"size": 400000000}');
select ok(private.storage_object_ok('recipe-media',
          '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png',
          '00000000-0000-0000-0000-0000000d1801'),
          'D18 an upload in the draft bucket counts as uploaded');
select ok(not private.storage_object_ok('recipe-files',
          '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png',
          '00000000-0000-0000-0000-0000000d1801'),
          'D18 other buckets are checked as before');
select ok(not public.hit_upload_target_limit('00000000-0000-0000-0000-0000000d1801'),
          'D18 the 300MB/day upload cap counts the draft bucket');

-- Orphans: fresh ones are kept; old unreferenced ones are listed; a draft protects only its owner's files.
select ok(not ((public.orphan_uploads(500) -> 'media') ? '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png'),
          'D18 an upload younger than 24 hours is kept');
update storage.objects set created_at = now() - interval '2 days'
 where name like '00000000-0000-0000-0000-0000000d1801/%';
select ok((public.orphan_uploads(500) -> 'media') ? '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png'
          and (public.orphan_uploads(500) -> 'files') ? '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1815/x.zip',
          'D18 unsubmitted results and zips older than 24 hours are listed for deletion');
insert into public.recipe_drafts (owner_id, category, step, payload)
values ('00000000-0000-0000-0000-0000000d1802', 'prompt', 3,
        '{"media":[{"path":"00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png"}]}');
select ok((public.orphan_uploads(500) -> 'media') ? '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png',
          'D18 another user''s draft cannot keep someone''s upload alive');
insert into public.recipe_drafts (owner_id, category, step, payload)
values ('00000000-0000-0000-0000-0000000d1801', 'prompt', 3,
        '{"media":[{"path":"00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png"}]}');
select ok(not ((public.orphan_uploads(500) -> 'media') ? '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png'),
          'D18 an upload kept in the owner''s saved draft is not deleted');

set local role authenticated;
select throws_ok($$ select public.media_sync_claim(1) $$, '42501', null, 'D18 clients cannot claim media sync');
select throws_ok($$ select * from public.media_sync_queue $$, '42501', null, 'D18 clients cannot read the sync queue');
reset role;

select * from finish();
rollback;
