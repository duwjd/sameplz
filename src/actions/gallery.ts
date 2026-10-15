"use server";
// GAL / m:sameup / m:report / fork actions (F6-1~3, F4-11). zod → verified claims → ownership →
// RPC → updateTag. SAME 인증 images are re-checked before they are posted (F6-3).
import { updateTag } from "next/cache";
import { z } from "zod";
import { getGalleryFeed, type GalleryPage } from "@/data/gallery";
import { syncRecipeMedia } from "@/data/media-sync";
import { recipeTag } from "@/data/recipe";
import { createMediaUploadTarget, hitUploadTargetLimit } from "@/data/upload";
import { getViewer, type Viewer } from "@/lib/auth/account";
import { checkImage } from "@/lib/moderation/play";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  DRAFT_MEDIA_BUCKET,
  isMediaMime,
  isOwnMediaPath,
  mediaKindOf,
} from "@/lib/upload/media";
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  RATIOS,
  UploadFormSchema,
  type UploadForm,
} from "@/lib/validation/upload";

type Gate = "LOGIN_REQUIRED" | "SIGNUP_INCOMPLETE";

async function member(): Promise<Viewer | Gate> {
  const viewer = await getViewer();
  if (!viewer) return "LOGIN_REQUIRED";
  if (!viewer.signupComplete) return "SIGNUP_INCOMPLETE";
  return viewer;
}

const refreshGallery = (publicId?: string) => {
  if (publicId) updateTag(recipeTag(publicId));
  updateTag("gallery");
  updateTag("rankings");
};

// ---------------------------------------------------------------- feed (GAL-01)

const PageInput = z.object({
  kind: z.enum(["same_cert"]).nullable().default(null),
  cursor: z
    .object({ before: z.iso.datetime({ offset: true }), beforeId: z.guid() })
    .nullable()
    .default(null),
});

export async function loadGalleryPage(input: unknown): Promise<GalleryPage> {
  const parsed = PageInput.safeParse(input);
  if (!parsed.success) return { posts: [], cursor: null };
  return getGalleryFeed({ kind: parsed.data.kind, cursor: parsed.data.cursor });
}

// ---------------------------------------------------------------- SAME 인증 (m:sameup, F6-1/3, F4-11)

const UploadInput = z.object({
  mime: z.string(),
  size: z.number().int().positive(),
});

/** Signed upload slot for a SAME 인증 image (private draft bucket, D18). */
export async function createSameUpload(
  input: unknown,
): Promise<
  | { ok: true; path: string; token: string; bucket?: string }
  | { ok: false; reason: string }
> {
  const parsed = UploadInput.safeParse(input);
  if (!parsed.success || !isMediaMime(parsed.data.mime))
    return { ok: false, reason: "INVALID_FILE" };
  const viewer = await member();
  if (typeof viewer === "string") return { ok: false, reason: viewer };
  const video = mediaKindOf(parsed.data.mime) === "video";
  if (parsed.data.size > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES))
    return { ok: false, reason: "TOO_LARGE" };
  if (!(await hitUploadTargetLimit(viewer)))
    return { ok: false, reason: "RATE_LIMITED" };
  const target = await createMediaUploadTarget(viewer, parsed.data.mime);
  return target ? { ok: true, ...target } : { ok: false, reason: "FAILED" };
}

const PostInput = z
  .object({
    recipeId: z.guid(),
    title: z.string().trim().min(1).max(40),
    alt: z.string().max(120).default(""),
    ratio: z.enum(RATIOS).default("1/1"),
    mediaPath: z.string().max(200).nullable().default(null),
    kind: z.enum(["image", "video"]).default("image"),
    playCellId: z.guid().nullable().default(null),
  })
  .refine((v) => Boolean(v.mediaPath) !== Boolean(v.playCellId));

export type PostSameResult =
  | { ok: true; status: "visible" | "pending_review" }
  | { ok: false; reason: string };

/** Copy the viewer's own succeeded playground result into the draft bucket (F4-11). */
async function copyPlayResult(viewer: Viewer, cellId: string) {
  const supabase = await createClient();
  const { data: cell } = await supabase
    .from("play_cells")
    .select("result_path, status")
    .eq("id", cellId)
    .maybeSingle();
  if (!cell?.result_path || cell.status !== "succeeded") return null;
  const ext = cell.result_path.split(".").pop() ?? "png";
  const path = `${viewer.id}/${crypto.randomUUID()}.${ext}`;
  const copied = await createAdminClient()
    .storage.from("play-results")
    .copy(cell.result_path, path, { destinationBucket: DRAFT_MEDIA_BUCKET });
  if (copied.error) return null;
  return {
    path,
    kind: ["mp4", "webm"].includes(ext)
      ? ("video" as const)
      : ("image" as const),
  };
}

