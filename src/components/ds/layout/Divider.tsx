import * as React from "react";

/* SAMEPLZ Divider — a hairline rule. Horizontal or vertical, with optional
   inset label text centered on the line. */

/** Hairline rule; horizontal or vertical, with optional centered label. */
export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  label?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Divider({
  orientation = "horizontal",
  label,
  style = {},
}: DividerProps) {
  if (orientation === "vertical") {
    return (
      <span
        style={{
          display: "inline-block",
          width: 1,
          alignSelf: "stretch",
          background: "var(--sp-border-normal)",
          ...style,
        }}
      />
    );
  }
  if (label != null) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, ...style }}>
        <span
          style={{ flex: 1, height: 1, background: "var(--sp-border-normal)" }}
        />
        <span
          style={{
            fontFamily: "var(--sp-font-sans)",
            fontSize: 13,
            color: "var(--sp-fg-hint)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <span
          style={{ flex: 1, height: 1, background: "var(--sp-border-normal)" }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        height: 1,
        background: "var(--sp-border-normal)",
        width: "100%",
        ...style,
      }}
    />
  );
}

export default Divider;
