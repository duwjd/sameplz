import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { RecipeCardProps } from "@/components/ds";
import { toRecipeCard, type ReferenceData } from "@/lib/catalog/card";
import { createPublicClient, hasSupabaseEnv } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import {
  MARKET_PAGE_SIZE,
  type MarketCategory,
  type MarketQuery,
} from "@/lib/validation/market";

export interface ToolOption {
  code: string;
  label: string;
  kind: string;
}

/** Job / tool labels (public reference data). */
export async function getReferenceData(): Promise<
  ReferenceData & {
    toolList: ToolOption[];
    jobList: { code: string; label: string }[];
  }
> {
  "use cache";
  cacheLife("hours");
  cacheTag("reference");
  if (!hasSupabaseEnv())
    return { jobs: {}, tools: {}, jobList: [], toolList: [] };
  const supabase = createPublicClient();
  const [jobs, tools] = await Promise.all([
    supabase.from("jobs").select("code,label,sort").order("sort"),
    supabase.from("tools").select("code,label,kind,sort").order("sort"),
  ]);
  if (jobs.error) throw jobs.error;
  if (tools.error) throw tools.error;
  return {
    jobs: Object.fromEntries(jobs.data.map((j) => [j.code, j.label])),
    tools: Object.fromEntries(tools.data.map((t) => [t.code, t.label])),
    jobList: jobs.data.map(({ code, label }) => ({ code, label })),
    toolList: tools.data.map(({ code, label, kind }) => ({
      code,
      label,
      kind,
    })),
  };
}

export type CategoryCounts = Record<MarketCategory, number> & { all: number };

function toCounts(
  rows: { category: string; total: number }[] | null,
): CategoryCounts {
  const counts: CategoryCounts = { all: 0, prompt: 0, agent: 0, skill: 0 };
  for (const r of rows ?? []) {
    if (
      r.category === "prompt" ||
      r.category === "agent" ||
      r.category === "skill"
    ) {
      counts[r.category] = Number(r.total);
      counts.all += Number(r.total);
    }
  }
  return counts;
}

/** MKT-01 「판매 중 N개」: live recipes per category, ignoring filters. */
export async function getLiveCounts(): Promise<CategoryCounts> {
  "use cache";
  cacheLife("minutes");
  cacheTag("rankings");
  if (!hasSupabaseEnv()) return toCounts([]);
  const { data, error } = await createPublicClient().rpc(
    "search_recipe_counts",
    {},
  );
  if (error) throw error;
  return toCounts(data);
}

export interface MarketResult {
  cards: RecipeCardProps[];
  total: number;
  /** Only when this page is empty: hits per category for the same query/filters (F1-6). */
  elsewhere: CategoryCounts | null;
}

/**
 * MKT list + search. Not cached: search_recipes logs queries (first page) and results depend
 * on the full normalized query. Runs with the caller's session (anon for guests).
 */
export async function searchMarket(query: MarketQuery): Promise<MarketResult> {
  if (!hasSupabaseEnv())
    return { cards: [], total: 0, elsewhere: toCounts([]) };
  const supabase = await createClient();
  const ref = await getReferenceData();

  // 1-char queries: the RPC returns nothing by design; skip the round trip.
  if (query.q && query.q.length < 2) {
    return { cards: [], total: 0, elsewhere: toCounts([]) };
  }

  const { data, error } = await supabase.rpc("search_recipes", {
    p_query: query.q ?? undefined,
    p_category: query.category ?? undefined,
    p_job: query.job ?? undefined,
    p_tool: query.tool ?? undefined,
    p_sort: query.sort,
    p_limit: MARKET_PAGE_SIZE,
    p_offset: (query.page - 1) * MARKET_PAGE_SIZE,
  });
  if (error) throw error;

  const rows = data ?? [];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  let elsewhere: CategoryCounts | null = null;
  if (rows.length === 0) {
    const counts = await supabase.rpc("search_recipe_counts", {
      p_query: query.q ?? undefined,
      p_job: query.job ?? undefined,
      p_tool: query.tool ?? undefined,
    });
    if (counts.error) throw counts.error;
    elsewhere = toCounts(counts.data);
  }
  return { cards: rows.map((r) => toRecipeCard(r, ref)), total, elsewhere };
}

export interface CollectionPack {
  slug: string;
  title: string;
  intro: string;
  reason: string;
  cards: RecipeCardProps[];
}

/** COL-01: live packs with their live recipes (RLS hides the rest). */
export async function getCollections(): Promise<CollectionPack[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("collections");
  if (!hasSupabaseEnv()) return [];
  const supabase = createPublicClient();
  const ref = await getReferenceData();
  const { data, error } = await supabase
    .from("collections")
    .select(
      "slug,title,intro,reason,sort,collection_items(sort,recipes(public_id,title,summary,category,prompt_kind,price_krw,creator_nickname,job_codes,tool_codes,filters,status))",
    )
    .eq("status", "live")
    .order("sort");
  if (error) throw error;

  return (data ?? []).map((c) => ({
    slug: c.slug,
    title: c.title,
    intro: c.intro,
    reason: c.reason,
    cards: [...(c.collection_items ?? [])]
      .sort((a, b) => a.sort - b.sort)
      .flatMap((item) => {
        const r = item.recipes;
        if (!r || r.status !== "live") return [];
        return [
          toRecipeCard(
            {
              ...r,
              creator_handle: "",
              downloads: 0,
              same_count: 0,
              likes: 0,
              popularity: 0,
              published_at: "",
              score: 0,
              total_count: 0,
            },
            ref,
          ),
        ];
      }),
  }));
}
