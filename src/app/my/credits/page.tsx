import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CreditsGuest } from "@/components/credits/CreditsGuest";
import {
  getCreditHistory,
  getCreditSummary,
  type CreditLineDTO,
} from "@/data/playground";
import { getViewer } from "@/lib/auth/account";
import { kstMonthDay, kstShortDate, MONTHLY_GRANT } from "@/lib/play/copy";

export const metadata: Metadata = {
  title: "크레딧 · SAMEPLZ",
  robots: { index: false },
};

const LINE_LABEL: Record<CreditLineDTO["kind"], string> = {
  grant: "이번 달 무료 크레딧",
  use: "플레이그라운드 사용",
  returned: "모델 오류 · 크레딧 반환",
  safety: "안전 필터 · 차감 없음",
  holding: "만드는 중 · 결과가 나오면 정산돼요",
  expire: "지난달 남은 크레딧 소멸",
};

const FILTERS = [
  { value: "all", label: "전체" },
  { value: "in", label: "지급·반환" },
  { value: "out", label: "사용·소멸" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

const matches = (f: Filter, l: CreditLineDTO) =>
  f === "all" ||
  (f === "in"
    ? ["grant", "returned", "safety"].includes(l.kind)
    : ["use", "holding", "expire"].includes(l.kind));

async function Credits({
  searchParams,
}: {
  searchParams: PageProps<"/my/credits">["searchParams"];
}) {
  const sp = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === sp.filter)
    ? (sp.filter as Filter)
    : "all";
  const viewer = await getViewer();
  if (!viewer) return <CreditsGuest />;
  const [summary, lines] = await Promise.all([
    getCreditSummary(viewer),
    getCreditHistory(viewer),
  ]);
  if (!summary)
    return <p>크레딧 정보를 불러오지 못했어요. 잠시 뒤에 새로고침해 주세요.</p>;
  const shown = lines.filter((l) => matches(filter, l));

  return (
    <>
      <section
        aria-labelledby="crd-balance"
        style={{
          border: "1px solid var(--sp-line-normal)",
          borderRadius: 16,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <h2
          id="crd-balance"
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--sp-fg-secondary)",
          }}
        >
          보유 크레딧
        </h2>
        <b
          style={{ fontSize: 32, fontWeight: 800 }}
          data-testid="crd-available"
        >
          {summary.available}C
        </b>
        <span style={{ fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          이번 달 무료 크레딧이에요 · {kstMonthDay(summary.nextResetAt)} 0시에
          새로 채워지고, 남은 크레딧은 그때 사라져요.
        </span>
        <span style={{ fontSize: 14 }}>
          오늘 남은 한도 <b>{summary.remainingToday}C</b> / 하루{" "}
          {summary.dailyLimit}C
          {summary.held > 0 ? ` · 만드는 중 ${summary.held}C` : ""}
        </span>
      </section>

      <section
        aria-labelledby="crd-history"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2
            id="crd-history"
            style={{ margin: 0, fontSize: 18, fontWeight: 700 }}
          >
            내역
          </h2>
          <nav aria-label="내역 거르기" style={{ display: "flex", gap: 6 }}>
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={
                  f.value === "all"
                    ? "/my/credits"
                    : `/my/credits?filter=${f.value}`
                }
                aria-current={filter === f.value ? "page" : undefined}
                style={{
                  fontSize: 13,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--sp-line-normal)",
                  background:
                    filter === f.value
                      ? "var(--sp-bg-primary-soft, var(--sp-bg-secondary))"
                      : "transparent",
                  color: "var(--sp-fg-normal)",
                }}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
        {shown.length === 0 ? (
          <p
            style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}
          >
            내역이 없어요 · 플레이그라운드에서 만들면 여기에 쌓여요.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {shown.map((l, i) => (
              <li
                key={`${l.at}-${i}`}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--sp-line-normal)",
                  fontSize: 14,
                }}
              >
                <span style={{ color: "var(--sp-fg-secondary)", minWidth: 48 }}>
                  {kstShortDate(l.at)}
                </span>
                <span style={{ flex: 1 }}>{LINE_LABEL[l.kind]}</span>
                <b
                  style={{
                    color:
                      l.delta > 0
                        ? "var(--sp-fg-accent)"
                        : "var(--sp-fg-normal)",
                  }}
                >
                  {l.delta > 0
                    ? `+${l.delta}C`
                    : l.delta < 0
                      ? `${l.delta}C`
                      : `0C (${l.credits}C 반환)`}
                </b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="crd-rules"
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        <h2 id="crd-rules" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          크레딧 규칙
        </h2>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 14,
            lineHeight: 1.7,
            color: "var(--sp-fg-secondary)",
          }}
        >
          <li>
            매달 1일 0시(한국 시간)에 {MONTHLY_GRANT}C를 드려요. 남은
            크레딧은 다음 달로 넘어가지 않아요.
          </li>
          <li>하루에 {summary.dailyLimit}C까지 쓸 수 있어요.</li>
          <li>
            모델 오류로 못 만들면 쓴 크레딧을 바로 돌려드려요. 안전 필터에
            걸리면 차감하지 않아요.
          </li>
          <li>
            크레딧은 플레이그라운드 생성에만 써요. 레시피를 받는 데는 쓰지
            않아요.
          </li>
          <li>지금은 무료 크레딧만 있어요. 충전·환불은 아직 없어요.</li>
        </ul>
      </section>
    </>
  );
}

export default function CreditsPage(props: PageProps<"/my/credits">) {
  return (
    <main
      data-screen-label="Credits"
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "32px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        color: "var(--sp-fg-normal)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>크레딧</h1>
          <p
            style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}
          >
            플레이그라운드에서 쓰는 무료 크레딧이에요.
          </p>
        </div>
        <Link
          href="/play"
          style={{
            marginLeft: "auto",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--sp-fg-accent)",
          }}
        >
          플레이그라운드 열기
        </Link>
      </header>
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            style={{
              height: 240,
              borderRadius: 16,
              background: "var(--sp-bg-secondary)",
            }}
          />
        }
      >
        <Credits searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
