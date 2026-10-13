import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MarketSkeleton } from "@/components/market/MarketSkeleton";
import { MarketSubnav } from "@/components/market/MarketSubnav";
import { MarketView } from "@/components/market/MarketView";
import {
  MARKET_CATEGORIES,
  parseMarketQuery,
  type MarketSlug,
} from "@/lib/validation/market";

const TITLES: Record<MarketSlug, string> = {
  prompts: "프롬프트",
  agents: "에이전트",
  skills: "스킬",
};

// Only the three category slugs exist; anything else is a real 404 (status included).
export function generateStaticParams() {
  return Object.keys(MARKET_CATEGORIES).map((category) => ({ category }));
}

export async function generateMetadata(props: PageProps<"/market/[category]">) {
  const { category } = await props.params;
  return { title: `${TITLES[category as MarketSlug] ?? "마켓"} · SAMEPLZ` };
}

async function CategoryMarket({
  category,
  searchParams,
}: {
  category: MarketSlug;
  searchParams: PageProps<"/market/[category]">["searchParams"];
}) {
  const query = parseMarketQuery(await searchParams, category);
  return <MarketView query={query} base={`/market/${category}`} />;
}

export default async function CategoryMarketPage(
  props: PageProps<"/market/[category]">,
) {
  // params are known at build time (generateStaticParams), so the 404 is decided before streaming
  // and keeps a real 404 status.
  const { category } = await props.params;
  if (!(category in MARKET_CATEGORIES)) notFound();
  const slug = category as MarketSlug;
  return (
    <>
      <MarketSubnav current={MARKET_CATEGORIES[slug]} />
      <Suspense fallback={<MarketSkeleton />}>
        <CategoryMarket category={slug} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
