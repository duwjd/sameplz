"use client";
// HOME (HOME-01~05): rolling banner → weekly downloads → live TOP 10 → trending results → creators.
// Layout transcribed from the design handoff (SAMEPLZ Home.dc.html).
import { useState, type CSSProperties } from "react";
import {
  Avatar,
  Button,
  GalleryTile,
  HeroBanner,
  RankCard,
  RankRail,
  RecipeCard,
  Tabs,
} from "@/components/ds";
import {
  CREATORS,
  FEED,
  RANK_TABS,
  SLIDES,
  WEEKLY,
  rankRecipes,
  type RankTab,
} from "./home-data";

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "-0.4px",
};
const sectionHint: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--sp-fg-hint)",
};
const moreLink: CSSProperties = { fontSize: 14, fontWeight: 600 };

function SectionHead({
  title,
  hint,
  more,
}: {
  title: string;
  hint: string;
  more?: { href: string; label: string };
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={sectionTitle}>{title}</h2>
        <p style={sectionHint}>{hint}</p>
      </div>
      {more && (
        <a href={more.href} style={moreLink}>
          {more.label}
        </a>
      )}
    </div>
  );
}

export function HomeView() {
  const [rankTab, setRankTab] = useState<RankTab>("all");
  const ranks = rankRecipes(rankTab);

  return (
    <div
      data-screen-label="Home"
      style={{
        background: "var(--sp-bg-canvas)",
        color: "var(--sp-fg-normal)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <main
        style={{
          padding: "24px 24px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 56,
        }}
      >
        <HeroBanner slides={SLIDES} />

        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHead
            title="이번 주 다운로드 많은"
            hint="최근 7일 받은 수 · 무료 레시피 포함"
            more={{ href: "#market", label: "전체 보기" }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
              gap: 16,
            }}
          >
            {WEEKLY.map((item) => (
              <RecipeCard key={item.title} {...item} href="#item" />
            ))}
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionHead
            title="실시간 인기 TOP 10"
            hint="다운로드 + SAME×4 + 좋아요×0.5 · 1시간 전 대비"
          />
          <Tabs
            items={RANK_TABS}
            value={rankTab}
            onChange={(v) => setRankTab(v as RankTab)}
          />
          <RankRail>
            {ranks.map((r) => (
              <RankCard key={`${rankTab}-${r.rank}`} {...r} href="#item" />
            ))}
          </RankRail>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHead
            title="지금 뜨는 결과물"
            hint="결과물이 먼저, 레시피는 한 번 누르면 나와요"
            more={{ href: "#gallery", label: "갤러리 보기" }}
          />
          <div style={{ columns: "5 200px", columnGap: 16 }}>
            {FEED.map((g) => (
              <div
                key={g.title}
                style={{ breakInside: "avoid", marginBottom: 16 }}
              >
                <GalleryTile {...g} />
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHead
            title="인기 크리에이터"
            hint="팔로우하면 새 레시피가 나올 때 알려 드려요"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
              gap: 16,
            }}
          >
            {CREATORS.map((c) => (
              <div
                key={c.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 16,
                  borderRadius: 16,
                  background: "var(--sp-bg-surface)",
                  border: "1px solid var(--sp-border-normal)",
                }}
              >
                <Avatar name={c.name} size="xl" />
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <b style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</b>
                  <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
                    팔로워 {c.followers} · {c.top}
                  </span>
                </div>
                <Button size="sm" color="contrast">
                  팔로우
                </Button>
              </div>
            ))}
          </div>
        </section>
      </main>

    </div>
  );
}
