"use client";

import * as React from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ Tabs — underline tab bar. `items` = [{value,label,icon?}];
   controlled via `value` + `onChange`. Active tab shows a primary underline. */

/**
 * Underline tab bar. Drive with `value` / `onChange`.
 * @startingPoint section="Navigation" subtitle="Tabs — underline tab bar" viewport="700x120"
 */
export interface TabItem {
  value: string;
  label: React.ReactNode;
  icon?: IconName;
}
export interface TabsProps {
  items: TabItem[];
  value?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
}

const SIZES: Record<
  NonNullable<TabsProps["size"]>,
  { h: number; font: number }
> = {
  sm: { h: 36, font: 13 },
  md: { h: 40, font: 14 },
  lg: { h: 48, font: 16 },
};

export function Tabs({
  items = [],
  value,
  onChange,
  size = "md",
  style = {},
}: TabsProps) {
  const s = SIZES[size] || SIZES.md;
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--sp-border-normal)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => {
              if (onChange) onChange(it.value);
            }}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: s.h,
              padding: "0 12px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: s.font,
              fontWeight: active ? 700 : 500,
              color: active ? "var(--sp-fg-primary)" : "var(--sp-fg-hint)",
              outline: "none",
              transition:
                "color var(--sp-duration-default) var(--sp-easing-standard)",
            }}
          >
            {it.icon && <Icon name={it.icon} size={s.font + 2} />}
            {it.label}
            <span
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                bottom: -1,
                height: 2,
                borderRadius: 2,
                background: active ? "var(--sp-bg-primary)" : "transparent",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
