-- D20 (F7-7 privacy policy): device/IP hashes and abuse records of a withdrawn member are kept one
-- year after withdrawal to stop rejoin-for-credits abuse (D13), then deleted. Records with no member
-- (ops signals) also go after one year. Rate-limit buckets are already pruned after 2 days.
create or replace function private.prune_abuse_records()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.account_devices d
   using public.profiles p
   where p.id = d.user_id and p.deleted_at < now() - interval '1 year';
  delete from public.abuse_signals s
   where (s.user_id is null and s.created_at < now() - interval '1 year')
      or exists (select 1 from public.profiles p
                  where p.id = s.user_id and p.deleted_at < now() - interval '1 year');
$$;
revoke execute on function private.prune_abuse_records() from public, anon, authenticated;

select cron.schedule('sameplz-prune-abuse', '45 15 * * *', 'select private.prune_abuse_records()');
