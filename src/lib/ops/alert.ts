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
