-- F7-7 / D20: the privacy policy's retention periods match what the database deletes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Old leaver (withdrew 400 days ago), recent leaver (10 days ago), active member.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e701', 'ret-old@example.test'),
  ('00000000-0000-0000-0000-00000000e702', 'ret-new@example.test'),
  ('00000000-0000-0000-0000-00000000e703', 'ret-act@example.test'),
  ('00000000-0000-0000-0000-00000000e704', 'ret-edge@example.test');
update public.profiles set deleted_at = now() - interval '400 days' where id = '00000000-0000-0000-0000-00000000e701';
update public.profiles set deleted_at = now() - interval '10 days' where id = '00000000-0000-0000-0000-00000000e702';
update public.profiles set deleted_at = now() - interval '364 days' where id = '00000000-0000-0000-0000-00000000e704';

insert into public.account_devices (user_id, device_hash, ip_hash) values
  ('00000000-0000-0000-0000-00000000e701', repeat('a', 64), repeat('b', 64)),
  ('00000000-0000-0000-0000-00000000e702', repeat('a', 64), repeat('b', 64)),
  ('00000000-0000-0000-0000-00000000e703', repeat('c', 64), null),
  ('00000000-0000-0000-0000-00000000e704', repeat('d', 64), null);
insert into public.abuse_signals (user_id, kind, created_at) values
  ('00000000-0000-0000-0000-00000000e701', 'ret_test', now() - interval '500 days'),
  ('00000000-0000-0000-0000-00000000e702', 'ret_test', now() - interval '500 days'),
  ('00000000-0000-0000-0000-00000000e703', 'ret_test', now() - interval '500 days'),
  (null, 'ret_test', now() - interval '400 days'),
  (null, 'ret_test', now() - interval '10 days');

select private.prune_abuse_records();

select is((select count(*)::integer from public.account_devices where user_id = '00000000-0000-0000-0000-00000000e701'),
          0, 'F7-7 device hashes of a member who left over a year ago are deleted');
select is((select count(*)::integer from public.account_devices
            where user_id in ('00000000-0000-0000-0000-00000000e702', '00000000-0000-0000-0000-00000000e703')),
          2, 'F7-7 device hashes of a recent leaver and an active member stay');
select is((select count(*)::integer from public.abuse_signals
            where kind = 'ret_test' and user_id = '00000000-0000-0000-0000-00000000e701'),
          0, 'F7-7 abuse records of a member who left over a year ago are deleted');
select is((select count(*)::integer from public.abuse_signals
            where kind = 'ret_test' and user_id in ('00000000-0000-0000-0000-00000000e702', '00000000-0000-0000-0000-00000000e703')),
          2, 'F7-7 abuse records of a recent leaver and an active member stay');
select is((select count(*)::integer from public.abuse_signals where kind = 'ret_test' and user_id is null),
          1, 'F7-7 records with no member go after a year');
select ok((select count(*) = 1 from cron.job where jobname = 'sameplz-prune-abuse'),
          'F7-7 the retention job is scheduled daily');

select is((select count(*)::integer from public.account_devices where user_id = '00000000-0000-0000-0000-00000000e704'),
          1, 'F7-7 a member who left 364 days ago keeps the device hash until the year is up');
select ok(not has_function_privilege('anon', 'private.prune_abuse_records()', 'execute'),
          'F7-7 anon cannot run the retention job');
select ok(not has_function_privilege('authenticated', 'private.prune_abuse_records()', 'execute'),
          'F7-7 members cannot run the retention job');

select * from finish();
rollback;
