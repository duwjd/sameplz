// Operator alerts (F4-15) to a Slack or Discord incoming webhook (OPS_ALERT_WEBHOOK_URL, server env).
// Free and optional: without the variable nothing is sent and nothing is marked sent.
import "server-only";

export interface BudgetAlert {
  month: string;
  level: 80 | 100;
  cap: number;
  used: number;
  state: string;
}

/** Korean one-liner; numbers only, no user data. */
export function budgetAlertText(a: BudgetAlert): string {
  const month = Number(a.month.slice(5, 7));
  const pct = a.cap > 0 ? Math.floor((a.used / a.cap) * 100) : 100;
  return a.level === 80
    ? `[SAMEPLZ] ${month}월 생성 예산의 ${pct}%를 썼어요 (${a.used.toLocaleString("ko-KR")}C / ${a.cap.toLocaleString("ko-KR")}C). 100%가 되면 이번 달 생성이 마감돼요.`
    : `[SAMEPLZ] ${month}월 생성이 마감됐어요 (${a.state === "open" ? "예산 소진" : "수동 정지"} · ${a.used.toLocaleString("ko-KR")}C / ${a.cap.toLocaleString("ko-KR")}C). 다음 달 1일에 자동으로 다시 열려요.`;
}

export interface SlaAlert {
  kind: "review_24h" | "report_20h";
  id: string;
  since: string;
}

/** F8-1 / F8-2: one message per sweep with the counts; ids stay out of the text (no user data). */
export function slaAlertText(alerts: SlaAlert[]): string | null {
  const reviews = alerts.filter((a) => a.kind === "review_24h").length;
  const reports = alerts.filter((a) => a.kind === "report_20h").length;
  if (!reviews && !reports) return null;
  const parts = [
    reviews ? `24시간 넘은 심사 ${reviews}건` : "",
    reports ? `20시간 넘게 답하지 않은 신고 ${reports}건` : "",
  ].filter(Boolean);
  return `[SAMEPLZ] ${parts.join(", ")}이 있어요. /admin 에서 처리해 주세요.`;
}

/** POST to the ops webhook. true only on a 2xx (the caller marks the alert sent). */
export async function postOpsAlert(text: string): Promise<boolean> {
  const url = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  try {
    const res = await fetch(u, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Slack reads `text`, Discord reads `content`; each ignores the other.
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
