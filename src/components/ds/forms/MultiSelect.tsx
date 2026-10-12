"use client";

import * as React from "react";
import { Icon } from "@/components/ds/icons/Icon";

/* SAMEPLZ MultiSelect — dropdown that selects several options. Selected values
   show as removable chips in the trigger. Controlled via `value` (array) +
   `onChange(nextArray)`. `options` = [{value,label}]. */

/**
 * Multi-select dropdown; selected values render as removable chips.
 * Control with `value` (array of value strings) + `onChange`.
 * @startingPoint section="Forms" subtitle="MultiSelect — multi-value dropdown with chips" viewport="700x260"
 */
export interface MultiSelectOption {
  value: string;
  label: React.ReactNode;
}
export interface MultiSelectProps {
  options: MultiSelectOption[];
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  size?: "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  invalid?: boolean;
  style?: React.CSSProperties;
}

const SIZES: Record<
  NonNullable<MultiSelectProps["size"]>,
  { minH: number; pad: string; font: number }
> = {
  sm: { minH: 24, pad: "2px 6px", font: 14 },
  md: { minH: 32, pad: "3px 8px", font: 14 },
  lg: { minH: 40, pad: "5px 10px", font: 14 },
  xl: { minH: 48, pad: "8px 12px", font: 16 },
};

export function MultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = "Select…",
  size = "lg",
  disabled = false,
  invalid = false,
  style = {},
}: MultiSelectProps) {
  const s = SIZES[size] || SIZES.lg;
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = options.filter((o) => value.includes(o.value));
  const toggle = (v: string) => {
    if (onChange)
      onChange(
        value.includes(v) ? value.filter((x) => x !== v) : [...value, v],
      );
  };
  const border = invalid
    ? "var(--sp-border-danger)"
    : open
      ? "var(--sp-border-primary)"
      : "var(--sp-border-normal)";

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 220, ...style }}>
      <div
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          minHeight: s.minH,
          padding: s.pad,
          boxSizing: "border-box",
          background: disabled
            ? "var(--sp-bg-secondary)"
            : "var(--sp-bg-surface)",
          border: `1px solid ${border}`,
          borderRadius: "var(--sp-radius-300)",
          boxShadow: open ? "0 0 0 3px var(--sp-focus-ring)" : "none",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "var(--sp-font-sans)",
        }}
      >
        {selected.length === 0 && (
          <span
            style={{
              color: "var(--sp-fg-hint)",
              fontSize: s.font,
              padding: "0 2px",
            }}
          >
            {placeholder}
          </span>
        )}
        {selected.map((o) => (
          <span
            key={o.value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 22,
              padding: "0 6px",
              background: "var(--sp-bg-secondary)",
              borderRadius: "var(--sp-radius-200)",
              fontSize: 13,
              color: "var(--sp-fg-normal)",
            }}
          >
            {o.label}
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggle(o.value);
              }}
              style={{
                display: "flex",
                cursor: "pointer",
                color: "var(--sp-fg-hint)",
              }}
            >
              <Icon name="CloseOutlineIcon" size={12} />
            </span>
          </span>
        ))}
        <span style={{ marginLeft: "auto", display: "flex" }}>
          <Icon
            name="ChevronDownOutlineIcon"
            size={16}
            style={{
              color: "var(--sp-fg-hint)",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform var(--sp-duration-default)",
            }}
          />
        </span>
      </div>
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
            const on = value.includes(o.value);
            return (
              <div
                key={o.value}
                onClick={() => toggle(o.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: "var(--sp-radius-200)",
                  cursor: "pointer",
                  fontFamily: "var(--sp-font-sans)",
                  fontSize: s.font,
                  color: "var(--sp-fg-normal)",
                  background: on ? "var(--sp-bg-primary-soft)" : "transparent",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `1.5px solid ${on ? "var(--sp-bg-primary)" : "var(--sp-border-hover)"}`,
                    background: on ? "var(--sp-bg-primary)" : "transparent",
                  }}
                >
                  {on && (
                    <Icon
                      name="ConfirmOutlineIcon"
                      size={12}
                      style={{ color: "var(--sp-fg-accent)" }}
                    />
                  )}
                </span>
                {o.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MultiSelect;
