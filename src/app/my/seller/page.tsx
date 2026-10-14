import type { Metadata } from "next";
import { Suspense } from "react";
import { SellerGuest, SellerView } from "@/components/seller/SellerView";
import {
  getMyRecipes,
  getMyWaitlist,
  SELLER_DAYS,
  type SellerDays,
} from "@/data/seller";
import { getViewer } from "@/lib/auth/account";

export const metadata: Metadata = {
  title: "판매자 센터 · SAMEPLZ",
  robots: { index: false },
};

const toDays = (v: unknown): SellerDays =>
  (SELLER_DAYS as readonly number[]).includes(Number(v))
    ? (Number(v) as SellerDays)
    : 30;

async function Seller({
  searchParams,
}: {
  searchParams: PageProps<"/my/seller">["searchParams"];
}) {
  const sp = await searchParams;
  const days = toDays(sp.days);
  const viewer = await getViewer();
  if (!viewer) return <SellerGuest />;
  const [rows, waitlist] = await Promise.all([
    getMyRecipes(days),
    getMyWaitlist(),
  ]);
  return <SellerView rows={rows} days={days} waitlist={waitlist} />;
}

function SellerSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 320,
        borderRadius: 16,
        background: "var(--sp-bg-secondary)",
      }}
    />
  );
}

export default function SellerPage(props: PageProps<"/my/seller">) {
  return (
    <main
      data-screen-label="Seller"
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        color: "var(--sp-fg-normal)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
          판매자 센터
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          올린 레시피의 상태와 반응을 봐요. 반려된 레시피가 맨 위에 와요.
        </p>
      </header>
      <Suspense fallback={<SellerSkeleton />}>
        <Seller searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
