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

const DialogTitleId = React.createContext<string | undefined>(undefined);

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * a11y (ux-copy-a11y): labelled by the header title, Esc closes, focus moves inside on open,
 * Tab stays inside, and focus returns to the opener on close.
 */
export function Dialog({
  open,
  onClose,
  size = "md",
  children,
  style = {},
}: DialogProps) {
  const titleId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
    // Prefer the first action in the body; fall back to the header close button.
    const first =
      focusables().find((el) => !el.closest("[data-dialog-close]")) ??
      focusables()[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
        <DialogTitleId.Provider value={titleId}>
          {children}
        </DialogTitleId.Provider>
      </div>
    </div>
  );
}

export function DialogHeader({ title, onClose, children }: DialogHeaderProps) {
  const titleId = React.useContext(DialogTitleId);
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
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "var(--sp-fg-normal)",
            }}
          >
            {title}
          </h2>
        )}
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          data-dialog-close=""
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
