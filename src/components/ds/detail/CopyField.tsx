"use client";

import { useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ds/icons/Icon";
import { Button } from "@/components/ds/actions/Button";

/* SAMEPLZ CopyField — read-only mono value with a copy button: install
   commands, share links, coupon codes. Falls back to selecting the text when
   the clipboard is blocked. Confirms with "복사됨" for 2s. */

/**
 * Read-only mono value with a copy button.
 */
export interface CopyFieldProps {
  value: string;
  label?: string;
  multiline?: boolean;
  onCopy?: (value: string) => void;
  style?: CSSProperties;
}

export function CopyField({
  value = "",
  label,
  multiline = false,
  onCopy,
  style = {},
}: CopyFieldProps) {
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const copy = () => {
    const ok = () => {
      setDone(true);
      if (onCopy) onCopy(value);
      setTimeout(() => setDone(false), 2000);
    };
    const fallback = () => {
      const el = ref.current;
      if (!el) return;
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = window.getSelection();
      if (!s) return;
      s.removeAllRanges();
      s.addRange(r);
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(value).then(ok, fallback);
    else fallback();
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {label ? (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--sp-fg-secondary)",
          }}
        >
          {label}
        </span>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: multiline ? "flex-start" : "center",
          gap: 8,
          padding: multiline ? 12 : "4px 4px 4px 12px",
          minHeight: 40,
          boxSizing: "border-box",
          borderRadius: 8,
          background: "var(--sp-bg-secondary)",
          border: "1px solid var(--sp-border-secondary)",
        }}
      >
        <code
          ref={ref}
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--sp-font-code)",
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--sp-fg-normal)",
            whiteSpace: multiline ? "pre-wrap" : "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            wordBreak: "break-all",
          }}
        >
          {value}
        </code>
        <Button
          size="sm"
          color={done ? "primary" : "secondary"}
          variant={done ? "fill" : "outline"}
          onClick={copy}
          startIcon={
            <Icon name={done ? "CheckCircleIcon" : "CopyOutlineIcon"} />
          }
        >
          {done ? "복사됨" : "복사"}
        </Button>
      </div>
    </div>
  );
}

export default CopyField;
