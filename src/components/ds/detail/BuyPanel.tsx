import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/ds/icons/Icon";
import { Button } from "@/components/ds/actions/Button";
import { Badge } from "@/components/ds/data-display/Badge";
import { Avatar } from "@/components/ds/data-display/Avatar";
import { formatWon } from "@/components/ds/market/format";

/* SAMEPLZ BuyPanel — the sticky purchase column on recipe detail pages.
   One main button per state:
     none  → "SAME 하기 · 9,900원"      free  → "무료로 SAME 하기"
     owned → "라이브러리에서 열기"      mine  → 내 레시피 · 새 버전 올리기 / 판매자 센터
   `play` adds 바로 만들어 보기 (playground). Pass `playDisabledReason` when the tool has no API. */

export type BuyPanelState = "none" | "owned" | "mine";

export interface BuyPanelSeller {
  name: string;
  avatar?: string;
  note?: string;
}

/**
 * Purchase column on recipe detail pages. One main action per state.
 */
export interface BuyPanelProps {
  price?: number;
  state?: BuyPanelState;
  ownedNote?: string;
  license?: string;
  rejected?: boolean;
  play?: boolean;
  playDisabledReason?: string;
  liked?: boolean;
  seller?: BuyPanelSeller;
  following?: boolean;
  onBuy?: () => void;
  onOpen?: () => void;
  onPlay?: () => void;
  onLike?: () => void;
  onShare?: () => void;
  onFollow?: () => void;
  onEdit?: () => void;
  onSeller?: () => void;
  style?: CSSProperties;
}

const LICENSE =
  "하나의 라이선스: 본인·업무에 자유롭게 사용, 원문 재판매·재배포는 안 돼요.";

export function BuyPanel({
  price = 0,
  state = "none",
  ownedNote,
  license = LICENSE,
  rejected = false,
  play = true,
  playDisabledReason,
  liked = false,
  seller,
  following = false,
  onBuy,
  onOpen,
  onPlay,
  onLike,
  onShare,
  onFollow,
  onEdit,
  onSeller,
  style = {},
}: BuyPanelProps) {
  const free = price === 0;
  let main: ReactNode;
  if (state === "mine") {
    main = (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Badge
          color="contrast"
          variant="fill"
          style={{ alignSelf: "flex-start" }}
        >
          내 레시피
        </Badge>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          <Button
            size="lg"
            color="secondary"
            variant="outline"
            stretch
            onClick={onEdit}
          >
            {rejected ? "고쳐서 다시 제출" : "새 버전 올리기"}
          </Button>
          <Button
            size="lg"
            color="secondary"
            variant="outline"
            stretch
            onClick={onSeller}
          >
            판매자 센터
          </Button>
        </div>
      </div>
    );
  } else if (state === "owned") {
    main = (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Button size="xl" color="primary" stretch onClick={onOpen}>
          라이브러리에서 열기
        </Button>
        {ownedNote ? (
          <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
            {ownedNote}
          </span>
        ) : null}
      </div>
    );
  } else {
    main = (
      <Button
        size="xl"
        color="primary"
        stretch
        onClick={onBuy}
        style={{ fontWeight: 700 }}
      >
        {free ? "무료로 SAME 하기" : "SAME 하기 · " + formatWon(price)}
      </Button>
    );
  }
  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 20,
        borderRadius: 16,
        background: "var(--sp-bg-surface)",
        border: "1px solid var(--sp-border-normal)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{ fontSize: 12, fontWeight: 600, color: "var(--sp-fg-hint)" }}
        >
          가격
        </span>
        <span
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: -0.6,
            color: free ? "var(--sp-fg-primary)" : "var(--sp-fg-normal)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatWon(price)}
        </span>
        <span
          style={{ fontSize: 12, lineHeight: 1.5, color: "var(--sp-fg-hint)" }}
        >
          {license}
        </span>
      </div>
      {main}
      {play ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Button
            size="lg"
            color="secondary"
            variant="outline"
            stretch
            disabled={!!playDisabledReason}
            onClick={onPlay}
            startIcon={<Icon name="MagicWandIcon" />}
          >
            바로 만들어 보기
          </Button>
          {playDisabledReason ? (
            <span
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--sp-fg-hint)",
              }}
            >
              {playDisabledReason}
            </span>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Button
          size="md"
          color={liked ? "primary" : "secondary"}
          variant={liked ? "ghost" : "outline"}
          stretch
          aria-pressed={liked}
          onClick={onLike}
          startIcon={<Icon name={liked ? "HeartIcon" : "HeartOutlineIcon"} />}
        >
          {liked ? "좋아요 함" : "좋아요"}
        </Button>
        <Button
          size="md"
          color="secondary"
          variant="outline"
          stretch
          onClick={onShare}
          startIcon={<Icon name="LinkOutlineIcon" />}
        >
          링크 복사
        </Button>
      </div>
      {!free && state === "none" ? (
        <span
          style={{ fontSize: 12, lineHeight: 1.5, color: "var(--sp-fg-hint)" }}
        >
          원문을 열기 전엔 7일 안에 환불돼요. 열고 나면 환불이 어려워요.
        </span>
      ) : null}
      {seller && state !== "mine" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingTop: 16,
            borderTop: "1px solid var(--sp-border-secondary)",
          }}
        >
          <Avatar name={seller.name} src={seller.avatar} size="lg" />
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
                color: "var(--sp-fg-normal)",
              }}
            >
              {seller.name}
            </b>
            <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
              {seller.note || "크리에이터 · 본인인증 완료"}
            </span>
          </div>
          <Button
            size="sm"
            color={following ? "secondary" : "contrast"}
            variant={following ? "outline" : "fill"}
            onClick={onFollow}
          >
            {following ? "팔로잉" : "팔로우"}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

export default BuyPanel;
