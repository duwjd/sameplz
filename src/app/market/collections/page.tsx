// COL-01 read view: packs with their recipes shown expanded (expand / collapse is P1, F1-9).
import Link from "next/link";
import { EmptyState, RecipeCard } from "@/components/ds";
import { MarketSubnav } from "@/components/market/MarketSubnav";
import { getCollections } from "@/data/catalog";

export const metadata = { title: "컬렉션 · SAMEPLZ" };

export default async function CollectionsPage() {
  const packs = await getCollections();
  return (
    <>
      <MarketSubnav current="collection" />
      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 24px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <nav
            aria-label="현재 위치"
            style={{ fontSize: 13, color: "var(--sp-fg-hint)" }}
          >
            <Link href="/">홈</Link> / <Link href="/market">마켓</Link> /{" "}
            <span aria-current="page">컬렉션</span>
          </nav>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.6px",
            }}
          >
            컬렉션
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-hint)" }}>
            카테고리를 섞어서 묶은 팩이에요.
          </p>
        </div>
        {packs.length === 0 ? (
          <EmptyState
            icon="FolderOutlineIcon"
            title="아직 공개된 컬렉션이 없어요"
            description="마켓에서 레시피를 먼저 둘러보세요."
          />
        ) : (
          packs.map((pack) => (
            <section
              key={pack.slug}
              aria-labelledby={`pack-${pack.slug}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                padding: 20,
                borderRadius: 16,
                background: "var(--sp-bg-surface)",
                border: "1px solid var(--sp-border-normal)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h2
                  id={`pack-${pack.slug}`}
                  style={{ margin: 0, fontSize: 20, fontWeight: 700 }}
                >
                  {pack.title}
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "var(--sp-fg-secondary)",
                  }}
                >
                  {pack.intro} · {pack.cards.length}개
                </p>
                {pack.reason && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--sp-fg-hint)",
                    }}
                  >
                    {pack.reason}
                  </p>
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                  gap: 16,
                }}
              >
                {pack.cards.map((card) => (
                  <RecipeCard key={card.href} {...card} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </>
  );
}
