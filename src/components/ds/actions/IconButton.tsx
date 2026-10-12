"use client";

import * as React from "react";

/* SAMEPLZ IconButton — a square/rounded button that holds a single icon.
   Same palettes + variants as Button. `rounded` makes it a circle. */

/**
 * Square icon-only button. Same palettes and variants as Button.
 * `rounded` renders it as a circle (used for avatars / FABs).
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** An <Icon/> element to render inside. */
  icon: React.ReactElement<{ size?: number | string }>;
  size?: "sm" | "md" | "lg" | "xl";
  color?:
    "primary" | "secondary" | "success" | "warning" | "danger" | "contrast";
  variant?: "fill" | "outline" | "ghost";
  /** Circular instead of rounded-square. */
  rounded?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}

type Size = NonNullable<IconButtonProps["size"]>;
type Color = NonNullable<IconButtonProps["color"]>;

const SIZES: Record<Size, { box: number; icon: number }> = {
  sm: { box: 24, icon: 16 },
  md: { box: 32, icon: 20 },
  lg: { box: 40, icon: 24 },
  xl: { box: 48, icon: 24 },
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
    text: "var(--sp-fg-secondary)",
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

export function IconButton({
  icon,
  size = "md",
  color = "secondary",
  variant = "ghost",
  rounded = false,
  disabled = false,
  "aria-label": ariaLabel = "button",
  style = {},
  ...rest
}: IconButtonProps) {
  const s = SIZES[size] || SIZES.md;
  const p = PALETTE[color] || PALETTE.secondary;
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
    width: s.box,
    height: s.box,
    boxSizing: "border-box",
    padding: 0,
    borderRadius: rounded ? "var(--sp-radius-full)" : "var(--sp-radius-300)",
    border: `1px solid ${border}`,
    background: bg,
    color: fg,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition:
      "background var(--sp-duration-default) var(--sp-easing-standard), color var(--sp-duration-default) var(--sp-easing-standard)",
    outline: "none",
    ...style,
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      style={base}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      {icon && React.cloneElement(icon, { size: icon.props.size ?? s.icon })}
    </button>
  );
}

export default IconButton;
