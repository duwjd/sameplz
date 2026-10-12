import * as React from "react";

/* SAMEPLZ InputGroup — joins addons and a control into one seamless bordered
   row (e.g. prefix label + input + button). Children sit flush; the group
   owns the border/radius, inner children drop their own. Sizes sm/md/lg/xl. */

/**
 * Joins addons + a control into one seamless bordered row.
 * Compose with InputAddon (static prefix/suffix) and GroupInput (borderless field).
 */
export interface InputGroupProps {
  size?: "sm" | "md" | "lg" | "xl";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export interface InputAddonProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export type GroupInputProps = React.InputHTMLAttributes<HTMLInputElement>;

const HEIGHT: Record<NonNullable<InputGroupProps["size"]>, number> = {
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
};

export function InputGroup({
  size = "lg",
  children,
  style = {},
}: InputGroupProps) {
  const h = HEIGHT[size] || HEIGHT.lg;
  const arr = React.Children.toArray(children);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        height: h,
        border: "1px solid var(--sp-border-normal)",
        borderRadius: "var(--sp-radius-300)",
        overflow: "hidden",
        background: "var(--sp-bg-surface)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {arr.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span
              style={{
                width: 1,
                background: "var(--sp-border-secondary)",
                flexShrink: 0,
              }}
            />
          )}
          {child}
        </React.Fragment>
      ))}
    </div>
  );
}

/* Static text/icon addon for an InputGroup. */
export function InputAddon({ children, style = {} }: InputAddonProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0 12px",
        background: "var(--sp-bg-secondary)",
        color: "var(--sp-fg-hint)",
        fontSize: 14,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* Borderless input designed to sit inside an InputGroup. */
export function GroupInput({ style = {}, ...rest }: GroupInputProps) {
  return (
    <input
      style={{
        border: "none",
        outline: "none",
        background: "transparent",
        padding: "0 12px",
        fontFamily: "var(--sp-font-sans)",
        fontSize: 14,
        color: "var(--sp-fg-normal)",
        minWidth: 0,
        flex: 1,
        ...style,
      }}
      {...rest}
    />
  );
}

export default InputGroup;
