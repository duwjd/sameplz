// Placeholder until the W2~W6 policy drafts are final (docs/plan-12w.md 외부 일정).
export const metadata = { title: "개인정보처리방침 · SAMEPLZ" };

export default function Page() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
        개인정보처리방침
      </h1>
      <p style={{ margin: 0, fontSize: 15, color: "var(--sp-fg-secondary)" }}>
        초안을 준비하고 있어요. 정식 공개 전에 이 페이지에 전문을 올려요.
      </p>
    </main>
  );
}
