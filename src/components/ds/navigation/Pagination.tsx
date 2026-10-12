"use client";

import * as React from "react";
import { Icon } from "@/components/ds/icons/Icon";

/* SAMEPLZ Pagination — page navigation with prev/next and numbered pages.
   Controlled via `page` (1-based) + `onChange`. Collapses long ranges. */

/** Numbered page navigation with prev/next; collapses long ranges with ellipses. */
export interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  /** Total page count. */
  total: number;
  onChange?: (page: number) => void;
  size?: "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  style?: React.CSSProperties;
}

type PageToken = number | "…";

function range(a: number, b: number): number[] {
  const r: number[] = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}

function pages(current: number, total: number): PageToken[] {
  if (total <= 7) return range(1, total);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3)
    return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

const SIZES: Record<NonNullable<PaginationProps["size"]>, number> = {
  sm: 28,
  md: 32,
  lg: 40,
  xl: 48,
};

interface CellOptions {
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  dim?: boolean;
}

export function Pagination({
  page = 1,
  total = 1,
  onChange,
  size = "md",
  disabled = false,
  style = {},
}: PaginationProps) {
  const box = SIZES[size] || SIZES.md;
  const go = (p: number) => {
    if (!disabled && p >= 1 && p <= total && p !== page) {
      if (onChange) onChange(p);
    }
  };
  const cell = (content: React.ReactNode, opts: CellOptions = {}) => (
    <button
      type="button"
      disabled={disabled || opts.disabled}
      onClick={opts.onClick}
      aria-current={opts.active ? "page" : undefined}
      style={{
        minWidth: box,
        height: box,
        padding: "0 6px",
        border: "none",
        borderRadius: "var(--sp-radius-200)",
        background: opts.active ? "var(--sp-bg-primary)" : "transparent",
        color: opts.active ? "var(--sp-fg-accent)" : "var(--sp-fg-secondary)",
        fontFamily: "var(--sp-font-sans)",
        fontSize: 14,
        fontWeight: opts.active ? 700 : 500,
        cursor: disabled || opts.disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none",
        opacity: opts.dim ? 0.4 : 1,
      }}
    >
      {content}
    </button>
  );

  return (
    <nav
      aria-label="pagination"
      style={{ display: "inline-flex", alignItems: "center", gap: 2, ...style }}
    >
      {cell(<Icon name="ChevronLeftOutlineIcon" size={16} />, {
        onClick: () => go(page - 1),
        disabled: page <= 1,
        dim: page <= 1,
      })}
      {pages(page, total).map((p, i) =>
        p === "…" ? (
          <span
            key={`e${i}`}
            style={{
              minWidth: box,
              textAlign: "center",
              color: "var(--sp-fg-disabled)",
            }}
          >
            …
          </span>
        ) : (
          <React.Fragment key={p}>
            {cell(p, { active: p === page, onClick: () => go(p) })}
          </React.Fragment>
        ),
      )}
      {cell(<Icon name="ChevronRightOutlineIcon" size={16} />, {
        onClick: () => go(page + 1),
        disabled: page >= total,
        dim: page >= total,
      })}
    </nav>
  );
}

export default Pagination;
