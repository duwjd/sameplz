import * as React from "react";

/* SAMEPLZ Grid — CSS grid layout. `columns` = number (equal 1fr tracks) or a
   raw grid-template-columns string. `gap` = space token or px. */

/** CSS grid layout. `columns` = track count (equal 1fr) or a template string. */
export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: number | string;
  /** Space token (100 = 8px) or raw px. */
  gap?: number;
  children?: React.ReactNode;
}

const SPACE: Record<number, number> = {
  25: 2,
  50: 4,
  75: 6,
  100: 8,
  150: 12,
  200: 16,
  250: 20,
  300: 24,
  400: 32,
  500: 40,
  600: 48,
  800: 64,
};
const g = (v: number | null | undefined): number =>
  v == null ? 0 : SPACE[v] != null ? SPACE[v] : v;

export function Grid({
  columns = 2,
  gap = 200,
  children,
  style = {},
  ...rest
}: GridProps) {
  const template =
    typeof columns === "number"
      ? `repeat(${columns}, minmax(0, 1fr))`
      : columns;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: template,
        gap: g(gap),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Grid;
