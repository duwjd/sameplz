import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/ds/icons/Icon";
import { KIND_ICON } from "@/components/ds/market/format";

/* SAMEPLZ Media — the result frame used by cards, gallery tiles and
   playground outputs. Shows `src` (image) or a typed placeholder.
   `ratio` keeps the result's real aspect ("9/16" video stays vertical).
   Corner slots: topLeft / topRight / bottomLeft take Badges. */

/** Prompt output kind. */
export type ResultKind = "이미지" | "영상" | "텍스트";
/** Media placeholder kind: a prompt output kind, or a non-prompt category. */
export type MediaKind = ResultKind | "agent" | "skill";

/**
 * Result frame used by cards, gallery tiles and playground outputs. Keeps the real aspect ratio.
 */
export interface MediaProps {
  src?: string;
  alt?: string;
  /** CSS aspect-ratio, e.g. "4/3", "9/16". */
  ratio?: string;
  kind?: MediaKind;
  label?: string;
  /** Overlay a play button. */
  video?: boolean;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  bottomLeft?: ReactNode;
  radius?: number;
  children?: ReactNode;
  style?: CSSProperties;
}

export function Media({
  src,
  alt = "",
  ratio = "4/3",
  kind = "이미지",
  label,
  video = false,
  topLeft,
  topRight,
  bottomLeft,
  radius = 0,
  children,
  style = {},
}: MediaProps) {
  const slot = (pos: CSSProperties, node: ReactNode) =>
    node ? (
      <span style={{ position: "absolute", display: "flex", gap: 4, ...pos }}>
        {node}
      </span>
    ) : null;
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: ratio,
        width: "100%",
        overflow: "hidden",
        background: "var(--sp-bg-secondary)",
        borderRadius: radius,
        ...style,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-generated result of arbitrary origin; kept identical to the design source
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
            color: "var(--sp-fg-hint)",
            fontFamily: "var(--sp-font-sans)",
            fontSize: 12,
            fontWeight: 500,
            textAlign: "center",
            padding: 12,
          }}
        >
          <Icon name={KIND_ICON[kind] || "ImageOutlineIcon"} size={24} />
          {label ? <span>{label}</span> : null}
        </div>
      )}
      {video ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(14,26,20,0.72)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="PlayIcon" size={20} />
        </span>
      ) : null}
      {children}
      {slot({ top: 10, left: 10 }, topLeft)}
      {slot({ top: 10, right: 10 }, topRight)}
      {slot({ bottom: 10, left: 10 }, bottomLeft)}
    </div>
  );
}

export default Media;
