import "server-only";
import type { Viewer } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import {
  DRAFT_MEDIA_BUCKET,
  MEDIA_BUCKET,
  MEDIA_MIME,
  isOwnMediaPath,
  mediaKindOf,
  mediaUrl,
  sniffMatches,
  extMatchesMime,
  type MediaMime,
} from "@/lib/upload/media";
import {
  MAX_IMAGE_BYTES,
  MAX_SKILL_ZIP_BYTES,
  MAX_VIDEO_BYTES,
  UploadFormSchema,
  type UploadForm,
} from "@/lib/validation/upload";

const FILES_BUCKET = "recipe-files";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SKILL_ZIP_PATH = new RegExp(`^(${UUID})/${UUID}/[a-z0-9-]{1,64}\\.zip$`);

export interface DraftDTO {
  form: UploadForm;
  step: number;
  updatedAt: string;
}

type DraftQuery = {
  is: (c: "recipe_id", v: null) => unknown;
  eq: (c: "recipe_id", v: string) => unknown;
};
/** One draft per new recipe (recipe_id null) and one per existing recipe (new version). */
const byRecipe = <Q extends DraftQuery>(q: Q, recipeId: string | null) =>
  (recipeId ? q.eq("recipe_id", recipeId) : q.is("recipe_id", null)) as Q;

/** UP-08: the viewer's draft for a new recipe, or for a new version of `recipeId` (RLS: own rows). */
export async function getMyDraft(
  recipeId: string | null = null,
): Promise<DraftDTO | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await byRecipe(
    supabase.from("recipe_drafts").select("payload,step,updated_at"),
    recipeId,
  ).maybeSingle();
  if (!data) return null;
  const form = UploadFormSchema.parse(data.payload ?? {});
  // A draft always belongs to the recipe it is filed under.
  form.recipeId = recipeId;
  // Saved preview URLs expire (D18 signed URLs): sign them again — own paths only.
  const { data: claims } = await supabase.auth.getClaims();
  const owner = claims?.claims.sub;
  const urls = owner ? await mediaPreviewUrls(owner, form.media.map((m) => m.path)) : new Map<string, string>();
  form.media = form.media.map((m) => ({ ...m, url: urls.get(m.path) ?? "" }));
  return { form, step: data.step, updatedAt: data.updated_at };
}

export async function saveMyDraft(
  viewer: Viewer,
  form: UploadForm,
  step: number,
) {
  const supabase = await createClient();
  const recipeId = form.recipeId ?? null;
  // Drop results that are not the viewer's own uploads (D18: a draft never vouches for others' files).
  const clean = { ...form, media: form.media.filter((m) => isOwnMediaPath(m.path, viewer.id)) };
  const row = { payload: clean, step, category: form.category };
  const { data: existing } = await byRecipe(
    supabase.from("recipe_drafts").select("id"),
    recipeId,
  ).maybeSingle();
  const { error } = existing
    ? await supabase.from("recipe_drafts").update(row).eq("id", existing.id)
    : await supabase
        .from("recipe_drafts")
        .insert({ ...row, owner_id: viewer.id, recipe_id: recipeId });
  return !error;
}

export async function deleteMyDraft(recipeId: string | null = null) {
  const supabase = await createClient();
  const { error } = await byRecipe(
    supabase.from("recipe_drafts").delete(),
    recipeId,
  );
  return !error;
}

/**
 * D18: preview URLs for the owner's own results — a 1-hour signed URL from the draft bucket, or the
 * public URL when the result is already published. Unknown paths map to "".
 */
export async function mediaPreviewUrls(ownerId: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  // Only the caller's own results: a draft payload is user-written and may name anyone's path.
  const valid = paths.filter((p) => mediaUrl(p) && isOwnMediaPath(p, ownerId));
  if (!valid.length) return out;
  const { data } = await createAdminClient().storage.from(DRAFT_MEDIA_BUCKET).createSignedUrls(valid, 3600);
  for (const s of data ?? []) if (s.path && s.signedUrl && !s.error) out.set(s.path, s.signedUrl);
  for (const p of valid) if (!out.has(p)) out.set(p, mediaUrl(p)!);
  return out;
}

