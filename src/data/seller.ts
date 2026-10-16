import "server-only";
import { mediaPreviewUrls } from "@/data/upload";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { ipHash } from "@/lib/abuse/fingerprint";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import {
  RATIOS,
  UploadFormSchema,
  type UploadForm,
} from "@/lib/validation/upload";
import { isRejectCode, type RejectCode } from "@/lib/moderation/reject-codes";

export type RecipeStatus =
  "rejected" | "in_review" | "private" | "live" | "stopped" | "taken_down";

export interface MyRecipeDTO {
  recipeId: string;
  publicId: string;
  title: string;
  category: "prompt" | "agent" | "skill";
  promptKind: "image" | "video" | "text" | null;
  status: RecipeStatus;
  versionNo: number | null;
  pendingVersionNo: number | null;
  reject: { code: RejectCode | null; note: string | null } | null;
  updatedAt: string;
  views: number;
  downloads: number;
  sameCount: number;
  linkClicks: number;
  links: { code: string; clicks: number }[];
}

export const SELLER_DAYS = [7, 30, 90] as const;
export type SellerDays = (typeof SELLER_DAYS)[number];

const STATUSES: RecipeStatus[] = [
  "rejected",
  "in_review",
  "private",
  "live",
  "stopped",
  "taken_down",
];

/** SELL-03 / F5-10: own recipes, rejected → in review → private → live, stats for the period. */
export async function getMyRecipes(days: SellerDays): Promise<MyRecipeDTO[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_recipes", { p_days: days });
  if (error) {
    console.error("[seller] my_recipes failed", error.code);
    return [];
  }
  return data.map((r) => ({
    recipeId: r.recipe_id,
    publicId: r.public_id,
    title: r.title,
    category: r.category as MyRecipeDTO["category"],
    promptKind: (r.prompt_kind ?? null) as MyRecipeDTO["promptKind"],
    status: (STATUSES as string[]).includes(r.status)
      ? (r.status as RecipeStatus)
      : "private",
    versionNo: r.version_no ?? null,
    pendingVersionNo: r.pending_version_no ?? null,
    // The latest version's rejection (a live recipe can have a rejected new version).
    reject:
      r.reject_code || r.status === "rejected"
        ? {
            code: isRejectCode(r.reject_code) ? r.reject_code : null,
            note: r.reject_note ?? null,
          }
        : null,
    updatedAt: r.updated_at,
    views: Number(r.views ?? 0),
    downloads: Number(r.downloads ?? 0),
    sameCount: Number(r.same_count ?? 0),
    linkClicks: Number(r.link_clicks ?? 0),
    links: Array.isArray(r.links)
      ? (r.links as { code?: unknown; clicks?: unknown }[])
          .filter((l) => typeof l.code === "string")
          .map((l) => ({
            code: l.code as string,
            clicks: Number(l.clicks ?? 0),
          }))
      : [],
  }));
}

