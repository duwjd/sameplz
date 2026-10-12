import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ StatBar — popularity metrics. SAMEPLZ shows "how many people
   followed this" instead of verification badges.
   size="sm": inline icon row for cards. size="lg": big-number panel for detail pages.
   items = [{ label, value, icon? }] */

export interface StatBarItem {
  label: string;
  value: ReactNode;
  icon?: IconName;
}

/**
 * Popularity metrics. sm = inline icon row (cards), lg = big-number panel (detail).
 */
export interface StatBarProps {
  items: StatBarItem[];
  size?: "sm" | "lg";
  style?: CSSProperties;
}

export function StatBar({ items = [], size = "sm", style = {} }: StatBarProps) {
  if (size === "lg") {
    return (
      <div
        aria-label="인기 지표"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(" + items.length + ", minmax(0,1fr))",
          border: "1px solid var(--sp-border-normal)",
          borderRadius: 12,
          background: "var(--sp-bg-surface)",
          fontFamily: "var(--sp-font-sans)",
          ...style,
        }}
      >
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "14px 16px",
              borderLeft: i ? "1px solid var(--sp-border-secondary)" : "none",
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: -0.4,
                color: "var(--sp-fg-normal)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {it.value}
            </span>
            <span style={{ fontSize: 13, color: "var(--sp-fg-hint)" }}>
              {it.label}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      aria-label="인기 지표"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        fontFamily: "var(--sp-font-sans)",
        fontSize: 12,
        color: "var(--sp-fg-hint)",
        ...style,
      }}
    >
      {items.map((it, i) => (
        <span
          key={i}
          title={it.label}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          {it.icon ? (
            <Icon name={it.icon} size={14} />
          ) : (
            <span>{it.label}</span>
          )}
          <b
            style={{
              fontWeight: 600,
              color: "var(--sp-fg-secondary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {it.value}
          </b>
          {it.icon ? (
            <span
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }}
            >
              {it.label}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export default StatBar;
