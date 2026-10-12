"use client";

import * as React from "react";
import { Icon } from "@/components/ds/icons/Icon";

/* SAMEPLZ Select — trigger + popup list of options. Sizes sm/md/lg/xl.
   Controlled via `value` + `onChange(value)`. `options` = [{value,label}]. */

/**
 * Single-select dropdown (trigger + popup). Provide `options` as
 * `{ value, label }[]` and control with `value` / `onChange`.
 * @startingPoint section="Forms" subtitle="Select — dropdown with popup list" viewport="700x260"
 */
export interface SelectOption {
  value: string;
  label: React.ReactNode;
}
export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  invalid?: boolean;
  style?: React.CSSProperties;
}

const SIZES: Record<
  NonNullable<SelectProps["size"]>,
  { height: number; padding: string; font: number }
> = {
  sm: { height: 24, padding: "0 8px", font: 14 },
  md: { height: 32, padding: "0 12px", font: 14 },
  lg: { height: 40, padding: "0 16px", font: 14 },
  xl: { height: 48, padding: "0 24px", font: 16 },
};

export function Select({
  options = [],
  value,
  onChange,
  placeholder = "Select…",
  size = "lg",
  disabled = false,
  invalid = false,
  style = {},
}: SelectProps) {
  const s = SIZES[size] || SIZES.lg;
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const border = invalid
    ? "var(--sp-border-danger)"
    : open
      ? "var(--sp-border-primary)"
      : "var(--sp-border-normal)";

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        display: "inline-block",
        minWidth: 180,
        ...style,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          width: "100%",
          height: s.height,
          padding: s.padding,
          boxSizing: "border-box",
          background: disabled
            ? "var(--sp-bg-secondary)"
            : "var(--sp-bg-surface)",
          border: `1px solid ${border}`,
          borderRadius: "var(--sp-radius-300)",
          boxShadow: open ? "0 0 0 3px var(--sp-focus-ring)" : "none",
          fontFamily: "var(--sp-font-sans)",
          fontSize: s.font,
          cursor: disabled ? "not-allowed" : "pointer",
          color: selected ? "var(--sp-fg-normal)" : "var(--sp-fg-hint)",
          outline: "none",
          opacity: disabled ? 0.6 : 1,
          transition:
            "border-color var(--sp-duration-default) var(--sp-easing-standard)",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <Icon
          name="ChevronDownOutlineIcon"
          size={16}
          style={{
            color: "var(--sp-fg-hint)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform var(--sp-duration-default)",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--sp-bg-surface)",
            border: "1px solid var(--sp-border-normal)",
            borderRadius: "var(--sp-radius-300)",
            boxShadow: "var(--sp-shadow-lg)",
            padding: 4,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <div
                key={o.value}
                onClick={() => {
                  if (onChange) onChange(o.value);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: "var(--sp-radius-200)",
                  cursor: "pointer",
                  fontFamily: "var(--sp-font-sans)",
                  fontSize: s.font,
                  color: "var(--sp-fg-normal)",
                  background: active
                    ? "var(--sp-bg-primary-soft)"
                    : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    e.currentTarget.style.background = "var(--sp-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <span>{o.label}</span>
                {active && (
                  <Icon
                    name="ConfirmOutlineIcon"
                    size={16}
                    style={{ color: "var(--sp-fg-primary)" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Select;
