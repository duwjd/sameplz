"use client";

import { useState, type CSSProperties } from "react";
import { Icon } from "@/components/ds/icons/Icon";
import { formatCredit } from "@/components/ds/market/format";

/* SAMEPLZ ModelOption — a selectable model in the playground compare picker
   (max 3, enforced by the parent). Shows credit cost per unit. Models without
   an API stay visible but disabled, with the reason ("연결 예정", "공식 API 없음"). */

/**
 * Checkbox card for the compare picker. Parent enforces max 3.
 */
export interface ModelOptionProps {
  name: string;
  kind?: string;
  /** Credits per unit. */
  cost?: number;
  unit?: string;
  selected?: boolean;
  disabled?: boolean;
  /** Shown instead of kind. Disables the option. */
  disabledReason?: string;
  onChange?: (selected: boolean) => void;
  style?: CSSProperties;
}

export function ModelOption({
  name,
  kind,
  cost,
  unit = "장",
  selected = false,
  disabled = false,
  disabledReason,
  onChange,
  style = {},
}: ModelOptionProps) {
  const [hover, setHover] = useState(false);
  const off = disabled || !!disabledReason;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-disabled={off}
      disabled={off}
      onClick={() => onChange && onChange(!selected)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: "unset",
        boxSizing: "border-box",
        cursor: off ? "not-allowed" : "pointer",
        display: "grid",
        gridTemplateColumns: "20px 1fr auto",
        alignItems: "center",
        columnGap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        border:
          "1px solid " +
          (selected
            ? "var(--sp-border-primary)"
            : hover && !off
              ? "var(--sp-border-hover)"
              : "var(--sp-border-normal)"),
        boxShadow: selected
          ? "inset 0 0 0 1px var(--sp-border-primary)"
          : "none",
        // Off: muted surface instead of opacity, so the stated reason stays readable (contrast).
        background: selected
          ? "var(--sp-bg-primary-tint)"
          : off
            ? "var(--sp-bg-secondary)"
            : "var(--sp-bg-surface)",
        fontFamily: "var(--sp-font-sans)",
        transition: "border-color 150ms ease, background 150ms ease",
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: selected
            ? "var(--sp-bg-primary)"
            : "var(--sp-bg-surface)",
          color: "var(--sp-fg-accent)",
          border: selected ? "none" : "1.5px solid var(--sp-gray-400)",
        }}
      >
        {selected ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6.2 5 8.5l4.5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
        }}
      >
        <b
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--sp-fg-normal)",
          }}
        >
          {name}
        </b>
        <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
          {disabledReason || kind}
        </span>
      </span>
      {cost != null && !disabledReason ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--sp-fg-secondary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Icon name="LightningIcon" size={14} />
          {formatCredit(cost)}
          <span style={{ fontWeight: 400, color: "var(--sp-fg-hint)" }}>
            {" "}
            / {unit}
          </span>
        </span>
      ) : null}
    </button>
  );
}

export default ModelOption;
