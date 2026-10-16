-- SEC audit (W7): API roles hold only the table privileges some policy actually uses.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select ok(not exists (
  select 1 from information_schema.table_privileges
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')),
  'SEC no API role can truncate, add triggers to or reference public tables');
select ok(not exists (
  select 1 from information_schema.table_privileges
   where table_schema = 'public' and grantee = 'anon' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  'SEC guests have no direct write on any public table');
select ok(not has_table_privilege('authenticated', 'public.recipes', 'update'),
          'SEC members cannot update recipes directly (status, approval go through RPCs)');
select ok(not has_table_privilege('authenticated', 'public.recipe_versions', 'insert'),
          'SEC members cannot insert recipe versions directly');
select ok(not has_table_privilege('authenticated', 'public.entitlements', 'insert'),
          'SEC members cannot grant themselves entitlements directly');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'update'),
          'SEC members cannot point their avatar at an arbitrary image');
select ok(has_column_privilege('authenticated', 'public.profiles', 'nickname', 'update'),
          'SEC members still edit their own profile fields');
select ok(has_table_privilege('authenticated', 'public.follows', 'insert')
          and has_table_privilege('authenticated', 'public.recipe_likes', 'delete'),
          'SEC member writes that policies allow keep their grants');
select ok((select count(*) = 1 from pg_trigger where tgname = 'face_consents_no_truncate'),
          'SEC face consents cannot be truncated');

select * from finish();
rollback;
