import type { CSSProperties } from "react";
import { Icon } from "@/components/ds/icons/Icon";
import { Button } from "@/components/ds/actions/Button";
import { Badge } from "@/components/ds/data-display/Badge";
import { Media, type ResultKind } from "@/components/ds/market/Media";
import { formatCount } from "@/components/ds/market/format";

/* SAMEPLZ GalleryTile — one result in the 갤러리. Originals and SAME 인증
   (follow-along results) mix in a masonry column; media keeps its real ratio.
   같은 걸로 → original recipe. 이걸로 만들기 → fork (royalty 10% to the original creator).
   Every result carries an "AI 생성" mark. */

export type GalleryTileType = "original" | "same";

/**
 * One gallery result with 같은 걸로 and 이걸로 만들기 (fork).
 */
export interface GalleryTileProps {
  title: string;
  creator: string;
  likes?: number;
  liked?: boolean;
  type?: GalleryTileType;
  madeHere?: boolean;
  media?: string;
  ratio?: string;
  kind?: ResultKind;
  mediaLabel?: string;
  recipe?: string;
  canFork?: boolean;
  onSame?: () => void;
  onFork?: () => void;
  onLike?: () => void;
  onRecipe?: () => void;
  style?: CSSProperties;
}

export function GalleryTile({
  title,
  creator,
  likes = 0,
  liked = false,
  type = "original",
  madeHere = false,
  media,
  ratio = "1/1",
  kind = "이미지",
  mediaLabel,
  recipe,
  canFork = true,
  onSame,
  onFork,
  onLike,
  onRecipe,
  style = {},
}: GalleryTileProps) {
  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        overflow: "hidden",
        breakInside: "avoid",
        background: "var(--sp-bg-surface)",
        border: "1px solid var(--sp-border-normal)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      <Media
        src={media}
        ratio={ratio}
        kind={kind}
        label={mediaLabel}
        video={kind === "영상"}
        topLeft={
          type === "same" ? (
            <Badge color="contrast" variant="fill" size="sm">
              SAME 인증
            </Badge>
          ) : null
        }
        topRight={
          madeHere ? (
            <Badge color="primary" variant="fill" size="sm">
              여기서 생성
            </Badge>
          ) : null
        }
        bottomLeft={
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
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 14px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <b
              style={{
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.4,
                color: "var(--sp-fg-normal)",
              }}
            >
              {title}
            </b>
            <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
              {creator}
            </span>
          </div>
          <button
            type="button"
            aria-pressed={liked}
            aria-label={"좋아요 " + formatCount(likes)}
            onClick={onLike}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: liked ? "var(--sp-fg-danger)" : "var(--sp-fg-hint)",
              fontVariantNumeric: "tabular-nums",
              padding: "2px 0",
            }}
          >
            <Icon name={liked ? "HeartIcon" : "HeartOutlineIcon"} size={16} />
            {formatCount(likes)}
          </button>
        </div>
        {recipe ? (
          <button
            type="button"
            onClick={onRecipe}
            style={{
              all: "unset",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--sp-fg-secondary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            원본 레시피 ·{" "}
            <span
              style={{ textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              {recipe}
            </span>
          </button>
        ) : null}
        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
          <Button size="sm" color="primary" onClick={onSame}>
            같은 걸로
          </Button>
          {canFork && type === "original" ? (
            <Button
              size="sm"
              color="secondary"
              variant="outline"
              onClick={onFork}
              startIcon={<Icon name="ForkIcon" />}
            >
              이걸로 만들기
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default GalleryTile;
