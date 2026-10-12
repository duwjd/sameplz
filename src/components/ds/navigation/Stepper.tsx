import * as React from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ Stepper — horizontal process indicator. `steps` = [{label, icon?}];
   `current` is the active index. Steps before it read as done, after as
   upcoming, separated by chevrons. Mirrors the SAMEPLZ NavBar stepper. */

/**
 * Horizontal step / process indicator. `current` marks the active step;
 * earlier steps render as done, later as upcoming.
 */
export interface StepperStep {
  label: React.ReactNode;
  icon?: IconName;
}
export interface StepperProps {
  steps: StepperStep[];
  /** Zero-based index of the active step. */
  current?: number;
  style?: React.CSSProperties;
}

type StepState = "done" | "current" | "upcoming";

export function Stepper({ steps = [], current = 0, style = {} }: StepperProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        height: 56,
        padding: "0 20px",
        boxSizing: "border-box",
        background: "var(--sp-bg-surface)",
        border: "1px solid var(--sp-border-normal)",
        borderRadius: "var(--sp-radius-300)",
        fontFamily: "var(--sp-font-sans)",
        overflowX: "auto",
        ...style,
      }}
    >
      {steps.map((s, i) => {
        const state: StepState =
          i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <Icon
                name="ChevronRightOutlineIcon"
                size={16}
                style={{ color: "var(--sp-fg-disabled)", flexShrink: 0 }}
              />
            )}
            <Step index={i} state={state} label={s.label} icon={s.icon} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

const STEP_CFG: Record<StepState, { bg: string; fg: string; text: string }> = {
  done: {
    bg: "var(--sp-bg-primary)",
    fg: "var(--sp-fg-accent)",
    text: "var(--sp-fg-normal)",
  },
  current: {
    bg: "var(--sp-bg-primary)",
    fg: "var(--sp-fg-accent)",
    text: "var(--sp-fg-primary)",
  },
  upcoming: {
    bg: "var(--sp-bg-secondary)",
    fg: "var(--sp-fg-hint)",
    text: "var(--sp-fg-hint)",
  },
};

function Step({
  index,
  state,
  label,
  icon,
}: {
  index: number;
  state: StepState;
  label: React.ReactNode;
  icon?: IconName;
}) {
  const cfg = STEP_CFG[state];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: "50%",
          flexShrink: 0,
          background: cfg.bg,
          color: cfg.fg,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {state === "done" ? (
          <Icon name={icon || "ConfirmOutlineIcon"} size={14} />
        ) : (
          index + 1
        )}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: state === "upcoming" ? 500 : 600,
          color: cfg.text,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </span>
  );
}

export default Stepper;
