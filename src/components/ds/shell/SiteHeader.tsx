"use client";

import { useState, type CSSProperties } from "react";
import { Icon } from "@/components/ds/icons/Icon";
import { Button } from "@/components/ds/actions/Button";
import { IconButton } from "@/components/ds/actions/IconButton";
import { Avatar } from "@/components/ds/data-display/Avatar";
import { Logo } from "@/components/ds/brand/Logo";
import { formatCredit } from "@/components/ds/market/format";

/* SAMEPLZ SiteHeader — the GNB. Top row: logo · global search · account
   actions. Bottom row: 홈 / 갤러리 / 마켓 ▾ / 플레이그라운드.
   마켓 opens a submenu on hover/focus; the ▾ button toggles it by click/Enter, Esc closes.
   Guest (user = null) sees one 로그인 button; members see 알림 · 크레딧 · avatar. */

export interface SiteHeaderUser {
  name: string;
  avatar?: string;
}

export type SiteHeaderActive =
  | "home"
  | "gallery"
  | "market"
  | "play"
  | "prompt"
  | "agent"
  | "skill"
  | "collection";

export interface SiteHeaderNavItem {
  key: string;
  label: string;
  /** Opens the 마켓 submenu. */
  menu?: boolean;
}

export interface SiteHeaderMarketItem {
  key: string;
  label: string;
  desc?: string;
  count?: number;
}

/**
 * Global navigation. Guest (user=null) sees 로그인; members see 알림 · 크레딧 · avatar.
 */
export interface SiteHeaderProps {
  user?: SiteHeaderUser | null;
  notifications?: number;
  credits?: number;
  active?: SiteHeaderActive;
  nav?: SiteHeaderNavItem[];
  market?: SiteHeaderMarketItem[];
  marketTotal?: number;
  searchPlaceholder?: string;
  onNavigate?: (key: string) => void;
  onSearch?: (q: string) => void;
  onLogin?: () => void;
  onNotifications?: () => void;
  onCredits?: () => void;
  onAccount?: () => void;
  style?: CSSProperties;
}

const DEFAULT_NAV: SiteHeaderNavItem[] = [
  { key: "home", label: "홈" },
  { key: "gallery", label: "갤러리" },
  { key: "market", label: "마켓", menu: true },
  { key: "play", label: "플레이그라운드" },
];
const DEFAULT_MARKET: SiteHeaderMarketItem[] = [
  { key: "prompt", label: "프롬프트", desc: "이미지·영상·텍스트" },
  { key: "agent", label: "에이전트", desc: "여러 단계를 알아서" },
  { key: "skill", label: "스킬", desc: "Claude·ChatGPT에 넣는 기능" },
  { key: "collection", label: "컬렉션", desc: "섞어서 묶은 팩" },
];

