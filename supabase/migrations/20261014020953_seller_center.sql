-- W4 SELL / UP-08: 「고쳐서 다시 제출」 and 「새 버전 올리기」 start from the owner's latest version.
-- my_recipe_for_edit returns everything the wizard needs EXCEPT the original; the original comes from
-- my_recipe_original, which the app reads only in src/data/secrets.ts (hidden-content rule 1).
-- Both are owner-only (NOT_FOUND for anyone else, same as a missing recipe). They live in `public`
-- like the other owner RPCs; calling my_recipe_original directly only ever returns the caller's own
-- original, so the "secrets.ts only" rule is an app-side convention here, not a leak boundary.

create or replace function public.my_recipe_for_edit(p_recipe uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rec public.recipes%rowtype;
  v public.recipe_versions%rowtype;
  h jsonb;
begin
  select * into rec from public.recipes where id = p_recipe and owner_id = auth.uid();
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  select * into v from public.recipe_versions where recipe_id = rec.id order by version_no desc limit 1;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';   -- same answer as my_recipe_original
  end if;
  -- Header of the latest submission (it reaches `recipes` only on approval); seed rows have none.
  h := coalesce(v.header, jsonb_build_object(
    'title', rec.title, 'summary', rec.summary, 'search_tags', to_jsonb(rec.search_tags),
    'job_codes', to_jsonb(rec.job_codes), 'tool_codes', to_jsonb(rec.tool_codes), 'filters', rec.filters));
  return jsonb_build_object(
    'recipe_id', rec.id,
    'public_id', rec.public_id,
    'category', rec.category,
    'prompt_kind', rec.prompt_kind,
    'status', rec.status,
    'title', h ->> 'title',
    'summary', coalesce(h ->> 'summary', ''),
    'search_tags', coalesce(h -> 'search_tags', '[]'::jsonb),
    'job_codes', coalesce(h -> 'job_codes', '[]'::jsonb),
    'tool_codes', coalesce(h -> 'tool_codes', '[]'::jsonb),
    'version_no', v.version_no,
    'public_meta', coalesce(v.public_meta, '{}'::jsonb),
    'has_scripts', coalesce(v.has_scripts, false),
    'review_pending', exists (select 1 from public.review_queue q where q.recipe_id = rec.id and q.state = 'open'),
    -- The latest version's rejection, whatever the recipe status: a live recipe keeps serving v1
    -- while its rejected v2 waits to be fixed.
    'reject', (select jsonb_build_object('code', q.reject_code, 'note', q.reject_note)
                 from public.review_queue q
                where q.version_id = v.id and q.state = 'rejected'
                order by q.decided_at desc limit 1),
    'media', coalesce((select jsonb_agg(jsonb_build_object('path', m.storage_path, 'kind', m.kind, 'ratio', m.ratio,
                                                            'alt', m.alt_text, 'ai', m.is_ai_generated)
                                        order by vm.sort)
                         from public.recipe_version_media vm join public.media_assets m on m.id = vm.media_id
                        where vm.version_id = v.id and vm.role = 'result'), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('path', f.storage_path, 'filename', f.filename,
                                                            'size', f.size_bytes) order by f.sort)
                         from public.recipe_version_files f where f.version_id = v.id), '[]'::jsonb));
end;
$$;
revoke execute on function public.my_recipe_for_edit(uuid) from public, anon;
grant execute on function public.my_recipe_for_edit(uuid) to authenticated;

create or replace function public.my_recipe_original(p_recipe uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o jsonb;
begin
  select jsonb_build_object('prompt_body', s.prompt_body, 'skill_md', s.skill_md, 'agent_config', s.agent_config)
    into o
    from public.recipes r
    join lateral (select v.id from public.recipe_versions v where v.recipe_id = r.id
                   order by v.version_no desc limit 1) lv on true
    join public.recipe_version_secrets s on s.version_id = lv.id
   where r.id = p_recipe and r.owner_id = auth.uid();
  if o is null then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  return o;
end;
$$;
revoke execute on function public.my_recipe_original(uuid) from public, anon;
grant execute on function public.my_recipe_original(uuid) to authenticated;

-- my_recipes (from create_upload_and_review): the rejection shown is the latest version's, so a live
-- recipe with a rejected new version shows it too (it used to show only for status = 'rejected').
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
  left join lateral (select q.reject_code, q.reject_note
                       from public.recipe_versions lv
                       join public.review_queue q on q.version_id = lv.id and q.state = 'rejected'
                      where lv.recipe_id = r.id
                        and lv.version_no = (select max(x.version_no) from public.recipe_versions x where x.recipe_id = r.id)
                      order by q.decided_at desc limit 1) lr on true
  where r.owner_id = auth.uid()
  order by case r.status when 'rejected' then 0 when 'in_review' then 1 when 'private' then 2
                         when 'live' then 3 else 4 end,
           r.updated_at desc
$$;
revoke execute on function public.my_recipes(integer) from public, anon;
grant execute on function public.my_recipes(integer) to authenticated;
