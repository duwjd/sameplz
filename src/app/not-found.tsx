// NF-01·02: same screen for missing pages and hidden recipes (private / in review / rejected) —
// it never says which (F1-7).
import Link from "next/link";
import { EmptyState, RecipeCard } from "@/components/ds";
import { getPopularRecipes } from "@/data/recipe";

export const metadata = {
  title: "찾는 페이지가 없어요 · SAMEPLZ",
  robots: { index: false },
};

const linkButton = (primary: boolean) =>
  ({
    display: "inline-flex",
    alignItems: "center",
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    background: primary ? "var(--sp-bg-primary)" : "var(--sp-bg-surface)",
    color: primary ? "var(--sp-fg-accent)" : "var(--sp-fg-normal)",
    border: primary ? "none" : "1px solid var(--sp-border-normal)",
  }) as const;

export default async function NotFound() {
  const popular = await getPopularRecipes(6);
  return (
    <main
      data-screen-label="Not found"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "48px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      <EmptyState
        icon="SearchOutlineIcon"
        titleAs="h1"
        title="찾는 페이지가 없어요"
        description="주소가 바뀌었거나, 지금은 볼 수 없는 레시피예요. 홈이나 마켓에서 다시 찾아봐 주세요."
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/" style={linkButton(true)}>
              홈으로 가기
            </Link>
            <Link href="/market" style={linkButton(false)}>
              마켓 둘러보기
            </Link>
          </div>
        }
      />
      {popular.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            지금 인기 있는 레시피
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
              gap: 16,
            }}
          >
            {popular.map((c) => (
              <RecipeCard key={c.href} {...c} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
