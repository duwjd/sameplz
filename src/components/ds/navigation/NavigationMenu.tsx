"use client";

import * as React from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ NavigationMenu — vertical sidebar navigation. Compose NavItem
   children; `selected` highlights the active item. Supports icons + nesting. */

/**
 * Vertical sidebar navigation. Compose NavItem children.
 * @startingPoint section="Navigation" subtitle="NavigationMenu — sidebar nav" viewport="360x360"
 */
export interface NavigationMenuProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export interface NavItemProps {
  icon?: IconName;
  label?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  /** Trailing element (e.g. a Badge). */
  badge?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function NavigationMenu({ children, style = {} }: NavigationMenuProps) {
  return (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {children}
    </nav>
  );
}

export function NavItem({
  icon,
  label,
  selected = false,
  disabled = false,
  badge,
  onClick,
  style = {},
}: NavItemProps) {
  const [hover, setHover] = React.useState(false);
  let bg = "transparent",
    color = "var(--sp-fg-secondary)";
  if (selected) {
    bg = "var(--sp-bg-primary-soft)";
    color = "var(--sp-fg-primary)";
  } else if (hover && !disabled) {
    bg = "var(--sp-bg-hover)";
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
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        height: 40,
        padding: "0 12px",
        border: "none",
        borderRadius: "var(--sp-radius-300)",
        background: bg,
        color,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "var(--sp-font-sans)",
        fontSize: 14,
        fontWeight: selected ? 600 : 500,
        textAlign: "left",
        outline: "none",
        transition:
          "background var(--sp-duration-default) var(--sp-easing-standard)",
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={20} style={{ flexShrink: 0 }} />}
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {badge != null && <span style={{ flexShrink: 0 }}>{badge}</span>}
    </button>
  );
}

export default NavigationMenu;