export function SiteHeader({
  user = null,
  notifications = 0,
  credits = 0,
  active = "home",
  nav = DEFAULT_NAV,
  market = DEFAULT_MARKET,
  searchPlaceholder = "프로필 사진, 언박싱 숏폼, 블로그 SEO…",
  onNavigate,
  onSearch,
  onLogin,
  onNotifications,
  onCredits,
  onAccount,
  style = {},
}: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const go = (k: string) => {
    setOpen(false);
    if (onNavigate) onNavigate(k);
  };
  const navLink = (active_: boolean): CSSProperties => ({
    all: "unset",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    height: 44,
    padding: "0 12px",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: active_ ? 700 : 500,
    color: active_ ? "var(--sp-fg-normal)" : "var(--sp-fg-secondary)",
    boxShadow: active_ ? "inset 0 -3px 0 var(--sp-bg-primary)" : "none",
  });
  return (
    <header
      style={{
        background: "var(--sp-bg-surface)",
        borderBottom: "1px solid var(--sp-border-normal)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "12px 24px",
          flexWrap: "wrap",
        }}
      >
        <a
          href="#home"
          onClick={(e) => {
            if (onNavigate) {
              e.preventDefault();
              go("home");
            }
          }}
          aria-label="SAMEPLZ 홈"
          style={{ display: "inline-flex", color: "inherit" }}
        >
          <Logo size={30} />
        </a>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (onSearch) onSearch(q);
          }}
          style={{ flex: 1, minWidth: 220, maxWidth: 560, display: "flex" }}
        >
          <label
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 40,
              padding: "0 6px 0 12px",
              boxSizing: "border-box",
              borderRadius: 999,
              background: "var(--sp-bg-secondary)",
              border:
                "1px solid " +
                (focus ? "var(--sp-border-primary)" : "transparent"),
              boxShadow: focus ? "0 0 0 3px var(--sp-focus-ring)" : "none",
              transition: "box-shadow 150ms ease",
            }}
          >
            <span
              style={{ color: "var(--sp-fg-hint)", display: "inline-flex" }}
            >
              <Icon name="SearchOutlineIcon" size={18} />
            </span>
            <span
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }}
            >
              검색
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              style={{
                all: "unset",
                flex: 1,
                minWidth: 0,
                fontSize: 14,
                color: "var(--sp-fg-normal)",
              }}
            />
            <Button
              type="submit"
              size="md"
              color="contrast"
              style={{ borderRadius: 999 }}
            >
              검색
            </Button>
          </label>
        </form>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
          }}
        >
          {user ? (
            <>
              <span style={{ position: "relative", display: "inline-flex" }}>
                <IconButton
                  icon={<Icon name="BellOnOutlineIcon" />}
                  variant="ghost"
                  color="secondary"
                  size="lg"
                  rounded
                  aria-label={
                    "알림" +
                    (notifications ? " " + notifications + "개 새로" : "")
                  }
                  onClick={onNotifications}
                />
                {notifications ? (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 0,
                      minWidth: 18,
                      height: 18,
                      padding: "0 5px",
                      boxSizing: "border-box",
                      borderRadius: 999,
                      background: "var(--sp-bg-danger)",
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid var(--sp-bg-surface)",
                    }}
                  >
                    {notifications > 99 ? "99+" : notifications}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={onCredits}
                aria-label={"크레딧 " + formatCredit(credits)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 36,
                  padding: "0 12px",
                  borderRadius: 999,
                  background: "var(--sp-bg-primary-soft)",
                  color: "var(--sp-fg-primary)",
                  fontSize: 14,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <Icon name="LightningIcon" size={16} />
                {formatCredit(credits)}
              </button>
              <button
                type="button"
                onClick={onAccount}
                aria-label="마이페이지"
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "inline-flex",
                  borderRadius: "50%",
                }}
              >
                <Avatar name={user.name} src={user.avatar} size="lg" />
              </button>
            </>
          ) : (
            <Button color="primary" size="lg" onClick={onLogin}>
              로그인
            </Button>
          )}
        </div>
      </div>
      <nav aria-label="주 메뉴" style={{ padding: "0 12px" }}>
        <ul
          style={{
            display: "flex",
            gap: 4,
            margin: 0,
            padding: 0,
            listStyle: "none",
            flexWrap: "wrap",
          }}
        >
          {nav.map((n) =>
            n.menu ? (
              <li
                key={n.key}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
              >
                <button
                  type="button"
                  onClick={() => go(n.key)}
                  onFocus={() => setOpen(true)}
                  style={navLink(
                    active === n.key || market.some((m) => m.key === active),
                  )}
                >
                  {n.label}
                </button>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label="마켓 하위 메뉴 열기"
                  onClick={() => setOpen(!open)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    display: "inline-flex",
                    marginLeft: -8,
                    padding: 4,
                    color: "var(--sp-fg-hint)",
                    transform: open ? "rotate(180deg)" : "none",
                    transition: "transform 150ms ease",
                  }}
                >
                  <Icon name="ChevronDownOutlineIcon" size={16} />
                </button>
                {open ? (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      paddingTop: 4,
                      zIndex: 20,
                    }}
                  >
                    <ul
                      aria-label="마켓 하위 메뉴"
                      style={{
                        margin: 0,
                        padding: 6,
                        listStyle: "none",
                        width: 320,
                        background: "var(--sp-bg-surface)",
                        border: "1px solid var(--sp-border-normal)",
                        borderRadius: 12,
                        boxShadow: "var(--sp-shadow-lg)",
                      }}
                    >
                      {market.map((m) => (
                        <MarketItem
                          key={m.key}
                          item={m}
                          active={active === m.key}
                          onClick={() => go(m.key)}
                        />
                      ))}
                      <li
                        style={{
                          borderTop: "1px solid var(--sp-border-secondary)",
                          margin: "6px 0 0",
                          paddingTop: 6,
                        }}
                      >
                        <MarketItem
                          item={{ key: "market", label: "마켓 전체 보기" }}
                          onClick={() => go("market")}
                        />
                      </li>
                    </ul>
                  </div>
                ) : null}
              </li>
            ) : (
              <li key={n.key} style={{ display: "flex" }}>
                <button
                  type="button"
                  aria-current={active === n.key ? "page" : undefined}
                  onClick={() => go(n.key)}
                  style={navLink(active === n.key)}
                >
                  {n.label}
                </button>
              </li>
            ),
          )}
        </ul>
      </nav>
    </header>
  );
}

function MarketItem({
  item,
  active,
  onClick,
}: {
  item: SiteHeaderMarketItem;
  active?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const Row = item.key === "market" ? "div" : "li";
  return (
    <Row style={{ listStyle: "none" }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-current={active ? "page" : undefined}
        style={{
          all: "unset",
          boxSizing: "border-box",
          cursor: "pointer",
          width: "100%",
          display: "grid",
          alignItems: "center",
          padding: "10px 12px",
          borderRadius: 8,
          background: active
            ? "var(--sp-bg-primary-soft)"
            : hover
              ? "var(--sp-bg-hover)"
              : "transparent",
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <b
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: active ? "var(--sp-fg-primary)" : "var(--sp-fg-normal)",
            }}
          >
            {item.label}
          </b>
          {item.desc ? (
            <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
              {item.desc}
            </span>
          ) : null}
        </span>
      </button>
    </Row>
  );
}

export default SiteHeader;
