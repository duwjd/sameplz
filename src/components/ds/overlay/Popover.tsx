"use client";

import * as React from "react";

/* SAMEPLZ Popover — floating content anchored to a trigger. Toggles on click,
   closes on outside click. `side` positions the panel around the trigger. */

/** Click-triggered floating panel anchored to its trigger. */
export interface PopoverProps {
  trigger: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "end";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const SIDE_POS: Record<
  NonNullable<PopoverProps["side"]>,
  React.CSSProperties
> = {
  bottom: { top: "calc(100% + 8px)" },
  top: { bottom: "calc(100% + 8px)" },
  right: { left: "calc(100% + 8px)", top: 0 },
  left: { right: "calc(100% + 8px)", top: 0 },
};

export function Popover({
  trigger,
  children,
  side = "bottom",
  align = "start",
  style = {},
}: PopoverProps) {
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

  const base: React.CSSProperties = { position: "absolute", zIndex: 60 };
  const sidePos = SIDE_POS[side];
  const alignPos: React.CSSProperties =
    side === "top" || side === "bottom"
      ? align === "end"
        ? { right: 0 }
        : { left: 0 }
      : {};

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div
          role="dialog"
          style={{
            ...base,
            ...sidePos,
            ...alignPos,
            minWidth: 220,
            background: "var(--sp-bg-surface)",
            border: "1px solid var(--sp-border-normal)",
            borderRadius: "var(--sp-radius-400)",
            boxShadow: "var(--sp-shadow-lg)",
            padding: 16,
            fontFamily: "var(--sp-font-sans)",
            fontSize: 14,
            color: "var(--sp-fg-secondary)",
            ...style,
          }}
        >
          {children}
        </div>
      )}
    </span>
  );
}

export default Popover;
