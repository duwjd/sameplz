"use client";

import * as React from "react";

/* SAMEPLZ TextInput — single-line text field. Sizes sm/md/lg/xl, states
   default / focus / invalid / disabled. Optional leading/trailing adornments. */

/**
 * Single-line text field. Compose with Field for label + description + error.
 * @startingPoint section="Forms" subtitle="TextInput — text field with adornments" viewport="700x120"
 */
export interface TextInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  size?: "sm" | "md" | "lg" | "xl";
  /** Red border + error affordance. */
  invalid?: boolean;
  disabled?: boolean;
  /** Leading element (icon/prefix). */
  startAdornment?: React.ReactNode;
  /** Trailing element (icon/suffix/clear). */
  endAdornment?: React.ReactNode;
}

const SIZES: Record<
  NonNullable<TextInputProps["size"]>,
  { height: number; padding: string; font: number }
> = {
  sm: { height: 24, padding: "0 8px", font: 14 },
  md: { height: 32, padding: "0 12px", font: 14 },
  lg: { height: 40, padding: "0 16px", font: 14 },
  xl: { height: 48, padding: "0 24px", font: 16 },
};

export function TextInput({
  size = "lg",
  invalid = false,
  disabled = false,
  startAdornment = null,
  endAdornment = null,
  style = {},
  ...rest
}: TextInputProps) {
  const s = SIZES[size] || SIZES.lg;
  const [focus, setFocus] = React.useState(false);

  let border = "var(--sp-border-normal)";
  let shadow = "none";
  if (invalid) {
    border = "var(--sp-border-danger)";
    if (focus) shadow = "0 0 0 3px var(--sp-bg-danger-tint)";
  } else if (focus) {
    border = "var(--sp-border-primary)";
    shadow = "0 0 0 3px var(--sp-focus-ring)";
  }

  const wrap: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    height: s.height,
    padding: s.padding,
    boxSizing: "border-box",
    background: disabled ? "var(--sp-bg-secondary)" : "var(--sp-bg-surface)",
    border: `1px solid ${border}`,
    borderRadius: "var(--sp-radius-300)",
    boxShadow: shadow,
    opacity: disabled ? 0.6 : 1,
    transition:
      "border-color var(--sp-duration-default) var(--sp-easing-standard), box-shadow var(--sp-duration-default) var(--sp-easing-standard)",
    ...style,
  };
  const input: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontFamily: "var(--sp-font-sans)",
    fontSize: s.font,
    color: "var(--sp-fg-normal)",
    padding: 0,
    height: "100%",
  };

  return (
    <div style={wrap}>
      {startAdornment && (
        <span
          style={{ display: "flex", color: "var(--sp-fg-hint)", flexShrink: 0 }}
        >
          {startAdornment}
        </span>
      )}
      <input
        style={input}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        {...rest}
      />
      {endAdornment && (
        <span
          style={{ display: "flex", color: "var(--sp-fg-hint)", flexShrink: 0 }}
        >
          {endAdornment}
        </span>
      )}
    </div>
  );
}

export default TextInput;
