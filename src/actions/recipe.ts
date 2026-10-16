"use server";
import { createHmac } from "node:crypto";
import { updateTag } from "next/cache";
import { z } from "zod";
import { recipeTag } from "@/data/recipe";
import { ipHash } from "@/lib/abuse/fingerprint";
import { getViewer } from "@/lib/auth/account";
import { isPublicId } from "@/lib/recipe/detail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const RecipeRef = z.object({
  recipeId: z.guid(),
  publicId: z.string().refine(isPublicId),
});
const RefCode = z.string().regex(/^[a-z0-9]{6,12}$/);

const CLAIM_REASONS = [
  "SIGNUP_INCOMPLETE",
  "ACCOUNT_SUSPENDED",
  "RECIPE_UNAVAILABLE",
  "OWN_RECIPE",
  "NOT_FREE",
] as const;
type ClaimReason = (typeof CLAIM_REASONS)[number] | "LOGIN_REQUIRED" | "FAILED";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Invalidate the detail cache by the recipe's real public id (never a client-sent one). */
async function refreshRecipeTag(supabase: ServerClient, recipeId: string) {
  const { data } = await supabase
    .from("recipes")
    .select("public_id")
    .eq("id", recipeId)
    .maybeSingle();
  if (data) updateTag(recipeTag(data.public_id));
}

export type ClaimResult =
  | { ok: true; entitlementId: string; created: boolean }
  | { ok: false; reason: ClaimReason };

/** F2-1 「무료로 SAME 하기」: zod → claims → claim_free_recipe (idempotent) → updateTag. */
export async function claimFreeRecipe(input: {
  recipeId: string;
  publicId: string;
  ref?: string | null;
}): Promise<ClaimResult> {
  const parsed = RecipeRef.extend({
    ref: RefCode.nullish().catch(null),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "RECIPE_UNAVAILABLE" };

  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "LOGIN_REQUIRED" };
  if (!viewer.signupComplete) return { ok: false, reason: "SIGNUP_INCOMPLETE" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_free_recipe", {
    p_recipe_id: parsed.data.recipeId,
    p_ref_code: parsed.data.ref ?? undefined,
  });
  if (error) {
    const known = CLAIM_REASONS.find((r) => error.message === r);
    return { ok: false, reason: known ?? "FAILED" };
  }
  const res = data as { entitlement_id: string; created: boolean };
  await refreshRecipeTag(supabase, parsed.data.recipeId); // download count on the detail page
  return { ok: true, entitlementId: res.entitlement_id, created: res.created };
}

export type LikeResult =
  | { ok: true; liked: boolean }
  | { ok: false; reason: "LOGIN_REQUIRED" | "SIGNUP_INCOMPLETE" | "FAILED" };

/** PRM-02 좋아요. RLS: own rows, visible recipes, finished signup. */
export async function toggleRecipeLike(input: {
  recipeId: string;
  publicId: string;
  like: boolean;
}): Promise<LikeResult> {
  const parsed = RecipeRef.extend({ like: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "FAILED" };

  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "LOGIN_REQUIRED" };
  if (!viewer.signupComplete) return { ok: false, reason: "SIGNUP_INCOMPLETE" };

  const supabase = await createClient();
  const { recipeId, like } = parsed.data;
  const result = like
    ? await supabase
        .from("recipe_likes")
        .upsert(
          { user_id: viewer.id, recipe_id: recipeId },
          { ignoreDuplicates: true },
        )
    : await supabase
        .from("recipe_likes")
        .delete()
        .eq("user_id", viewer.id)
        .eq("recipe_id", recipeId);
  if (result.error) return { ok: false, reason: "FAILED" };

  await refreshRecipeTag(supabase, recipeId);
  return { ok: true, liked: like };
}

/**
 * F2-3: count a share-link visit (MVP: counts only, no fee or attribution). Returns the creator
 * nickname for the inflow band, or null when the code is not this recipe's.
 */
export async function recordShareClick(input: {
  publicId: string;
  code: string;
}): Promise<{ creator: string | null }> {
  const parsed = z
    .object({ publicId: z.string().refine(isPublicId), code: RefCode })
    .safeParse(input);
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!parsed.success || !secret) return { creator: null };

  const { data, error } = await createAdminClient().rpc("record_share_click", {
    p_public_id: parsed.data.publicId,
    p_code: parsed.data.code,
    // IP HMAC: a script cannot mint visitors per request (W3 security review). Loopback (local
    // dev) falls back to a fixed key so clicks still count once.
    p_visitor_hash:
      (await ipHash(secret, "share-visitor")) ??
      createHmac("sha256", secret).update("share-visitor:local").digest("hex"),
  });
  if (error) {
    console.error("[share] record_share_click failed", error.code);
    return { creator: null };
  }
  return { creator: typeof data === "string" ? data : null };
}
