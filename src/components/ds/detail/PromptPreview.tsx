import { Fragment, type CSSProperties } from "react";
import { Icon } from "@/components/ds/icons/Icon";

/* SAMEPLZ PromptPreview — shows a prompt's shape without giving it away.
   [대괄호] tokens in `template` are variables: they stay readable as mint chips.
   When `locked`, every other word becomes a gray bar and a lock note sits below.
   `variables` = [{ name, description, example }] renders the input guide. */

export interface PromptVariable {
  name: string;
  description?: string;
  example?: string;
}

/**
 * Prompt shape without the text. [대괄호] tokens become variable chips.
 */
export interface PromptPreviewProps {
  template: string;
  locked?: boolean;
  lockNote?: string;
  variables?: PromptVariable[];
  style?: CSSProperties;
}

type Part = { text: string; v?: undefined } | { v: string; text?: undefined };

function parse(t: string): Part[] {
  const out: Part[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push({ text: t.slice(last, m.index) });
    out.push({ v: m[1] });
    last = re.lastIndex;
  }
  if (last < t.length) out.push({ text: t.slice(last) });
  return out;
}

export function PromptPreview({
  template = "",
  locked = true,
  lockNote = "본문은 받은 뒤 라이브러리나 플레이그라운드에서 열 수 있어요.",
  variables = [],
  style = {},
}: PromptPreviewProps) {
  const parts = parse(template);
  const chip = (v: string, k: number) => (
    <span
      key={k}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 6px",
        margin: "0 2px",
        borderRadius: 6,
        background: "var(--sp-bg-primary-soft)",
        color: "var(--sp-fg-primary)",
        fontFamily: "var(--sp-font-code)",
        fontSize: 12,
        fontWeight: 600,
        verticalAlign: "baseline",
      }}
    >
      [{v}]
    </span>
  );
  const bars = (text: string, k: number) =>
    text.split(/(\s+)/).map((w, j) =>
      /^\s+$/.test(w) || !w ? (
        w
      ) : (
        <span
          key={k + "-" + j}
          aria-hidden="true"
          style={{
            display: "inline-block",
            height: 10,
            width: Math.max(12, w.length * 9),
            borderRadius: 3,
            background: "var(--sp-gray-200)",
            verticalAlign: "middle",
          }}
        />
      ),
    );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      <div
        style={{
          borderRadius: 12,
          border: "1px solid var(--sp-border-normal)",
          background: "var(--sp-bg-surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 16,
            fontFamily: "var(--sp-font-code)",
            fontSize: 13,
            lineHeight: 2,
            color: "var(--sp-fg-normal)",
            wordBreak: "keep-all",
          }}
        >
          {locked ? (
            <span
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }}
            >
              본문은 가려져 있어요. 변수:{" "}
              {parts
                .filter((p) => p.v)
                .map((p) => p.v)
                .join(", ")}
            </span>
          ) : null}
          {parts.map((p, k) =>
            p.v !== undefined ? (
              chip(p.v, k)
            ) : locked ? (
              <Fragment key={k}>{bars(p.text, k)}</Fragment>
            ) : (
              <span key={k}>{p.text}</span>
            ),
          )}
        </div>
        {locked ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              background: "var(--sp-bg-secondary)",
              fontSize: 13,
              color: "var(--sp-fg-secondary)",
            }}
          >
            <Icon name="LockOutlineIcon" size={16} />
            {lockNote}
          </div>
        ) : null}
      </div>
      {variables.length ? (
        <dl
          style={{
            margin: 0,
            display: "grid",
            gridTemplateColumns: "minmax(80px,auto) 1fr",
            rowGap: 10,
            columnGap: 16,
            fontSize: 13,
          }}
        >
          {variables.map((v, i) => (
            <Fragment key={i}>
              <dt
                style={{
                  fontFamily: "var(--sp-font-code)",
                  fontWeight: 600,
                  color: "var(--sp-fg-primary)",
                }}
              >
                [{v.name}]
              </dt>
              <dd style={{ margin: 0, color: "var(--sp-fg-secondary)" }}>
                {v.description}
                {v.example ? (
                  <span style={{ color: "var(--sp-fg-hint)" }}>
                    {" "}
                    · 예: {v.example}
                  </span>
                ) : null}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export default PromptPreview;