/** Server-minted signed upload target. The path is fixed here, never taken from the client. */
async function signedUpload(bucket: string, path: string) {
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUploadUrl(path);
  if (error || !data) return null;
  return { path, token: data.token };
}

export async function createMediaUploadTarget(viewer: Viewer, mime: MediaMime) {
  // D18: uploads go to the private draft bucket; publishing moves them (src/data/media-sync.ts).
  // Until the migration that creates the bucket is applied (app deploys first), fall back to the
  // public bucket so uploads keep working; the queued sync moves them once the bucket exists.
  const path = `${viewer.id}/${crypto.randomUUID()}.${MEDIA_MIME[mime]}`;
  const draft = await signedUpload(DRAFT_MEDIA_BUCKET, path);
  if (draft) return { ...draft, bucket: DRAFT_MEDIA_BUCKET };
  const legacy = await signedUpload(MEDIA_BUCKET, path);
  return legacy ? { ...legacy, bucket: MEDIA_BUCKET } : null;
}

export async function createSkillZipTarget(viewer: Viewer, name: string) {
  return signedUpload(
    FILES_BUCKET,
    `${viewer.id}/${crypto.randomUUID()}/${name}.zip`,
  );
}

export const isOwnSkillZipPath = (path: string, ownerId: string) =>
  SKILL_ZIP_PATH.exec(path)?.[1] === ownerId;

async function objectInfo(bucket: string, path: string) {
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .info(path);
  if (error || !data) return null;
  return {
    size: Number(
      data.size ??
        (data.metadata as { size?: number } | undefined)?.size ??
        NaN,
    ),
    mime: String(
      data.contentType ??
        (data.metadata as { mimetype?: string } | undefined)?.mimetype ??
        "",
    ),
  };
}

/** Uploaded result matches what the form claims: own path, real type, size limit per kind. */
export async function verifyMedia(
  viewer: Viewer,
  media: UploadForm["media"],
): Promise<boolean> {
  for (const m of media) {
    if (!isOwnMediaPath(m.path, viewer.id)) return false;
    // New uploads sit in the draft bucket; a new version may reuse an already public result.
    const bucket = (await objectInfo(DRAFT_MEDIA_BUCKET, m.path)) ? DRAFT_MEDIA_BUCKET : MEDIA_BUCKET;
    const info = await objectInfo(bucket, m.path);
    if (!info || !Object.hasOwn(MEDIA_MIME, info.mime)) return false;
    if (!extMatchesMime(m.path, info.mime as MediaMime)) return false;
    const kind = mediaKindOf(info.mime as MediaMime);
    if (kind !== m.kind) return false;
    if (
      !(info.size > 0) ||
      info.size > (kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)
    )
      return false;
    if (!sniffMatches(info.mime as MediaMime, await headBytes(bucket, m.path)))
      return false;
  }
  return true;
}

/** First bytes of a result file (Range request on a short signed URL; works for both buckets). */
async function headBytes(bucket: string, path: string): Promise<Uint8Array> {
  const signed = await createAdminClient().storage.from(bucket).createSignedUrl(path, 60);
  const url = signed.data?.signedUrl;
  if (signed.error || !url) return new Uint8Array();
  try {
    const res = await fetch(url, {
      headers: { range: "bytes=0-31" },
      cache: "no-store",
    });
    if (!res.ok) return new Uint8Array();
    return new Uint8Array(await res.arrayBuffer()).subarray(0, 32);
  } catch {
    return new Uint8Array();
  }
}

