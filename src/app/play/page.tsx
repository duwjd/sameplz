import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/ds";
import { PlayView } from "@/components/play/PlayView";
import { PlayGuest } from "@/components/play/PlayGuest";
import {
  getCreditSummary,
  getMyRuns,
  getPlayModels,
  getPlayRecipes,
} from "@/data/playground";
import { getViewer } from "@/lib/auth/account";
import { isPublicId } from "@/lib/recipe/detail";

export const metadata: Metadata = {
  title: "플레이그라운드 · SAMEPLZ",
  robots: { index: false },
};

async function Play({
  searchParams,
}: {
  searchParams: PageProps<"/play">["searchParams"];
}) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const wanted =
    typeof sp.recipe === "string" && isPublicId(sp.recipe) ? sp.recipe : null;
  // Keep the recipe from the detail page across login (PLAY EX playGate).
  if (!viewer)
    return <PlayGuest next={wanted ? `/play?recipe=${wanted}` : "/play"} />;
  if (!viewer.signupComplete)
    return (
      <EmptyState
        icon="MagicWandIcon"
        title="가입을 마치면 만들어 볼 수 있어요"
        description="약관과 만 18세 이상 확인을 마치면 이번 달 무료 크레딧이 들어와요."
        actions={<Link href="/welcome?next=/play">가입 마치기</Link>}
      />
    );
  const [models, recipes, runs, summary] = await Promise.all([
    getPlayModels(),
    getPlayRecipes(viewer),
    getMyRuns({ limit: 20 }),
    getCreditSummary(viewer),
  ]);
  if (!summary)
    return (
      <EmptyState
        icon="MagicWandIcon"
        title="크레딧 정보를 불러오지 못했어요"
        description="잠시 뒤에 새로고침해 주세요."
      />
    );
  const initial =
    wanted && recipes.some((r) => r.publicId === wanted) ? wanted : null;
  return (
    <PlayView
      models={models}
      recipes={recipes}
      initialRecipe={initial}
      notice={wanted && !initial ? "not_received" : null}
      noticeRecipe={wanted && !initial ? wanted : null}
      runs={runs}
      summary={summary}
    />
  );
}

function PlaySkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 480,
        borderRadius: 16,
        background: "var(--sp-bg-secondary)",
      }}
    />
  );
}

export default function PlayPage(props: PageProps<"/play">) {
  return (
    <main
      data-screen-label="Play"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        color: "var(--sp-fg-normal)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--sp-fg-accent)",
          }}
        >
          플레이그라운드
        </span>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
          바로 만들어 보기
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          받은 레시피나 내 프롬프트로 모델 3개까지 나란히 만들어 봐요. 만들기
          전에 드는 크레딧을 먼저 보여 드려요.
        </p>
      </header>
      <Suspense fallback={<PlaySkeleton />}>
        <Play searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
