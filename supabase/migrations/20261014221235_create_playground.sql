-- W5 playground (PLAY, F4-1~5, F4-7~9, D8 fal · D12 cap · D17 · D19).
-- Pipeline: .claude/skills/generation-pipeline (failure matrix FM-1~24). Money rules: .claude/rules/money.md.
-- Every money-path function is security definer, search_path '', and server-only (service_role) except
-- the read-only quote and the owner's own save / notice actions.
-- credit_holds.cell_id stays FK-less: credits.test.sql holds arbitrary cell ids, and holds are only
-- created through start_run below (place_hold is private), which always inserts the cell first.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------- models and prices
create table public.models (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9.-]{1,40}$'),
  provider text not null check (provider in ('fal', 'mock')),
  label text not null check (char_length(label) between 1 and 40),
  kind text not null check (kind in ('image', 'video')),
  endpoint text not null,
  -- Endpoint used when reference images are attached (edit / image-to-video); null = no references.
  ref_endpoint text,
  ref_param text,
  ref_max integer not null default 0 check (ref_max between 0 and 4),
  -- { "<provider param>": { "label": "…", "values": [...], "default": v } }
  params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  deadline_seconds integer not null check (deadline_seconds between 60 and 7200),
  enabled boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  check ((ref_endpoint is null) = (ref_param is null)),
  check ((ref_endpoint is null) = (ref_max = 0))
);
alter table public.models enable row level security;
revoke all on public.models from anon, authenticated;
grant select on public.models to anon, authenticated;
create policy models_select_enabled on public.models for select to anon, authenticated using (enabled);

