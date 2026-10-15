-- D18 (B): results are public only for the current version of live / stopped recipes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fixture: an owner's recipe with one approved version and one result, plus storage objects.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000d1801', 'd18@example.test');
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now()
 where id = '00000000-0000-0000-0000-0000000d1801';
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

select ok(exists (select 1 from storage.buckets where id = 'recipe-media-draft' and not public),
          'D18 the draft bucket is private');
select ok(exists (select 1 from public.media_sync_queue where recipe_id = '00000000-0000-0000-0000-0000000d1810'),
          'D18 a new recipe is queued for media sync');

-- In review: not public.
select is((select b -> 'unpublish' from jsonb_array_elements(public.media_sync_batch(500)) b
            where b ->> 'recipe_id' = '00000000-0000-0000-0000-0000000d1810'),
          '["00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png"]'::jsonb,
          'D18 results of a recipe under review stay private');

-- Done with a stale queued_at keeps the row; with the current one removes it.
select ok(not public.media_sync_done('00000000-0000-0000-0000-0000000d1810', now() - interval '1 day'),
          'D18 a stale done never drops a newer queue entry');
select ok(public.media_sync_done('00000000-0000-0000-0000-0000000d1810',
          (select queued_at from public.media_sync_queue where recipe_id = '00000000-0000-0000-0000-0000000d1810')),
          'D18 done removes the queue entry');

-- Goes live with this version: queued again, now public.
update public.recipe_versions set review_status = 'approved', approved_at = now()
 where id = '00000000-0000-0000-0000-0000000d1811';
update public.recipes set status = 'live', current_version_id = '00000000-0000-0000-0000-0000000d1811',
       published_at = now()
 where id = '00000000-0000-0000-0000-0000000d1810';
select ok(exists (select 1 from public.media_sync_queue where recipe_id = '00000000-0000-0000-0000-0000000d1810'),
          'D18 going live queues the recipe');
select is((select b -> 'publish' from jsonb_array_elements(public.media_sync_batch(500)) b
            where b ->> 'recipe_id' = '00000000-0000-0000-0000-0000000d1810'),
          '["00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png"]'::jsonb,
          'D18 the current version of a live recipe is public');

-- Stopped keeps it public; private takes it back.
update public.recipes set status = 'stopped', stopped_reason = 'creator_request', stopped_at = now()
 where id = '00000000-0000-0000-0000-0000000d1810';
select ok(private.media_path_public('00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png'),
          'D18 a stopped recipe keeps its results public (holders still see the page)');
update public.recipes set status = 'private' where id = '00000000-0000-0000-0000-0000000d1810';
select ok(not private.media_path_public('00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1813.png'),
          'D18 a private recipe''s results are not public');

-- Uploads may sit in either bucket for submit_recipe_version.
insert into storage.objects (bucket_id, name, owner_id)
values ('recipe-media-draft', '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png',
        '00000000-0000-0000-0000-0000000d1801');
select ok(private.storage_object_ok('recipe-media',
          '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png',
          '00000000-0000-0000-0000-0000000d1801'),
          'D18 an upload in the draft bucket counts as uploaded');
select ok(not private.storage_object_ok('recipe-files',
          '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png',
          '00000000-0000-0000-0000-0000000d1801'),
          'D18 other buckets are checked as before');

-- Orphans: old, unreferenced draft uploads are listed; fresh or referenced ones are not.
update storage.objects set created_at = now() - interval '2 days'
 where bucket_id = 'recipe-media-draft' and name like '00000000-0000-0000-0000-0000000d1801/%';
select ok((public.orphan_uploads(500) -> 'media') ? '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png',
          'D18 an unsubmitted upload older than 24 hours is listed for deletion');
insert into public.recipe_drafts (owner_id, category, step, payload)
values ('00000000-0000-0000-0000-0000000d1801', 'prompt', 3,
        '{"media":[{"path":"00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png"}]}');
select ok(not ((public.orphan_uploads(500) -> 'media') ? '00000000-0000-0000-0000-0000000d1801/00000000-0000-0000-0000-0000000d1814.png'),
          'D18 an upload kept in a saved draft is not deleted');

set local role authenticated;
select throws_ok($$ select public.media_sync_batch(1) $$, '42501', null, 'D18 clients cannot read the sync queue');
reset role;

select * from finish();
rollback;
