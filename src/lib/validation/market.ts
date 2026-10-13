import { z } from "zod";

// MKT searchParams → normalized query. Invalid values are dropped (fall back to defaults)
// instead of erroring, so shared links never break the page.
export const MARKET_SORTS = ["popular", "downloads", "new"] as const;
export type MarketSort = (typeof MARKET_SORTS)[number];

export const MARKET_CATEGORIES = {
  prompts: "prompt",
  agents: "agent",
  skills: "skill",
} as const;
export type MarketSlug = keyof typeof MARKET_CATEGORIES;
export type MarketCategory = (typeof MARKET_CATEGORIES)[MarketSlug];

export const MARKET_PAGE_SIZE = 20;

export interface MarketQuery {
  q: string | null;
  category: MarketCategory | null;
  job: string | null;
  tool: string | null;
  sort: MarketSort;
  page: number;
}

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const text = z
  .unknown()
  .transform(first)
  .pipe(z.string().optional())
  .catch(undefined);

const code = text.transform((v) =>
  v && /^[a-z0-9_]{2,30}$/.test(v) ? v : null,
);

export function parseMarketQuery(
  searchParams: Record<string, string | string[] | undefined>,
  categorySlug?: string,
): MarketQuery {
  const q = text.parse(searchParams.q);
  const sort = text.parse(searchParams.sort);
  const page = Number.parseInt(text.parse(searchParams.page) ?? "", 10);
  const fromPath =
    categorySlug && categorySlug in MARKET_CATEGORIES
      ? MARKET_CATEGORIES[categorySlug as MarketSlug]
      : null;
  const fromParam = text.parse(searchParams.category);
  const category =
    fromPath ??
    (fromParam &&
    (Object.values(MARKET_CATEGORIES) as string[]).includes(fromParam)
      ? (fromParam as MarketCategory)
      : null);

  const trimmed = q?.trim().slice(0, 100) ?? "";
  return {
    q: trimmed.length > 0 ? trimmed : null,
    category,
    job: code.parse(searchParams.job),
    tool: code.parse(searchParams.tool),
    sort: (MARKET_SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as MarketSort)
      : "popular",
    page: Number.isFinite(page) && page >= 1 && page <= 500 ? page : 1,
  };
}

/** Build a market URL from a query, dropping defaults. `base` is /market or /market/<slug>. */
export function marketHref(base: string, query: Partial<MarketQuery>): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (base === "/market" && query.category)
    params.set("category", query.category);
  if (query.job) params.set("job", query.job);
  if (query.tool) params.set("tool", query.tool);
  if (query.sort && query.sort !== "popular") params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const s = params.toString();
  return s ? `${base}?${s}` : base;
}
