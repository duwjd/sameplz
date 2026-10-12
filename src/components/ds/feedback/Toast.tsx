import * as React from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ Toast — transient notification card. Palettes map to a leading
   status icon; renders a title, optional description, and close affordance. */

/** Transient notification card. Show/dismiss with your own toast manager. */
export interface ToastProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  color?: "normal" | "primary" | "success" | "warning" | "danger";
  onClose?: () => void;
  /** Optional action element (e.g. a Button). */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

type Color = NonNullable<ToastProps["color"]>;

const PALETTE: Record<Color, { fg: string; icon: IconName | null }> = {
  normal: { fg: "var(--sp-fg-normal)", icon: null },
  primary: { fg: "var(--sp-fg-primary)", icon: "InfoCircleIcon" },
  success: { fg: "var(--sp-fg-success)", icon: "CheckCircleIcon" },
  warning: { fg: "var(--sp-fg-warning)", icon: "WarningIcon" },
  danger: { fg: "var(--sp-fg-danger)", icon: "ErrorCircleIcon" },
};

export function Toast({
  title,
  description,
  color = "normal",
  onClose,
  action,
  style = {},
}: ToastProps) {
  const p = PALETTE[color] || PALETTE.normal;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        minWidth: 280,
        maxWidth: 380,
        boxSizing: "border-box",
        background: "var(--sp-bg-surface)",
        border: "1px solid var(--sp-border-normal)",
        borderRadius: "var(--sp-radius-300)",
        boxShadow: "var(--sp-shadow-lg)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {p.icon && (
        <Icon
          name={p.icon}
          size={20}
          style={{ color: p.fg, flexShrink: 0, marginTop: 1 }}
        />
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flex: 1,
          minWidth: 0,
        }}
      >
        {title != null && (
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--sp-fg-normal)",
            }}
          >
            {title}
          </div>
        )}
        {description != null && (
          <div
            style={{
              fontSize: 13,
              color: "var(--sp-fg-hint)",
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        )}
        {action && <div style={{ marginTop: 6 }}>{action}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 2,
            color: "var(--sp-fg-hint)",
            display: "flex",
            flexShrink: 0,
          }}
        >
          <Icon name="CloseOutlineIcon" size={16} />
        </button>
      )}
    </div>
  );
}

export default Toast;
