import type { CSSProperties } from "react";
import { Icon } from "@/components/ds/icons/Icon";
import { Button } from "@/components/ds/actions/Button";
import { Media, type ResultKind } from "@/components/ds/market/Media";

/* SAMEPLZ ResultFigure — one playground output (one model cell in a run row).
   Always marked "AI 생성"; trial runs add a SAMEPLZ 체험 watermark.
   Actions: 저장 · 비교에 고정 · SAME 인증 (only for recipes the user owns). */

/**
 * One model cell in a run row. Always marked AI 생성; trial adds a watermark.
 */
export interface ResultFigureProps {
  model?: string;
  media?: string;
  ratio?: string;
  kind?: ResultKind;
  mediaLabel?: string;
  trial?: boolean;
  pinned?: boolean;
  canSame?: boolean;
  onSave?: () => void;
  onPin?: () => void;
  onSame?: () => void;
  style?: CSSProperties;
}

export function ResultFigure({
  model,
  media,
  ratio = "1/1",
  kind = "이미지",
  mediaLabel,
  trial = false,
  pinned = false,
  canSame = false,
  onSave,
  onPin,
  onSame,
  style = {},
}: ResultFigureProps) {
  return (
    <figure
      style={{
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontFamily: "var(--sp-font-sans)",
        minWidth: 0,
        ...style,
      }}
    >
      <Media
        src={media}
        ratio={ratio}
        kind={kind}
        label={mediaLabel || model}
        video={kind === "영상"}
        radius={12}
        style={{
          border: pinned
            ? "2px solid var(--sp-border-primary)"
            : "1px solid var(--sp-border-normal)",
          boxSizing: "border-box",
        }}
        topLeft={
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 20,
              padding: "0 6px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(14,26,20,0.72)",
              color: "#FFFFFF",
            }}
          >
            AI 생성
          </span>
        }
        topRight={
          pinned ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 20,
                padding: "0 6px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                background: "var(--sp-bg-primary)",
                color: "var(--sp-fg-accent)",
              }}
            >
              고정됨
            </span>
          ) : null
        }
      >
        {trial ? (
          <span
            aria-label="체험 워터마크"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 1,
              color: "rgba(255,255,255,0.7)",
              textShadow: "0 1px 2px rgba(0,0,0,0.4)",
              transform: "rotate(-18deg)",
            }}
          >
            SAMEPLZ 체험
          </span>
        ) : null}
      </Media>
      <figcaption style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {model ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--sp-fg-secondary)",
            }}
          >
            {model}
          </span>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Button
            size="sm"
            color="secondary"
            variant="outline"
            onClick={onSave}
            startIcon={<Icon name="DownloadOutlineIcon" />}
          >
            저장
          </Button>
          <Button
            size="sm"
            color={pinned ? "primary" : "secondary"}
            variant={pinned ? "ghost" : "outline"}
            aria-pressed={pinned}
            onClick={onPin}
          >
            {pinned ? "고정됨" : "비교에 고정"}
          </Button>
          {canSame && !trial ? (
            <Button size="sm" color="primary" onClick={onSame}>
              SAME 인증
            </Button>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}

export default ResultFigure;
