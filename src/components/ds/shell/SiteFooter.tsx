"use client";

import type { CSSProperties, ReactNode } from "react";
import { LogoWordmark } from "@/components/ds/brand/Logo";

/* SAMEPLZ SiteFooter — legal notice (통신판매중개 고지, 전자상거래법 제20조),
   policy links and company line. Required on the home screen and checkout. */

/**
 * Legal footer. Required on home and checkout.
 */
export interface SiteFooterProps {
  links?: string[];
  onLink?: (label: string) => void;
  company?: ReactNode;
  style?: CSSProperties;
}

const DEFAULT_LINKS = ["이용 안내", "이용약관", "개인정보처리방침", "고객센터"];

export function SiteFooter({
  links = DEFAULT_LINKS,
  onLink,
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
        {links.map((l, i) => (
          <button
            key={l}
            type="button"
            onClick={() => onLink && onLink(l)}
            style={{
              all: "unset",
              cursor: "pointer",
              fontSize: 13,
              color: i === 2 ? "var(--sp-fg-normal)" : "var(--sp-fg-secondary)",
              fontWeight: i === 2 ? 700 : 500,
            }}
          >
            {l}
          </button>
        ))}
      </nav>
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
        SAMEPLZ는 통신판매중개자로서 거래 당사자가 아니며, 상품 정보와 거래에
        대한 책임은 각 판매자에게 있어요.
      </p>
      {company ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--sp-fg-hint)" }}>
          {company}
        </p>
      ) : null}
    </footer>
  );
}

export default SiteFooter;
