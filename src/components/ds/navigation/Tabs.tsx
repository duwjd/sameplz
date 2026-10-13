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
  /** Wires tabs to one panel: tab ids `${idPrefix}-tab-${value}`, panel id `${idPrefix}-panel`. */
  idPrefix?: string;
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
  idPrefix,
  style = {},
}: TabsProps) {
  const s = SIZES[size] || SIZES.md;
  // WAI-ARIA tabs: arrows / Home / End move focus and select (roving tabindex).
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const i = items.findIndex((it) => it.value === value);
    const last = items.length - 1;
    const next =
      e.key === "ArrowRight"
        ? i >= last
          ? 0
          : i + 1
        : e.key === "ArrowLeft"
          ? i <= 0
            ? last
            : i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0 || !items[next]) return;
    e.preventDefault();
    onChange?.(items[next].value);
    const tabs =
      e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]',
      );
    tabs?.[next]?.focus();
  };
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
            id={idPrefix ? `${idPrefix}-tab-${it.value}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel` : undefined}
            tabIndex={active || value === undefined ? 0 : -1}
            onKeyDown={onKeyDown}
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
