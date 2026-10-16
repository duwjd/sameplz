"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { LogoWordmark } from "@/components/ds/brand/Logo";

/* SAMEPLZ SiteFooter — policy links, operator notice and company line. Required on the home
   screen. The 통신판매중개 notice (전자상거래법 제20조) returns with the paid phase via `notice`. */

export interface SiteFooterLink {
  label: string;
  /** null renders plain text (e.g. a contact not set up yet). */
  href: string | null;
  /** HOME-06: 개인정보처리방침 is shown bold. */
  strong?: boolean;
}

/**
 * Legal footer. Required on home.
 */
export interface SiteFooterProps {
  links?: SiteFooterLink[];
  notice?: ReactNode;
  company?: ReactNode;
  style?: CSSProperties;
}

const DEFAULT_LINKS: SiteFooterLink[] = [
  { label: "이용 안내", href: "/guide" },
  { label: "이용약관", href: "/terms" },
  { label: "개인정보처리방침", href: "/privacy", strong: true },
];

export function SiteFooter({
  links = DEFAULT_LINKS,
  notice,
  company,
  style = {},
}: SiteFooterProps) {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--sp-border-normal)",
        background: "var(--sp-bg-canvas)",
        padding: "32px 24px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      <LogoWordmark size={18} color="var(--sp-fg-hint)" title="SAMEPLZ" />
      <nav
        aria-label="정책"
        style={{ display: "flex", flexWrap: "wrap", gap: 20 }}
      >
        {links.map((l) => {
          const linkStyle: CSSProperties = {
            fontSize: 13,
            textDecoration: "none",
            color: l.strong ? "var(--sp-fg-normal)" : "var(--sp-fg-secondary)",
            fontWeight: l.strong ? 700 : 500,
          };
          if (!l.href)
            return (
              <span key={l.label} style={linkStyle}>
                {l.label}
              </span>
            );
          return l.href.startsWith("/") ? (
            <Link key={l.label} href={l.href} style={linkStyle}>
              {l.label}
            </Link>
          ) : (
            <a key={l.label} href={l.href} style={linkStyle}>
              {l.label}
            </a>
          );
        })}
      </nav>
      {notice ? (
        <p
          style={{
            margin: 0,
            maxWidth: 720,
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--sp-fg-hint)",
            textWrap: "pretty",
          }}
        >
          {notice}
        </p>
      ) : null}
      {company ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--sp-fg-hint)" }}>
          {company}
        </p>
      ) : null}
    </footer>
  );
}

export default SiteFooter;
