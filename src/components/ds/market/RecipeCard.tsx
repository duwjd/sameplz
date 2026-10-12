"use client";

import { useState, type CSSProperties, type ElementType } from "react";
import { Badge } from "@/components/ds/data-display/Badge";
import { Media, type ResultKind } from "@/components/ds/market/Media";
import { StatBar } from "@/components/ds/market/StatBar";
import {
  formatWon,
  formatCount,
  CATEGORY_LABEL,
} from "@/components/ds/market/format";

/* SAMEPLZ RecipeCard — the market list item for prompts, agents and skills.
   Result first: the media frame leads, then title, creator · job, popularity
   and price. Category sits on the media as an ink badge; free recipes get a mint badge. */

/** Category of a sellable recipe shown on market cards. */
export type RecipeCategory = "prompt" | "agent" | "skill";

/**
 * Market list item. Result first, then title, creator · job, popularity and price.
 */
export interface RecipeCardProps {
  title: string;
  creator: string;
  job?: string;
  category?: RecipeCategory;
  /** Prompt output kind. */
  kind?: ResultKind;
  /** KRW. 0 = 무료. */
  price?: number;
  tools?: string[];
  downloads?: number;
  same?: number;
  likes?: number;
  media?: string;
  ratio?: string;
  mediaLabel?: string;
  href?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export function RecipeCard({
  title,
  creator,
  job,
  category = "prompt",
  kind = "이미지",
  price = 0,
  tools = [],
  downloads = 0,
  same = 0,
  likes = 0,
  media,
  ratio = "4/3",
  mediaLabel,
  href,
  onClick,
  style = {},
}: RecipeCardProps) {
  const [hover, setHover] = useState(false);
  const Tag: ElementType = href ? "a" : onClick ? "button" : "div";
  const typeLabel = category === "prompt" ? kind : CATEGORY_LABEL[category];
  const mediaKind = category === "prompt" ? kind : category;
  return (
    <Tag
      href={href}
      onClick={onClick}
      type={Tag === "button" ? "button" : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        textAlign: "left",
        textDecoration: "none",
        color: "inherit",
        font: "inherit",
        padding: 0,
        cursor: href || onClick ? "pointer" : "default",
        background: "var(--sp-bg-surface)",
        borderRadius: 16,
        overflow: "hidden",
        border:
          "1px solid " +
          (hover ? "var(--sp-border-hover)" : "var(--sp-border-normal)"),
        boxShadow: hover ? "var(--sp-shadow-md)" : "none",
        transition: "box-shadow 200ms ease, border-color 200ms ease",
        fontFamily: "var(--sp-font-sans)",
        minWidth: 0,
        ...style,
      }}
    >
      <Media
        src={media}
        ratio={ratio}
        kind={mediaKind}
        label={mediaLabel}
        video={kind === "영상" && category === "prompt"}
        topLeft={
          <Badge color="contrast" variant="fill" size="sm">
            {typeLabel}
          </Badge>
        }
        topRight={
          price === 0 ? (
            <Badge color="primary" variant="fill" size="sm">
              무료
            </Badge>
          ) : null
        }
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "14px 16px 16px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.4,
            fontWeight: 600,
            color: "var(--sp-fg-normal)",
            letterSpacing: -0.2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textWrap: "pretty",
            wordBreak: "keep-all",
          }}
        >
          {title}
        </h3>
        <span
          style={{
            fontSize: 13,
            color: "var(--sp-fg-hint)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {creator}
          {job ? " · " + job : ""}
        </span>
        <StatBar
          items={[
            {
              label: "다운로드",
              value: formatCount(downloads),
              icon: "DownloadOutlineIcon",
            },
            {
              label: "SAME",
              value: formatCount(same),
              icon: "CopyOutlineIcon",
            },
            {
              label: "좋아요",
              value: formatCount(likes),
              icon: "HeartOutlineIcon",
            },
          ]}
        />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 2,
          }}
        >
          <b
            style={{
              fontSize: 16,
              fontWeight: 700,
              color:
                price === 0 ? "var(--sp-fg-primary)" : "var(--sp-fg-normal)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {formatWon(price)}
          </b>
          <span
            style={{
              fontSize: 12,
              color: "var(--sp-fg-hint)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {tools.join(" · ")}
          </span>
        </div>
      </div>
    </Tag>
  );
}

export default RecipeCard;
