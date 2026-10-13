import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type {
  GalleryTileProps,
  RankCardProps,
  RecipeCardProps,
} from "@/components/ds";
import { getReferenceData } from "@/data/catalog";
import {
  KIND,
  mediaLabelFor,
  recipeHref,
  toRecipeCard,
} from "@/lib/catalog/card";
import { createPublicClient, hasSupabaseEnv } from "@/lib/supabase/public";

export const RANK_TABS = ["all", "prompt", "agent", "skill"] as const;
export type RankTab = (typeof RANK_TABS)[number];

export interface HomeSlide {
  name: string;
  eyebrow?: string;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
  imageLabel?: string;
}

export interface HomeGalleryItem extends Omit<
  GalleryTileProps,
  "onSame" | "onFork" | "onLike" | "onRecipe"
> {
  id: string;
  recipeHref: string;
}

export interface HomeCreator {
  handle: string;
  name: string;
  avatar?: string;
  followers: number;
  top: string;
  topHref: string;
  isStaff: boolean;
}

export interface HomeSections {
  slides: HomeSlide[];
  weekly: RecipeCardProps[];
  rankings: Record<RankTab, RankCardProps[]>;
  rankedAt: string | null;
  gallery: HomeGalleryItem[];
  creators: HomeCreator[];
}

// Shown when no banner is active yet (fresh production DB).
const DEFAULT_SLIDE: HomeSlide = {
  name: "서비스",
  eyebrow: "AI 레시피 플레이그라운드",
  title: "저거랑 같은 걸로 주세요.",
  description:
    "남이 만든 AI 결과물을 구경하다가 SAME을 누르면, 그걸 만든 프롬프트·에이전트·스킬을 그대로 받아요.",
  cta: { label: "마켓 둘러보기", href: "/market" },
  imageLabel: "결과물 콜라주",
};

const EMPTY: HomeSections = {
  slides: [DEFAULT_SLIDE],
  weekly: [],
  rankings: { all: [], prompt: [], agent: [], skill: [] },
  rankedAt: null,
  gallery: [],
  creators: [],
};

/** HOME-01~05 in one cached read (public data, anon RLS + definer RPCs). */
export async function getHomeSections(): Promise<HomeSections> {
  "use cache";
  cacheLife("minutes");
  cacheTag("rankings", "gallery");
  if (!hasSupabaseEnv()) return EMPTY;

  const supabase = createPublicClient();
  const ref = await getReferenceData();
  const [banners, weekly, creators, gallery, ...ranks] = await Promise.all([
    supabase
      .from("banners")
      .select("name,eyebrow,title,subtitle,cta_label,cta_href,alt_text,sort")
      .order("sort"),
    supabase.rpc("home_weekly", { p_limit: 4 }),
    supabase.rpc("home_creators", { p_limit: 8 }),
    supabase.rpc("home_gallery", { p_limit: 16 }),
    ...RANK_TABS.map((tab) =>
      supabase.rpc("home_rankings", { p_category: tab }),
    ),
  ]);
  for (const r of [banners, weekly, creators, gallery, ...ranks])
    if (r.error) throw r.error;

  const slides: HomeSlide[] = (banners.data ?? []).map((b) => ({
    name: b.name,
    eyebrow: b.eyebrow || undefined,
    title: b.title,
    description: b.subtitle || undefined,
    cta:
      b.cta_label && b.cta_href
        ? { label: b.cta_label, href: b.cta_href }
        : undefined,
    imageLabel: b.alt_text ?? undefined,
  }));

  const rankings = Object.fromEntries(
    RANK_TABS.map((tab, i) => [
      tab,
      (ranks[i].data ?? []).map((r): RankCardProps => ({
        rank: r.rank,
        title: r.title,
        creator: r.creator_nickname,
        category: r.category as RankCardProps["category"],
        kind: r.prompt_kind ? KIND[r.prompt_kind] : undefined,
        price: r.price_krw,
        // F1-3: NEW for fresh entries; 0 renders as — (no previous snapshot or < 100 downloads / 24h).
        move: r.is_new ? "new" : (r.move ?? 0),
        mediaLabel: mediaLabelFor(r.category, r.filters, ref),
        href: recipeHref(r.public_id),
      })),
    ]),
  ) as Record<RankTab, RankCardProps[]>;

  return {
    slides: slides.length > 0 ? slides : [DEFAULT_SLIDE],
    weekly: (weekly.data ?? []).map((w) => toRecipeCard(w, ref)),
    rankings,
    rankedAt: ranks[0].data?.[0]?.taken_at ?? null,
    gallery: (gallery.data ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      creator: g.author_nickname,
      recipe: g.recipe_title,
      recipeHref: recipeHref(g.recipe_public_id),
      ratio: g.ratio ?? "1/1",
      kind: g.media_kind === "video" ? "영상" : undefined,
      type: g.kind === "same_cert" ? "same" : "original",
      madeHere: g.generated_here,
      likes: g.likes,
    })),
    creators: (creators.data ?? []).map((c) => ({
      handle: c.handle,
      name: c.nickname,
      avatar: c.avatar_url ?? undefined,
      followers: c.followers,
      top: c.top_title,
      topHref: recipeHref(c.top_public_id),
      isStaff: c.is_staff,
    })),
  };
}
