// F7-7: shared frame for the policy documents (/guide, /terms, /privacy, /policy/*). Static, no data.
import Link from "next/link";
import type { ReactNode } from "react";
import { POLICY_DOCS, POLICY_EFFECTIVE_DATE } from "@/lib/policy/operator";

export function PolicyPage({
  path,
  eyebrow,
  title,
  intro,
  toc,
  children,
}: {
  path: string;
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  /** Section jump chips at the top (GUIDE). */
  toc?: { id: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <main
      data-screen-label="Policy"
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "40px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        color: "var(--sp-fg-normal)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--sp-fg-secondary)",
          }}
        >
          {eyebrow}
        </span>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{title}</h1>
        {intro ? (
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--sp-fg-secondary)",
            }}
          >
            {intro}
          </p>
        ) : null}
        <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-hint)" }}>
          시행일 {POLICY_EFFECTIVE_DATE}
        </p>
      </header>
      {toc ? (
        <nav
          aria-label="섹션 이동"
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 34,
                padding: "0 14px",
                borderRadius: 999,
                border: "1px solid var(--sp-border-normal)",
                background: "var(--sp-bg-surface)",
                color: "var(--sp-fg-normal)",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {t.label}
            </a>
          ))}
        </nav>
      ) : null}
      {children}
      <nav
        aria-label="다른 정책 문서"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          paddingTop: 16,
          borderTop: "1px solid var(--sp-border-normal)",
        }}
      >
        {POLICY_DOCS.filter((d) => d.href !== path).map((d) => (
          <Link
            key={d.href}
            href={d.href}
            style={{
              fontSize: 14,
              color: "var(--sp-fg-secondary)",
              textDecoration: "underline",
            }}
          >
            {d.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

export function PolicySection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        scrollMarginTop: 80,
        fontSize: 15,
        lineHeight: 1.7,
      }}
    >
      <h2
        id={id ? `${id}-title` : undefined}
        style={{ margin: 0, fontSize: 19, fontWeight: 800 }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PolicyList({ items }: { items: ReactNode[] }) {
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: 20,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export const policyP = { margin: 0 } as const;
export const policyHelp = {
  margin: 0,
  fontSize: 14,
  color: "var(--sp-fg-secondary)",
} as const;

export function PolicyTable({
  label,
  head,
  rows,
}: {
  /** Names the table (and its scroll region on narrow screens) for screen readers. */
  label: string;
  head: string[];
  rows: ReactNode[][];
}) {
  const cell = {
    padding: "10px 12px",
    borderBottom: "1px solid var(--sp-border-normal)",
    textAlign: "left" as const,
    verticalAlign: "top" as const,
    fontSize: 14,
  };
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      style={{ overflowX: "auto" }}
    >
      <table
        aria-label={label}
        style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}
      >
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                style={{
                  ...cell,
                  fontWeight: 700,
                  color: "var(--sp-fg-secondary)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={cell}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