-- rule: { "unit": "image"|"second", "keys": ["quality", …], "usd": { "medium|1024x1024": 0.053 },
--         "per_reference_usd": 0.01 }   usd keys = values of `keys` joined with '|'.
create table public.model_prices (
  model_id text not null references public.models (id) on delete cascade,
  price_version integer not null check (price_version > 0),
  rule jsonb not null check (rule ? 'unit' and rule ? 'keys' and rule ? 'usd'
                             and rule ->> 'unit' in ('image', 'second')
                             and jsonb_typeof(rule -> 'keys') = 'array' and jsonb_typeof(rule -> 'usd') = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (model_id, price_version)
);
create unique index model_prices_one_active on public.model_prices (model_id) where active;
alter table public.model_prices enable row level security;
revoke all on public.model_prices from anon, authenticated;

-- A price version never changes once written (F4-1): new prices are a new version; only `active` toggles.
create or replace function private.model_prices_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.model_id <> old.model_id or new.price_version <> old.price_version or new.rule <> old.rule then
    raise exception using errcode = 'P0001', message = 'PRICE_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke execute on function private.model_prices_immutable() from public, anon, authenticated;
create trigger model_prices_immutable before update on public.model_prices
  for each row execute function private.model_prices_immutable();

-- One cell = one image or one video. Unknown keys / disallowed values / missing price → INVALID_PARAMS.
-- credits = ceil(USD × 805) (D17), at least 1. Returns the filled params too.
create or replace function private.quote_cell(p_model text, p_params jsonb, p_refs integer default 0)
returns table (credits integer, price_version integer, params jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m public.models%rowtype;
  pr public.model_prices%rowtype;
  filled jsonb := '{}'::jsonb;
  k text;
  v jsonb;
  key text;
  usd numeric;
begin
  select * into m from public.models where id = p_model and enabled;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
  end if;
  if p_params is null then
    p_params := '{}'::jsonb;
  end if;
  if jsonb_typeof(p_params) <> 'object' or coalesce(p_refs, 0) < 0 or coalesce(p_refs, 0) > m.ref_max then
    raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
  end if;
  for k in select jsonb_object_keys(p_params) loop
    if not m.params ? k then
      raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
    end if;
  end loop;
  for k in select jsonb_object_keys(m.params) loop
    v := coalesce(p_params -> k, m.params -> k -> 'default');
    if v is null or not ((m.params -> k -> 'values') @> jsonb_build_array(v)) then
      raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
    end if;
    filled := filled || jsonb_build_object(k, v);
  end loop;

  select * into pr from public.model_prices where model_id = p_model and active;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
  end if;
  select string_agg(coalesce(filled -> x.k #>> '{}', ''), '|' order by x.ord) into key
    from jsonb_array_elements_text(pr.rule -> 'keys') with ordinality as x(k, ord);
  usd := (pr.rule -> 'usd' ->> coalesce(key, ''))::numeric;
  if usd is null then
    raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
  end if;
  if pr.rule ->> 'unit' = 'second' then
    usd := usd * (filled ->> 'duration')::numeric;
    if usd is null then   -- per-second price without a duration (catalog error): never price it at 1C
      raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
    end if;
  end if;
  usd := usd + coalesce((pr.rule ->> 'per_reference_usd')::numeric, 0) * coalesce(p_refs, 0);
  credits := greatest(1, ceil(usd * 805))::integer;
  price_version := pr.price_version;
  params := filled;
  return next;
end;
$$;

-- p_cells: [{model, params, count}] — ≤3 distinct models, count 1~4 (video 1), ≤12 cells.
create or replace function private.quote_cells(p_cells jsonb, p_refs integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c jsonb;
  q record;
  n integer;
  total integer := 0;
  ncells integer := 0;
  out_cells jsonb := '[]'::jsonb;
  versions jsonb := '{}'::jsonb;
  kind text;
begin
  if p_cells is null or jsonb_typeof(p_cells) <> 'array' or jsonb_array_length(p_cells) not between 1 and 3 then
    raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
  end if;
  if (select count(distinct e ->> 'model') from jsonb_array_elements(p_cells) e) <> jsonb_array_length(p_cells) then
    raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
  end if;
  for c in select * from jsonb_array_elements(p_cells) loop
    if jsonb_typeof(c) <> 'object' or jsonb_typeof(c -> 'model') <> 'string' then
      raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
    end if;
    n := case when c -> 'count' is null then 1
              when jsonb_typeof(c -> 'count') = 'number' and (c ->> 'count')::numeric between 1 and 4
                   and (c ->> 'count')::numeric = trunc((c ->> 'count')::numeric)
                then (c ->> 'count')::numeric::integer end;
    select m.kind into kind from public.models m where m.id = c ->> 'model';
    if n is null or n < 1 or n > 4 or (kind = 'video' and n <> 1) then
      raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
    end if;
    select * into q from private.quote_cell(c ->> 'model', c -> 'params', p_refs);
    total := total + q.credits * n;
    ncells := ncells + n;
    out_cells := out_cells || jsonb_build_array(jsonb_build_object(
      'model', c ->> 'model', 'params', q.params, 'credits', q.credits, 'count', n));
    versions := versions || jsonb_build_object(c ->> 'model', q.price_version);
  end loop;
  if ncells > 12 then
    raise exception using errcode = 'P0001', message = 'INVALID_PARAMS';
  end if;
  return jsonb_build_object('total', total, 'cells', out_cells, 'price_versions', versions);
end;
$$;

-- Read-only estimate for the run bar (F4-1). The server recomputes it inside start_run.
create or replace function public.quote_play(p_cells jsonb, p_refs integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q jsonb := private.quote_cells(p_cells, p_refs);
  lim integer := (select daily_limit from private.credit_policy());
  remaining integer := greatest(lim - coalesce(private.used_today((select auth.uid())), 0), 0);
begin
  return q || jsonb_build_object(
    'cells', (select jsonb_agg(e || jsonb_build_object('exceeds_daily_limit', (e ->> 'credits')::integer > lim)
                               order by o)
                from jsonb_array_elements(q -> 'cells') with ordinality as x(e, o)),
    'daily_limit', lim, 'remaining_today', remaining,
    'exceeds_remaining', (q ->> 'total')::integer > remaining);
end;
$$;

-- ---------------------------------------------------------------- runs and cells
create table public.play_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('own', 'free', 'blank')),
  recipe_version_id uuid references public.recipe_versions (id) on delete set null,
  client_request_id uuid not null,
  variables jsonb not null default '{}'::jsonb check (jsonb_typeof(variables) = 'object'),
  reference_ids uuid[] not null default '{}',
  face_consent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, client_request_id),
  check (mode <> 'blank' or recipe_version_id is null)
);
create index play_runs_user_idx on public.play_runs (user_id, created_at desc);
create index play_runs_recipe_version_idx on public.play_runs (recipe_version_id) where recipe_version_id is not null;

create table public.play_cells (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.play_runs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  model_id text not null references public.models (id),
  params jsonb not null,
  price_credits integer not null check (price_credits > 0),
  price_version integer not null,
  status text not null default 'queued'
    check (status in ('queued', 'submitted', 'running', 'succeeded', 'failed', 'blocked', 'canceled', 'expired')),
  error_code text check (error_code is null or error_code ~ '^[A-Z_]{2,40}$'),
  provider_request_id text unique,
  webhook_token_hash text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  submitted_at timestamptz,
  deadline_at timestamptz,
  finished_at timestamptz,
  result_path text,
  saved_at timestamptz,
  delete_after timestamptz,
  created_at timestamptz not null default now()
);
alter table public.play_cells add constraint play_cells_price_fk
  foreign key (model_id, price_version) references public.model_prices (model_id, price_version);
create index play_cells_run_idx on public.play_cells (run_id);
create index play_cells_user_idx on public.play_cells (user_id, created_at desc);
create index play_cells_model_price_idx on public.play_cells (model_id, price_version);
create index play_cells_queued_idx on public.play_cells (next_attempt_at) where status = 'queued';
create index play_cells_deadline_idx on public.play_cells (deadline_at) where status in ('submitted', 'running');
create index play_cells_delete_idx on public.play_cells (delete_after) where result_path is not null and saved_at is null;

-- Rendered prompts never leave this table except through play_prompt_for_submit (src/data/secrets.ts).
create table private.play_prompts (
  run_id uuid primary key references public.play_runs (id) on delete cascade,
  rendered text not null check (char_length(rendered) between 1 and 8000)
);
alter table private.play_prompts enable row level security;   -- no policies (hidden-content)
revoke all on private.play_prompts from public, anon, authenticated;

create table public.play_refs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  path text not null unique,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  size integer not null check (size between 1 and 10485760),
  created_at timestamptz not null default now(),
  delete_after timestamptz not null default now() + interval '24 hours'
);
create index play_refs_delete_idx on public.play_refs (delete_after);
create index play_refs_user_idx on public.play_refs (user_id);

create table public.face_consents (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.play_runs (id) on delete cascade,
  ref_id uuid references public.play_refs (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  notice_version text not null default 'play-face-v1',
  consented_at timestamptz not null default now()
);
create index face_consents_run_idx on public.face_consents (run_id);
create index face_consents_user_idx on public.face_consents (user_id);
create index face_consents_ref_idx on public.face_consents (ref_id);
-- Consent evidence (F4-8): append-only like consent_events.
create trigger face_consents_append_only before update or delete on public.face_consents
  for each row execute function private.reject_update_delete();

create table public.generation_webhook_inbox (
  provider text not null,
  event_key text not null,
  cell_id uuid references public.play_cells (id) on delete set null,
  received_at timestamptz not null default now(),
  primary key (provider, event_key)
);
create index generation_webhook_inbox_cell_idx on public.generation_webhook_inbox (cell_id);
create index generation_webhook_inbox_received_idx on public.generation_webhook_inbox (received_at);

alter table public.play_runs enable row level security;
alter table public.play_cells enable row level security;
alter table public.play_refs enable row level security;
alter table public.face_consents enable row level security;
alter table public.generation_webhook_inbox enable row level security;
revoke all on public.play_runs, public.play_cells, public.play_refs, public.face_consents,
  public.generation_webhook_inbox from anon, authenticated;
revoke all on sequence public.face_consents_id_seq from anon, authenticated;
grant select on public.play_runs to authenticated;
-- Token hash and provider id stay server-side.
grant select (id, run_id, model_id, params, price_credits, status, error_code, result_path, saved_at,
              delete_after, finished_at, created_at) on public.play_cells to authenticated;
grant select (id, path, mime, created_at, delete_after) on public.play_refs to authenticated;
create policy play_runs_select_own on public.play_runs for select to authenticated
  using (user_id = (select auth.uid()));
create policy play_cells_select_own on public.play_cells for select to authenticated
  using (user_id = (select auth.uid()));
create policy play_refs_select_own on public.play_refs for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- storage (D19)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('play-refs', 'play-refs', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
       ('play-results', 'play-results', false, 52428800,
        array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------- realtime (F4-4)
-- Private broadcast channel run:{id}: only the run's owner may receive.
create policy play_run_owner_receives on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (select 1 from public.play_runs r
                 where r.user_id = (select auth.uid()) and 'run:' || r.id::text = (select realtime.topic()))
  );

-- ---------------------------------------------------------------- start_run (F4-2, FM-1/18/20)
create or replace function public.start_run(
  p_user uuid, p_client_request_id uuid, p_mode text, p_recipe_version_id uuid, p_variables jsonb,
  p_cells jsonb, p_price_versions jsonb, p_reference_ids uuid[], p_face_consent boolean,
  p_rendered_prompt text, p_ip_hash text, p_device_hash text, p_expected_total integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid;
  v_cell uuid;
  ids uuid[] := '{}';
  refs integer := coalesce(cardinality(p_reference_ids), 0);
  q jsonb;
  total integer;
  reason text;
  c jsonb;
  i integer;
  hold jsonb;
  detail text;
begin
  if p_user is null or p_client_request_id is null or p_rendered_prompt is null
     or char_length(btrim(p_rendered_prompt)) = 0 or char_length(p_rendered_prompt) > 8000
     or p_mode is null or p_mode not in ('own', 'free', 'blank')
     or (p_variables is not null and jsonb_typeof(p_variables) <> 'object') then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_PARAMS');
  end if;

  -- One run per (user, client_request_id): serialize the user's starts on the account row.
  perform private.ensure_credit_account(p_user);
  perform 1 from public.credit_accounts where user_id = p_user for update;
  select id into v_run from public.play_runs where user_id = p_user and client_request_id = p_client_request_id;
  if v_run is not null then
    return jsonb_build_object('ok', true, 'existing', true, 'run_id', v_run,
      'cell_ids', (select coalesce(jsonb_agg(id order by created_at, id), '[]'::jsonb)
                     from public.play_cells where run_id = v_run));
  end if;

  if not exists (select 1 from public.profiles where id = p_user and ai_notice_ack_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'AI_NOTICE_REQUIRED');
  end if;

  -- Mode: own recipe / received free recipe / blank prompt. Only prompt recipes run here.
  if p_mode = 'blank' then
    if p_recipe_version_id is not null then
      return jsonb_build_object('ok', false, 'reason', 'NOT_ENTITLED');
    end if;
  elsif p_mode = 'own' then
    if not exists (select 1 from public.recipe_versions v join public.recipes r on r.id = v.recipe_id
                    where v.id = p_recipe_version_id and r.owner_id = p_user and r.category = 'prompt') then
      return jsonb_build_object('ok', false, 'reason', 'NOT_ENTITLED');
    end if;
  else
    if not exists (select 1 from public.recipe_versions v
                     join public.recipes r on r.id = v.recipe_id
                     join public.entitlements e on e.recipe_id = r.id
                    where v.id = p_recipe_version_id and v.review_status = 'approved' and r.category = 'prompt'
                      and r.status = 'live' and e.user_id = p_user and e.revoked_at is null) then
      return jsonb_build_object('ok', false, 'reason', 'NOT_ENTITLED');
    end if;
  end if;

  if refs > 0 then
    if refs > 4 or (select count(distinct x) from unnest(p_reference_ids) x) <> refs
       or (select count(*) from public.play_refs f
            where f.id = any (p_reference_ids) and f.user_id = p_user and f.delete_after > now()) <> refs
       or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_cells) = 'array' then p_cells else '[]' end) e
                   left join public.models m on m.id = e ->> 'model'
                   where m.id is null or m.ref_max < refs) then
      return jsonb_build_object('ok', false, 'reason', 'INVALID_REFERENCE');
    end if;
    if not coalesce(p_face_consent, false) then
      return jsonb_build_object('ok', false, 'reason', 'FACE_CONSENT_REQUIRED');
    end if;
  end if;

  begin
    q := private.quote_cells(p_cells, refs);
  exception when sqlstate 'P0001' then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_PARAMS');
  end;
  if p_price_versions is null or q -> 'price_versions' <> p_price_versions then
    return jsonb_build_object('ok', false, 'reason', 'PRICE_CHANGED');
  end if;
  total := (q ->> 'total')::integer;
  -- The quote the user saw (F4-1): also catches a changed default or allowed value within a price version.
  if p_expected_total is not null and p_expected_total <> total then
    return jsonb_build_object('ok', false, 'reason', 'PRICE_CHANGED');
  end if;

  reason := private.check_run_allowed(p_user, total, p_ip_hash, p_device_hash);   -- rate buckets persist
  if reason is not null then
    if reason = 'INSUFFICIENT_CREDITS' then
      return jsonb_build_object('ok', false, 'reason', reason,
                                'shortfall', total - private.spendable_credits(p_user));
    end if;
    return jsonb_build_object('ok', false, 'reason', reason);
  end if;

  -- All or nothing: any failed hold rolls the whole block back (run, cells, prompt, holds, budget).
  begin
    insert into public.play_runs (user_id, mode, recipe_version_id, client_request_id, variables,
                                  reference_ids, face_consent_at)
    values (p_user, p_mode, p_recipe_version_id, p_client_request_id, coalesce(p_variables, '{}'::jsonb),
            coalesce(p_reference_ids, '{}'), case when refs > 0 then now() end)
    returning id into v_run;
    insert into private.play_prompts (run_id, rendered) values (v_run, p_rendered_prompt);
    if refs > 0 then
      insert into public.face_consents (run_id, ref_id, user_id) select v_run, x, p_user from unnest(p_reference_ids) x;
    end if;
    for c in select * from jsonb_array_elements(q -> 'cells') loop
      for i in 1 .. (c ->> 'count')::integer loop
        insert into public.play_cells (run_id, user_id, model_id, params, price_credits, price_version)
        values (v_run, p_user, c ->> 'model', c -> 'params', (c ->> 'credits')::integer,
                (q -> 'price_versions' ->> (c ->> 'model'))::integer)
        returning id into v_cell;
        hold := private.place_hold(v_cell, p_user, (c ->> 'credits')::integer);
        if not coalesce((hold ->> 'ok')::boolean, false) then
          raise exception using errcode = 'P0001', message = 'HOLD_FAILED', detail = hold::text;
        end if;
        ids := ids || v_cell;
      end loop;
    end loop;
  exception when sqlstate 'P0001' then
    get stacked diagnostics detail = pg_exception_detail;
    if sqlerrm = 'HOLD_FAILED' then
      if detail::jsonb ->> 'reason' = 'INSUFFICIENT_CREDITS' then   -- shortfall for the whole run
        return jsonb_build_object('ok', false, 'reason', 'INSUFFICIENT_CREDITS',
                                  'shortfall', greatest(total - private.spendable_credits(p_user), 1));
      end if;
      return jsonb_build_object('ok', false, 'reason', detail::jsonb ->> 'reason');
    end if;
    raise;
  end;
  return jsonb_build_object('ok', true, 'existing', false, 'run_id', v_run, 'cell_ids', to_jsonb(ids),
                            'total', total);
end;
$$;

-- ---------------------------------------------------------------- terminal transition (F4-5, FM-4~9/14)
-- The only exit for a cell: claim the terminal state once, settle once, broadcast the whitelist only.
-- Each call is its own transaction: never finish cells of several users in one call (lock order
-- cell → account → generation_budget would deadlock with start_run and the monthly grant).
create or replace function public.finish_cell(p_cell uuid, p_status text, p_error_code text default null,
                                              p_result_path text default null, p_provider_billed boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.play_cells%rowtype;
  s jsonb;
  outcome text;
  code text := case when p_error_code ~ '^[A-Z_]{2,40}$' then p_error_code
                    when p_error_code is not null then 'PROVIDER_ERROR' end;
begin
  if p_status is null or p_status not in ('succeeded', 'failed', 'blocked', 'canceled', 'expired') then
    raise exception using errcode = 'P0001', message = 'INVALID_OUTCOME';
  end if;
  if p_status = 'succeeded' and p_result_path is null then
    raise exception using errcode = 'P0001', message = 'RESULT_REQUIRED';
  end if;
  update public.play_cells
     set status = p_status,
         error_code = case when p_status = 'succeeded' then null else code end,
         result_path = case when p_status = 'succeeded' then p_result_path end,
         finished_at = now(),
         delete_after = case when p_status = 'succeeded' then created_at + interval '30 days' end
   where id = p_cell and status in ('queued', 'submitted', 'running')
  returning * into c;
  if not found then
    return jsonb_build_object('finished', false, 'captured', 0);   -- duplicate / late event (FM-9)
  end if;
  outcome := case p_status when 'succeeded' then 'success' when 'blocked' then 'safety_blocked'
                           when 'canceled' then 'canceled' else 'model_error' end;
  s := private.settle_cell(p_cell, outcome);
  -- The user gets the credits back, but a provider that billed anyway still spends the budget (D12).
  if coalesce(p_provider_billed, false) and p_status <> 'succeeded' then
    update public.generation_budget
       set spent = spent + c.price_credits, updated_at = now()
     where month = (select private.kst_month(h.created_at) from public.credit_holds h where h.cell_id = p_cell);
  end if;
  if p_status = 'blocked' then
    perform private.record_moderation_block(c.user_id);
  end if;
  -- The rendered prompt is only needed while a cell may still be (re)submitted.
  if not exists (select 1 from public.play_cells x
                  where x.run_id = c.run_id and x.status in ('queued', 'submitted', 'running')) then
    delete from private.play_prompts where run_id = c.run_id;
  end if;
  begin   -- a UI hint: never let a failed broadcast undo the settlement
    perform realtime.send(jsonb_build_object('cell_id', c.id, 'status', c.status, 'error_code', c.error_code),
                          'cell', 'run:' || c.run_id::text, true);
  exception when others then
    null;
  end;
  return jsonb_build_object('finished', true, 'captured', coalesce((s ->> 'captured')::integer, 0));
end;
$$;

-- ---------------------------------------------------------------- submission (FM-10/17/21)
create or replace function public.claim_cell_submit(p_cell uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.play_cells%rowtype;
  m public.models%rowtype;
  r public.play_runs%rowtype;
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select * into c from public.play_cells where id = p_cell for update;
  if not found or c.status <> 'queued' or c.next_attempt_at > now() then
    return jsonb_build_object('ok', false, 'reason', 'NOT_QUEUED');
  end if;
  if c.attempts >= 3 then
    perform public.finish_cell(p_cell, 'failed', 'PROVIDER_UNAVAILABLE');
    return jsonb_build_object('ok', false, 'reason', 'EXHAUSTED');
  end if;
  update public.play_cells
     set attempts = attempts + 1, webhook_token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex'),
         next_attempt_at = now() + interval '5 minutes'   -- lease: a crash before mark_cell_submitted retries later
   where id = p_cell;
  select * into m from public.models where id = c.model_id;
  select * into r from public.play_runs where id = c.run_id;
  return jsonb_build_object('ok', true, 'token', token, 'provider', m.provider, 'kind', m.kind,
    'endpoint', case when cardinality(r.reference_ids) > 0 then m.ref_endpoint else m.endpoint end,
    'ref_param', case when cardinality(r.reference_ids) > 0 then m.ref_param end,
    'model_id', c.model_id, 'params', c.params, 'run_id', c.run_id, 'user_id', c.user_id,
    'reference_ids', to_jsonb(r.reference_ids), 'attempt', c.attempts + 1);
end;
$$;

create or replace function public.mark_cell_submitted(p_cell uuid, p_provider_request_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.play_cells c
     set status = 'submitted', provider_request_id = coalesce(c.provider_request_id, p_provider_request_id),
         submitted_at = now(),
         deadline_at = now() + make_interval(secs => (select m.deadline_seconds from public.models m where m.id = c.model_id))
   where c.id = p_cell and c.status = 'queued';
  return found;
end;
$$;

create or replace function public.requeue_cell(p_cell uuid, p_error_code text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.play_cells
     set next_attempt_at = now() + make_interval(mins => greatest(attempts, 1)),
         error_code = case when p_error_code ~ '^[A-Z_]{2,40}$' then p_error_code
                           when p_error_code is not null then 'PROVIDER_ERROR' end
   where id = p_cell and status = 'queued';
  return found;
end;
$$;

create or replace function public.mark_cell_running(p_cell uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.play_cells set status = 'running' where id = p_cell and status = 'submitted';
  return found;
end;
$$;

-- ---------------------------------------------------------------- webhook helpers (FM-9/10/11)
create or replace function public.verify_cell_token(p_cell uuid, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.play_cells%rowtype;
  m public.models%rowtype;
begin
  select * into c from public.play_cells where id = p_cell;
  if not found or p_token is null or c.webhook_token_hash is null
     or c.webhook_token_hash <> encode(sha256(convert_to(p_token, 'UTF8')), 'hex') then
    return jsonb_build_object('ok', false);
  end if;
  select * into m from public.models where id = c.model_id;
  return jsonb_build_object('ok', true, 'status', c.status, 'provider_request_id', c.provider_request_id,
    'run_id', c.run_id, 'user_id', c.user_id, 'model_id', c.model_id, 'kind', m.kind, 'provider', m.provider);
end;
$$;

create or replace function public.attach_provider_request(p_cell uuid, p_provider_request_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.play_cells set provider_request_id = p_provider_request_id
   where id = p_cell and provider_request_id is null;
  return found;
end;
$$;

create or replace function public.record_webhook_event(p_provider text, p_event_key text, p_cell uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.generation_webhook_inbox (provider, event_key, cell_id) values (p_provider, p_event_key, p_cell)
  on conflict do nothing;
  return found;
end;
$$;

-- ---------------------------------------------------------------- sweeper (FM-7/8/17/21, D19)
-- Called each minute by /api/cron/play-sweeper. Read-only: it lists work, and the app finishes /
-- resubmits / polls each cell in its own call (one transaction per cell, see finish_cell).
--   finish: queued > 10 min with the submit lease over → failed PROVIDER_UNAVAILABLE;
--           submitted/running > 24 h past the deadline (provider lookups kept failing) → expired TIMEOUT.
create or replace function public.sweep_targets()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'finish', (select coalesce(jsonb_agg(jsonb_build_object('cell', s.id, 'status', s.st, 'error_code', s.code)
                                         order by s.created_at), '[]'::jsonb)
                 from (select id, created_at, 'failed' as st, 'PROVIDER_UNAVAILABLE' as code from public.play_cells
                        where status = 'queued' and created_at < now() - interval '10 minutes' and next_attempt_at <= now()
                       union all
                       select id, created_at, 'expired', 'TIMEOUT' from public.play_cells
                        where status in ('submitted', 'running') and deadline_at < now() - interval '24 hours'
                       order by created_at limit 100) s),
    'resubmit', (select coalesce(jsonb_agg(id order by next_attempt_at), '[]'::jsonb) from (
                   select id, next_attempt_at from public.play_cells
                    where status = 'queued' and next_attempt_at <= now()
                      and created_at >= now() - interval '10 minutes'
                    order by next_attempt_at limit 50) s),
    'poll', (select coalesce(jsonb_agg(jsonb_build_object('cell', s.id, 'provider_request_id', s.provider_request_id,
                                                          'endpoint', s.endpoint, 'provider', s.provider,
                                                          'deadline_at', s.deadline_at) order by s.deadline_at), '[]'::jsonb)
               from (select c.id, c.provider_request_id, c.deadline_at, m.provider,
                            case when cardinality(r.reference_ids) > 0 then m.ref_endpoint else m.endpoint end as endpoint
                       from public.play_cells c join public.models m on m.id = c.model_id
                       join public.play_runs r on r.id = c.run_id
                      where c.status in ('submitted', 'running') and c.deadline_at < now()
                      order by c.deadline_at limit 50) s),
    'expired_refs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', path)), '[]'::jsonb)
                       from (select id, path from public.play_refs where delete_after <= now()
                              order by delete_after limit 100) s),
    'expired_results', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', result_path)), '[]'::jsonb)
                          from (select id, result_path from public.play_cells
                                 where result_path is not null and saved_at is null and delete_after <= now()
                                 order by delete_after limit 100) s))
$$;

-- After the files are removed from Storage: drop the ref rows / clear result paths. Pass only the ids
-- whose files were actually deleted, so a failed delete is retried on the next sweep.
create or replace function public.purge_play_files(p_ref_ids uuid[], p_cell_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.play_refs where id = any (coalesce(p_ref_ids, '{}')) and delete_after <= now();
  update public.play_cells set result_path = null
   where id = any (coalesce(p_cell_ids, '{}')) and saved_at is null and delete_after <= now();
  delete from public.generation_webhook_inbox where received_at < now() - interval '30 days';
end;
$$;

-- Reference upload slot: server mints the path; 30 per user per hour.
create or replace function public.create_play_ref(p_user uuid, p_ext text, p_mime text, p_size integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_path text;
begin
  if p_ext is null or p_ext not in ('png', 'jpg', 'jpeg', 'webp') then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_FILE');
  end if;
  if not private.hit_rate_limit('play_ref:user:' || p_user, 30, interval '1 hour') then
    return jsonb_build_object('ok', false, 'reason', 'RATE_LIMITED');
  end if;
  v_path := p_user::text || '/' || v_id::text || '.' || p_ext;
  insert into public.play_refs (id, user_id, path, mime, size) values (v_id, p_user, v_path, p_mime, p_size);
  return jsonb_build_object('ok', true, 'id', v_id, 'path', v_path);
end;
$$;

-- Rendered prompt for (re)submission. Callers: src/data/secrets.ts only.
create or replace function public.play_prompt_for_submit(p_cell uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.rendered from private.play_prompts p join public.play_cells c on c.run_id = p.run_id
   where c.id = p_cell and c.status = 'queued'
$$;

-- ---------------------------------------------------------------- owner actions
create or replace function public.save_play_cell(p_cell uuid, p_saved boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.play_cells
     set saved_at = case when p_saved then now() end,
         delete_after = case when p_saved then null
                             else greatest(created_at + interval '30 days', now() + interval '1 day') end
   where id = p_cell and user_id = (select auth.uid()) and status = 'succeeded' and result_path is not null;
  return found;
end;
$$;

create or replace function public.ack_ai_notice()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.profiles set ai_notice_ack_at = coalesce(ai_notice_ack_at, now())
   where id = (select auth.uid()) and deleted_at is null
  returning ai_notice_ack_at
$$;

-- ---------------------------------------------------------------- grants
revoke execute on function private.quote_cell(text, jsonb, integer), private.quote_cells(jsonb, integer)
  from public, anon, authenticated;
revoke execute on function public.quote_play(jsonb, integer) from public, anon;
grant execute on function public.quote_play(jsonb, integer) to authenticated;

revoke execute on function
  public.start_run(uuid, uuid, text, uuid, jsonb, jsonb, jsonb, uuid[], boolean, text, text, text, integer),
  public.finish_cell(uuid, text, text, text, boolean), public.claim_cell_submit(uuid),
  public.mark_cell_submitted(uuid, text), public.requeue_cell(uuid, text), public.mark_cell_running(uuid),
  public.verify_cell_token(uuid, text), public.attach_provider_request(uuid, text),
  public.record_webhook_event(text, text, uuid), public.sweep_targets(), public.purge_play_files(uuid[], uuid[]),
  public.create_play_ref(uuid, text, text, integer), public.play_prompt_for_submit(uuid)
  from public, anon, authenticated;
grant execute on function
  public.start_run(uuid, uuid, text, uuid, jsonb, jsonb, jsonb, uuid[], boolean, text, text, text, integer),
  public.finish_cell(uuid, text, text, text, boolean), public.claim_cell_submit(uuid),
  public.mark_cell_submitted(uuid, text), public.requeue_cell(uuid, text), public.mark_cell_running(uuid),
  public.verify_cell_token(uuid, text), public.attach_provider_request(uuid, text),
  public.record_webhook_event(text, text, uuid), public.sweep_targets(), public.purge_play_files(uuid[], uuid[]),
  public.create_play_ref(uuid, text, text, integer), public.play_prompt_for_submit(uuid)
  to service_role;

revoke execute on function public.save_play_cell(uuid, boolean), public.ack_ai_notice() from public, anon;
grant execute on function public.save_play_cell(uuid, boolean), public.ack_ai_notice() to authenticated;

-- ---------------------------------------------------------------- sweeper trigger (pg_cron + pg_net)
-- Vercel Hobby cron runs once a day, so Supabase calls the sweeper each minute. The site URL and the
-- shared secret live in Supabase Vault (set by the owner); without them this does nothing (local).
create or replace function private.call_play_sweeper()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'sameplz_site_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'sameplz_cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(url := rtrim(v_url, '/') || '/api/cron/play-sweeper',
                        body := '{}'::jsonb,
                        headers := jsonb_build_object('authorization', 'Bearer ' || v_secret,
                                                      'content-type', 'application/json'),
                        timeout_milliseconds := 10000);
end;
$$;
revoke execute on function private.call_play_sweeper() from public, anon, authenticated;
select cron.schedule('sameplz-play-sweeper', '* * * * *', 'select private.call_play_sweeper()');

-- ---------------------------------------------------------------- production budget (D12)
-- 2026-10-15 decision: $50 per month ≈ 40,250C. Existing rows (local seed) are left alone.
-- actor: nil uuid = migration (no profile row). 'budget_init' = first cap of a month, not a manual change.
with ins as (
  insert into public.generation_budget (month, cap_credits, state)
  values (private.kst_month(), 40250, 'open'), ((private.kst_month() + interval '1 month')::date, 40250, 'open')
  on conflict (month) do nothing
  returning month)
insert into public.admin_actions (actor_id, action, target_type, target_id, reason, detail)
select '00000000-0000-0000-0000-000000000000', 'budget_init', 'generation_budget', ins.month::text,
       'D12 운영 상한 결정(2026-10-15)', jsonb_build_object('cap_credits', 40250, 'usd', 50)
  from ins;

-- ---------------------------------------------------------------- catalog (D8, 2026-10-15)
-- fal endpoints and list prices from fal model pages (2026-10-15). GPT Image and Seedance bill by tokens;
-- these tables are the published per-image / per-second estimates (Seedance at 16:9 area, the widest
-- offered). Recheck with the fal pricing API before raising price_version.
insert into public.models (id, provider, label, kind, endpoint, ref_endpoint, ref_param, ref_max, params, deadline_seconds, sort) values
('gpt-image-2', 'fal', 'GPT Image 2', 'image', 'openai/gpt-image-2', 'openai/gpt-image-2/edit', 'image_urls', 4,
 '{"image_size":{"label":"크기","values":["1024x1024","1024x768","768x1024","1536x1024","1024x1536"],"default":"1024x1024"},
   "quality":{"label":"품질","values":["low","medium","high"],"default":"medium"}}', 300, 10),
('gpt-image-2.5-flare', 'fal', 'GPT Image 2.5 Flare', 'image', 'openai/gpt-image-2.5/flare/text-to-image',
 'openai/gpt-image-2.5/flare/edit', 'image_urls', 4,
 '{"quality":{"label":"품질","values":["low","medium","high","xhigh"],"default":"medium"}}', 300, 20),
('gpt-image-2.5-sunburst', 'fal', 'GPT Image 2.5 Sunburst', 'image', 'openai/gpt-image-2.5/sunburst/text-to-image',
 'openai/gpt-image-2.5/sunburst/edit', 'image_urls', 4,
 '{"quality":{"label":"품질","values":["low","medium","high","xhigh"],"default":"medium"}}', 300, 30),
('nano-banana-2', 'fal', 'Nano Banana 2', 'image', 'fal-ai/nano-banana-2', 'fal-ai/nano-banana-2/edit', 'image_urls', 4,
 '{"aspect_ratio":{"label":"비율","values":["1:1","4:5","3:4","2:3","9:16","4:3","3:2","16:9"],"default":"1:1"},
   "resolution":{"label":"해상도","values":["0.5K","1K","2K","4K"],"default":"1K"}}', 300, 40),
('nano-banana-pro', 'fal', 'Nano Banana Pro', 'image', 'fal-ai/nano-banana-pro', 'fal-ai/nano-banana-pro/edit', 'image_urls', 4,
 '{"aspect_ratio":{"label":"비율","values":["1:1","4:5","3:4","2:3","9:16","4:3","3:2","16:9"],"default":"1:1"},
   "resolution":{"label":"해상도","values":["1K","2K","4K"],"default":"1K"}}', 300, 50),
('grok-imagine-image-2', 'fal', 'Grok Imagine Image 2.0', 'image', 'xai/grok-imagine-image/v2.0/text-to-image',
 'xai/grok-imagine-image/v2.0/edit', 'image_urls', 4,
 '{"aspect_ratio":{"label":"비율","values":["1:1","4:5","3:4","2:3","9:16","4:3","3:2","16:9"],"default":"1:1"},
   "resolution":{"label":"해상도","values":["1k","2k"],"default":"1k"},
   "quality":{"label":"품질","values":["low","medium"],"default":"low"}}', 300, 60),
('grok-imagine-video-1.5-lite', 'fal', 'Grok Imagine Video 1.5 Lite', 'video', 'xai/grok-imagine-video/v1.5/lite/text-to-video',
 'xai/grok-imagine-video/v1.5/lite/image-to-video', 'image_url', 1,
 '{"duration":{"label":"길이(초)","values":[3,5,6,8,10,15],"default":5},
   "resolution":{"label":"해상도","values":["480p","720p","1080p"],"default":"480p"},
   "aspect_ratio":{"label":"비율","values":["16:9","9:16","1:1"],"default":"9:16"}}', 1200, 70),
('grok-imagine-video-1.5', 'fal', 'Grok Imagine Video 1.5', 'video', 'xai/grok-imagine-video/v1.5/text-to-video',
 'xai/grok-imagine-video/v1.5/image-to-video', 'image_url', 1,
 '{"duration":{"label":"길이(초)","values":[3,5,6,8,10,15],"default":3},
   "resolution":{"label":"해상도","values":["480p","720p","1080p"],"default":"480p"},
   "aspect_ratio":{"label":"비율","values":["16:9","9:16","1:1"],"default":"9:16"}}', 1200, 80),
('kling-v3-standard', 'fal', 'Kling 3 Standard', 'video', 'fal-ai/kling-video/v3/standard/text-to-video',
 'fal-ai/kling-video/v3/standard/image-to-video', 'start_image_url', 1,
 '{"duration":{"label":"길이(초)","values":["3","5","10","15"],"default":"3"},
   "aspect_ratio":{"label":"비율","values":["16:9","9:16","1:1"],"default":"9:16"},
   "generate_audio":{"label":"오디오","values":[false,true],"default":false}}', 1800, 90),
('kling-v3-pro', 'fal', 'Kling 3 Pro', 'video', 'fal-ai/kling-video/v3/pro/text-to-video',
 'fal-ai/kling-video/v3/pro/image-to-video', 'start_image_url', 1,
 '{"duration":{"label":"길이(초)","values":["3","5","10","15"],"default":"3"},
   "aspect_ratio":{"label":"비율","values":["16:9","9:16","1:1"],"default":"9:16"},
   "generate_audio":{"label":"오디오","values":[false,true],"default":false}}', 1800, 100),
('seedance-2.0-fast', 'fal', 'Seedance 2.0 Fast', 'video', 'bytedance/seedance-2.0/fast/text-to-video',
 'bytedance/seedance-2.0/fast/image-to-video', 'image_url', 1,
 '{"duration":{"label":"길이(초)","values":["4","5","8","10","15"],"default":"4"},
   "resolution":{"label":"해상도","values":["480p","720p"],"default":"480p"},
   "aspect_ratio":{"label":"비율","values":["16:9","9:16","1:1"],"default":"9:16"},
   "generate_audio":{"label":"오디오","values":[false,true],"default":false}}', 1800, 110),
('seedance-2.5', 'fal', 'Seedance 2.5', 'video', 'bytedance/seedance-2.5/text-to-video',
 'bytedance/seedance-2.5/image-to-video', 'image_url', 1,
 '{"duration":{"label":"길이(초)","values":["4","5","8","10","15"],"default":"4"},
   "resolution":{"label":"해상도","values":["480p","720p","1080p"],"default":"480p"},
   "aspect_ratio":{"label":"비율","values":["16:9","9:16","1:1"],"default":"9:16"},
   "generate_audio":{"label":"오디오","values":[false,true],"default":false}}', 1800, 120);

insert into public.model_prices (model_id, price_version, rule) values
('gpt-image-2', 1, '{"unit":"image","keys":["quality","image_size"],"usd":{
   "low|1024x1024":0.006,"medium|1024x1024":0.053,"high|1024x1024":0.211,
   "low|1024x768":0.005,"medium|1024x768":0.037,"high|1024x768":0.145,
   "low|768x1024":0.005,"medium|768x1024":0.037,"high|768x1024":0.145,
   "low|1536x1024":0.005,"medium|1536x1024":0.042,"high|1536x1024":0.165,
   "low|1024x1536":0.005,"medium|1024x1536":0.042,"high|1024x1536":0.165}}'),
('gpt-image-2.5-flare', 1, '{"unit":"image","keys":["quality"],"usd":{
   "low":0.00588,"medium":0.01317,"high":0.05268,"xhigh":0.09366}}'),
('gpt-image-2.5-sunburst', 1, '{"unit":"image","keys":["quality"],"usd":{
   "low":0.00588,"medium":0.01317,"high":0.05268,"xhigh":0.09366}}'),
('nano-banana-2', 1, '{"unit":"image","keys":["resolution"],"usd":{"0.5K":0.06,"1K":0.08,"2K":0.12,"4K":0.16}}'),
('nano-banana-pro', 1, '{"unit":"image","keys":["resolution"],"usd":{"1K":0.15,"2K":0.15,"4K":0.30}}'),
('grok-imagine-image-2', 1, '{"unit":"image","keys":["resolution","quality"],"usd":{
   "1k|low":0.04,"1k|medium":0.06,"2k|low":0.06,"2k|medium":0.08},"per_reference_usd":0.01}'),
('grok-imagine-video-1.5-lite', 1, '{"unit":"second","keys":["resolution"],"usd":{"480p":0.02,"720p":0.03,"1080p":0.14}}'),
('grok-imagine-video-1.5', 1, '{"unit":"second","keys":["resolution"],"usd":{"480p":0.08,"720p":0.14,"1080p":0.25}}'),
('kling-v3-standard', 1, '{"unit":"second","keys":["generate_audio"],"usd":{"false":0.084,"true":0.126}}'),
('kling-v3-pro', 1, '{"unit":"second","keys":["generate_audio"],"usd":{"false":0.112,"true":0.168}}'),
('seedance-2.0-fast', 1, '{"unit":"second","keys":["resolution"],"usd":{"480p":0.108,"720p":0.2419}}'),
('seedance-2.5', 1, '{"unit":"second","keys":["resolution"],"usd":{"480p":0.2205,"720p":0.473,"1080p":1.164}}');
