// GAL read DAL: the feed (visible posts on live recipes, gallery_feed) and what the viewer can post a
// SAME 인증 for. Public media URLs only (D18: a visible post's result is in the public bucket).
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { degradeCachedRead } from "@/data/degrade";
import { recipeTag } from "@/data/recipe";
import type { Viewer } from "@/lib/auth/account";
import { recipeHref } from "@/lib/catalog/card";
import { createPublicClient, hasSupabaseEnv } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/upload/media";

export interface GalleryPostDTO {
  id: string;
  title: string;
  type: "original" | "same";
  ratio: string;
  kind: "image" | "video";
  media: string | null;
  alt: string | null;
  madeHere: boolean;
  author: string;
  authorId: string;
  recipeId: string;
  recipe: string;
  recipeHref: string;
  recipePublicId: string;
  canFork: boolean;
  likes: number;
  liked: boolean;
  createdAt: string;
}

export interface GalleryPage {
  posts: GalleryPostDTO[];
  /** Pass back to load the next page; null at the end. */
  cursor: { before: string; beforeId: string } | null;
}

export const GALLERY_PAGE = 24;

export async function getGalleryFeed(
  opts: {
    kind?: "same_cert" | null;
    cursor?: { before: string; beforeId: string } | null;
    recipeId?: string | null;
    limit?: number;
  } = {},
): Promise<GalleryPage> {
  if (!hasSupabaseEnv()) return { posts: [], cursor: null };
  const limit = opts.limit ?? GALLERY_PAGE;
  const supabase = await createClient();
  const { data } = await supabase.rpc("gallery_feed", {
    p_kind: opts.kind ?? undefined,
    p_before: opts.cursor?.before,
    p_before_id: opts.cursor?.beforeId,
    p_limit: limit,
    p_recipe: opts.recipeId ?? undefined,
  });
  const rows = data ?? [];
  const posts = rows.map((g): GalleryPostDTO => ({
    id: g.id,
    title: g.title,
    type: g.kind === "same_cert" ? "same" : "original",
    ratio: g.ratio ?? "1/1",
    kind: g.media_kind === "video" ? "video" : "image",
    media: mediaUrl(g.media_path),
    alt: g.alt_text,
    madeHere: g.generated_here,
    author: g.author_nickname,
    authorId: g.author_id,
    recipeId: g.recipe_id,
    recipe: g.recipe_title,
    recipeHref: recipeHref(g.recipe_public_id),
    recipePublicId: g.recipe_public_id,
    canFork: g.fork_allowed,
    likes: g.likes,
    liked: g.liked,
    createdAt: g.created_at,
  }));
  const last = rows.at(-1);
  return {
    posts,
    cursor:
      rows.length === limit && last
        ? { before: last.created_at, beforeId: last.id }
        : null,
  };
}

export interface SameTargetDTO {
  recipeId: string;
  publicId: string;
  title: string;
}

/** GAL-04 / m:sameup: live recipes the viewer received (a SAME 인증 needs an active entitlement). */
export async function getMySameTargets(
  viewer: Viewer,
): Promise<SameTargetDTO[]> {
  const supabase = await createClient();
  const { data: ents } = await supabase
    .from("entitlements")
    .select("recipe_id")
    .eq("user_id", viewer.id)
    .is("revoked_at", null)
    .limit(200);
  const ids = (ents ?? []).map((e) => e.recipe_id);
  if (!ids.length) return [];
  const { data } = await supabase
    .from("recipes")
    .select("id, public_id, title")
    .in("id", ids)
    .eq("status", "live")
    .neq("owner_id", viewer.id)
    .order("title");
  return (data ?? []).map((r) => ({
    recipeId: r.id,
    publicId: r.public_id,
    title: r.title,
  }));
}

/** Detail 「따라 만든 결과」: a recipe's visible SAME 인증 (public, cached with the recipe and gallery). */
export async function getRecipeSamePosts(publicId: string, recipeId: string, limit = 8): Promise<GalleryPostDTO[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(recipeTag(publicId), "gallery");
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await createPublicClient().rpc("gallery_feed", {
    p_kind: "same_cert",
    p_limit: limit,
    p_recipe: recipeId,
  });
  if (error) return degradeCachedRead("getRecipeSamePosts", error, []);
  return (data ?? []).map(
    (g): GalleryPostDTO => ({
      id: g.id,
      title: g.title,
      type: "same",
      ratio: g.ratio ?? "1/1",
      kind: g.media_kind === "video" ? "video" : "image",
      media: mediaUrl(g.media_path),
      alt: g.alt_text,
      madeHere: g.generated_here,
      author: g.author_nickname,
      authorId: g.author_id,
      recipeId: g.recipe_id,
      recipe: g.recipe_title,
      recipeHref: recipeHref(g.recipe_public_id),
      recipePublicId: g.recipe_public_id,
      canFork: g.fork_allowed,
      likes: g.likes,
      liked: false,
      createdAt: g.created_at,
    }),
  );
}
