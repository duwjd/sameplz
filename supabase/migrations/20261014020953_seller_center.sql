-- W4 SELL / UP-08: 「고쳐서 다시 제출」 and 「새 버전 올리기」 start from the owner's latest version.
-- my_recipe_for_edit returns everything the wizard needs EXCEPT the original; the original comes from
-- my_recipe_original, which the app reads only in src/data/secrets.ts (hidden-content rule 1).
-- Both are owner-only (NOT_FOUND for anyone else, same as a missing recipe).

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
    'reject', (select jsonb_build_object('code', q.reject_code, 'note', q.reject_note)
                 from public.review_queue q
                where q.recipe_id = rec.id and q.state = 'rejected' and rec.status = 'rejected'
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
