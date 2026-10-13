// MKT-01~05: location + title + live count, filters, sort, applied chips, results / zero results.
// Server component: data comes from the DAL, controls only change the URL.
import Link from "next/link";
import type { CSSProperties } from "react";
import { EmptyState, RecipeCard } from "@/components/ds";
import {
  getLiveCounts,
  getReferenceData,
  searchMarket,
  type CategoryCounts,
} from "@/data/catalog";
import { POPULAR_SEARCH_TERMS } from "@/lib/search/popular-terms";
import {
  MARKET_PAGE_SIZE,
  marketHref,
  type MarketCategory,
  type MarketQuery,
  type MarketSort,
} from "@/lib/validation/market";
import {
  AppliedChips,
  ChipGroup,
  FilterPanel,
  LinkButton,
  SortControl,
  type AppliedChip,
  type ChipLink,
} from "./MarketControls";

const CATEGORY_LABEL: Record<MarketCategory, string> = {
  prompt: "프롬프트",
  agent: "에이전트",
  skill: "스킬",
};
const CATEGORY_SLUG: Record<MarketCategory, string> = {
  prompt: "prompts",
  agent: "agents",
  skill: "skills",
};
const HEADINGS: Record<"all" | MarketCategory, { title: string; sub: string }> =
  {
    all: { title: "마켓 전체", sub: "프롬프트·에이전트·스킬을 한 번에 봐요." },
    prompt: { title: "프롬프트", sub: "이미지·영상·텍스트 생성 레시피" },
    agent: { title: "에이전트", sub: "여러 단계를 알아서 처리하는 흐름" },
    skill: { title: "스킬", sub: "Claude·ChatGPT에 넣는 기능 묶음" },
  };
const SORTS: { value: MarketSort; label: string }[] = [
  { value: "popular", label: "인기순" },
  { value: "downloads", label: "다운로드순" },
  { value: "new", label: "최신순" },
];
// Which tool kinds each tab filters on (MKT-02).
const TOOL_FILTER: Record<
  "all" | MarketCategory,
  { label: string; kinds: string[] } | null
> = {
  all: null,
  prompt: { label: "사용 도구", kinds: ["generator", "assistant"] },
  agent: { label: "실행 환경", kinds: ["runner", "assistant"] },
  skill: { label: "사용 도구", kinds: ["assistant"] },
};

const groupTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--sp-fg-secondary)",
};

