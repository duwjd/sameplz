import "server-only";
import { cacheLife } from "next/cache";

/**
 * Public cached reads run at build time too. With D14 (no Supabase Branching), Vercel can build
 * a merge before deploy-db applies its migration, so a new RPC may not exist yet. Instead of
 * failing the build, log, render empty, and keep the cache entry short (minutes) so it heals on its own.
 * Call only inside a "use cache" scope.
 */
export function degradeCachedRead<T>(
  label: string,
  error: unknown,
  fallback: T,
): T {
  console.error(
    `[data] ${label} failed; serving empty and retrying soon`,
    error,
  );
  cacheLife("minutes"); // "seconds" would make the read dynamic and break prerendering
  return fallback;
}
