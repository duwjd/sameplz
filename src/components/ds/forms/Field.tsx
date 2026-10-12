import * as React from "react";

/* SAMEPLZ Field — form-row wrapper: label (+required), optional description,
   the control (children), and an error / helper message. */

/** Form-field wrapper: label, description, control slot, and error message. */
export interface FieldProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Field({
  label,
  description,
  error,
  required = false,
  htmlFor,
  children,
  style = {},
}: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label != null && (
        <label
          htmlFor={htmlFor}
          style={{
            fontFamily: "var(--sp-font-sans)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--sp-fg-normal)",
            display: "inline-flex",
            gap: 2,
          }}
        >
          {label}
          {required && <span style={{ color: "var(--sp-fg-danger)" }}>*</span>}
        </label>
      )}
      {description != null && (
        <span
          style={{
            fontFamily: "var(--sp-font-sans)",
            fontSize: 13,
            color: "var(--sp-fg-hint)",
            lineHeight: 1.5,
          }}
        >
          {description}
        </span>
      )}
      {children}
      {error != null && (
        <span
          style={{
            fontFamily: "var(--sp-font-sans)",
            fontSize: 13,
            color: "var(--sp-fg-danger)",
            lineHeight: 1.5,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

export default Field;
