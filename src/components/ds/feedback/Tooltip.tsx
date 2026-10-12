"use client";

import * as React from "react";

/* SAMEPLZ Tooltip — small label shown on hover/focus of its child.
   `side` positions the bubble; appears after a short delay. */

/** Hover/focus tooltip label wrapping any trigger element. */
export interface TooltipProps {
  label: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const POS: Record<NonNullable<TooltipProps["side"]>, React.CSSProperties> = {
  top: {
    bottom: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    marginBottom: 6,
  },
  bottom: {
    top: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    marginTop: 6,
  },
  left: {
    right: "100%",
    top: "50%",
    transform: "translateY(-50%)",
    marginRight: 6,
  },
  right: {
    left: "100%",
    top: "50%",
    transform: "translateY(-50%)",
    marginLeft: 6,
  },
};

export function Tooltip({
  label,
  side = "top",
  children,
  style = {},
}: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const show = () => {
    timer.current = setTimeout(() => setOpen(true), 200);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  const pos = POS[side];

  return (
    <span
      style={{ position: "relative", display: "inline-flex", ...style }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 60,
            ...pos,
            background: "var(--sp-bg-contrast)",
            color: "var(--sp-fg-on-contrast)",
            fontFamily: "var(--sp-font-sans)",
            fontSize: 12,
            fontWeight: 500,
            padding: "4px 8px",
            borderRadius: "var(--sp-radius-200)",
            whiteSpace: "nowrap",
            boxShadow: "var(--sp-shadow-md)",
            pointerEvents: "none",
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

export default Tooltip;
