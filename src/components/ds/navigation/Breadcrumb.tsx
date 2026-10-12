"use client";

import * as React from "react";
import { Icon } from "@/components/ds/icons/Icon";

/* SAMEPLZ Breadcrumb — hierarchical path. Pass `items` = [{label, href}];
   the last item renders as current (non-link). Chevron separators. */

/** Hierarchical breadcrumb trail. Last item = current page. */
export interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
}
export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  size?: "sm" | "md" | "lg" | "xl";
  style?: React.CSSProperties;
}

const FONT: Record<NonNullable<BreadcrumbProps["size"]>, number> = {
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
};

export function Breadcrumb({
  items = [],
  size = "md",
  style = {},
}: BreadcrumbProps) {
  const fs = FONT[size] || 14;
  return (
    <nav
      aria-label="breadcrumb"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 4,
        fontFamily: "var(--sp-font-sans)",
        fontSize: fs,
        ...style,
      }}
    >
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {last ? (
              <span
                aria-current="page"
                style={{ color: "var(--sp-fg-normal)", fontWeight: 600 }}
              >
                {it.label}
              </span>
            ) : (
              <a
                href={it.href || "#"}
                style={{ color: "var(--sp-fg-hint)", textDecoration: "none" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--sp-fg-normal)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--sp-fg-hint)")
                }
              >
                {it.label}
              </a>
            )}
            {!last && (
              <Icon
                name="ChevronRightOutlineIcon"
                size={fs}
                style={{ color: "var(--sp-fg-disabled)" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;
