import "server-only";
import type { Viewer } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import {
  MEDIA_BUCKET,
  MEDIA_MIME,
  isOwnMediaPath,
  mediaKindOf,
  mediaUrl,
  sniffMatches,
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

/** UP-08: the viewer's draft for a new recipe (RLS: own rows only). */
export async function getMyDraft(): Promise<DraftDTO | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe_drafts")
    .select("payload,step,updated_at")
    .is("recipe_id", null)
    .maybeSingle();
  if (!data) return null;
  return {
    form: UploadFormSchema.parse(data.payload ?? {}),
    step: data.step,
    updatedAt: data.updated_at,
  };
}

export async function saveMyDraft(
  viewer: Viewer,
  form: UploadForm,
  step: number,
) {
  const supabase = await createClient();
  const row = { payload: form, step, category: form.category };
  const { data: existing } = await supabase
    .from("recipe_drafts")
    .select("id")
    .is("recipe_id", null)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("recipe_drafts").update(row).eq("id", existing.id)
    : await supabase
        .from("recipe_drafts")
        .insert({ ...row, owner_id: viewer.id });
  return !error;
}

export async function deleteMyDraft() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recipe_drafts")
    .delete()
    .is("recipe_id", null);
  return !error;
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
  return signedUpload(
    MEDIA_BUCKET,
    `${viewer.id}/${crypto.randomUUID()}.${MEDIA_MIME[mime]}`,
  );
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
    const info = await objectInfo(MEDIA_BUCKET, m.path);
    if (!info || !Object.hasOwn(MEDIA_MIME, info.mime)) return false;
    const kind = mediaKindOf(info.mime as MediaMime);
    if (kind !== m.kind) return false;
    if (
      !(info.size > 0) ||
      info.size > (kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)
    )
      return false;
    if (!sniffMatches(info.mime as MediaMime, await headBytes(m.path)))
      return false;
  }
  return true;
}

/** First bytes of a public result file (Range request; the bucket is public). */
async function headBytes(path: string): Promise<Uint8Array> {
  const url = mediaUrl(path);
  if (!url) return new Uint8Array();
  try {
    const res = await fetch(url, { headers: { range: "bytes=0-31" }, cache: "no-store" });
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

/** Paid layer 2 runs per submit: 20 per user per hour (public.hit_upload_limit). */
export async function hitUploadLimit(viewer: Viewer): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("hit_upload_limit", {
    p_user: viewer.id,
  });
  return !error && data === true;
}

export type SubmitOutcome =
  | { ok: true; publicId: string; status: string; review: boolean }
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
  const r = data as { public_id: string; status: string; review: boolean };
  return {
    ok: true,
    publicId: r.public_id,
    status: r.status,
    review: Boolean(r.review),
  };
}
