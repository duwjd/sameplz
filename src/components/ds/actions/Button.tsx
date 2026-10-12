"use client";

import * as React from "react";

/* SAMEPLZ Button — sizes sm/md/lg/xl, six color palettes, three variants
   (fill / outline / ghost). Values transcribed from the Vapor Figma. */

/** An <Icon/>-like element: accepts `size` and `style`. */
type GlyphElement = React.ReactElement<{
  size?: number | string;
  style?: React.CSSProperties;
}>;

/**
 * SAMEPLZ primary action button. Six color palettes × three visual variants,
 * four sizes. Use `fill` for primary actions, `outline` for secondary,
 * `ghost` for low-emphasis / toolbar actions.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Control height. sm=24 md=32 lg=40 xl=48 */
  size?: "sm" | "md" | "lg" | "xl";
  /** Color palette. */
  color?:
    "primary" | "secondary" | "success" | "warning" | "danger" | "contrast";
  /** Visual treatment. */
  variant?: "fill" | "outline" | "ghost";
  disabled?: boolean;
  /** Fill the container width. */
  stretch?: boolean;
  /** Leading <Icon/> element. */
  startIcon?: GlyphElement | null;
  /** Trailing <Icon/> element. */
  endIcon?: GlyphElement | null;
  children?: React.ReactNode;
}

type Size = NonNullable<ButtonProps["size"]>;
type Color = NonNullable<ButtonProps["color"]>;

const SIZES: Record<
  Size,
  { height: number; padding: string; font: number; gap: number; icon: number }
> = {
  sm: { height: 24, padding: "0 8px", font: 12, gap: 6, icon: 16 },
  md: { height: 32, padding: "0 12px", font: 14, gap: 6, icon: 16 },
  lg: { height: 40, padding: "0 16px", font: 14, gap: 6, icon: 20 },
  xl: { height: 48, padding: "0 24px", font: 16, gap: 6, icon: 24 },
};

const PALETTE: Record<
  Color,
  {
    solid: string;
    hover: string;
    on: string;
    line: string;
    tint: string;
    text: string;
  }
> = {
  primary: {
    solid: "var(--sp-bg-primary)",
    hover: "var(--sp-bg-primary-hover)",
    on: "var(--sp-fg-accent)",
    line: "var(--sp-border-primary)",
    tint: "var(--sp-bg-primary-tint)",
    text: "var(--sp-fg-primary)",
  },
  secondary: {
    solid: "var(--sp-bg-secondary)",
    hover: "var(--sp-gray-200)",
    on: "var(--sp-fg-normal)",
    line: "var(--sp-gray-300)",
    tint: "var(--sp-bg-neutral-tint)",
    text: "var(--sp-fg-normal)",
  },
  success: {
    solid: "var(--sp-bg-success)",
    hover: "var(--sp-bg-success-hover)",
    on: "var(--sp-fg-accent)",
    line: "var(--sp-border-success)",
    tint: "var(--sp-bg-success-tint)",
    text: "var(--sp-fg-success)",
  },
  warning: {
    solid: "var(--sp-bg-warning)",
    hover: "var(--sp-bg-warning-hover)",
    on: "var(--sp-fg-accent)",
    line: "var(--sp-border-warning)",
    tint: "var(--sp-bg-warning-tint)",
    text: "var(--sp-fg-warning)",
  },
  danger: {
    solid: "var(--sp-bg-danger)",
    hover: "var(--sp-bg-danger-hover)",
    on: "var(--sp-fg-accent)",
    line: "var(--sp-border-danger)",
    tint: "var(--sp-bg-danger-tint)",
    text: "var(--sp-fg-danger)",
  },
  contrast: {
    solid: "var(--sp-bg-contrast)",
    hover: "var(--sp-bg-contrast-hover)",
    on: "var(--sp-fg-on-contrast)",
    line: "var(--sp-gray-800)",
    tint: "var(--sp-bg-neutral-tint)",
    text: "var(--sp-fg-contrast)",
  },
};

export function Button({
  children,
  size = "md",
  color = "primary",
  variant = "fill",
  disabled = false,
  stretch = false,
  startIcon = null,
  endIcon = null,
  style = {},
  ...rest
}: ButtonProps) {
  const s = SIZES[size] || SIZES.md;
  const p = PALETTE[color] || PALETTE.primary;
  const [hover, setHover] = React.useState(false);

  let bg = "transparent",
    fg = p.text,
    border = "transparent";
  if (variant === "fill") {
    bg = hover ? p.hover : p.solid;
    fg = p.on;
  } else if (variant === "outline") {
    bg = hover ? p.tint : "transparent";
    fg = p.text;
    border = p.line;
  } else if (variant === "ghost") {
    bg = hover ? p.tint : "transparent";
    fg = p.text;
  }

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: s.gap,
    height: s.height,
    padding: s.padding,
    boxSizing: "border-box",
    width: stretch ? "100%" : "auto",
    fontFamily: "var(--sp-font-sans)",
    fontWeight: 600,
    fontSize: s.font,
    lineHeight: 1,
    letterSpacing: "-0.1px",
    whiteSpace: "nowrap",
    borderRadius: "var(--sp-radius-300)",
    border: `1px solid ${border}`,
    background: bg,
    color: fg,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition:
      "background var(--sp-duration-default) var(--sp-easing-standard), color var(--sp-duration-default) var(--sp-easing-standard)",
    userSelect: "none",
    outline: "none",
    ...style,
  };

  const glyph = (el: GlyphElement | null) =>
    el &&
    React.cloneElement(el, {
      size: el.props.size ?? s.icon,
      style: { flexShrink: 0, ...(el.props.style || {}) },
    });

  return (
    <button
      type="button"
      disabled={disabled}
      style={base}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {glyph(startIcon)}
      {children != null && <span>{children}</span>}
      {glyph(endIcon)}
    </button>
  );
}

export default Button;