export interface EditContext {
  form: UploadForm;
  publicId: string;
  status: RecipeStatus;
  versionNo: number;
  reviewPending: boolean;
  reject: { code: RejectCode | null; note: string | null } | null;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strs = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const list = (v: unknown) =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

/**
 * 「고쳐서 다시 제출」 / 「새 버전 올리기」: the latest version as a wizard form, WITHOUT the original
 * (the wizard asks for it through loadOwnOriginal). null when it is not the viewer's recipe.
 */
export async function getRecipeForEdit(
  recipeId: string,
): Promise<EditContext | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_recipe_for_edit", {
    p_recipe: recipeId,
  });
  if (error || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const meta = (
    d.public_meta && typeof d.public_meta === "object" ? d.public_meta : {}
  ) as Record<string, unknown>;
  const category = str(d.category) as UploadForm["category"];
  const files = list(d.files);
  // D18: results may be private (draft bucket) — sign them for the owner's preview.
  const { data: claims } = await supabase.auth.getClaims();
  const previews = await mediaPreviewUrls(
    claims?.claims.sub ?? "",
    list(d.media).map((m) => str(m.path)),
  );
  const zip =
    category === "skill"
      ? files.find((f) => str(f.filename).endsWith(".zip"))
      : undefined;

  const form = UploadFormSchema.parse({
    recipeId,
    category,
    promptKind: d.prompt_kind ?? null,
    title: str(d.title),
    summary: str(d.summary),
    jobCodes: strs(d.job_codes),
    toolCodes: strs(d.tool_codes),
    tags: strs(d.search_tags),
    prompt: {
      body: "",
      variables: list(meta.variables).map((v) => ({
        name: str(v.name),
        description: str(v.description),
        example: str(v.example),
      })),
      settings: list(meta.settings).map((s) => ({
        label: str(s.label),
        value: str(s.value),
      })),
    },
    skill: {
      source: zip ? "zip" : "md",
      skillMd: "",
      zip: zip
        ? {
            path: str(zip.path),
            filename: str(zip.filename),
            size: Number(zip.size ?? 0),
          }
        : null,
      examples: list(meta.examples).map((e) => ({
        user: str(e.user),
        reply: str(e.reply),
      })),
      before: str(meta.before),
      after: str(meta.after),
    },
    agent: {
      flow: strs(meta.flow),
      integrations: strs(meta.integrations),
      runtime: str(meta.runtime),
      does: strs(meta.does),
      doesNot: strs(meta.does_not),
      prepare: strs(meta.prepare),
      config: "",
      noKeys: false,
    },
    // Only results we can show again (server-minted paths); seed placeholders are dropped.
    media: list(d.media)
      .map((m) => ({
        path: str(m.path),
        kind: m.kind === "video" ? "video" : "image",
        ratio: (RATIOS as readonly string[]).includes(str(m.ratio))
          ? str(m.ratio)
          : "1/1",
        alt: str(m.alt),
        ai: m.ai !== false,
        url: previews.get(str(m.path)) ?? "",
      }))
      .filter((m) => m.url),
    visibility: d.status === "private" ? "private" : "public",
    changelog: "",
  });

  const reject =
    d.reject && typeof d.reject === "object"
      ? (d.reject as Record<string, unknown>)
      : null;
  return {
    form,
    publicId: str(d.public_id),
    status: (STATUSES as string[]).includes(str(d.status))
      ? (str(d.status) as RecipeStatus)
      : "private",
    versionNo: Number(d.version_no ?? 1),
    reviewPending: d.review_pending === true,
    reject: reject
      ? {
          code: isRejectCode(reject.code) ? reject.code : null,
          note: str(reject.note) || null,
        }
      : null,
  };
}

/** F5-14: the viewer's waitlist row (RLS: own row only). */
export async function getMyWaitlist(): Promise<{
  joined: boolean;
  categories: string[];
}> {
  if (!hasSupabaseEnv()) return { joined: false, categories: [] };
  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_waitlist")
    .select("categories")
    .maybeSingle();
  return { joined: Boolean(data), categories: data?.categories ?? [] };
}

/**
 * F5-10 views, counted server-side while rendering the dynamic part of the detail page (no public
 * endpoint to hammer). One per visitor per KST day in SQL (IP HMAC). Owners are not counted. On Vercel
 * a request without the platform IP header is not counted; locally a fixed key keeps it countable.
 */
export async function countRecipeView(
  publicId: string,
  isOwner: boolean,
): Promise<void> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (isOwner || !secret || !hasSupabaseEnv()) return;
  const hash =
    (await ipHash(secret, "recipe-view")) ??
    (process.env.VERCEL
      ? null
      : createHmac("sha256", secret).update("recipe-view:local").digest("hex"));
  if (!hash) return;
  after(async () => {
    const { error } = await createAdminClient().rpc("record_recipe_view", {
      p_public_id: publicId,
      p_visitor_hash: hash,
    });
    if (error) console.error("[seller] record_recipe_view failed", error.code);
  });
}
