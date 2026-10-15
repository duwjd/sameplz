-- W4 UP / SELL (MVP: free uploads only, D10): drafts, auto-check results, human review queue,
-- result media bucket, recipe views, share-link creation, owner dashboard.
-- Submission trust model: the server action runs the auto checks (layer 1 rules + layer 2 moderation)
-- and uploads files, then calls submit_recipe_version with the secret key. Clients can never call it,
-- so check results and storage paths cannot be forged from the browser.

-- ---------------------------------------------------------------- drafts (UP-08, F5-1)
create table public.recipe_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete cascade,      -- set when drafting a new version
  category text check (category in ('prompt', 'agent', 'skill')),
  step smallint not null default 1 check (step between 1 and 5),
  payload jsonb not null default '{}'::jsonb check (pg_column_size(payload) <= 262144),
  updated_at timestamptz not null default now()
);
-- One draft per new recipe and one per existing recipe.
create unique index recipe_drafts_new_key on public.recipe_drafts (owner_id) where recipe_id is null;
create unique index recipe_drafts_version_key on public.recipe_drafts (owner_id, recipe_id) where recipe_id is not null;
create index recipe_drafts_recipe_idx on public.recipe_drafts (recipe_id);
alter table public.recipe_drafts enable row level security;
revoke all on public.recipe_drafts from anon, authenticated;
grant select, insert, update, delete on public.recipe_drafts to authenticated;
create trigger recipe_drafts_touch before update on public.recipe_drafts
  for each row execute function private.touch_updated_at();

create policy recipe_drafts_select_own on public.recipe_drafts
  for select to authenticated using (owner_id = (select auth.uid()));
create policy recipe_drafts_insert_own on public.recipe_drafts
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.signup_complete())
              and (recipe_id is null or exists (select 1 from public.recipes r
                                                 where r.id = recipe_drafts.recipe_id and r.owner_id = (select auth.uid()))));
create policy recipe_drafts_update_own on public.recipe_drafts
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and (recipe_id is null or exists (select 1 from public.recipes r
                                                 where r.id = recipe_drafts.recipe_id and r.owner_id = (select auth.uid()))));
create policy recipe_drafts_delete_own on public.recipe_drafts
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------- auto checks (UP-07, F5-3, F5-4)
create table public.auto_checks (
  id bigint generated always as identity primary key,
  version_id uuid not null references public.recipe_versions (id) on delete cascade,
  layer smallint not null check (layer in (1, 2)),
  result text not null check (result in ('pass', 'review', 'fail')),
  findings jsonb not null default '[]'::jsonb,          -- [{code: 'R08', step, field, note}]
  checker text not null default '' check (char_length(checker) <= 80),
  created_at timestamptz not null default now()
);
create index auto_checks_version_idx on public.auto_checks (version_id);
alter table public.auto_checks enable row level security;
revoke all on public.auto_checks from anon, authenticated;
grant select on public.auto_checks to authenticated;
create policy auto_checks_select_owner on public.auto_checks
  for select to authenticated
  using (exists (select 1 from public.recipe_versions v join public.recipes r on r.id = v.recipe_id
                 where v.id = auto_checks.version_id and r.owner_id = (select auth.uid()))
         or (select private.is_admin()));