export async function postSameCert(input: unknown): Promise<PostSameResult> {
  const parsed = PostInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  const viewer = await member();
  if (typeof viewer === "string") return { ok: false, reason: viewer };
  const v = parsed.data;

  let path = v.mediaPath;
  let kind = v.kind;
  if (v.playCellId) {
    const copy = await copyPlayResult(viewer, v.playCellId);
    if (!copy) return { ok: false, reason: "NOT_FOUND" };
    ({ path, kind } = copy);
  } else if (!path || !isOwnMediaPath(path, viewer.id)) {
    return { ok: false, reason: "MEDIA_NOT_UPLOADED" };
  }

  // F6-3: re-check the image before it is shown. A checker that is down sends the post to review
  // (hidden); an uploaded video cannot be checked here and waits for a person too.
  const admin = createAdminClient();
  let status: "visible" | "pending_review" = "visible";
  if (kind === "image") {
    const signed = await admin.storage
      .from(DRAFT_MEDIA_BUCKET)
      .createSignedUrl(path!, 120);
    const verdict = signed.data
      ? await checkImage(signed.data.signedUrl)
      : "unavailable";
    if (verdict === "blocked") {
      await admin.storage.from(DRAFT_MEDIA_BUCKET).remove([path!]);
      return { ok: false, reason: "SAFETY_BLOCKED" };
    }
    if (verdict === "unavailable") status = "pending_review";
  } else if (!v.playCellId) status = "pending_review";

  const { data, error } = await admin.rpc("post_same_cert", {
    p_user: viewer.id,
    p_recipe: v.recipeId,
    p_media_path: path!,
    p_kind: kind,
    p_ratio: v.ratio,
    p_alt: v.alt,
    p_title: v.title,
    p_play_cell: v.playCellId as string,
    p_status: status,
  });
  const r = data as { ok?: boolean; reason?: string } | null;
  if (error || !r?.ok) return { ok: false, reason: r?.reason ?? "FAILED" };
  // The new post's result goes public with its recipe (D18) before the gallery is shown again.
  await syncRecipeMedia().catch(() => null);
  const { data: rec } = await admin
    .from("recipes")
    .select("public_id")
    .eq("id", v.recipeId)
    .maybeSingle();
  refreshGallery(rec?.public_id);
  return { ok: true, status };
}

const PostId = z.object({ postId: z.guid() });

/** ACTV 「내리기」: own SAME 인증 only (RLS gallery_posts_delete_own). SAME −1. */
export async function removeSameCert(input: unknown): Promise<{ ok: boolean }> {
  const parsed = PostId.safeParse(input);
  if (!parsed.success) return { ok: false };
  const viewer = await member();
  if (typeof viewer === "string") return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gallery_posts")
    .delete()
    .eq("id", parsed.data.postId)
    .eq("author_id", viewer.id)
    .eq("kind", "same_cert")
    .select("recipe_id");
  if (error || !data?.length) return { ok: false };
  await syncRecipeMedia().catch(() => null);
  const { data: rec } = await supabase
    .from("recipes")
    .select("public_id")
    .eq("id", data[0].recipe_id)
    .maybeSingle();
  refreshGallery(rec?.public_id);
  return { ok: true };
}

/** F6-5: like / unlike a post (RLS: own rows, visible posts). */
export async function togglePostLike(
  input: unknown,
): Promise<{ ok: boolean; liked?: boolean; reason?: Gate }> {
  const parsed = PostId.safeParse(input);
  if (!parsed.success) return { ok: false };
  const viewer = await member();
  if (typeof viewer === "string") return { ok: false, reason: viewer };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", viewer.id)
    .eq("post_id", parsed.data.postId)
    .maybeSingle();
  const { error } = existing
    ? await supabase
        .from("post_likes")
        .delete()
        .eq("user_id", viewer.id)
        .eq("post_id", parsed.data.postId)
    : await supabase
        .from("post_likes")
        .insert({ user_id: viewer.id, post_id: parsed.data.postId });
  if (error) return { ok: false };
  updateTag("gallery");
  return { ok: true, liked: !existing };
}

// ---------------------------------------------------------------- report (m:report, F6-3)

