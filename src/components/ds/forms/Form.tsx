"use client";

import * as React from "react";

/* SAMEPLZ Form — form layout wrapper. Stacks Fields with consistent spacing and
   provides a FormActions row (right-aligned) for submit/cancel buttons. */

/**
 * Form layout wrapper. Stacks Field rows; compose with FormSection (grouped
 * heading + fields) and FormActions (right-aligned button row).
 */
export interface FormProps {
  gap?: number;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export interface FormSectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export interface FormActionsProps {
  align?: "start" | "center" | "end";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Form({ gap = 20, onSubmit, children, style = {} }: FormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (onSubmit) onSubmit(e);
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {children}
    </form>
  );
}

export function FormSection({
  title,
  description,
  children,
  style = {},
}: FormSectionProps) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 16, ...style }}
    >
      {(title != null || description != null) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {title != null && (
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
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
        </div>
      )}
      {children}
    </div>
  );
}

export function FormActions({
  align = "end",
  children,
  style = {},
}: FormActionsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginTop: 4,
        justifyContent:
          align === "end"
            ? "flex-end"
            : align === "center"
              ? "center"
              : "flex-start",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Form;
