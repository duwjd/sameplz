// Small labelled controls for the ADM forms (native select keeps the label and error wiring simple).
import type { CSSProperties, ReactNode } from "react";

export const adminSelect: CSSProperties = {
  height: 36,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--sp-border-normal)",
  background: "var(--sp-bg-surface)",
  color: "var(--sp-fg-normal)",
  fontSize: 14,
};

export function AdminField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 14, fontWeight: 600 }}>
        {label}
      </label>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-danger)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
