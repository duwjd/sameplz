export function MarketSkeleton() {
  return (
    <main
      aria-busy="true"
      style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 64px" }}
    >
      <p style={{ color: "var(--sp-fg-hint)", fontSize: 14 }}>
        레시피를 불러오고 있어요
      </p>
    </main>
  );
}
