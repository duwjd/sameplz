// D18 (B): keep each recipe result in the right bucket. Public (`recipe-media`) only while it belongs
// to the current version of a live / stopped recipe (or a visible gallery post of one); otherwise
// private (`recipe-media-draft`). Recipes are queued by triggers; a run claims them with a lease
// (no parallel run per recipe), re-checks every path right before moving it, and only reports done
// when every move succeeded — anything else is retried with backoff. Hourly, unreferenced uploads
// older than 24 hours are deleted.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DRAFT_MEDIA_BUCKET, MEDIA_BUCKET } from "@/lib/upload/media";

const FILES_BUCKET = "recipe-files";

interface SyncItem {
  recipe_id: string;
  queued_at: string;
  publish: string[];
  unpublish: string[];
}

type Db = ReturnType<typeof createAdminClient>;

/** Seed and legacy rows carry paths we never minted; there is no object to move. */
const isPlaceholder = (path: string) =>
  !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/.test(path);

const exists = async (db: Db, bucket: string, path: string) =>
  !(await db.storage.from(bucket).info(path)).error;

/** Make sure `path` is in `to` and not in `from`. true when that holds afterwards. */
async function place(
  db: Db,
  path: string,
  from: string,
  to: string,
): Promise<boolean> {
  const inFrom = await exists(db, from, path);
  if (inFrom) {
    if (!(await exists(db, to, path))) {
      const copied = await db.storage
        .from(from)
        .copy(path, path, { destinationBucket: to });
      if (copied.error) return false;
    }
    if ((await db.storage.from(from).remove([path])).error) return false;
    return true;
  }
  // Not in `from`: fine if it is already in `to`, or if it is a placeholder with no object at all.
  return (await exists(db, to, path)) || isPlaceholder(path);
}

export interface MediaSyncReport {
  recipes: number;
  moved: number;
  retried: number;
  orphans: number;
}

export async function syncRecipeMedia(limit = 20): Promise<MediaSyncReport> {
  const db = createAdminClient();
  const report: MediaSyncReport = {
    recipes: 0,
    moved: 0,
    retried: 0,
    orphans: 0,
  };
  const { data, error } = await db.rpc("media_sync_claim", { p_limit: limit });
  if (error) throw new Error("media_sync_claim");
  for (const item of (data ?? []) as unknown as SyncItem[]) {
    report.recipes++;
    const paths = [...item.publish, ...item.unpublish];
    // The claim may be minutes old: ask again right before moving.
    const { data: fresh } = await db.rpc("media_paths_public", {
      p_paths: paths,
    });
    const isPublic = (fresh ?? {}) as Record<string, boolean>;
    let ok = Boolean(fresh);
    for (const path of paths) {
      if (!ok) break;
      const placed = isPublic[path]
        ? await place(db, path, DRAFT_MEDIA_BUCKET, MEDIA_BUCKET)
        : await place(db, path, MEDIA_BUCKET, DRAFT_MEDIA_BUCKET);
      if (placed) report.moved++;
      else ok = false;
    }
    if (ok)
      await db.rpc("media_sync_done", {
        p_recipe: item.recipe_id,
        p_queued_at: item.queued_at,
      });
    else {
      await db.rpc("media_sync_retry", { p_recipe: item.recipe_id });
      report.retried++;
    }
  }

  const { data: scan } = await db.rpc("claim_orphan_scan");
  if (scan === true) {
    const { data: orphans } = await db.rpc("orphan_uploads", { p_limit: 100 });
    const o = (orphans ?? {}) as {
      media?: string[];
      public?: string[];
      files?: string[];
    };
    for (const [bucket, names] of [
      [DRAFT_MEDIA_BUCKET, o.media ?? []],
      [MEDIA_BUCKET, o.public ?? []],
      [FILES_BUCKET, o.files ?? []],
    ] as const) {
      if (
        names.length &&
        !(await db.storage.from(bucket).remove([...names])).error
      )
        report.orphans += names.length;
    }
  }
  return report;
}
