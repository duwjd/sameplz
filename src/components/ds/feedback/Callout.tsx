import * as React from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ Callout — inline contextual message. Six palettes, soft tinted
   surface with a leading status icon and optional title. */

/** Inline contextual message with status icon. */
export interface CalloutProps {
  color?: "primary" | "hint" | "success" | "warning" | "danger" | "contrast";
  title?: React.ReactNode;
  /** Override the default status icon. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

type Color = NonNullable<CalloutProps["color"]>;

const PALETTE: Record<Color, { bg: string; fg: string; icon: IconName }> = {
  primary: {
    bg: "var(--sp-bg-primary-soft)",
    fg: "var(--sp-fg-primary)",
    icon: "InfoCircleIcon",
  },
  hint: {
    bg: "var(--sp-bg-hint-soft)",
    fg: "var(--sp-fg-hint)",
    icon: "InfoCircleIcon",
  },
  success: {
    bg: "var(--sp-bg-success-soft)",
    fg: "var(--sp-fg-success)",
    icon: "CheckCircleIcon",
  },
  warning: {
    bg: "var(--sp-bg-warning-soft)",
    fg: "var(--sp-fg-warning)",
    icon: "WarningIcon",
  },
  danger: {
    bg: "var(--sp-bg-danger-soft)",
    fg: "var(--sp-fg-danger)",
    icon: "ErrorCircleIcon",
  },
  contrast: {
    bg: "var(--sp-bg-contrast)",
    fg: "var(--sp-fg-on-contrast)",
    icon: "InfoCircleIcon",
  },
};

export function Callout({
  children,
  title,
  color = "primary",
  icon,
  style = {},
}: CalloutProps) {
  const p = PALETTE[color] || PALETTE.primary;
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: 16,
        boxSizing: "border-box",
        background: p.bg,
        borderRadius: "var(--sp-radius-300)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      <span
        style={{ color: p.fg, flexShrink: 0, display: "flex", marginTop: 1 }}
      >
        {icon ? icon : <Icon name={p.icon} size={20} />}
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
        }}
      >
        {title != null && (
          <div style={{ fontSize: 14, fontWeight: 700, color: p.fg }}>
            {title}
          </div>
        )}
        <div
          style={{
            fontSize: 14,
            color:
              color === "contrast"
                ? "var(--sp-fg-accent)"
                : "var(--sp-fg-secondary)",
            lineHeight: 1.5,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default Callout;
