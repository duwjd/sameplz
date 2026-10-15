-- PLAY-05: the /play grid re-reads its runs (Realtime hint + 4 s poll). Each refresh signs result
-- URLs, so it is limited per user: 60 per minute is a few open tabs. Server-only.
create or replace function public.hit_play_refresh(p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$ select private.hit_rate_limit('play_refresh:user:' || p_user, 60, interval '1 minute') $$;
revoke execute on function public.hit_play_refresh(uuid) from public, anon, authenticated;
grant execute on function public.hit_play_refresh(uuid) to service_role;
