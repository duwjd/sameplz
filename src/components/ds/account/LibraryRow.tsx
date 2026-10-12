import type { CSSProperties, ReactNode } from "react";
import { Badge, type BadgeProps } from "@/components/ds/data-display/Badge";
import { Media, type MediaKind } from "@/components/ds/market/Media";

/* SAMEPLZ LibraryRow — a received recipe in 라이브러리 / 구매 내역.
   Pinned to the version received; a newer version shows as "새 버전 v1.2".
   status = { label, tone } where tone: 'refundable' (열기 전 · 환불 가능),
   'viewed' (열어 봄 · 환불 제한), 'ended' (판매 종료 · 계속 사용). Actions go in `actions`. */

export type LibraryStatusTone = "refundable" | "viewed" | "ended" | "update";

export interface LibraryRowStatus {
  label: string;
  tone: LibraryStatusTone;
}

/**
 * Library row pinned to the received version.
 */
export interface LibraryRowProps {
  title: string;
  meta?: string;
  kind?: MediaKind;
  media?: string;
  status?: LibraryRowStatus;
  newVersion?: string;
  actions?: ReactNode;
  onTitle?: () => void;
  style?: CSSProperties;
}

const TONE: Record<
  LibraryStatusTone,
  [NonNullable<BadgeProps["color"]>, NonNullable<BadgeProps["variant"]>]
> = {
  refundable: ["primary", "subtle"],
  viewed: ["hint", "subtle"],
  ended: ["contrast", "fill"],
  update: ["warning", "fill"],
};

export function LibraryRow({
  title,
  meta,
  kind = "이미지",
  media,
  status,
  newVersion,
  actions,
  onTitle,
  style = {},
}: LibraryRowProps) {
  const t = (status && TONE[status.tone]) || TONE.viewed;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "64px minmax(0,1fr)",
        columnGap: 16,
        rowGap: 12,
        alignItems: "center",
        padding: "16px 0",
        borderBottom: "1px solid var(--sp-border-secondary)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      <Media src={media} ratio="1/1" kind={kind} radius={10} />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
            flex: "1 1 240px",
          }}
        >
          <button
            type="button"
            onClick={onTitle}
            style={{
              all: "unset",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--sp-fg-normal)",
            }}
          >
            {title}
          </button>
          {meta ? (
            <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
              {meta}
            </span>
          ) : null}
          <span
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}
          >
            {status ? (
              <Badge color={t[0]} variant={t[1]} size="sm">
                {status.label}
              </Badge>
            ) : null}
            {newVersion ? (
              <Badge color="warning" variant="fill" size="sm">
                새 버전 {newVersion}
              </Badge>
            ) : null}
          </span>
        </div>
        {actions ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
            }}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default LibraryRow;