-- ---------------------------------------------------------------- reject codes (R01~R16, UP spec)
create or replace function private.is_reject_code(p_code text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select p_code ~ '^R(0[1-9]|1[0-6])$' $$;

-- ---------------------------------------------------------------- human review queue (D10, F5-6)
create table public.review_queue (
  id bigint generated always as identity primary key,
  version_id uuid not null references public.recipe_versions (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  reason text not null check (reason in ('agent', 'scripts', 'auto_check', 'moderation_unavailable')),
  requested_visibility text not null check (requested_visibility in ('public', 'private')),
  state text not null default 'open' check (state in ('open', 'approved', 'rejected')),
  reject_code text check (reject_code is null or private.is_reject_code(reject_code)),
  reject_note text check (char_length(reject_note) <= 500),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((state = 'rejected') = (reject_code is not null))
);
create unique index review_queue_open_version_key on public.review_queue (version_id) where state = 'open';
create index review_queue_recipe_idx on public.review_queue (recipe_id);
create index review_queue_open_idx on public.review_queue (created_at) where state = 'open';
alter table public.review_queue enable row level security;
revoke all on public.review_queue from anon, authenticated;
grant select on public.review_queue to authenticated;
create policy review_queue_select_admin on public.review_queue
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------- views (SELL F5-10)
-- One row per (recipe, visitor, KST day): views = rows. Written by the server (record_recipe_view).
create table public.recipe_views (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  day date not null,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  primary key (recipe_id, day, visitor_hash)
);
alter table public.recipe_views enable row level security;
revoke all on public.recipe_views from anon, authenticated;

-- ---------------------------------------------------------------- media bucket (UP-05)
-- Public: result media are shown on detail pages. Uploads only through server-signed upload URLs
-- (no storage.objects policies), path `{owner_id}/{uuid}.{ext}`.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-media', 'recipe-media', true, 52428800,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
-- MVP (D18 open): media of in-review / private / rejected recipes sit in this public bucket under
-- unguessable uuid paths; nothing sensitive is ever stored here.

-- Storage object present and under the owner's folder (paths are minted by the server).
create or replace function private.storage_object_ok(p_bucket text, p_path text, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path is not null
     and split_part(p_path, '/', 1) = p_owner::text
     and p_path !~ '(^/|\.\.)'
     and exists (select 1 from storage.objects o where o.bucket_id = p_bucket and o.name = p_path)
$$;
revoke execute on function private.storage_object_ok(text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- version header (D10 review gate)
-- Title, summary, tags, codes and filters travel with the version and reach `recipes` only when that
-- version becomes current (auto-pass or human approval), so a version under review never changes
-- what the public sees. Frozen like the other content columns once approved.
alter table public.recipe_versions add column header jsonb check (header is null or jsonb_typeof(header) = 'object');

create or replace function private.recipe_versions_freeze_header()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.approved_at is not null and new.header is distinct from old.header then
    raise exception using errcode = 'P0001', message = 'VERSION_FROZEN';
  end if;
  return new;
end;
$$;
create trigger recipe_versions_freeze_header before update of header on public.recipe_versions
  for each row execute function private.recipe_versions_freeze_header();

create or replace function private.apply_version_header(p_version uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.recipes r
     set title = v.header ->> 'title',
         summary = coalesce(v.header ->> 'summary', ''),
         search_tags = coalesce(array(select jsonb_array_elements_text(v.header -> 'search_tags')), '{}'),
         job_codes = array(select jsonb_array_elements_text(v.header -> 'job_codes')),
         tool_codes = coalesce(array(select jsonb_array_elements_text(v.header -> 'tool_codes')), '{}'),
         filters = coalesce(v.header -> 'filters', '{}'::jsonb)
    from public.recipe_versions v
   where v.id = p_version and r.id = v.recipe_id and v.header is not null
$$;
revoke execute on function private.apply_version_header(uuid) from public, anon, authenticated;

-- jsonb array of text → text[]; null when it is not an array or holds non-strings / nulls.
create or replace function private.text_array(p jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then '{}'::text[]
    when jsonb_typeof(p) <> 'array' then null
    when exists (select 1 from jsonb_array_elements(p) e where jsonb_typeof(e) <> 'string') then null
    else array(select btrim(e) from jsonb_array_elements_text(p) e)
  end
$$;
revoke execute on function private.text_array(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- submit (UP-01~08, F5-2, F5-6, F5-7)
create or replace function public.submit_recipe_version(p_owner uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.recipes%rowtype;
  is_new boolean := (p_payload ->> 'recipe_id') is null;
  v_category text := p_payload ->> 'category';
  v_visibility text := p_payload ->> 'visibility';
  v_changelog text := btrim(coalesce(p_payload ->> 'changelog', ''));
  v_has_scripts boolean := coalesce((p_payload ->> 'has_scripts')::boolean, false);
  v_jobs text[] := private.text_array(p_payload -> 'job_codes');
  v_tools text[] := private.text_array(p_payload -> 'tool_codes');
  v_tags text[] := private.text_array(p_payload -> 'search_tags');
  v_secret jsonb := coalesce(p_payload -> 'secret', '{}'::jsonb);
  v_header jsonb;
  v_version uuid;
  v_version_no integer;
  needs_review boolean;
  review_reason text;
  m jsonb;
  f jsonb;
  c jsonb;
  v_media uuid;
  i integer := 0;
begin
  if not exists (select 1 from public.profiles p where p.id = p_owner and p.deleted_at is null
                   and p.terms_accepted_at is not null and p.adult_confirmed_at is not null) then
    raise exception using errcode = 'P0001', message = 'SIGNUP_INCOMPLETE';
  end if;

  -- Shape and size (everything below is shown publicly or stored as the sold original).
  if jsonb_typeof(p_payload) <> 'object'
     or coalesce(jsonb_typeof(p_payload -> 'public_meta'), 'object') <> 'object'
     or coalesce(jsonb_typeof(p_payload -> 'filters'), 'object') <> 'object'
     or jsonb_typeof(v_secret) <> 'object'
     or coalesce(jsonb_typeof(p_payload -> 'media'), 'array') <> 'array'
     or coalesce(jsonb_typeof(p_payload -> 'files'), 'array') <> 'array'
     or coalesce(jsonb_typeof(p_payload -> 'checks'), 'array') <> 'array' then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYLOAD';
  end if;
  if pg_column_size(p_payload -> 'public_meta') > 32768 or pg_column_size(p_payload -> 'filters') > 2048
     or pg_column_size(v_secret) > 131072 then
    raise exception using errcode = 'P0001', message = 'PAYLOAD_TOO_LARGE';
  end if;
  if jsonb_array_length(coalesce(p_payload -> 'media', '[]'::jsonb)) < 1 then
    raise exception using errcode = 'P0001', message = 'R01';                 -- at least one result
  end if;
  if jsonb_array_length(p_payload -> 'media') > 8 or jsonb_array_length(coalesce(p_payload -> 'files', '[]'::jsonb)) > 50 then
    raise exception using errcode = 'P0001', message = 'TOO_MANY_FILES';
  end if;
  if char_length(v_changelog) > 500 then
    raise exception using errcode = 'P0001', message = 'CHANGELOG_TOO_LONG';
  end if;

  -- Checks the server ran: both layers present (layer 2 "unavailable" is recorded as review);
  -- a failed or result-less check never reaches the database.
  if exists (select 1 from jsonb_array_elements(coalesce(p_payload -> 'checks', '[]'::jsonb)) x
             where coalesce(x ->> 'result', '') not in ('pass', 'review')) then
    raise exception using errcode = 'P0001', message = 'CHECK_FAILED';
  end if;
  if (select count(distinct (x ->> 'layer')) from jsonb_array_elements(coalesce(p_payload -> 'checks', '[]'::jsonb)) x
       where x ->> 'layer' in ('1', '2')) <> 2 then
    raise exception using errcode = 'P0001', message = 'CHECKS_MISSING';
  end if;

  -- Codes and tags: no nulls, no duplicates, known codes only.
  if v_jobs is null or cardinality(v_jobs) not between 1 and 2 or array_position(v_jobs, null) is not null
     or cardinality(array(select distinct unnest(v_jobs))) <> cardinality(v_jobs)
     or exists (select 1 from unnest(v_jobs) j where not exists (select 1 from public.jobs x where x.code = j)) then
    raise exception using errcode = 'P0001', message = 'INVALID_JOB_CODES';
  end if;
  if v_tools is null or cardinality(v_tools) > 10
     or cardinality(array(select distinct unnest(v_tools))) <> cardinality(v_tools)
     or exists (select 1 from unnest(v_tools) t where not exists (select 1 from public.tools x where x.code = t)) then
    raise exception using errcode = 'P0001', message = 'INVALID_TOOL_CODES';
  end if;
  if v_tags is null or cardinality(v_tags) > 10
     or exists (select 1 from unnest(v_tags) t where char_length(t) not between 1 and 20)
     or cardinality(array(select distinct unnest(v_tags))) <> cardinality(v_tags) then
    raise exception using errcode = 'P0001', message = 'INVALID_TAGS';
  end if;

  if is_new then
    if v_category is null or v_category not in ('prompt', 'agent', 'skill') then
      raise exception using errcode = 'P0001', message = 'INVALID_CATEGORY';
    end if;
  else
    select * into rec from public.recipes where id = (p_payload ->> 'recipe_id')::uuid for update;
    if not found or rec.owner_id <> p_owner then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    if rec.status = 'stopped' then
      raise exception using errcode = 'P0001', message = 'RECIPE_STOPPED';
    end if;
    if v_category is not null and v_category <> rec.category then
      raise exception using errcode = 'P0001', message = 'CATEGORY_LOCKED';                -- F5-7
    end if;
    v_category := rec.category;
    if v_changelog = '' then
      raise exception using errcode = 'P0001', message = 'CHANGELOG_REQUIRED';             -- F5-7
    end if;
    if exists (select 1 from public.review_queue q where q.recipe_id = rec.id and q.state = 'open') then
      raise exception using errcode = 'P0001', message = 'REVIEW_PENDING';
    end if;
    -- A new version keeps the recipe's current visibility unless the owner chose one.
    v_visibility := coalesce(v_visibility, case when rec.status = 'private' then 'private' else 'public' end);
  end if;
  v_visibility := coalesce(v_visibility, 'public');
  if v_visibility not in ('public', 'private') then
    raise exception using errcode = 'P0001', message = 'INVALID_VISIBILITY';
  end if;

  -- The sold original matching the category.
  if (v_category = 'prompt' and nullif(btrim(coalesce(v_secret ->> 'prompt_body', '')), '') is null)
     or (v_category = 'skill' and nullif(btrim(coalesce(v_secret ->> 'skill_md', '')), '') is null)
     or (v_category = 'agent' and coalesce(jsonb_typeof(v_secret -> 'agent_config'), '') <> 'object') then
    raise exception using errcode = 'P0001', message = 'ORIGINAL_REQUIRED';
  end if;

  v_header := jsonb_build_object(
    'title', btrim(coalesce(p_payload ->> 'title', '')),
    'summary', btrim(coalesce(p_payload ->> 'summary', '')),
    'search_tags', to_jsonb(v_tags), 'job_codes', to_jsonb(v_jobs), 'tool_codes', to_jsonb(v_tools),
    'filters', coalesce(p_payload -> 'filters', '{}'::jsonb));

  if is_new then
    -- Not public until a version is approved (status in_review), so the header can go in now.
    insert into public.recipes (owner_id, category, prompt_kind, title, summary, search_tags, status,
                                job_codes, tool_codes, filters)
    values (p_owner, v_category, case when v_category = 'prompt' then p_payload ->> 'prompt_kind' end,
            v_header ->> 'title', v_header ->> 'summary', v_tags, 'in_review', v_jobs, v_tools,
            v_header -> 'filters')
    returning * into rec;
    v_version_no := 1;
  else
    -- Validate the header with the table's own checks without touching the live row.
    perform 1 where char_length(v_header ->> 'title') between 2 and 40 and char_length(v_header ->> 'summary') <= 60;
    if not found then
      raise exception using errcode = 'P0001', message = 'INVALID_HEADER';
    end if;
    select coalesce(max(version_no), 0) + 1 into v_version_no from public.recipe_versions where recipe_id = rec.id;
  end if;

  -- D10: agents and scripted skills always get a human; so does any layer that said "review".
  needs_review := rec.category = 'agent' or v_has_scripts
    or exists (select 1 from jsonb_array_elements(p_payload -> 'checks') x where x ->> 'result' = 'review');
  review_reason := case when rec.category = 'agent' then 'agent'
                        when v_has_scripts then 'scripts'
                        when exists (select 1 from jsonb_array_elements(p_payload -> 'checks') x
                                     where x ->> 'result' = 'review' and x ->> 'checker' = 'unavailable')
                          then 'moderation_unavailable'
                        else 'auto_check' end;

  insert into public.recipe_versions (recipe_id, version_no, changelog, review_status, public_meta, has_scripts,
                                      content_sha256, header)
  values (rec.id, v_version_no, case when v_changelog = '' then '첫 버전' else v_changelog end,
          case when needs_review then 'pending_review' else 'auto_passed' end,
          coalesce(p_payload -> 'public_meta', '{}'::jsonb), v_has_scripts,
          p_payload ->> 'content_sha256', v_header)
  returning id into v_version;

  insert into public.recipe_version_secrets (version_id, prompt_body, skill_md, agent_config)
  values (v_version, v_secret ->> 'prompt_body', v_secret ->> 'skill_md', v_secret -> 'agent_config');

  -- Files and media go in before approval (approved versions are frozen).
  for m in select * from jsonb_array_elements(p_payload -> 'media') loop
    if not private.storage_object_ok('recipe-media', m ->> 'path', p_owner) then
      raise exception using errcode = 'P0001', message = 'MEDIA_NOT_UPLOADED';
    end if;
    insert into public.media_assets (owner_id, storage_path, kind, ratio, is_ai_generated, source, alt_text)
    values (p_owner, m ->> 'path', m ->> 'kind', m ->> 'ratio', coalesce((m ->> 'ai')::boolean, true), 'upload',
            nullif(btrim(coalesce(m ->> 'alt', '')), ''))
    returning id into v_media;
    insert into public.recipe_version_media (version_id, media_id, role, sort) values (v_version, v_media, 'result', i);
    i := i + 1;
  end loop;
  i := 0;
  -- Paths are per version (`{owner}/{version}/…`, minted by the server): files are re-uploaded each version.
  for f in select * from jsonb_array_elements(coalesce(p_payload -> 'files', '[]'::jsonb)) loop
    if not private.storage_object_ok('recipe-files', f ->> 'path', p_owner) then
      raise exception using errcode = 'P0001', message = 'FILE_NOT_UPLOADED';
    end if;
    insert into public.recipe_version_files (version_id, filename, storage_path, size_bytes, sha256, sort)
    values (v_version, f ->> 'filename', f ->> 'path', (f ->> 'size')::integer, f ->> 'sha256', i);
    i := i + 1;
  end loop;
  for c in select * from jsonb_array_elements(p_payload -> 'checks') loop
    insert into public.auto_checks (version_id, layer, result, findings, checker)
    values (v_version, (c ->> 'layer')::smallint, c ->> 'result', coalesce(c -> 'findings', '[]'::jsonb),
            coalesce(c ->> 'checker', ''));
  end loop;

  if needs_review then
    insert into public.review_queue (version_id, recipe_id, reason, requested_visibility)
    values (v_version, rec.id, review_reason, v_visibility);
    -- Nothing approved yet → the recipe waits in review; a live recipe keeps serving its current version.
    if not exists (select 1 from public.recipe_versions v where v.recipe_id = rec.id and v.approved_at is not null) then
      update public.recipes set status = 'in_review', current_version_id = coalesce(rec.current_version_id, v_version)
       where id = rec.id;
    end if;
  else
    update public.recipe_versions set review_status = 'approved', approved_at = now() where id = v_version;
    perform private.apply_version_header(v_version);
    update public.recipes
       set current_version_id = v_version,
           status = case when v_visibility = 'public' then 'live' else 'private' end,
           published_at = case when v_visibility = 'public' then coalesce(published_at, now()) else published_at end
     where id = rec.id;
  end if;

  delete from public.recipe_drafts d
   where d.owner_id = p_owner and ((is_new and d.recipe_id is null) or d.recipe_id = rec.id);

  select * into rec from public.recipes where id = rec.id;
  return jsonb_build_object('recipe_id', rec.id, 'public_id', rec.public_id, 'version_id', v_version,
                            'version_no', v_version_no, 'status', rec.status, 'review', needs_review);
end;
$$;
revoke execute on function public.submit_recipe_version(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_recipe_version(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------- review decision (F5-6; UI in W6)
create or replace function public.admin_decide_review(p_actor uuid, p_version uuid, p_decision text,
                                                      p_code text default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.review_queue%rowtype;
  rec public.recipes%rowtype;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception using errcode = 'P0001', message = 'INVALID_DECISION';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'admin') then
    raise exception using errcode = 'P0001', message = 'NOT_ADMIN';
  end if;
  select * into q from public.review_queue where version_id = p_version and state = 'open' for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_IN_QUEUE';
  end if;
  select * into rec from public.recipes where id = q.recipe_id for update;

  if p_decision = 'approve' then
    update public.recipe_versions set review_status = 'approved', approved_at = now() where id = p_version;
    perform private.apply_version_header(p_version);
    -- A stopped recipe stays stopped (holders get the fixed version; reopening is an ops decision).
    update public.recipes
       set current_version_id = p_version,
           status = case when rec.status = 'stopped' then 'stopped'
                         when q.requested_visibility = 'public' then 'live' else 'private' end,
           published_at = case when q.requested_visibility = 'public' then coalesce(published_at, now())
                               else published_at end
     where id = rec.id;
    update public.review_queue set state = 'approved', decided_by = p_actor, decided_at = now() where id = q.id;
  else
    if p_code is null or not private.is_reject_code(p_code) then
      raise exception using errcode = 'P0001', message = 'REJECT_CODE_REQUIRED';
    end if;
    update public.recipe_versions set review_status = 'rejected' where id = p_version;
    -- Nothing approved yet → the recipe is rejected; otherwise the approved version keeps serving.
    if not exists (select 1 from public.recipe_versions v where v.recipe_id = rec.id and v.approved_at is not null) then
      update public.recipes set status = 'rejected' where id = rec.id;
    end if;
    update public.review_queue
       set state = 'rejected', reject_code = p_code, reject_note = p_note, decided_by = p_actor, decided_at = now()
     where id = q.id;
  end if;
  insert into public.admin_actions (actor_id, action, target_type, target_id, reason, detail)
  values (p_actor, 'review_' || p_decision, 'recipe_version', p_version::text,
          coalesce(nullif(btrim(p_note), ''), coalesce(p_code, 'approved')),
          jsonb_build_object('recipe_id', rec.id, 'code', p_code));
  select * into rec from public.recipes where id = rec.id;
  return jsonb_build_object('recipe_id', rec.id, 'public_id', rec.public_id, 'status', rec.status);
end;
$$;
revoke execute on function public.admin_decide_review(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_decide_review(uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------- visibility (SELL)
create or replace function public.set_recipe_visibility(p_recipe uuid, p_visibility text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.recipes%rowtype;
begin
  if p_visibility not in ('public', 'private') then
    raise exception using errcode = 'P0001', message = 'INVALID_VISIBILITY';
  end if;
  select * into rec from public.recipes where id = p_recipe and owner_id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if rec.status not in ('live', 'private') then
    raise exception using errcode = 'P0001', message = 'NOT_TOGGLEABLE';   -- in review / rejected / stopped
  end if;
  update public.recipes
     set status = case when p_visibility = 'public' then 'live' else 'private' end,
         published_at = case when p_visibility = 'public' then coalesce(published_at, now()) else published_at end
   where id = rec.id
   returning * into rec;
  return jsonb_build_object('recipe_id', rec.id, 'public_id', rec.public_id, 'status', rec.status);
end;
$$;
revoke execute on function public.set_recipe_visibility(uuid, text) from public, anon;
grant execute on function public.set_recipe_visibility(uuid, text) to authenticated;

-- ---------------------------------------------------------------- share links (F2-3 creation, F5-10)
create or replace function public.create_share_link(p_recipe uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.recipes%rowtype;
  v_id uuid;
begin
  if p_code is null or p_code !~ '^[a-z0-9]{6,12}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_CODE';
  end if;
  select * into rec from public.recipes where id = p_recipe and owner_id = auth.uid();
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if rec.status <> 'live' then
    raise exception using errcode = 'P0001', message = 'NOT_LIVE';
  end if;
  if (select count(*) from public.share_links l where l.recipe_id = rec.id) >= 20 then
    raise exception using errcode = 'P0001', message = 'TOO_MANY_LINKS';
  end if;
  insert into public.share_links (recipe_id, creator_id, code) values (rec.id, auth.uid(), p_code)
  on conflict (code) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception using errcode = 'P0001', message = 'CODE_TAKEN';
  end if;
  return jsonb_build_object('id', v_id, 'code', p_code);
end;
$$;
revoke execute on function public.create_share_link(uuid, text) from public, anon;
grant execute on function public.create_share_link(uuid, text) to authenticated;

-- ---------------------------------------------------------------- views (server only)
create or replace function public.record_recipe_view(p_public_id text, p_visitor_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.recipe_views (recipe_id, day, visitor_hash)
  select r.id, (now() at time zone 'Asia/Seoul')::date, p_visitor_hash
  from public.recipes r
  where r.public_id = p_public_id and r.status = 'live' and p_visitor_hash ~ '^[0-9a-f]{64}$'
  on conflict do nothing
$$;
revoke execute on function public.record_recipe_view(text, text) from public, anon, authenticated;
grant execute on function public.record_recipe_view(text, text) to service_role;

-- ---------------------------------------------------------------- owner dashboard (SELL-03, F5-10)
-- Order: rejected → in review → private → live (→ stopped). Stats for the last p_days (7/30/90).
create or replace function public.my_recipes(p_days integer default 30)
returns table (
  recipe_id uuid,
  public_id text,
  title text,
  category text,
  prompt_kind text,
  status text,
  version_no integer,
  pending_version_no integer,
  reject_code text,
  reject_note text,
  updated_at timestamptz,
  views bigint,
  downloads bigint,
  same_count bigint,
  link_clicks bigint,
  links jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with span as (
    select (now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 90))) as since,
           ((now() at time zone 'Asia/Seoul')::date - least(greatest(coalesce(p_days, 30), 1), 90)) as since_day
  )
  select r.id, r.public_id, r.title, r.category, r.prompt_kind, r.status,
         cv.version_no,
         (select v.version_no from public.review_queue q join public.recipe_versions v on v.id = q.version_id
           where q.recipe_id = r.id and q.state = 'open' order by q.created_at desc limit 1),
         lr.reject_code, lr.reject_note,
         r.updated_at,
         (select count(*) from public.recipe_views w, span where w.recipe_id = r.id and w.day > span.since_day),
         (select count(*) from public.entitlements e, span
           where e.recipe_id = r.id and e.revoked_at is null and e.source <> 'owner' and e.user_id <> r.owner_id
             and e.created_at >= span.since),
         (select count(*) from public.gallery_posts g, span
           where g.recipe_id = r.id and g.kind = 'same_cert' and g.status = 'visible' and g.created_at >= span.since),
         (select count(*) from public.share_link_clicks k join public.share_links l on l.id = k.link_id, span
           where l.recipe_id = r.id and k.created_at >= span.since),
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'code', l.code,
                   'clicks', (select count(*) from public.share_link_clicks k where k.link_id = l.id))
                   order by l.created_at), '[]'::jsonb)
           from public.share_links l where l.recipe_id = r.id)
  from public.recipes r
  left join public.recipe_versions cv on cv.id = r.current_version_id and cv.approved_at is not null
  left join lateral (select q.reject_code, q.reject_note from public.review_queue q
                     where q.recipe_id = r.id and q.state = 'rejected'
                     order by q.decided_at desc limit 1) lr on r.status = 'rejected'
  where r.owner_id = auth.uid()
  order by case r.status when 'rejected' then 0 when 'in_review' then 1 when 'private' then 2
                         when 'live' then 3 else 4 end,
           r.updated_at desc
$$;
revoke execute on function public.my_recipes(integer) from public, anon;
grant execute on function public.my_recipes(integer) to authenticated;

-- ---------------------------------------------------------------- retention
-- Views older than the longest dashboard window (90 days) are not needed.
select cron.schedule('sameplz-prune-views', '30 15 * * *',
  $$delete from public.recipe_views where day < ((now() at time zone 'Asia/Seoul')::date - 100)$$);
