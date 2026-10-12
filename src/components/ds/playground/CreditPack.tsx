"use client";

import { useState, type CSSProperties } from "react";
import { Badge } from "@/components/ds/data-display/Badge";
import { formatCredit } from "@/components/ds/market/format";

/* SAMEPLZ CreditPack — one credit top-up option (5,000원 → 500C,
   10,000원 → 1,050C +5%, 30,000원 → 3,300C +10%). Radio semantics; the
   parent holds the selection. Credits pay for generations only, never recipes. */

/**
 * Radio card for credit packs.
 */
export interface CreditPackProps {
  price: number;
  credits: number;
  bonus?: string;
  selected?: boolean;
  recommended?: boolean;
  onSelect?: () => void;
  style?: CSSProperties;
}

export function CreditPack({
  price,
  credits,
  bonus,
  selected = false,
  recommended = false,
  onSelect,
  style = {},
}: CreditPackProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "18px 16px 16px",
        borderRadius: 12,
        minWidth: 0,
        border:
          "1px solid " +
          (selected
            ? "var(--sp-border-primary)"
            : hover
              ? "var(--sp-border-hover)"
              : "var(--sp-border-normal)"),
        boxShadow: selected
          ? "inset 0 0 0 1px var(--sp-border-primary)"
          : "none",
        background: selected
          ? "var(--sp-bg-primary-tint)"
          : "var(--sp-bg-surface)",
        fontFamily: "var(--sp-font-sans)",
        transition: "border-color 150ms ease, background 150ms ease",
        ...style,
      }}
    >
      {recommended ? (
        <Badge
          color="contrast"
          variant="fill"
          size="sm"
          style={{ position: "absolute", top: -10, left: 14 }}
        >
          추천
        </Badge>
      ) : null}
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <b
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: -0.4,
            color: "var(--sp-fg-normal)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatCredit(credits)}
        </b>
        {bonus ? (
          <Badge color="primary" variant="subtle" size="sm">
            {bonus}
          </Badge>
        ) : null}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "var(--sp-fg-secondary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Number(price).toLocaleString("ko-KR")}원
      </span>
    </button>
  );
}

export default CreditPack;
