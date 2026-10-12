import * as React from "react";

/* SAMEPLZ Card — surface container with optional Header / Body / Footer.
   1px border, radius-400, optional shadow on `elevated`. Compose sub-parts. */

/** Surface container. Compose with CardHeader / CardTitle / CardBody / CardFooter. */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Add a drop shadow (raised surface). */
  elevated?: boolean;
  children?: React.ReactNode;
}
export interface CardSectionProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card({
  children,
  elevated = false,
  style = {},
  ...rest
}: CardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--sp-bg-surface)",
        border: "1px solid var(--sp-border-normal)",
        borderRadius: "var(--sp-radius-400)",
        boxShadow: elevated ? "var(--sp-shadow-md)" : "none",
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style = {} }: CardSectionProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "20px 24px 0",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, style = {} }: CardSectionProps) {
  return (
    <div
      style={{
        fontFamily: "var(--sp-font-sans)",
        fontSize: 18,
        fontWeight: 700,
        color: "var(--sp-fg-normal)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, style = {} }: CardSectionProps) {
  return (
    <div
      style={{
        padding: "16px 24px",
        fontFamily: "var(--sp-font-sans)",
        fontSize: 14,
        color: "var(--sp-fg-secondary)",
        lineHeight: 1.6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardFooter({ children, style = {} }: CardSectionProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 24px 20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Card;
