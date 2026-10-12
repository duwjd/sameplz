import * as React from "react";

/* SAMEPLZ Checkbox — sizes sm(16)/md(20), states checked / indeterminate /
   invalid / disabled. Controlled via `checked`; renders its own control box. */

/**
 * Checkbox with built-in control box + optional label.
 * @startingPoint section="Forms" subtitle="Checkbox — checked / indeterminate / invalid" viewport="700x120"
 */
export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  size?: "sm" | "md";
  label?: React.ReactNode;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SIZES: Record<NonNullable<CheckboxProps["size"]>, number> = {
  sm: 16,
  md: 20,
};

export function Checkbox({
  checked = false,
  indeterminate = false,
  disabled = false,
  invalid = false,
  size = "md",
  label,
  onChange,
  style = {},
  ...rest
}: CheckboxProps) {
  const box = SIZES[size] || SIZES.md;
  const active = checked || indeterminate;
  let bg = "var(--sp-bg-surface)";
  let border = invalid ? "var(--sp-border-danger)" : "var(--sp-border-hover)";
  if (active) {
    bg = "var(--sp-bg-primary)";
    border = "var(--sp-bg-primary)";
  }

  const control: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: box,
    height: box,
    flexShrink: 0,
    boxSizing: "border-box",
    background: bg,
    border: `1.5px solid ${border}`,
    borderRadius: "var(--sp-radius-200)",
    transition:
      "background var(--sp-duration-fast) var(--sp-easing-standard), border-color var(--sp-duration-fast) var(--sp-easing-standard)",
  };

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "var(--sp-font-sans)",
        fontSize: size === "sm" ? 14 : 16,
        color: "var(--sp-fg-normal)",
        userSelect: "none",
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        {...rest}
      />
      <span style={control} aria-hidden="true">
        {indeterminate ? (
          <svg width={box * 0.6} height={box * 0.6} viewBox="0 0 12 12">
            <rect
              x="2"
              y="5"
              width="8"
              height="2"
              rx="1"
              fill="var(--sp-fg-accent)"
            />
          </svg>
        ) : checked ? (
          <svg
            width={box * 0.7}
            height={box * 0.7}
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M11.5 3.5L5.5 10L2.5 7"
              stroke="var(--sp-fg-accent)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      {label != null && <span>{label}</span>}
    </label>
  );
}

export default Checkbox;
