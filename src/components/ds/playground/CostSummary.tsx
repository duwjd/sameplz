import type { CSSProperties } from "react";
import { Icon } from "@/components/ds/icons/Icon";
import { Button } from "@/components/ds/actions/Button";
import { formatCredit } from "@/components/ds/market/format";

/* SAMEPLZ CostSummary — 예상 크레딧 before a playground run.
   lines = [{ label: 'Seedream 4.5 × 2장', credits: 16 }]. Total = sum; 1C = 10원.
   When the total exceeds `balance`, shows the shortfall and a 충전하기 button.
   `trial` replaces the cost with the one free trial note (watermark, original hidden). */

export interface CostLine {
  label: string;
  credits: number;
}

/**
 * Estimated cost before a run. Shows shortfall + 충전하기 when balance is short.
 */
export interface CostSummaryProps {
  lines?: CostLine[];
  balance?: number;
  trial?: boolean;
  onCharge?: () => void;
  onRun?: () => void;
  runLabel?: string;
  style?: CSSProperties;
}

export function CostSummary({
  lines = [],
  balance = 0,
  trial = false,
  onCharge,
  onRun,
  runLabel = "만들기",
  style = {},
}: CostSummaryProps) {
  const total = lines.reduce((a, l) => a + (l.credits || 0), 0);
  const short = !trial && total > balance ? total - balance : 0;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRadius: 12,
        background: "var(--sp-bg-secondary)",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      {trial ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--sp-fg-secondary)",
          }}
        >
          <Icon
            name="GiftOutlineIcon"
            size={16}
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <span>
            체험 1회 · 크레딧이 빠지지 않아요. 결과에 워터마크가 붙고 원문은
            보이지 않아요.
          </span>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lines.map((l, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: "var(--sp-fg-secondary)",
                }}
              >
                <span>{l.label}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatCredit(l.credits)}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingTop: 10,
              borderTop: "1px solid var(--sp-border-normal)",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--sp-fg-normal)",
              }}
            >
              예상 크레딧
            </span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <b
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "var(--sp-fg-normal)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatCredit(total)}
              </b>
              <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
                {(total * 10).toLocaleString("ko-KR")}원
              </span>
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: short ? "var(--sp-fg-danger)" : "var(--sp-fg-hint)",
            }}
          >
            <span>보유 {formatCredit(balance)}</span>
            {short ? (
              <b style={{ fontWeight: 600 }}>{formatCredit(short)} 모자라요</b>
            ) : (
              <span>실행 뒤 {formatCredit(balance - total)}</span>
            )}
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {short ? (
          <Button
            size="lg"
            color="contrast"
            stretch
            onClick={onCharge}
            startIcon={<Icon name="LightningIcon" />}
          >
            충전하기
          </Button>
        ) : (
          <Button
            size="lg"
            color="primary"
            stretch
            onClick={onRun}
            disabled={!trial && !lines.length}
            startIcon={<Icon name="MagicWandIcon" />}
          >
            {runLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export default CostSummary;
