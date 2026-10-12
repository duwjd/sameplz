"use client";

import * as React from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ Menu — dropdown menu anchored to a trigger. Compose MenuItem /
   MenuSeparator / MenuLabel children. Closes on outside click or item select. */

/** Dropdown menu anchored to a trigger. Compose MenuItem / MenuSeparator / MenuLabel. */
export interface MenuProps {
  /** The clickable trigger element. */
  trigger: React.ReactNode;
  align?: "start" | "end";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export interface MenuItemProps {
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export interface MenuLabelProps {
  children?: React.ReactNode;
}

export function Menu({
  trigger,
  children,
  align = "start",
  style = {},
}: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const alignStyle: React.CSSProperties =
    align === "end" ? { right: 0 } : { left: 0 };
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            ...alignStyle,
            zIndex: 60,
            minWidth: 200,
            padding: 4,
            background: "var(--sp-bg-surface)",
            border: "1px solid var(--sp-border-normal)",
            borderRadius: "var(--sp-radius-300)",
            boxShadow: "var(--sp-shadow-lg)",
            fontFamily: "var(--sp-font-sans)",
            ...style,
          }}
        >
          {children}
        </div>
      )}
    </span>
  );
}

export function MenuItem({
  icon,
  children,
  danger = false,
  disabled = false,
  shortcut,
  onClick,
  style = {},
}: MenuItemProps) {
  const [hover, setHover] = React.useState(false);
  const color = danger ? "var(--sp-fg-danger)" : "var(--sp-fg-normal)";
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 10px",
        border: "none",
        borderRadius: "var(--sp-radius-200)",
        background:
          hover && !disabled
            ? danger
              ? "var(--sp-bg-danger-soft)"
              : "var(--sp-bg-hover)"
            : "transparent",
        color,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "var(--sp-font-sans)",
        fontSize: 14,
        textAlign: "left",
        outline: "none",
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={18} style={{ flexShrink: 0 }} />}
      <span style={{ flex: 1 }}>{children}</span>
      {shortcut && (
        <span style={{ color: "var(--sp-fg-disabled)", fontSize: 12 }}>
          {shortcut}
        </span>
      )}
    </button>
  );
}

export function MenuSeparator() {
  return (
    <div
      style={{
        height: 1,
        background: "var(--sp-border-secondary)",
        margin: "4px 0",
      }}
    />
  );
}

export function MenuLabel({ children }: MenuLabelProps) {
  return (
    <div
      style={{
        padding: "6px 10px 4px",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--sp-fg-hint)",
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      {children}
    </div>
  );
}

export default Menu;
