"use client";
// F8-4: a suspended member sees why some buttons refuse, on every page (warning and ban show none:
// a warning changes nothing, a ban signs out to /blocked).
import { useAuth } from "@/components/auth/AuthProvider";

const kstDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));

export function SanctionBanner() {
  const { viewer } = useAuth();
  const s = viewer?.sanction;
  if (!s || (s.level !== "seller_suspended" && s.level !== "account_suspended"))
    return null;
  const until = s.endsAt ? `${kstDate(s.endsAt)}까지` : "해제될 때까지";
  const what =
    s.level === "seller_suspended"
      ? "새 레시피와 새 버전을 올릴 수 없어요."
      : "받기·만들기·올리기·글쓰기를 할 수 없어요. 받은 레시피는 계속 열 수 있어요.";
  return (
    <div
      role="status"
      style={{
        background: "var(--sp-bg-surface)",
        borderBottom: "1px solid var(--sp-border-normal)",
        padding: "10px 24px",
        fontSize: 14,
        lineHeight: 1.5,
        color: "var(--sp-fg-normal)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <strong>
        {s.level === "seller_suspended" ? "레시피 올리기가 멈췄어요" : "계정 이용이 멈췄어요"}
      </strong>{" "}
      · {until} {what} 사유는 알림에 있고, 이의는 고객센터로 알려 주세요.
    </div>
  );
}