/** Bytes of an uploaded skill zip (own path, size-capped) for server-side inspection. */
export async function readSkillZip(
  viewer: Viewer,
  path: string,
): Promise<Uint8Array | null> {
  if (!isOwnSkillZipPath(path, viewer.id)) return null;
  const info = await objectInfo(FILES_BUCKET, path);
  if (!info || !(info.size > 0) || info.size > MAX_SKILL_ZIP_BYTES) return null;
  const { data, error } = await createAdminClient()
    .storage.from(FILES_BUCKET)
    .download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return bytes.byteLength <= MAX_SKILL_ZIP_BYTES ? bytes : null;
}

/** Per-user submit caps (public.hit_upload_limit): 20 / hour, 40 / day. */
export async function hitUploadLimit(viewer: Viewer): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("hit_upload_limit", {
    p_user: viewer.id,
  });
  return !error && data === null;
}

/** Global daily judge budget, counted only right before paid layer 2 calls. false → skip layer 2. */
export async function hitJudgeBudget(): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("hit_judge_budget");
  return !error && data === true;
}

/** Signed upload URLs: 60 per user per hour (public.hit_upload_target_limit). */
export async function hitUploadTargetLimit(viewer: Viewer): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc(
    "hit_upload_target_limit",
    {
      p_user: viewer.id,
    },
  );
  return !error && data === true;
}

/** Stores the server-rebuilt skill zip (the file buyers download) under a fresh server path. */
export async function storeRebuiltSkillZip(
  viewer: Viewer,
  name: string,
  bytes: Uint8Array,
) {
  const path = `${viewer.id}/${crypto.randomUUID()}/${name}.zip`;
  const { error } = await createAdminClient()
    .storage.from(FILES_BUCKET)
    .upload(path, bytes, { contentType: "application/zip", upsert: false });
  return error ? null : path;
}

export type SubmitOutcome =
  | { ok: true; publicId: string; status: string; review: boolean; recipeId?: string | null }
  | { ok: false; code: string };

/** public.submit_recipe_version with the secret key (clients can never call it). */
export async function submitVersion(
  viewer: Viewer,
  payload: Record<string, unknown>,
): Promise<SubmitOutcome> {
  const { data, error } = await createAdminClient().rpc(
    "submit_recipe_version",
    {
      p_owner: viewer.id,
      p_payload: payload as never,
    },
  );
  if (error) {
    // Raised codes are ours (P0001 message); anything else is a server problem.
    return {
      ok: false,
      code: error.code === "P0001" ? error.message : "FAILED",
    };
  }
  const r = data as { public_id: string; status: string; review: boolean; recipe_id?: string };
  return {
    ok: true,
    recipeId: r.recipe_id ?? null,
    publicId: r.public_id,
    status: r.status,
    review: Boolean(r.review),
  };
}

/** F6-2: a new recipe made from 「이걸로 만들기」 remembers its origin (public.set_recipe_fork). */
export async function rememberFork(viewer: Viewer, recipeId: string, fromRecipeId: string) {
  const { data } = await createAdminClient().rpc("set_recipe_fork", {
    p_owner: viewer.id,
    p_recipe: recipeId,
    p_from_recipe: fromRecipeId,
  });
  return data === true;
}

/**
 * One uploaded result of the viewer's (SAME 인증): own path, a real image / video whose bytes match
 * the stored type, within the size limit. The kind comes from the stored file, not the client.
 */
export async function inspectOwnUpload(
  viewer: Viewer,
  path: string,
): Promise<{ kind: "image" | "video"; mime: MediaMime } | null> {
  if (!isOwnMediaPath(path, viewer.id)) return null;
  const bucket = (await objectInfo(DRAFT_MEDIA_BUCKET, path)) ? DRAFT_MEDIA_BUCKET : MEDIA_BUCKET;
  const info = await objectInfo(bucket, path);
  if (!info || !Object.hasOwn(MEDIA_MIME, info.mime)) return null;
  const mime = info.mime as MediaMime;
  if (!extMatchesMime(path, mime)) return null;
  const kind = mediaKindOf(mime);
  if (!(info.size > 0) || info.size > (kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) return null;
  if (!sniffMatches(mime, await headBytes(bucket, path))) return null;
  return { kind, mime };
}
