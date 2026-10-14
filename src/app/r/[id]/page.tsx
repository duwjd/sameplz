import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Callout } from "@/components/ds";
import { RecipeActions } from "@/components/recipe/RecipeActions";
import {
  RecipeBody,
  RecipeDetailView,
  StopView,
} from "@/components/recipe/RecipeDetailView";
import { ShareRefBand } from "@/components/recipe/ShareRefBand";
import { getReferenceData } from "@/data/catalog";
import {
  getPrerenderRecipeIds,
  getRecipePublic,
  getRecipeViewerState,
  getSimilarRecipes,
} from "@/data/recipe";
import {
  libraryHref,
  playDisabledReason,
  type RecipeDetail,
} from "@/lib/recipe/detail";
import { mediaUrl } from "@/lib/upload/media";

const SITE = "https://sameplz.vercel.app";

// Cache Components needs at least one param; the placeholder simply prerenders as a 404.
export async function generateStaticParams() {
  const ids = await getPrerenderRecipeIds();
  return (ids.length > 0 ? ids : ["r000000"]).map((id) => ({ id }));
}

export async function generateMetadata(
  props: PageProps<"/r/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const recipe = await getRecipePublic(id);
  if (!recipe) return { title: "찾는 레시피가 없어요 · SAMEPLZ" };
  const url = `${SITE}/r/${recipe.public_id}`;
  const description =
    recipe.summary || `${recipe.creator.nickname}님의 AI 레시피예요.`;
  // First uploaded image result as the share card (videos have no still to show).
  const cover = recipe.media.find((m) => m.kind === "image" && mediaUrl(m.path));
  return {
    title: `${recipe.title} · SAMEPLZ`,
    description,
    alternates: { canonical: url },
    // STOP: keep out of search (F2-4); JSON-LD also says Discontinued.
    robots: recipe.status === "stopped" ? { index: false } : undefined,
    openGraph: {
      type: "website",
      url,
      siteName: "SAMEPLZ",
      locale: "ko_KR",
      title: recipe.title,
      description,
      ...(cover
        ? { images: [{ url: mediaUrl(cover.path)!, alt: cover.alt ?? recipe.title }] }
        : {}),
    },
  };
}

function panelProps(recipe: RecipeDetail) {
  return {
    id: recipe.id,
    publicId: recipe.public_id,
    price: recipe.price_krw,
    category: recipe.category,
    creator: {
      handle: recipe.creator.handle,
      nickname: recipe.creator.nickname,
      avatarUrl: recipe.creator.avatar_url,
      note: recipe.creator.is_staff
        ? "운영팀이 직접 만든 레시피예요"
        : (recipe.creator.bio ?? "크리에이터"),
    },
    playDisabledReason: playDisabledReason(recipe),
  };
}

async function ViewerPanel({ recipe }: { recipe: RecipeDetail }) {
  const state = await getRecipeViewerState(recipe.id);
  return <RecipeActions recipe={panelProps(recipe)} state={state} />;
}

/** STOP-02: holders keep their version; the owner gets a status note (seller center in W4). */
async function StopViewerNote({ recipe }: { recipe: RecipeDetail }) {
  const state = await getRecipeViewerState(recipe.id);
  if (state.isOwner)
    return (
      <>
        <Callout color="hint" title="판매를 멈춘 내 레시피예요">
          이미 받은 사람은 계속 쓸 수 있어요. 다시 여는 건 판매자 센터에서 할
          수 있어요.
        </Callout>
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <RecipeBody recipe={recipe} />
        </div>
      </>
    );
  if (!state.entitlement) return null;
  return (
    <Callout color="success" title="받은 버전은 계속 쓸 수 있어요">
      <span style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        판매가 멈춰도 받은 버전(v{state.entitlement.versionNo})은 그대로예요.
        <Link
          href={libraryHref(state.entitlement.id)}
          style={{ fontWeight: 700, color: "var(--sp-fg-primary)" }}
        >
          받은 버전 열기
        </Link>
      </span>
    </Callout>
  );
}

function PanelFallback() {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 360,
        borderRadius: 16,
        background: "var(--sp-bg-secondary)",
      }}
    />
  );
}

export default async function RecipePage(props: PageProps<"/r/[id]">) {
  // Decided before any Suspense boundary so a missing / hidden recipe gets a real 404 (F1-7).
  const { id } = await props.params;
  const recipe = await getRecipePublic(id);
  if (!recipe) notFound();
  const similar = await getSimilarRecipes(recipe.public_id, 4);

  if (recipe.status === "stopped") {
    return (
      <StopView
        recipe={recipe}
        similar={similar}
        viewerNote={
          <Suspense fallback={null}>
            <StopViewerNote recipe={recipe} />
          </Suspense>
        }
      />
    );
  }

  const referenceData = await getReferenceData();
  return (
    <RecipeDetailView
      recipe={recipe}
      referenceData={referenceData}
      similar={similar}
      refBand={
        <Suspense fallback={null}>
          <ShareRefBand publicId={recipe.public_id} />
        </Suspense>
      }
      actions={
        <Suspense fallback={<PanelFallback />}>
          <ViewerPanel recipe={recipe} />
        </Suspense>
      }
    />
  );
}
