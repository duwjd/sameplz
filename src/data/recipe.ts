import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { RecipeCardProps } from "@/components/ds";
import { getReferenceData } from "@/data/catalog";
import { toRecipeCard } from "@/lib/catalog/card";
import {
  isPublicId,
  parseRecipePublic,
  type RecipeDetail,
} from "@/lib/recipe/detail";
import { createPublicClient, hasSupabaseEnv } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { degradeCachedRead } from "./degrade";

export const recipeTag = (publicId: string) => `recipe:${publicId}`;

/**
 * PRM·AGT·SKL·STOP public part (viewer-independent, cached per recipe). null → 404 (F1-7):
 * private, in review, rejected and missing recipes all look the same. Never contains originals.
 */
export async function getRecipePublic(
  publicId: string,
): Promise<RecipeDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(recipeTag(publicId));
  if (!isPublicId(publicId) || !hasSupabaseEnv()) return null;
  const { data, error } = await createPublicClient().rpc("get_recipe_public", {
    p_public_id: publicId,
  });
  if (error) return degradeCachedRead("getRecipePublic", error, null);
  return parseRecipePublic(data);
}

/** STOP-03 / detail footer. Popularity-ordered, so it shares the rankings tag. */
export async function getSimilarRecipes(
  publicId: string,
  limit = 4,
): Promise<RecipeCardProps[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(recipeTag(publicId), "rankings");
  if (!hasSupabaseEnv()) return [];
  const [ref, { data, error }] = await Promise.all([
    getReferenceData(),
    createPublicClient().rpc("similar_recipes", {
      p_public_id: publicId,
      p_limit: limit,
    }),
  ]);
  if (error) return degradeCachedRead("getSimilarRecipes", error, []);
  return data.map((row) => toRecipeCard(row, ref));
}

/** NF-02: popular live recipes to keep browsing from the 404 page. */
export async function getPopularRecipes(limit = 6): Promise<RecipeCardProps[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("rankings");
  if (!hasSupabaseEnv()) return [];
  const [ref, { data, error }] = await Promise.all([
    getReferenceData(),
    createPublicClient().rpc("search_recipes", {
      p_sort: "popular",
      p_limit: limit,
    }),
  ]);
  if (error) return degradeCachedRead("getPopularRecipes", error, []);
  return data.map((row) => toRecipeCard(row, ref));
}

/** A few live recipes to prerender at build (Cache Components needs at least one param). */
export async function getPrerenderRecipeIds(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await createPublicClient().rpc("search_recipes", {
    p_sort: "popular",
    p_limit: 20,
  });
  if (error) return degradeCachedRead("getPrerenderRecipeIds", error, []);
  return data.map((r) => r.public_id);
}

export interface RecipeViewerState {
  signedIn: boolean;
  isOwner: boolean;
  liked: boolean;
  entitlement: {
    id: string;
    versionNo: number;
    openedAt: string | null;
    updateAvailable: boolean;
  } | null;
}

const GUEST: RecipeViewerState = {
  signedIn: false,
  isOwner: false,
  liked: false,
  entitlement: null,
};

/** Who is looking (dynamic, never cached): received / own recipe / liked. */
export async function getRecipeViewerState(
  recipeId: string,
): Promise<RecipeViewerState> {
  if (!hasSupabaseEnv()) return GUEST;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return GUEST;
  const { data } = await supabase.rpc("my_recipe_state", {
    p_recipe_id: recipeId,
  });
  const s = (data ?? null) as {
    is_owner?: boolean;
    liked?: boolean;
    entitlement?: {
      id: string;
      version_no: number;
      opened_at: string | null;
      update_available: boolean;
    } | null;
  } | null;
  return {
    signedIn: true,
    isOwner: Boolean(s?.is_owner),
    liked: Boolean(s?.liked),
    entitlement: s?.entitlement
      ? {
          id: s.entitlement.id,
          versionNo: s.entitlement.version_no,
          openedAt: s.entitlement.opened_at,
          updateAvailable: s.entitlement.update_available,
        }
      : null,
  };
}
