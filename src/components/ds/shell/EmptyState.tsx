import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ EmptyState — zero results, nothing purchased yet, login gates.
   Always says what to do next: pass the next step as `actions` (Buttons) or `children` (Chips). */

/**
 * Empty and gated states. Always offer the next step via actions or children.
 */
export interface EmptyStateProps {
  icon?: IconName;
  eyebrow?: string;
  title: string;
  /** Element for the title; use "h1" when the empty state is the page itself (404). */
  titleAs?: "b" | "h1" | "h2";
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}

export function EmptyState({
  icon,
  eyebrow,
  title,
  titleAs: TitleTag = "b",
  description,
  actions,
  children,
  style = {},
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 10,
        padding: "48px 24px",
        borderRadius: 16,
        background: "var(--sp-bg-secondary)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {icon ? (
        <span
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--sp-bg-surface)",
            color: "var(--sp-fg-hint)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 4,
          }}
        >
          <Icon name={icon} size={24} />
        </span>
      ) : null}
      {eyebrow ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: "var(--sp-fg-primary)",
          }}
        >
          {eyebrow}
        </span>
      ) : null}
      <TitleTag
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: "var(--sp-fg-normal)",
          letterSpacing: -0.3,
        }}
      >
        {title}
      </TitleTag>
      {description ? (
        <p
          style={{
            margin: 0,
            maxWidth: 420,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--sp-fg-hint)",
            textWrap: "pretty",
          }}
        >
          {description}
        </p>
      ) : null}
      {actions ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          {actions}
        </div>
      ) : null}
      {children ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginTop: 4,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;
