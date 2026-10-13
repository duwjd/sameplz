-- Security review (W2 login):
-- 1) F7-9 gate in the database: users who have not finished signup (terms + 18+) cannot write
--    social rows even by calling PostgREST directly (the server-action check alone is bypassable).
-- 2) Naver placeholder emails (D4-B, *.invalid) can only belong to the matching Naver account:
--    blocks pre-registering or changing into someone else's placeholder (account takeover).

create or replace function private.signup_complete()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.deleted_at is null
      and p.terms_accepted_at is not null
      and p.adult_confirmed_at is not null
  )
$$;
revoke execute on function private.signup_complete() from public, anon;
grant execute on function private.signup_complete() to authenticated;

alter policy follows_insert_own on public.follows
  with check (follower_id = (select auth.uid()) and (select private.signup_complete()));

alter policy recipe_likes_insert_own on public.recipe_likes
  with check (user_id = (select auth.uid()) and (select private.recipe_visible(recipe_id))
              and (select private.signup_complete()));

alter policy post_likes_insert_own on public.post_likes
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.gallery_posts g where g.id = post_likes.post_id and g.status = 'visible')
              and (select private.signup_complete()));

alter policy gallery_posts_insert_same_cert on public.gallery_posts
  with check (kind = 'same_cert' and author_id = (select auth.uid())
              and status = 'visible' and (select private.has_entitlement(recipe_id))
              and (select private.gallery_refs_ok(media_id, recipe_id, version_id, entitlement_id))
              and (select private.signup_complete()));

alter policy gallery_posts_insert_original on public.gallery_posts
  with check (kind = 'original' and author_id = (select auth.uid()) and status = 'visible'
              and exists (select 1 from public.recipes r where r.id = gallery_posts.recipe_id and r.owner_id = (select auth.uid()))
              and (select private.gallery_refs_ok(media_id, recipe_id, version_id, entitlement_id))
              and (select private.signup_complete()));

alter policy creator_waitlist_insert_own on public.creator_waitlist
  with check (user_id = (select auth.uid()) and (select private.signup_complete()));

-- ---------------------------------------------------------------- Naver placeholder ownership
-- n_<first 32 hex of sha256('naver:' || naver_id)>@naver.users.sameplz.invalid (src/lib/auth/naver.ts)
create or replace function private.guard_placeholder_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  naver_id text := new.raw_app_meta_data ->> 'naver_id';
begin
  if new.email is null or lower(new.email) not like '%.invalid' then
    return new;
  end if;
  if naver_id is null
     or lower(new.email) <> 'n_' || left(encode(sha256(convert_to('naver:' || naver_id, 'UTF8')), 'hex'), 32)
                           || '@naver.users.sameplz.invalid' then
    raise exception using errcode = 'P0001', message = 'PLACEHOLDER_EMAIL_RESERVED';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_placeholder_email() from public, anon, authenticated;

create trigger guard_placeholder_email
  before insert or update of email, raw_app_meta_data on auth.users
  for each row execute function private.guard_placeholder_email();
