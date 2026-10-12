"use client";

import * as React from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ Nav — a group of navigation links in a track (horizontal or vertical).
   Distinct from NavigationMenu (sidebar) and NavBar (page header): Nav is a
   compact link cluster (e.g. secondary/section nav). Compose NavLink children.
   Sizes sm/md/lg/xl, shape rounded or pill, optional stretch. */

/**
 * Compact navigation link cluster in a track (section / secondary nav).
 * Compose NavLink children. Horizontal or vertical, rounded or pill, 4 sizes.
 */
export interface NavProps {
  size?: "sm" | "md" | "lg" | "xl";
  shape?: "rounded" | "pill";
  direction?: "row" | "column";
  stretch?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export interface NavLinkProps {
  icon?: IconName;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  align?: "start" | "center" | "end";
  children?: React.ReactNode;
  style?: React.CSSProperties;
  /** @internal Injected by Nav. */
  _size?: NonNullable<NavProps["size"]>;
  /** @internal Injected by Nav. */
  _shape?: NonNullable<NavProps["shape"]>;
  /** @internal Injected by Nav. */
  _stretch?: boolean;
}

const SIZES: Record<NonNullable<NavProps["size"]>, number> = {
  sm: 32,
  md: 36,
  lg: 40,
  xl: 48,
};
const FONT: Record<NonNullable<NavProps["size"]>, number> = {
  sm: 13,
  md: 14,
  lg: 14,
  xl: 16,
};

export function Nav({
  size = "md",
  shape = "rounded",
  direction = "row",
  stretch = false,
  children,
  style = {},
}: NavProps) {
  const arr = React.Children.toArray(
    children,
  ) as React.ReactElement<NavLinkProps>[];
  return (
    <nav
      style={{
        display: "inline-flex",
        flexDirection: direction,
        gap: 4,
        padding: 4,
        background: "var(--sp-bg-secondary)",
        borderRadius: shape === "pill" ? 999 : "var(--sp-radius-400)",
        width: stretch ? "100%" : "auto",
        boxSizing: "border-box",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {arr.map((c) =>
        React.cloneElement(c, {
          _size: size,
          _shape: shape,
          _stretch: stretch,
        }),
      )}
    </nav>
  );
}

export function NavLink({
  icon,
  children,
  selected = false,
  disabled = false,
  onClick,
  align = "center",
  _size = "md",
  _shape = "rounded",
  _stretch = false,
  style = {},
}: NavLinkProps) {
  const [hover, setHover] = React.useState(false);
  let bg = "transparent",
    color = "var(--sp-fg-hint)";
  if (selected) {
    bg = "var(--sp-bg-surface)";
    color = "var(--sp-fg-normal)";
  } else if (hover && !disabled) {
    color = "var(--sp-fg-normal)";
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        justifyContent:
          align === "start"
            ? "flex-start"
            : align === "end"
              ? "flex-end"
              : "center",
        flex: _stretch ? 1 : "none",
        height: SIZES[_size] || 36,
        padding: "0 12px",
        border: "none",
        borderRadius: _shape === "pill" ? 999 : "var(--sp-radius-300)",
        background: bg,
        color,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        boxShadow: selected ? "var(--sp-shadow-sm)" : "none",
        fontFamily: "var(--sp-font-sans)",
        fontSize: FONT[_size] || 14,
        fontWeight: selected ? 600 : 500,
        whiteSpace: "nowrap",
        outline: "none",
        transition:
          "background var(--sp-duration-default) var(--sp-easing-standard), color var(--sp-duration-default) var(--sp-easing-standard)",
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={(FONT[_size] || 14) + 2} />}
      {children}
    </button>
  );
}

export default Nav;
