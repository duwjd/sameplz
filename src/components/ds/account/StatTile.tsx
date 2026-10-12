"use client";

import {
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ StatTile — number tile for 마이페이지 홈 and 판매자 센터
   (받은 레시피 · 크레딧 · 좋아요 · 매출…). Clickable tiles lead to their screen.
   `delta` shows a period change ("+12%"); `hint` holds the next step for new members. */

/**
 * Number tile; clickable tiles lead to their screen.
 */
export interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  delta?: string;
  icon?: IconName;
  onClick?: () => void;
  style?: CSSProperties;
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  delta,
  icon,
  onClick,
  style = {},
}: StatTileProps) {
  const [hover, setHover] = useState(false);
  const Tag: ElementType = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: onClick ? "unset" : undefined,
        boxSizing: "border-box",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 16,
        borderRadius: 12,
        minWidth: 0,
        background: "var(--sp-bg-surface)",
        border:
          "1px solid " +
          (hover && onClick
            ? "var(--sp-border-hover)"
            : "var(--sp-border-normal)"),
        fontFamily: "var(--sp-font-sans)",
        transition: "border-color 150ms ease",
        ...style,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--sp-fg-hint)",
        }}
      >
        {icon ? <Icon name={icon} size={16} /> : null}
        {label}
        {onClick ? (
          <Icon
            name="ChevronRightOutlineIcon"
            size={14}
            style={{ marginLeft: "auto" }}
          />
        ) : null}
      </span>
      <span
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          columnGap: 4,
        }}
      >
        <b
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: -0.5,
            color: "var(--sp-fg-normal)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </b>
        {unit ? (
          <span style={{ fontSize: 14, color: "var(--sp-fg-secondary)" }}>
            {unit}
          </span>
        ) : null}
        {delta ? (
          <span
            style={{
              marginLeft: 2,
              fontSize: 12,
              fontWeight: 600,
              color: String(delta).startsWith("-")
                ? "var(--sp-fg-danger)"
                : "var(--sp-fg-primary)",
            }}
          >
            {delta}
          </span>
        ) : null}
      </span>
      {hint ? (
        <span
          style={{ fontSize: 12, lineHeight: 1.5, color: "var(--sp-fg-hint)" }}
        >
          {hint}
        </span>
      ) : null}
    </Tag>
  );
}

export default StatTile;
