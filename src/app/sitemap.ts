import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient, hasSupabaseEnv } from "@/lib/supabase/public";

const SITE = "https://sameplz.vercel.app";

async function liveRecipes(): Promise<
  { public_id: string; updated_at: string }[]
> {
  "use cache";
  cacheLife("hours");
  cacheTag("sitemap");
  if (!hasSupabaseEnv()) return [];
  const { data, error } = await createPublicClient()
    .from("recipes")
    .select("public_id,updated_at")
    .eq("status", "live")
    .order("published_at", { ascending: false })
    .limit(5000);
  if (error) {
    console.error("[sitemap] recipes failed", error.code);
    return [];
  }
  return data;
}

// Live recipes only: STOP is noindex, hidden recipes are 404. Policy pages (F7-7) are static.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const recipes = await liveRecipes();
  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    ...["", "/prompts", "/agents", "/skills", "/collections"].map((p) => ({
      url: `${SITE}/market${p}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...["/guide", "/terms", "/privacy", "/policy/content", "/policy/ai"].map(
      (p) => ({
        url: `${SITE}${p}`,
        changeFrequency: "monthly" as const,
        priority: 0.3,
      }),
    ),
    ...recipes.map((r) => ({
      url: `${SITE}/r/${r.public_id}`,
      lastModified: r.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
