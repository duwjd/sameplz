import * as React from "react";

/* SAMEPLZ layout — Stack (flex row/column), HStack, VStack. Maps the design
   system's spacing scale to `gap`. `gap` accepts a space-token number
   (25,50,75,100,150,200,300,400,600,800) or a raw px number. */

/**
 * Flex layout primitive. `gap` takes a SAMEPLZ space token (100 = 8px) or raw px.
 * Use HStack / VStack for the common row / column cases.
 */
export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column";
  /** Space token (25,50,75,100,150,200,300,400,600,800) or raw px. */
  gap?: number;
  align?: React.CSSProperties["alignItems"];
  justify?: React.CSSProperties["justifyContent"];
  wrap?: boolean;
  inline?: boolean;
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

export function Stack({
  direction = "column",
  gap = 100,
  align,
  justify,
  wrap = false,
  inline = false,
  children,
  style = {},
  ...rest
}: StackProps) {
  return (
    <div
      style={{
        display: inline ? "inline-flex" : "flex",
        flexDirection: direction,
        gap: g(gap),
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : "nowrap",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function HStack(props: StackProps) {
  return <Stack direction="row" align={props.align ?? "center"} {...props} />;
}
export function VStack(props: StackProps) {
  return <Stack direction="column" {...props} />;
}

export default Stack;
