"use client";

import * as React from "react";
import { Icon } from "@/components/ds/icons/Icon";

/* SAMEPLZ Dialog — modal dialog with backdrop. Sizes sm/md/lg. Compose
   DialogHeader / DialogBody / DialogFooter. Controlled via `open` + `onClose`. */

/** Modal dialog with backdrop. Compose DialogHeader / DialogBody / DialogFooter. */
export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export interface DialogHeaderProps {
  title?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
}
export interface DialogSectionProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const WIDTH: Record<NonNullable<DialogProps["size"]>, number> = {
  sm: 400,
  md: 520,
  lg: 720,
};

export function Dialog({
  open,
  onClose,
  size = "md",
  children,
  style = {},
}: DialogProps) {
  if (!open) return null;
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--sp-bg-overlay)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: WIDTH[size] || WIDTH.md,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--sp-bg-surface)",
          borderRadius: "var(--sp-radius-500)",
          boxShadow: "var(--sp-shadow-xl)",
          fontFamily: "var(--sp-font-sans)",
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ title, onClose, children }: DialogHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "20px 24px 12px",
      }}
    >
      <div style={{ flex: 1 }}>
        {title != null && (
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--sp-fg-normal)",
            }}
          >
            {title}
          </div>
        )}
        {children}
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
            color: "var(--sp-fg-hint)",
            padding: 2,
            display: "flex",
          }}
        >
          <Icon name="CloseOutlineIcon" size={20} />
        </button>
      )}
    </div>
  );
}

export function DialogBody({ children, style = {} }: DialogSectionProps) {
  return (
    <div
      style={{
        padding: "0 24px",
        overflowY: "auto",
        fontSize: 14,
        color: "var(--sp-fg-secondary)",
        lineHeight: 1.6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function DialogFooter({ children, style = {} }: DialogSectionProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        padding: "20px 24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Dialog;
