"use client";

import {
  Children,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { Icon } from "@/components/ds/icons/Icon";
import { Badge } from "@/components/ds/data-display/Badge";
import { Media, type ResultKind } from "@/components/ds/market/Media";
import { formatWon, CATEGORY_LABEL } from "@/components/ds/market/format";
import type { RecipeCategory } from "@/components/ds/market/RecipeCard";

/* SAMEPLZ RankCard + RankRail — "실시간 인기 TOP 10". A big rank numeral
   beside a compact recipe card, laid out on a horizontally scrolling rail.
   `move` = change vs one hour ago (positive up, negative down, 0 none, 'new'). */

/** Change vs 1 hour ago. Positive up, negative down, 0 none, 'new' for new entries. */
export type RankMove = number | "new";

/**
 * Big rank numeral beside a compact recipe card. Place several inside <RankRail> for a horizontal scroll strip.
 */
export interface RankCardProps {
  rank: number;
  title: string;
  creator: string;
  category?: RecipeCategory;
  kind?: ResultKind;
  price?: number;
  /** Change vs 1 hour ago. 'new' for new entries. */
  move?: RankMove;
  media?: string;
  mediaLabel?: string;
  href?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export interface RankRailProps {
  children?: ReactNode;
  style?: CSSProperties;
}

function Movement({ move }: { move: RankMove }) {
  if (move === "new")
    return (
      <Badge color="primary" variant="fill" size="sm">
        NEW
      </Badge>
    );
  if (!move)
    return (
      <span style={{ color: "var(--sp-fg-hint)" }} aria-label="변동 없음">
        –
      </span>
    );
  const up = move > 0;
  return (
    <span
      aria-label={(up ? "상승 " : "하락 ") + Math.abs(move)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontWeight: 600,
        color: up ? "var(--sp-fg-primary)" : "var(--sp-fg-hint)",
      }}
    >
      <Icon name={up ? "CaretUpIcon" : "CaretDownIcon"} size={14} />
      {Math.abs(move)}
    </span>
  );
}

export function RankCard({
  rank,
  title,
  creator,
  category = "prompt",
  kind,
  price = 0,
  move = 0,
  media,
  mediaLabel,
  href,
  onClick,
  style = {},
}: RankCardProps) {
  const [hover, setHover] = useState(false);
  const Tag: ElementType = href ? "a" : onClick ? "button" : "div";
  return (
    <Tag
      href={href}
      onClick={onClick}
      type={Tag === "button" ? "button" : undefined}
      aria-label={rank + "위 " + title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 0,
        width: 280,
        flexShrink: 0,
        scrollSnapAlign: "start",
        textDecoration: "none",
        color: "inherit",
        font: "inherit",
        textAlign: "left",
        padding: 0,
        border: 0,
        background: "none",
        cursor: href || onClick ? "pointer" : "default",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 88,
          lineHeight: 0.8,
          fontWeight: 800,
          letterSpacing: -6,
          width: rank >= 10 ? 104 : 64,
          flexShrink: 0,
          color: "var(--sp-fg-normal)",
          fontVariantNumeric: "tabular-nums",
          marginRight: -12,
          position: "relative",
          zIndex: 1,
          WebkitTextStroke: "0px",
          paddingBottom: 6,
        }}
      >
        {rank}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          overflow: "hidden",
          background: "var(--sp-bg-surface)",
          border:
            "1px solid " +
            (hover ? "var(--sp-border-hover)" : "var(--sp-border-normal)"),
          transition: "border-color 200ms ease",
        }}
      >
        <Media
          src={media}
          ratio="4/3"
          kind={category === "prompt" ? kind || "이미지" : category}
          label={mediaLabel}
          topRight={
            <Badge color="contrast" variant="fill" size="sm">
              {category === "prompt"
                ? kind || "프롬프트"
                : CATEGORY_LABEL[category]}
            </Badge>
          }
        />
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "10px 12px 12px",
          }}
        >
          <b
            style={{
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.4,
              color: "var(--sp-fg-normal)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </b>
          <span
            style={{
              fontSize: 12,
              color: "var(--sp-fg-hint)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {creator} · {CATEGORY_LABEL[category]}
          </span>
          <span
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
              marginTop: 2,
            }}
          >
            <b
              style={{
                fontWeight: 700,
                color:
                  price === 0 ? "var(--sp-fg-primary)" : "var(--sp-fg-normal)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatWon(price)}
            </b>
            <Movement move={move} />
          </span>
        </span>
      </span>
    </Tag>
  );
}

export function RankRail({ children, style = {} }: RankRailProps) {
  return (
    <div
      role="list"
      style={{
        display: "flex",
        gap: 20,
        overflowX: "auto",
        scrollSnapType: "x mandatory",
        paddingBottom: 8,
        scrollbarWidth: "thin",
        ...style,
      }}
    >
      {Children.map(children, (c) => (
        <div role="listitem" style={{ display: "flex" }}>
          {c}
        </div>
      ))}
    </div>
  );
}

export default RankCard;
