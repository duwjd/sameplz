"use client";

import * as React from "react";

/* SAMEPLZ Radio + RadioGroup. Radio is a single option; RadioGroup manages
   selection across children (pass `value` + `onChange`). */

/**
 * Radio option + RadioGroup container. Wrap Radios in a RadioGroup and drive
 * selection with `value` / `onChange`.
 * @startingPoint section="Forms" subtitle="Radio + RadioGroup — single select" viewport="700x140"
 */
export interface RadioProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  checked?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  size?: "sm" | "md";
  label?: React.ReactNode;
  value?: string;
}
export interface RadioGroupProps {
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  direction?: "row" | "column";
  gap?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const SIZES: Record<NonNullable<RadioProps["size"]>, number> = {
  sm: 16,
  md: 20,
};

export function Radio({
  checked = false,
  disabled = false,
  invalid = false,
  size = "md",
  label,
  value,
  name,
  onChange,
  style = {},
  ...rest
}: RadioProps) {
  const box = SIZES[size] || SIZES.md;
  let border = invalid ? "var(--sp-border-danger)" : "var(--sp-border-hover)";
  if (checked) border = "var(--sp-bg-primary)";

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
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: box,
          height: box,
          flexShrink: 0,
          boxSizing: "border-box",
          borderRadius: "50%",
          border: `1.5px solid ${border}`,
          background: "var(--sp-bg-surface)",
          transition:
            "border-color var(--sp-duration-fast) var(--sp-easing-standard)",
        }}
      >
        {checked && (
          <span
            style={{
              width: box * 0.5,
              height: box * 0.5,
              borderRadius: "50%",
              background: "var(--sp-bg-primary)",
            }}
          />
        )}
      </span>
      {label != null && <span>{label}</span>}
    </label>
  );
}

export function RadioGroup({
  value,
  onChange,
  name,
  direction = "column",
  gap = 12,
  children,
  style = {},
}: RadioGroupProps) {
  const arr = React.Children.toArray(
    children,
  ) as React.ReactElement<RadioProps>[];
  return (
    <div
      role="radiogroup"
      style={{ display: "flex", flexDirection: direction, gap, ...style }}
    >
      {arr.map((child) =>
        React.cloneElement(child, {
          name,
          checked: child.props.value === value,
          onChange: () => {
            if (onChange) onChange(child.props.value as string);
          },
        }),
      )}
    </div>
  );
}

export default Radio;
