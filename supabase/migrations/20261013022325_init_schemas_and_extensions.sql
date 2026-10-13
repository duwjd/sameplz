-- W2 schema v1 · 1/6: schemas, extensions, shared helpers.

create schema if not exists private;
-- Usage only: policy helpers live here and are evaluated for anon too. Each function still
-- needs its own execute grant; money RPCs revoke it from anon/authenticated.
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create extension if not exists citext with schema extensions;
create extension if not exists pgroonga with schema extensions; -- Korean search (D15)
create extension if not exists pg_cron;                          -- popularity refresh

-- Admin check from the JWT `admin` claim only (never user_metadata).
-- The access-token hook that sets the claim lands with the admin screens (W6).
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'admin')::boolean, false)
$$;

-- Used inside policies that anon also evaluates (returns false without the claim).
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- updated_at maintenance for editable catalog rows.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Append-only guard for ledger-like tables.
create or replace function private.reject_update_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'APPEND_ONLY';
end;
$$;
