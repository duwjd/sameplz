-- W6 GAL (F6-1~3, F4-11): gallery feed, SAME 인증 posting through the server (image re-check first),
-- fork origin, reports, and the blank-prompt text kept for 「이 프롬프트로 레시피 올리기」.

-- ---------------------------------------------------------------- SAME 인증 only through the server
-- A direct client insert would skip the image re-check (F6-3): posting is server-only now.
drop policy if exists gallery_posts_insert_same_cert on public.gallery_posts;

-- Post a SAME 인증 for p_user (service_role; the action checks the session, moderation decides the
-- status). The image is the user's upload in the draft bucket, or a copy of their own playground
-- result (then generated_here). Rate: 10 per user per hour.
create or replace function public.post_same_cert(
  p_user uuid, p_recipe uuid, p_media_path text, p_kind text, p_ratio text, p_alt text, p_title text,
  p_play_cell uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ent uuid;
  v_version uuid;
  v_media uuid;
  v_post uuid;
  v_here boolean := false;
begin
  if p_status is null or p_status not in ('visible', 'pending_review') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 40
     or p_kind is null or p_kind not in ('image', 'video')
     or (p_ratio is not null and p_ratio not in ('1/1', '3/4', '4/3', '4/5', '9/16', '16/9')) then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user and p.deleted_at is null
                   and p.terms_accepted_at is not null and p.adult_confirmed_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'SIGNUP_INCOMPLETE');
  end if;
  -- Received (active entitlement) and the recipe is public (live) — F6-1.
  select e.id, e.version_id into v_ent, v_version
    from public.entitlements e join public.recipes r on r.id = e.recipe_id
   where e.user_id = p_user and e.recipe_id = p_recipe and e.revoked_at is null and r.status = 'live';
  if v_ent is null then
    return jsonb_build_object('ok', false, 'reason', 'NOT_ENTITLED');
  end if;
  if not private.storage_object_ok('recipe-media', p_media_path, p_user) then
    return jsonb_build_object('ok', false, 'reason', 'MEDIA_NOT_UPLOADED');
  end if;
  if p_play_cell is not null then
    -- 「여기서 생성」: the user's own succeeded cell from a run of this recipe.
    if not exists (select 1 from public.play_cells c join public.play_runs r on r.id = c.run_id
                     join public.recipe_versions v on v.id = r.recipe_version_id
                    where c.id = p_play_cell and c.user_id = p_user and c.status = 'succeeded'
                      and v.recipe_id = p_recipe) then
      return jsonb_build_object('ok', false, 'reason', 'NOT_ENTITLED');
    end if;
    v_here := true;
  end if;
  if not private.hit_rate_limit('same_cert:user:' || p_user, 10, interval '1 hour') then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMITED');
  end if;

  insert into public.media_assets (owner_id, storage_path, kind, ratio, is_ai_generated, source, alt_text)
  values (p_user, p_media_path, p_kind, p_ratio, true, case when v_here then 'playground' else 'upload' end,
          nullif(btrim(coalesce(p_alt, '')), ''))
  returning id into v_media;
  insert into public.gallery_posts (author_id, recipe_id, version_id, kind, entitlement_id, generated_here,
                                    media_id, title, ratio, status)
  values (p_user, p_recipe, v_version, 'same_cert', v_ent, v_here, v_media, btrim(p_title), p_ratio, p_status)
  returning id into v_post;
  return jsonb_build_object('ok', true, 'post_id', v_post, 'status', p_status);
end;
$$;
revoke execute on function public.post_same_cert(uuid, uuid, text, text, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.post_same_cert(uuid, uuid, text, text, text, text, text, uuid, text) to service_role;

-- ---------------------------------------------------------------- gallery feed (GAL-01)
-- Newest first (a new SAME 인증 lands on top). Cursor = (created_at, id) of the last row.
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
revoke execute on function public.gallery_feed(text, timestamptz, uuid, integer, uuid) from public;
grant execute on function public.gallery_feed(text, timestamptz, uuid, integer, uuid) to anon, authenticated;
create index if not exists gallery_posts_feed_idx on public.gallery_posts (created_at desc, id desc) where status = 'visible';

-- ---------------------------------------------------------------- fork origin (F6-2)
-- After a fork draft is submitted as a new recipe: remember where it came from. Only a new recipe of
-- p_owner without an origin, from a live recipe that allows forks.
create or replace function public.set_recipe_fork(p_owner uuid, p_recipe uuid, p_from_recipe uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from_version uuid;
begin
  select current_version_id into v_from_version from public.recipes
   where id = p_from_recipe and status = 'live' and fork_allowed and owner_id <> p_owner;
  if v_from_version is null then
    return false;
  end if;
  update public.recipes set forked_from_recipe_id = p_from_recipe, forked_from_version_id = v_from_version
   where id = p_recipe and owner_id = p_owner and forked_from_recipe_id is null and id <> p_from_recipe;
  return found;
end;
$$;
revoke execute on function public.set_recipe_fork(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_recipe_fork(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------- reports (F6-3, ACTV-04, F8-2)
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('recipe', 'post')),
  target_id uuid not null,
  reason text not null check (reason in ('misleading', 'malicious', 'rights', 'prohibited')),
  detail text not null default '' check (char_length(detail) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  answer text check (char_length(answer) <= 500),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index reports_one_open_per_target on public.reports (reporter_id, target_type, target_id) where status = 'open';
create index reports_open_idx on public.reports (created_at) where status = 'open';
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
create policy reports_select_own on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- Report a visible recipe or gallery post. 10 per user per day; one open report per target.
create or replace function public.create_report(p_target_type text, p_target uuid, p_reason text, p_detail text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null or not exists (select 1 from public.profiles p where p.id = v_user and p.deleted_at is null
                                     and p.terms_accepted_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'LOGIN_REQUIRED');
  end if;
  if p_target_type not in ('recipe', 'post') or p_reason not in ('misleading', 'malicious', 'rights', 'prohibited')
     or char_length(coalesce(p_detail, '')) > 500 then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_INPUT');
  end if;
  if (p_target_type = 'recipe' and not exists (select 1 from public.recipes r where r.id = p_target and r.status in ('live', 'stopped')))
     or (p_target_type = 'post' and not exists (select 1 from public.gallery_posts g where g.id = p_target and g.status = 'visible')) then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  if exists (select 1 from public.reports where reporter_id = v_user and target_type = p_target_type
               and target_id = p_target and status = 'open') then
    return jsonb_build_object('ok', false, 'reason', 'ALREADY_REPORTED');
  end if;
  if not private.hit_rate_limit('report:user:' || v_user, 10, interval '1 day', private.kst_day_start()) then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMITED');
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, detail)
  values (v_user, p_target_type, p_target, p_reason, coalesce(btrim(p_detail), ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'report_id', v_id);
end;
$$;
revoke execute on function public.create_report(text, uuid, text, text) from public, anon;
grant execute on function public.create_report(text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- blank-prompt text (F4-11)
-- The user's own blank prompt (not a recipe original), kept so a result can become an upload draft.
alter table public.play_runs add column prompt_text text check (char_length(prompt_text) <= 4000);
create or replace function public.set_run_prompt_text(p_run uuid, p_user uuid, p_text text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.play_runs set prompt_text = p_text
   where id = p_run and user_id = p_user and mode = 'blank' and prompt_text is null
  returning true
$$;
revoke execute on function public.set_run_prompt_text(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_run_prompt_text(uuid, uuid, text) to service_role;
