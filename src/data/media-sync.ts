// D18 (B): keep each recipe result in the right bucket. Public (`recipe-media`) only while it belongs
// to the current version of a live / stopped recipe; otherwise private (`recipe-media-draft`).
// Recipes are queued by a trigger; this runs from the minute sweeper and right after the actions
// that change visibility. Also deletes unsubmitted uploads older than 24 hours.
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

type Storage = ReturnType<typeof createAdminClient>["storage"];

/** Copy into `to` (already there is fine), then remove from `from`. false when neither has it. */
async function moveObject(
  storage: Storage,
  path: string,
  from: string,
  to: string,
): Promise<boolean> {
  const copied = await storage
    .from(from)
    .copy(path, path, { destinationBucket: to });
  if (copied.error) {
    // Already in place (earlier run, or a reused result): nothing to copy.
    const there = await storage.from(to).info(path);
    if (there.error) return false;
  }
  const removed = await storage.from(from).remove([path]);
  return !removed.error;
}

export interface MediaSyncReport {
  recipes: number;
  published: number;
  unpublished: number;
  orphans: number;
}

export async function syncRecipeMedia(limit = 20): Promise<MediaSyncReport> {
  const db = createAdminClient();
  const report: MediaSyncReport = {
    recipes: 0,
    published: 0,
    unpublished: 0,
    orphans: 0,
  };
  const { data, error } = await db.rpc("media_sync_batch", { p_limit: limit });
  if (error) throw new Error("media_sync_batch");
  for (const item of (data ?? []) as unknown as SyncItem[]) {
    let ok = true;
    for (const path of item.publish) {
      if (await moveObject(db.storage, path, DRAFT_MEDIA_BUCKET, MEDIA_BUCKET)) report.published++;
      // Not in the draft bucket: fine if it is public already or a placeholder; otherwise retry later.
      else if (!isPlaceholder(path) && (await db.storage.from(MEDIA_BUCKET).info(path)).error) ok = false;
    }
    for (const path of item.unpublish) {
      if (await moveObject(db.storage, path, MEDIA_BUCKET, DRAFT_MEDIA_BUCKET))
        report.unpublished++;
    }
    // A failure leaves the recipe queued; the next sweep tries again.
    if (ok)
      await db.rpc("media_sync_done", {
        p_recipe: item.recipe_id,
        p_queued_at: item.queued_at,
      });
    report.recipes++;
  }

  const { data: orphans } = await db.rpc("orphan_uploads", { p_limit: 100 });
  const o = (orphans ?? { media: [], files: [] }) as {
    media: string[];
    files: string[];
  };
  if (
    o.media.length &&
    !(await db.storage.from(DRAFT_MEDIA_BUCKET).remove(o.media)).error
  )
    report.orphans += o.media.length;
  if (
    o.files.length &&
    !(await db.storage.from(FILES_BUCKET).remove(o.files)).error
  )
    report.orphans += o.files.length;
  return report;
}

/** Seed and legacy rows carry paths we never minted; there is no object to move. */
const isPlaceholder = (path: string) =>
  !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/.test(path);
