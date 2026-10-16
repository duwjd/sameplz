"use server";
import { updateTag } from "next/cache";
import { syncRecipeMedia } from "@/data/media-sync";
import { z } from "zod";
import { recipeTag } from "@/data/recipe";
import { readOwnOriginal, type OwnOriginalDTO } from "@/data/secrets";
import { getViewer, sanctionBlock, type Viewer } from "@/lib/auth/account";
import { WAITLIST_CONSENT_VERSION } from "@/lib/seller/waitlist";
import { createClient } from "@/lib/supabase/server";

type Gate =
  | { ok: true; viewer: Viewer }
  | {
      ok: false;
      reason:
        | "LOGIN_REQUIRED"
        | "SIGNUP_INCOMPLETE"
        | "ACCOUNT_SUSPENDED"
        | "SELLER_SUSPENDED";
    };
async function creator(): Promise<Gate> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "LOGIN_REQUIRED" };
  if (!viewer.signupComplete) return { ok: false, reason: "SIGNUP_INCOMPLETE" };
  // F8-4: republishing and share links count as selling (the database refuses them too).
  const blocked = sanctionBlock(viewer, "seller");
  if (blocked) return { ok: false, reason: blocked };
  return { ok: true, viewer };
}

const RecipeId = z.guid();
const rpcCode = (e: { code?: string; message: string } | null) =>
  e?.code === "P0001" ? e.message : "FAILED";

// ---------------------------------------------------------------- visibility (SELL-03)

export type VisibilityResult =
  | { ok: true; status: "live" | "private" }
  | {
      ok: false;
      reason:
        | "LOGIN_REQUIRED"
        | "SIGNUP_INCOMPLETE"
        | "ACCOUNT_SUSPENDED"
        | "SELLER_SUSPENDED"
        | "NOT_FOUND"
        | "NOT_TOGGLEABLE"
        | "FAILED";
    };

/** 공개 ↔ 비공개. Ownership and state are checked in set_recipe_visibility. */
export async function setRecipeVisibility(input: {
  recipeId: string;
  visibility: "public" | "private";
}): Promise<VisibilityResult> {
  const parsed = z
    .object({ recipeId: RecipeId, visibility: z.enum(["public", "private"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "NOT_FOUND" };
  const gate = await creator();
  if (!gate.ok) return { ok: false, reason: gate.reason };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_recipe_visibility", {
    p_recipe: parsed.data.recipeId,
    p_visibility: parsed.data.visibility,
  });
  if (error) {
    const code = rpcCode(error);
    return {
      ok: false,
      reason:
        code === "NOT_FOUND" || code === "NOT_TOGGLEABLE" ? code : "FAILED",
    };
  }
  const r = data as { public_id: string; status: "live" | "private" };
  // D18: results follow the recipe (public bucket only while live).
  await syncRecipeMedia().catch(() => null);
  // The detail page and every popularity list change with visibility.
  updateTag(recipeTag(r.public_id));
  updateTag("rankings");
  updateTag("collections");
  updateTag("sitemap");
  return { ok: true, status: r.status };
}

// ---------------------------------------------------------------- share links (SELL-04, F5-10)

export type ShareLinkResult =
  | { ok: true; code: string }
  | {
      ok: false;
      reason:
        | "LOGIN_REQUIRED"
        | "SIGNUP_INCOMPLETE"
        | "ACCOUNT_SUSPENDED"
        | "SELLER_SUSPENDED"
        | "INVALID_CODE"
        | "CODE_TAKEN"
        | "TOO_MANY_LINKS"
        | "NOT_LIVE"
        | "NOT_FOUND"
        | "FAILED";
    };

export async function createShareLink(input: {
  recipeId: string;
  code: string;
}): Promise<ShareLinkResult> {
  const parsed = z
    .object({ recipeId: RecipeId, code: z.string().max(40) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_CODE" };
  const code = parsed.data.code.trim();
  if (!/^[a-z0-9]{6,12}$/.test(code))
    return { ok: false, reason: "INVALID_CODE" };
  const gate = await creator();
  if (!gate.ok) return { ok: false, reason: gate.reason };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_share_link", {
    p_recipe: parsed.data.recipeId,
    p_code: code,
  });
  if (error) {
    const c = rpcCode(error);
    const known = [
      "INVALID_CODE",
      "CODE_TAKEN",
      "TOO_MANY_LINKS",
      "NOT_LIVE",
      "NOT_FOUND",
    ] as const;
    return {
      ok: false,
      reason: (known as readonly string[]).includes(c)
        ? (c as (typeof known)[number])
        : "FAILED",
    };
  }
  return { ok: true, code };
}

// ---------------------------------------------------------------- waitlist (F5-14)

const Categories = z.array(z.enum(["prompt", "agent", "skill"])).max(3);

export type WaitlistResult =
  | { ok: true; joined: boolean }
  | {
      ok: false;
      reason:
        | "LOGIN_REQUIRED"
        | "SIGNUP_INCOMPLETE"
        | "ACCOUNT_SUSPENDED"
        | "SELLER_SUSPENDED"
        | "FAILED";
    };

/** 「유료 판매 오픈 알림 신청」 once per user (PK user_id); again → 「신청했어요」, cancel deletes. */
export async function setWaitlist(input: {
  join: boolean;
  categories?: string[];
}): Promise<WaitlistResult> {
  const parsed = z
    .object({ join: z.boolean(), categories: Categories.optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "FAILED" };
  const gate = await creator();
  if (!gate.ok) return { ok: false, reason: gate.reason };
  const supabase = await createClient();
  if (!parsed.data.join) {
    const { error } = await supabase
      .from("creator_waitlist")
      .delete()
      .eq("user_id", gate.viewer.id);
    return error
      ? { ok: false, reason: "FAILED" }
      : { ok: true, joined: false };
  }
  const row = {
    user_id: gate.viewer.id,
    categories: [...new Set(parsed.data.categories ?? [])],
    consent_version: WAITLIST_CONSENT_VERSION,
  };
  let { error } = await supabase.from("creator_waitlist").insert(row);
  // Already on the list: re-record the current wording version and categories (RLS has no UPDATE
  // policy, so replace the own row).
  if (error?.code === "23505") {
    const del = await supabase
      .from("creator_waitlist")
      .delete()
      .eq("user_id", gate.viewer.id);
    ({ error } = del.error
      ? del
      : await supabase.from("creator_waitlist").insert(row));
  }
  if (error) return { ok: false, reason: "FAILED" };
  return { ok: true, joined: true };
}

// ---------------------------------------------------------------- edit (UP-08, F5-6, F5-7)

export type OwnOriginalResult =
  { ok: true; original: OwnOriginalDTO } | { ok: false };

/** The owner's own latest original for 「고쳐서 다시 제출」 / 「새 버전 올리기」. Never cached. */
export async function loadOwnOriginal(input: {
  recipeId: string;
}): Promise<OwnOriginalResult> {
  const parsed = z.object({ recipeId: RecipeId }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const gate = await creator();
  if (!gate.ok) return { ok: false };
  const original = await readOwnOriginal(parsed.data.recipeId);
  return original ? { ok: true, original } : { ok: false };
}
