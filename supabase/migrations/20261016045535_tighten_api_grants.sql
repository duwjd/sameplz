-- SEC audit (W7): the API roles kept Supabase's default table grants, so RLS was the only wall. Take
-- away what no policy uses, so a later loose policy cannot open a write path by itself.

-- TRUNCATE ignores RLS; TRIGGER / REFERENCES are never needed by the API roles.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

-- Guests never write directly (guest actions go through server-side RPCs).
revoke insert, update, delete on all tables in schema public from anon;

-- Members write only where a policy allows it (follows, likes, waitlist, drafts, own gallery delete,
-- own profile columns). Catalog, versions, media, entitlements and rankings change only through
-- security definer RPCs or the service role.
revoke insert, update, delete on public.recipes, public.recipe_versions, public.recipe_version_media,
  public.media_assets, public.jobs, public.tools, public.entitlements, public.ranking_snapshots,
  public.banners, public.collections, public.collection_items from authenticated;

-- avatar_url is set from the login provider at signup; members cannot point it at arbitrary images.
revoke update (avatar_url) on public.profiles from authenticated;
