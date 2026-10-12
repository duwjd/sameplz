import * as React from "react";

/* SAMEPLZ Spinner — indeterminate loading indicator. Sizes sm/md/lg/xl. */

/** Indeterminate loading spinner. */
export interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  /** Arc color (CSS color). Defaults to primary. */
  color?: string;
  style?: React.CSSProperties;
}

const SIZES: Record<NonNullable<SpinnerProps["size"]>, number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export function Spinner({
  size = "md",
  color = "var(--sp-fg-primary)",
  style = {},
}: SpinnerProps) {
  const px = SIZES[size] || SIZES.md;
  const stroke = px <= 20 ? 2 : 2.5;
  return (
    <span
      role="status"
      aria-label="loading"
      style={{ display: "inline-flex", width: px, height: px, ...style }}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        style={{ animation: "sp-spin 0.7s linear infinite" }}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          style={{ color: "var(--sp-border-normal)" }}
          opacity="0.35"
        />
        <path
          d="M12 3a9 9 0 0 1 9 9"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </svg>
      <style>{`@keyframes sp-spin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}

export default Spinner;
