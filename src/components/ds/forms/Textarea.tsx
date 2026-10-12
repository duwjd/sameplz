"use client";

import * as React from "react";

/* SAMEPLZ Textarea — multi-line text field. Same visual language as TextInput. */

/** Multi-line text field, same visual language as TextInput. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  disabled?: boolean;
  rows?: number;
}

export function Textarea({
  invalid = false,
  disabled = false,
  rows = 4,
  style = {},
  ...rest
}: TextareaProps) {
  const [focus, setFocus] = React.useState(false);
  let border = "var(--sp-border-normal)",
    shadow = "none";
  if (invalid) {
    border = "var(--sp-border-danger)";
    if (focus) shadow = "0 0 0 3px var(--sp-bg-danger-tint)";
  } else if (focus) {
    border = "var(--sp-border-primary)";
    shadow = "0 0 0 3px var(--sp-focus-ring)";
  }

  return (
    <textarea
      rows={rows}
      disabled={disabled}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 12px",
        resize: "vertical",
        minHeight: 80,
        fontFamily: "var(--sp-font-sans)",
        fontSize: 14,
        lineHeight: 1.5,
        color: "var(--sp-fg-normal)",
        background: disabled
          ? "var(--sp-bg-secondary)"
          : "var(--sp-bg-surface)",
        border: `1px solid ${border}`,
        borderRadius: "var(--sp-radius-300)",
        boxShadow: shadow,
        outline: "none",
        opacity: disabled ? 0.6 : 1,
        transition:
          "border-color var(--sp-duration-default) var(--sp-easing-standard), box-shadow var(--sp-duration-default) var(--sp-easing-standard)",
        ...style,
      }}
      {...rest}
    />
  );
}

export default Textarea;
