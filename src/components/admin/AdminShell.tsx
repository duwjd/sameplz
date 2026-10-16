// ADM shell: the same menu on every /admin screen. Rendered only after requireAdmin().
import Link from "next/link";
import type { ReactNode } from "react";

export type AdminKey = "home" | "reviews" | "reports" | "recipes";

const MENU: { key: AdminKey; href: string; label: string }[] = [
  { key: "home", href: "/admin", label: "개요" },
  { key: "reviews", href: "/admin/reviews", label: "심사 큐" },
  { key: "reports", href: "/admin/reports", label: "신고함" },
  { key: "recipes", href: "/admin/recipes", label: "레시피 조치" },
];

export function AdminShell({
  active,
  title,
  description,
  children,
}: {
  active: AdminKey;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main
      data-screen-label={`Admin ${active}`}
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "24px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        color: "var(--sp-fg-normal)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <nav
        aria-label="운영 메뉴"
        style={{ display: "flex", gap: 4, flexWrap: "wrap", overflowX: "auto" }}
      >
        {MENU.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            aria-current={m.key === active ? "page" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 36,
              padding: "0 12px",
              borderRadius: 8,
              fontSize: 14,
              textDecoration: "none",
              color: "var(--sp-fg-normal)",
              background:
                m.key === active ? "var(--sp-bg-secondary)" : "transparent",
              fontWeight: m.key === active ? 700 : 400,
              whiteSpace: "nowrap",
            }}
          >
            {m.label}
          </Link>
        ))}
      </nav>
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{title}</h1>
        {description && (
          <p
            style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}
          >
            {description}
          </p>
        )}
      </header>
      {children}
    </main>
  );
}

export const adminCard = {
  border: "1px solid var(--sp-border-normal)",
  borderRadius: 16,
  padding: 20,
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};

export const adminTable = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: 14,
};

export const adminCell = {
  textAlign: "left" as const,
  padding: "10px 12px",
  borderBottom: "1px solid var(--sp-border-normal)",
  verticalAlign: "top" as const,
};

export function AdminFallback() {
  return <div aria-hidden="true" style={{ height: 480 }} />;
}
