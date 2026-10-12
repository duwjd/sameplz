"use client";

import * as React from "react";

/* SAMEPLZ RadioCard — a selectable card (title + description) behaving as a
   radio option. Use inside RadioCardGroup for single-select. */

/** Card-style radio option (title + description) + RadioCardGroup container. */
export interface RadioCardProps {
  checked?: boolean;
  disabled?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  value?: string;
  onSelect?: (value: string) => void;
  style?: React.CSSProperties;
}
export interface RadioCardGroupProps {
  value?: string;
  onChange?: (value: string) => void;
  direction?: "row" | "column";
  gap?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function RadioCard({
  checked = false,
  disabled = false,
  title,
  description,
  value,
  onSelect,
  style = {},
}: RadioCardProps) {
  const border = checked ? "var(--sp-bg-primary)" : "var(--sp-border-normal)";
  return (
    <div
      role="radio"
      aria-checked={checked}
      onClick={() => {
        if (!disabled && onSelect) onSelect(value as string);
      }}
      style={{
        display: "flex",
        gap: 10,
        padding: 16,
        boxSizing: "border-box",
        border: `1.5px solid ${border}`,
        borderRadius: "var(--sp-radius-400)",
        background: checked
          ? "var(--sp-bg-primary-soft)"
          : "var(--sp-bg-surface)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition:
          "border-color var(--sp-duration-default) var(--sp-easing-standard), background var(--sp-duration-default) var(--sp-easing-standard)",
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          flexShrink: 0,
          marginTop: 1,
          borderRadius: "50%",
          border: `1.5px solid ${checked ? "var(--sp-bg-primary)" : "var(--sp-border-hover)"}`,
          background: "var(--sp-bg-surface)",
        }}
      >
        {checked && (
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--sp-bg-primary)",
            }}
          />
        )}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontFamily: "var(--sp-font-sans)",
            fontSize: 15,
            fontWeight: 600,
            color: "var(--sp-fg-normal)",
          }}
        >
          {title}
        </span>
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
      </span>
    </div>
  );
}

export function RadioCardGroup({
  value,
  onChange,
  direction = "column",
  gap = 10,
  children,
  style = {},
}: RadioCardGroupProps) {
  const arr = React.Children.toArray(
    children,
  ) as React.ReactElement<RadioCardProps>[];
  return (
    <div
      role="radiogroup"
      style={{ display: "flex", flexDirection: direction, gap, ...style }}
    >
      {arr.map((c) =>
        React.cloneElement(c, {
          checked: c.props.value === value,
          onSelect: onChange,
        }),
      )}
    </div>
  );
}

export default RadioCard;
