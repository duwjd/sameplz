"use client";

import * as React from "react";

/* SAMEPLZ NavBar — horizontal top navigation bar. Slots for brand (left),
   nav links (center/left), and actions (right). Compose NavBarLink children. */

/**
 * Horizontal top navigation bar with brand / links / actions slots.
 * Compose NavBarLink children for the center links.
 * @startingPoint section="Navigation" subtitle="NavBar — top navigation bar" viewport="900x120"
 */
export interface NavBarProps {
  brand?: React.ReactNode;
  links?: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}
export interface NavBarLinkProps {
  selected?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function NavBar({ brand, links, actions, style = {} }: NavBarProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        height: 60,
        padding: "0 24px",
        background: "var(--sp-bg-surface)",
        borderBottom: "1px solid var(--sp-border-normal)",
        fontFamily: "var(--sp-font-sans)",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {brand && (
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {brand}
        </div>
      )}
      {links && (
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {links}
        </nav>
      )}
      {actions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
          }}
        >
          {actions}
        </div>
      )}
    </header>
  );
}

export function NavBarLink({
  children,
  selected = false,
  onClick,
  style = {},
}: NavBarLinkProps) {
  const [hover, setHover] = React.useState(false);
  let color = "var(--sp-fg-hint)";
  if (selected) color = "var(--sp-fg-normal)";
  else if (hover) color = "var(--sp-fg-normal)";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        height: 60,
        padding: "0 12px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "var(--sp-font-sans)",
        fontSize: 14,
        fontWeight: selected ? 700 : 500,
        color,
        outline: "none",
        transition:
          "color var(--sp-duration-default) var(--sp-easing-standard)",
        ...style,
      }}
    >
      {children}
      <span
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 0,
          height: 2,
          background: selected ? "var(--sp-bg-primary)" : "transparent",
        }}
      />
    </button>
  );
}

export default NavBar;
