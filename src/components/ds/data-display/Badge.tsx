import * as React from "react";

/* SAMEPLZ Badge — small status/label pill. Six palettes, sizes sm/md/lg,
   `shape` square (r8) or pill (999), `variant` fill or subtle (soft tint). */

/** Small status label / count pill. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: "primary" | "success" | "warning" | "danger" | "contrast" | "hint";
  size?: "sm" | "md" | "lg";
  shape?: "square" | "pill";
  variant?: "fill" | "subtle";
  children?: React.ReactNode;
}

type Size = NonNullable<BadgeProps["size"]>;
type Color = NonNullable<BadgeProps["color"]>;

const SIZES: Record<Size, { height: number; padding: string; font: number }> = {
  sm: { height: 20, padding: "0 6px", font: 12 },
  md: { height: 24, padding: "0 8px", font: 12 },
  lg: { height: 32, padding: "0 12px", font: 14 },
};

const PALETTE: Record<
  Color,
  { on?: string; solid: string; soft: string; softText: string }
> = {
  primary: {
    solid: "var(--sp-bg-primary)",
    soft: "var(--sp-bg-primary-soft)",
    softText: "var(--sp-fg-primary)",
  },
  success: {
    solid: "var(--sp-bg-success)",
    soft: "var(--sp-bg-success-soft)",
    softText: "var(--sp-fg-success)",
  },
  warning: {
    solid: "var(--sp-bg-warning)",
    soft: "var(--sp-bg-warning-soft)",
    softText: "var(--sp-fg-warning)",
  },
  danger: {
    solid: "var(--sp-bg-danger)",
    soft: "var(--sp-bg-danger-soft)",
    softText: "var(--sp-fg-danger)",
  },
  contrast: {
    on: "var(--sp-fg-on-contrast)",
    solid: "var(--sp-bg-contrast)",
    soft: "var(--sp-bg-secondary)",
    softText: "var(--sp-fg-normal)",
  },
  hint: {
    solid: "var(--sp-gray-500)",
    soft: "var(--sp-bg-hint-soft)",
    softText: "var(--sp-fg-hint)",
  },
};

export function Badge({
  children,
  color = "primary",
  size = "md",
  shape = "square",
  variant = "subtle",
  style = {},
  ...rest
}: BadgeProps) {
  const s = SIZES[size] || SIZES.md;
  const p = PALETTE[color] || PALETTE.primary;
  const fill = variant === "fill";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: s.height,
        padding: s.padding,
        boxSizing: "border-box",
        background: fill ? p.solid : p.soft,
        color: fill ? p.on || "var(--sp-fg-accent)" : p.softText,
        borderRadius: shape === "pill" ? 999 : "var(--sp-radius-300)",
        fontFamily: "var(--sp-font-sans)",
        fontSize: s.font,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

export default Badge;
