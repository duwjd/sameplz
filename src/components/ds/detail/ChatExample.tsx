import type { CSSProperties } from "react";

/* SAMEPLZ ChatExample — "이렇게 말하면 작동해요": a skill's invocation shown
   as a short conversation. User turns sit right on a mint-soft bubble;
   the assistant (named by `tool`, e.g. "Claude") sits left on a neutral bubble.
   messages = [{ role: 'user' | 'assistant', text }] */

export interface ChatExampleMessage {
  role: "user" | "assistant";
  text: string;
}

/**
 * Shows how to call a skill.
 */
export interface ChatExampleProps {
  messages: ChatExampleMessage[];
  tool?: string;
  title?: string;
  style?: CSSProperties;
}

export function ChatExample({
  messages = [],
  tool = "AI",
  title,
  style = {},
}: ChatExampleProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 20,
        borderRadius: 16,
        background: "var(--sp-bg-canvas)",
        border: "1px solid var(--sp-border-secondary)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {title ? (
        <b
          style={{ fontSize: 13, fontWeight: 600, color: "var(--sp-fg-hint)" }}
        >
          {title}
        </b>
      ) : null}
      {messages.map((m, i) => {
        const me = m.role === "user";
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: me ? "flex-end" : "flex-start",
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--sp-fg-hint)",
              }}
            >
              {me ? "나" : tool}
            </span>
            <div
              style={{
                maxWidth: "82%",
                padding: "10px 14px",
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                textWrap: "pretty",
                borderRadius: me ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: me
                  ? "var(--sp-bg-primary-soft)"
                  : "var(--sp-bg-surface)",
                border: me
                  ? "1px solid transparent"
                  : "1px solid var(--sp-border-normal)",
                color: "var(--sp-fg-normal)",
              }}
            >
              {m.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ChatExample;
