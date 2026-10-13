"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/ds/icons/Icon";

/* SAMEPLZ Chip — pill used for filters, applied-filter removal, popular
   searches and section jumps. `selected` = ink fill with mint text.
   Pass `onRemove` to show a trailing × (applied filters). */

/**
 * Pill for filters and quick picks. selected = ink fill + mint text. onRemove adds a trailing ×.
 */
export interface ChipProps {
  children?: ReactNode;
  selected?: boolean;
  count?: number | string;
  onClick?: () => void;
  onRemove?: () => void;
  /** Accessible name of the remove button, e.g. "검색: 세무 해제". */
  removeLabel?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  style?: CSSProperties;
}

const SIZES = {
  sm: { h: 28, px: 10, font: 13 },
  md: { h: 32, px: 12, font: 14 },
};

export function Chip({
  children,
  selected = false,
  count,
  onClick,
  onRemove,
  removeLabel = "필터 해제",
  size = "md",
  disabled = false,
  style = {},
}: ChipProps) {
  const s = SIZES[size] || SIZES.md;
  const [hover, setHover] = useState(false);
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: s.h,
    padding: "0 " + s.px + "px",
    paddingRight: onRemove ? 6 : s.px,
    boxSizing: "border-box",
    borderRadius: 999,
    border:
      "1px solid " +
      (selected
        ? "var(--sp-bg-contrast)"
        : hover
          ? "var(--sp-border-hover)"
          : "var(--sp-border-normal)"),
    background: selected
      ? "var(--sp-bg-contrast)"
      : hover
        ? "var(--sp-bg-hover)"
        : "var(--sp-bg-surface)",
    color: selected ? "var(--sp-fg-on-contrast)" : "var(--sp-fg-normal)",
    fontFamily: "var(--sp-font-sans)",
    fontSize: s.font,
    fontWeight: selected ? 600 : 500,
    lineHeight: 1,
    whiteSpace: "nowrap",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: "background 150ms ease, border-color 150ms ease",
    ...style,
  };
  return (
    <span
      style={base}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={onRemove ? undefined : selected}
        onClick={onClick}
        style={{
          all: "unset",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: "inherit",
        }}
      >
        {children}
        {count != null ? (
          <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.72 }}>
            {count}
          </span>
        ) : null}
      </button>
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          style={{
            all: "unset",
            display: "inline-flex",
            width: 20,
            height: 20,
            borderRadius: "50%",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "inherit",
          }}
        >
          <Icon name="CloseOutlineIcon" size={14} />
        </button>
      ) : null}
    </span>
  );
}

export default Chip;
