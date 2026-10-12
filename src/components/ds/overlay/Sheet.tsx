"use client";

import * as React from "react";
import { Icon } from "@/components/ds/icons/Icon";

/* SAMEPLZ Sheet — panel that slides in from an edge. `side` left/right/top/bottom.
   Controlled via `open` + `onClose`. Compose your own header/body inside. */

/** Edge-anchored slide-in panel (drawer). */
export interface SheetProps {
  open: boolean;
  onClose?: () => void;
  side?: "left" | "right" | "top" | "bottom";
  /** Panel width (left/right) or height (top/bottom) in px. */
  size?: number;
  title?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Sheet({
  open,
  onClose,
  side = "right",
  size = 380,
  title,
  children,
  style = {},
}: SheetProps) {
  if (!open) return null;
  const horizontal = side === "left" || side === "right";
  const panel: React.CSSProperties = {
    position: "absolute",
    background: "var(--sp-bg-surface)",
    boxShadow: "var(--sp-shadow-xl)",
    display: "flex",
    flexDirection: "column",
    ...(horizontal
      ? { top: 0, bottom: 0, width: size, [side]: 0 }
      : { left: 0, right: 0, height: size, [side]: 0 }),
    ...style,
  };
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "var(--sp-bg-overlay)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <div role="dialog" aria-modal="true" style={panel}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "18px 20px",
            borderBottom: "1px solid var(--sp-border-secondary)",
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--sp-fg-normal)",
            }}
          >
            {title}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--sp-fg-hint)",
                display: "flex",
              }}
            >
              <Icon name="CloseOutlineIcon" size={20} />
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Sheet;