const ReportInput = z.object({
  targetType: z.enum(["recipe", "post"]),
  targetId: z.guid(),
  reason: z.enum(["misleading", "malicious", "rights", "prohibited"]),
  detail: z.string().max(500).default(""),
});

export async function createReport(
  input: unknown,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parsed = ReportInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  const viewer = await member();
  if (typeof viewer === "string") return { ok: false, reason: viewer };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_report", {
    p_target_type: parsed.data.targetType,
    p_target: parsed.data.targetId,
    p_reason: parsed.data.reason,
    p_detail: parsed.data.detail,
  });
  const r = data as { ok?: boolean; reason?: string } | null;
  if (error || !r?.ok) return { ok: false, reason: r?.reason ?? "FAILED" };
  return { ok: true };
}

// ---------------------------------------------------------------- drafts from the gallery / playground

/** Write the viewer's new-recipe draft (recipe_id null). Refuses to replace one unless asked. */
async function writeNewDraft(
  viewer: Viewer,
  form: UploadForm,
  replace: boolean,
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("recipe_drafts")
    .select("id")
    .eq("owner_id", viewer.id)
    .is("recipe_id", null)
    .maybeSingle();
  if (existing && !replace) return "DRAFT_EXISTS" as const;
  const row = { payload: form, step: 1, category: form.category };
  const { error } = existing
    ? await supabase.from("recipe_drafts").update(row).eq("id", existing.id)
    : await supabase
        .from("recipe_drafts")
        .insert({ ...row, owner_id: viewer.id, recipe_id: null });
  return error ? ("FAILED" as const) : ("ok" as const);
}

const ForkInput = z.object({
  publicId: z.string().regex(/^[a-z0-9]{6,16}$/),
  replace: z.boolean().default(false),
});

/**
 * GAL-03 「이걸로 만들기」 (F6-2): a new upload draft that remembers its origin. Only public meta is
 * copied (category, kind, [변수] names); the original prompt is never copied.
 */
export async function forkRecipe(
  input: unknown,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parsed = ForkInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "NOT_FOUND" };
  const viewer = await member();
  if (typeof viewer === "string") return { ok: false, reason: viewer };
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("recipes")
    .select(
      "id, public_id, title, category, prompt_kind, status, fork_allowed, owner_id",
    )
    .eq("public_id", parsed.data.publicId)
    .maybeSingle();
  if (!r || r.status !== "live" || !r.fork_allowed)
    return { ok: false, reason: "FORK_BLOCKED" };
  if (r.owner_id === viewer.id) return { ok: false, reason: "OWN_RECIPE" };
  const form = UploadFormSchema.parse({
    recipeId: null,
    forkOf: { recipeId: r.id, publicId: r.public_id, title: r.title },
    category: r.category,
    promptKind: r.prompt_kind,
    title: "",
  });
  const written = await writeNewDraft(viewer, form, parsed.data.replace);
  return written === "ok" ? { ok: true } : { ok: false, reason: written };
}

const RunInput = z.object({
  runId: z.guid(),
  replace: z.boolean().default(false),
});

/** F4-11 「이 프롬프트로 레시피 올리기」: the viewer's blank-prompt run → a new upload draft with results. */
export async function draftFromRun(
  input: unknown,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parsed = RunInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "NOT_FOUND" };
  const viewer = await member();
  if (typeof viewer === "string") return { ok: false, reason: viewer };
  const supabase = await createClient();
  const { data: run } = await supabase
    .from("play_runs")
    .select("id, mode, prompt_text")
    .eq("id", parsed.data.runId)
    .maybeSingle();
  if (!run || run.mode !== "blank" || !run.prompt_text)
    return { ok: false, reason: "NOT_FOUND" };
  const { data: cells } = await supabase
    .from("play_cells")
    .select("id, result_path, status")
    .eq("run_id", run.id)
    .eq("status", "succeeded")
    .limit(4);
  const media: UploadForm["media"] = [];
  for (const c of cells ?? []) {
    const copy = await copyPlayResult(viewer, c.id);
    if (copy)
      media.push({
        path: copy.path,
        kind: copy.kind,
        ratio: "1/1",
        alt: "",
        ai: true,
        url: "",
      });
  }
  const form = UploadFormSchema.parse({
    recipeId: null,
    category: "prompt",
    promptKind: media.some((m) => m.kind === "video") ? "video" : "image",
    prompt: { body: run.prompt_text, variables: [], settings: [] },
    media,
  });
  const written = await writeNewDraft(viewer, form, parsed.data.replace);
  return written === "ok" ? { ok: true } : { ok: false, reason: written };
}
