import { Suspense } from "react";
import { MarketSkeleton } from "@/components/market/MarketSkeleton";
import { MarketSubnav } from "@/components/market/MarketSubnav";
import { MarketView } from "@/components/market/MarketView";
import { parseMarketQuery } from "@/lib/validation/market";

export const metadata = { title: "마켓 · SAMEPLZ" };

async function Market({
  searchParams,
}: {
  searchParams: PageProps<"/market">["searchParams"];
}) {
  const query = parseMarketQuery(await searchParams);
  return <MarketView query={query} base="/market" />;
}

export default function MarketPage(props: PageProps<"/market">) {
  return (
    <>
      <MarketSubnav current="all" />
      <Suspense fallback={<MarketSkeleton />}>
        <Market searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