export async function MarketView({
  query,
  base,
}: {
  query: MarketQuery;
  base: string;
}) {
  const tab = query.category ?? "all";
  const [ref, live, result] = await Promise.all([
    getReferenceData(),
    getLiveCounts(),
    searchMarket(query),
  ]);
  const heading = HEADINGS[tab];
  const href = (patch: Partial<MarketQuery>) =>
    marketHref(base, { ...query, page: 1, ...patch });

  // ---- filters (MKT-02)
  const groups: { label: string; chips: ChipLink[] }[] = [];
  if (tab === "all") {
    groups.push({
      label: "카테고리",
      chips: (Object.keys(CATEGORY_LABEL) as MarketCategory[]).map((c) => ({
        label: CATEGORY_LABEL[c],
        selected: query.category === c,
        href: href({ category: query.category === c ? null : c }),
      })),
    });
  }
  groups.push({
    label: "직무",
    chips: ref.jobList.map((j) => ({
      label: j.label,
      selected: query.job === j.code,
      href: href({ job: query.job === j.code ? null : j.code }),
    })),
  });
  const toolFilter = TOOL_FILTER[tab];
  if (toolFilter) {
    groups.push({
      label: toolFilter.label,
      chips: ref.toolList
        .filter((t) => toolFilter.kinds.includes(t.kind))
        .map((t) => ({
          label: t.label,
          selected: query.tool === t.code,
          href: href({ tool: query.tool === t.code ? null : t.code }),
        })),
    });
  }

  // ---- applied chips (MKT-04)
  const applied: AppliedChip[] = [];
  if (query.q)
    applied.push({ label: `검색: ${query.q}`, removeHref: href({ q: null }) });
  if (base === "/market" && query.category)
    applied.push({
      label: CATEGORY_LABEL[query.category],
      removeHref: href({ category: null }),
    });
  if (query.job)
    applied.push({
      label: ref.jobs[query.job] ?? query.job,
      removeHref: href({ job: null }),
    });
  if (query.tool)
    applied.push({
      label: ref.tools[query.tool] ?? query.tool,
      removeHref: href({ tool: null }),
    });
  const filterCount = applied.filter(
    (a) => !a.label.startsWith("검색:"),
  ).length;
  const resetHref = marketHref(base, { q: query.q });
  const clearHref = base;

  const pages = Math.max(1, Math.ceil(result.total / MARKET_PAGE_SIZE));

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "24px 24px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* MKT-01 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <nav
            aria-label="현재 위치"
            style={{ fontSize: 13, color: "var(--sp-fg-hint)" }}
          >
            <Link href="/">홈</Link> /{" "}
            {tab === "all" ? (
              <span aria-current="page">마켓</span>
            ) : (
              <Link href="/market">마켓</Link>
            )}
            {tab !== "all" && (
              <>
                {" / "}
                <span aria-current="page">{CATEGORY_LABEL[tab]}</span>
              </>
            )}
          </nav>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.6px",
            }}
          >
            {heading.title}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-hint)" }}>
            {heading.sub}
          </p>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--sp-fg-secondary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          판매 중{" "}
          <b>
            {(tab === "all" ? live.all : live[tab]).toLocaleString("ko-KR")}
          </b>
          개
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* MKT-02 */}
        <FilterPanel
          title={`${heading.title === "마켓 전체" ? "마켓" : heading.title} 필터`}
          activeCount={filterCount}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {groups.map((g) => (
              <section key={g.label}>
                <h2 style={groupTitle}>{g.label}</h2>
                <ChipGroup label={g.label} chips={g.chips} />
              </section>
            ))}
            <div>
              <LinkButton href={resetHref}>필터 초기화</LinkButton>
            </div>
          </div>
        </FilterPanel>

        <section
          aria-label="검색 결과"
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            {/* MKT-05 count */}
            <p
              aria-live="polite"
              style={{
                margin: 0,
                fontSize: 14,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <b>{result.total.toLocaleString("ko-KR")}</b>개
              {query.q ? ` · “${query.q}” 검색 결과` : ""}
            </p>
            {/* MKT-03 */}
            <SortControl
              value={query.sort}
              options={SORTS.map((s) => ({
                ...s,
                href: href({ sort: s.value }),
              }))}
            />
          </div>
          {/* MKT-04 */}
          <AppliedChips chips={applied} clearHref={clearHref} />

          {result.cards.length > 0 ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                  gap: 16,
                }}
              >
                {result.cards.map((card) => (
                  <RecipeCard key={card.href} {...card} />
                ))}
              </div>
              {pages > 1 && (
                <nav
                  aria-label="페이지"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {query.page > 1 && (
                    <LinkButton
                      href={marketHref(base, {
                        ...query,
                        page: query.page - 1,
                      })}
                    >
                      이전
                    </LinkButton>
                  )}
                  <span
                    style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}
                  >
                    {query.page} / {pages}
                  </span>
                  {query.page < pages && (
                    <LinkButton
                      href={marketHref(base, {
                        ...query,
                        page: query.page + 1,
                      })}
                    >
                      다음
                    </LinkButton>
                  )}
                </nav>
              )}
            </>
          ) : (
            <ZeroResult
              query={query}
              elsewhere={result.elsewhere}
              resetHref={resetHref}
            />
          )}
        </section>
      </div>
    </main>
  );
}

/** MKT-05 / F1-6: never a dead end — other tabs first, popular terms when nothing anywhere. */
function ZeroResult({
  query,
  elsewhere,
  resetHref,
}: {
  query: MarketQuery;
  elsewhere: CategoryCounts | null;
  resetHref: string;
}) {
  const others: ChipLink[] = [];
  if (elsewhere && elsewhere.all > 0) {
    for (const c of Object.keys(CATEGORY_LABEL) as MarketCategory[]) {
      if (c !== query.category && elsewhere[c] > 0) {
        others.push({
          label: `${CATEGORY_LABEL[c]}에 ${elsewhere[c]}개 있어요`,
          href: marketHref(`/market/${CATEGORY_SLUG[c]}`, {
            ...query,
            category: c,
            page: 1,
          }),
        });
      }
    }
    if (query.category) {
      others.push({
        label: `마켓 전체에 ${elsewhere.all}개 있어요`,
        href: marketHref("/market", { ...query, category: null, page: 1 }),
      });
    }
  }

  return (
    <EmptyState
      icon="SearchOutlineIcon"
      title="조건에 맞는 레시피가 없어요"
      description={
        query.q
          ? `“${query.q}”를 다른 말로 찾아보거나, 필터를 줄이거나 다른 카테고리를 보세요.`
          : "필터를 줄이거나 다른 카테고리를 보세요."
      }
    >
      {others.length > 0 ? (
        <ChipGroup label="다른 곳의 결과" chips={others} />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--sp-fg-secondary)",
            }}
          >
            요즘 많이 찾는
          </p>
          <ChipGroup
            label="요즘 많이 찾는"
            chips={POPULAR_SEARCH_TERMS.map((term) => ({
              label: term,
              href: marketHref("/market", { q: term }),
            }))}
          />
          <LinkButton href={resetHref}>필터 초기화</LinkButton>
        </div>
      )}
    </EmptyState>
  );
}
