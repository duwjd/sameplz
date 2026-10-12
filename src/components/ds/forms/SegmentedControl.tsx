"use client";

import * as React from "react";

/* SAMEPLZ SegmentedControl — a row of mutually-exclusive options in a track.
   Sizes sm/md/lg. Controlled via `value` + `onChange(value)`. */

/**
 * Segmented control — a compact row of mutually exclusive choices.
 * @startingPoint section="Forms" subtitle="SegmentedControl — inline single select" viewport="700x100"
 */
export interface SegmentItem {
  value: string;
  label: React.ReactNode;
}
export interface SegmentedControlProps {
  items: SegmentItem[];
  value?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  stretch?: boolean;
  style?: React.CSSProperties;
}

const SIZES: Record<
  NonNullable<SegmentedControlProps["size"]>,
  { height: number; font: number; pad: string }
> = {
  sm: { height: 28, font: 13, pad: "0 10px" },
  md: { height: 32, font: 14, pad: "0 12px" },
  lg: { height: 40, font: 14, pad: "0 16px" },
};

export function SegmentedControl({
  items = [],
  value,
  onChange,
  size = "md",
  stretch = false,
  style = {},
}: SegmentedControlProps) {
  const s = SIZES[size] || SIZES.md;
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        gap: 2,
        boxSizing: "border-box",
        background: "var(--sp-bg-secondary)",
        borderRadius: "var(--sp-radius-300)",
        width: stretch ? "100%" : "auto",
        ...style,
      }}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => {
              if (onChange) onChange(it.value);
            }}
            style={{
              flex: stretch ? 1 : "none",
              height: s.height,
              padding: s.pad,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: "none",
              borderRadius: "var(--sp-radius-200)",
              background: active ? "var(--sp-bg-surface)" : "transparent",
              boxShadow: active ? "var(--sp-shadow-sm)" : "none",
              color: active ? "var(--sp-fg-normal)" : "var(--sp-fg-hint)",
              fontFamily: "var(--sp-font-sans)",
              fontSize: s.font,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              outline: "none",
              whiteSpace: "nowrap",
              transition:
                "background var(--sp-duration-default) var(--sp-easing-standard), color var(--sp-duration-default) var(--sp-easing-standard)",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
