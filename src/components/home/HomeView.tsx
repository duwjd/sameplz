"use client";
// HOME (HOME-01~05): rolling banner → weekly downloads → live TOP 10 → trending results → creators.
// Layout transcribed from the design handoff (SAMEPLZ Home.dc.html); data from src/data/home.ts.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { getMyFollowing, toggleFollow } from "@/actions/follow";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Avatar,
  Badge,
  Button,
  GalleryTile,
  HeroBanner,
  RankCard,
  RankRail,
  RecipeCard,
  Tabs,
  formatCount,
  type TabItem,
} from "@/components/ds";
import type { HomeSections, RankTab } from "@/data/home";

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

const RANK_TAB_ITEMS: TabItem[] = [
  { value: "all", label: "전체" },
  { value: "prompt", label: "프롬프트" },
  { value: "agent", label: "에이전트" },
  { value: "skill", label: "스킬" },
];

/** "10.13 14:00 기준" in Korea time. */
function rankedAtLabel(iso: string | null) {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${v("month")}.${v("day")} ${v("hour")}:${v("minute")} 기준`;
}

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
        <Link href={more.href} prefetch={false} style={moreLink}>
          {more.label}
        </Link>
      )}
    </div>
  );
}

export function HomeView({ data }: { data: HomeSections }) {
  const router = useRouter();
  const { viewer, requireLogin, followVersion, notify } = useAuth();
  const [followingState, setFollowing] = useState<Set<string>>(new Set());
  const [pendingFollow, setPendingFollow] = useState<string | null>(null);
  // Logged out (or signup unfinished) → nothing is followed.
  const following = viewer?.signupComplete ? followingState : new Set<string>();

  // Home is publicly cached; the viewer's follow state is fetched separately.
  useEffect(() => {
    if (!viewer?.signupComplete) return;
    let alive = true;
    getMyFollowing().then((handles) => {
      if (alive) setFollowing(new Set(handles));
    });
    return () => {
      alive = false;
    };
  }, [viewer, followVersion]);

  const onFollow = async (handle: string) => {
    if (!viewer) {
      // F7-1: follow continues automatically after login.
      requireLogin({ next: "/", action: { type: "follow", handle } });
      return;
    }
    const next = !following.has(handle);
    setPendingFollow(handle);
    const res = await toggleFollow({ handle, follow: next });
    setPendingFollow(null);
    if (res.ok) {
      setFollowing((prev) => {
        const s = new Set(prev);
        if (res.following) s.add(handle);
        else s.delete(handle);
        return s;
      });
    } else if (res.reason === "SELF") {
      notify("내 계정은 팔로우할 수 없어요.");
    } else {
      notify("팔로우하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    }
  };
  const [rankTab, setRankTab] = useState<RankTab>("all");
  const ranks = data.rankings[rankTab];
  const rankedAt = rankedAtLabel(data.rankedAt);

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
        {/* HOME-01 */}
        <HeroBanner
          slides={data.slides.map((s) => ({
            name: s.name,
            eyebrow: s.eyebrow,
            title: s.title,
            description: s.description,
            imageLabel: s.imageLabel,
            actions: s.cta
              ? [
                  {
                    label: s.cta.label,
                    primary: true,
                    onClick: () => router.push(s.cta!.href),
                  },
                ]
              : undefined,
          }))}
        />

        {/* HOME-02 */}
        {data.weekly.length > 0 && (
          <section
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            <SectionHead
              title="이번 주 다운로드 많은"
              hint="최근 7일 받은 수 · 무료 레시피 포함"
              more={{ href: "/market?sort=downloads", label: "전체 보기" }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                gap: 16,
              }}
            >
              {data.weekly.map((item) => (
                <RecipeCard key={item.href} {...item} />
              ))}
            </div>
          </section>
        )}

        {/* HOME-03 */}
        {data.rankings.all.length > 0 && (
          <section
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <SectionHead
              title="실시간 인기 TOP 10"
              hint={`${rankedAt ? `${rankedAt} · ` : ""}1시간마다 갱신 · ▲▼는 1시간 전 대비`}
            />
            <Tabs
              items={RANK_TAB_ITEMS}
              value={rankTab}
              onChange={(v) => setRankTab(v as RankTab)}
            />
            {ranks.length > 0 ? (
              <RankRail>
                {ranks.map((r) => (
                  <RankCard key={`${rankTab}-${r.rank}`} {...r} />
                ))}
              </RankRail>
            ) : (
              <p style={sectionHint}>
                이 탭에는 아직 순위에 오른 레시피가 없어요.
              </p>
            )}
          </section>
        )}

        {/* HOME-04 */}
        {data.gallery.length > 0 && (
          <section
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            <SectionHead
              title="지금 뜨는 결과물"
              hint="결과물이 먼저, 레시피는 한 번 누르면 나와요"
              more={{ href: "/gallery", label: "갤러리 보기" }}
            />
            <div style={{ columns: "5 200px", columnGap: 16 }}>
              {data.gallery.map(({ id, recipeHref, ...tile }) => (
                <div
                  key={id}
                  style={{ breakInside: "avoid", marginBottom: 16 }}
                >
                  <GalleryTile
                    {...tile}
                    canFork={false}
                    onSame={() => router.push(recipeHref)}
                    onRecipe={() => router.push(recipeHref)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* HOME-05 */}
        {data.creators.length > 0 && (
          <section
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
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
              {data.creators.map((c) => (
                <div
                  key={c.handle}
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
                  <Avatar name={c.name} src={c.avatar} size="xl" />
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
                        fontSize: 15,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {c.name}
                      {c.isStaff && (
                        <Badge size="sm" color="contrast">
                          운영팀
                        </Badge>
                      )}
                    </b>
                    <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
                      팔로워 {formatCount(c.followers)} · 대표작{" "}
                      <Link
                        href={c.topHref}
                        prefetch={false}
                        style={{ color: "inherit" }}
                      >
                        {c.top}
                      </Link>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    color="contrast"
                    variant={following.has(c.handle) ? "outline" : "fill"}
                    aria-pressed={following.has(c.handle)}
                    aria-label={`${c.name} ${following.has(c.handle) ? "팔로잉" : "팔로우"}`}
                    disabled={
                      pendingFollow === c.handle || viewer?.handle === c.handle
                    }
                    onClick={() => onFollow(c.handle)}
                  >
                    {following.has(c.handle) ? "팔로잉" : "팔로우"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
