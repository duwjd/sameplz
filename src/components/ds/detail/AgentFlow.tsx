import type { CSSProperties } from "react";
import { Icon } from "@/components/ds/icons/Icon";

/* SAMEPLZ AgentFlow — "동작 흐름": what an agent does, input to output, as
   numbered steps. Steps wrap on narrow widths.
   steps = [{ title, description }] */

export interface AgentFlowStep {
  title: string;
  description?: string;
}

/**
 * What an agent does, input to output.
 */
export interface AgentFlowProps {
  steps: AgentFlowStep[];
  style?: CSSProperties;
}

export function AgentFlow({ steps = [], style = {} }: AgentFlowProps) {
  return (
    <ol
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "stretch",
        gap: 8,
        margin: 0,
        padding: 0,
        listStyle: "none",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {steps.map((s, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "1 1 160px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              alignSelf: "stretch",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 14,
              borderRadius: 12,
              border: "1px solid var(--sp-border-normal)",
              background: "var(--sp-bg-surface)",
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "var(--sp-bg-contrast)",
                color: "var(--sp-fg-on-contrast)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}
            </span>
            <b
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--sp-fg-normal)",
              }}
            >
              {s.title}
            </b>
            {s.description ? (
              <span
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--sp-fg-hint)",
                }}
              >
                {s.description}
              </span>
            ) : null}
          </div>
          {i < steps.length - 1 ? (
            <span
              aria-hidden="true"
              style={{ color: "var(--sp-fg-hint)", display: "inline-flex" }}
            >
              <Icon name="ChevronRightOutlineIcon" size={16} />
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export default AgentFlow;
