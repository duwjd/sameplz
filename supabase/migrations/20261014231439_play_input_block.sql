-- F4-7 / D13: a run refused by our input moderation (before any cell exists) still counts toward the
-- 3-blocks-in-24h generation stop. Server-only (POST /api/play/runs); returns true when it suspends.
create or replace function public.record_play_input_block(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = p_user) then
    return false;
  end if;
  return private.record_moderation_block(p_user);
end;
$$;
revoke execute on function public.record_play_input_block(uuid) from public, anon, authenticated;
grant execute on function public.record_play_input_block(uuid) to service_role;
