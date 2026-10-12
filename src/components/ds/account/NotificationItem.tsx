"use client";

import { useState, type CSSProperties } from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ NotificationItem — one row in 알림. Every notification leads to
   its screen (library, seller center, detail, gallery). Unread rows carry a
   mint dot and a faint tint; opening the list marks all read.
   type: update | sale | same | review | report | follow */

export type NotificationType =
  "update" | "sale" | "same" | "review" | "report" | "follow";

/**
 * Notification row; unread rows carry a mint dot.
 */
export interface NotificationItemProps {
  type?: NotificationType;
  title: string;
  body?: string;
  time?: string;
  unread?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

const TYPE: Record<NotificationType, [IconName, string]> = {
  update: ["RefreshOutlineIcon", "업데이트"],
  sale: ["CouponIcon", "판매"],
  same: ["CopyOutlineIcon", "SAME 인증"],
  review: ["CheckCircleOutlineIcon", "사람 확인"],
  report: ["FlagIcon", "신고 답변"],
  follow: ["UserOutlineIcon", "새 레시피"],
};

export function NotificationItem({
  type = "update",
  title,
  body,
  time,
  unread = false,
  onClick,
  style = {},
}: NotificationItemProps) {
  const [hover, setHover] = useState(false);
  const t = TYPE[type] || TYPE.update;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "36px 1fr auto",
        columnGap: 12,
        alignItems: "start",
        padding: "14px 16px",
        borderRadius: 12,
        background: hover
          ? "var(--sp-bg-hover)"
          : unread
            ? "var(--sp-bg-primary-tint)"
            : "transparent",
        fontFamily: "var(--sp-font-sans)",
        transition: "background 150ms ease",
        ...style,
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--sp-bg-secondary)",
          color: "var(--sp-fg-secondary)",
        }}
      >
        <Icon name={t[0]} size={18} />
      </span>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          minWidth: 0,
        }}
      >
        <span
          style={{ fontSize: 12, fontWeight: 600, color: "var(--sp-fg-hint)" }}
        >
          {t[1]}
        </span>
        <b
          style={{
            fontSize: 14,
            fontWeight: unread ? 700 : 500,
            lineHeight: 1.45,
            color: "var(--sp-fg-normal)",
          }}
        >
          {title}
        </b>
        {body ? (
          <span
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--sp-fg-hint)",
            }}
          >
            {body}
          </span>
        ) : null}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--sp-fg-hint)",
          whiteSpace: "nowrap",
        }}
      >
        {time}
        {unread ? (
          <span
            aria-label="안 읽음"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--sp-bg-primary)",
              boxShadow: "0 0 0 1px var(--sp-border-primary)",
            }}
          />
        ) : null}
      </span>
    </button>
  );
}

export default NotificationItem;
