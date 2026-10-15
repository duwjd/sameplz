// PRM · AGT · SKL · STOP shell (server). Public data only; viewer-dependent parts arrive as slots
// rendered inside Suspense by the page.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  Badge,
  Breadcrumb,
  Callout,
  RecipeCard,
  StatBar,
} from "@/components/ds";
import type { ReferenceData } from "@/lib/catalog/card";
import { KIND } from "@/lib/catalog/card";
import {
  EXPERT_BADGE_COPY,
  REGULATED_COPY,
  STOP_REASON_COPY,
  type RecipeDetail,
} from "@/lib/recipe/detail";
import type { RecipeCardProps } from "@/components/ds";
import type { GalleryPostDTO } from "@/data/gallery";
import {
  AgentSections,
  PromptSections,
  SameResults,
  Section,
  SkillSections,
} from "./sections";

export const CATEGORY_LABEL = {
  prompt: "프롬프트",
  agent: "에이전트",
  skill: "스킬",
} as const;
const CATEGORY_SLUG = {
  prompt: "prompts",
  agent: "agents",
  skill: "skills",
} as const;

const pageStyle: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "24px 24px 80px",
  display: "flex",
  flexDirection: "column",
  gap: 24,
  color: "var(--sp-fg-normal)",
  fontFamily: "var(--sp-font-sans)",
};

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth() + 1).padStart(2, "0")}.${String(kst.getUTCDate()).padStart(2, "0")}`;
}

function Header({
  recipe,
  labels,
}: {
  recipe: RecipeDetail;
  labels: ReferenceData;
}) {
  const kind = recipe.prompt_kind ? KIND[recipe.prompt_kind] : null;
  const updated = formatDate(recipe.version.approved_at);
  const badge = recipe.creator.expert_badge;
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Breadcrumb
        size="sm"
        items={[
          { label: "마켓", href: "/market" },
          {
            label: CATEGORY_LABEL[recipe.category],
            href: `/market/${CATEGORY_SLUG[recipe.category]}`,
          },
          { label: recipe.title },
        ]}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <Badge size="sm" color="primary" variant="subtle">
          {CATEGORY_LABEL[recipe.category]}
          {kind ? ` · ${kind}` : ""}
        </Badge>
        {recipe.job_codes.map((j) => (
          <Badge key={j} size="sm" color="hint" variant="subtle">
            {labels.jobs[j] ?? j}
          </Badge>
        ))}
        {badge && (
          <Badge size="sm" color="success" variant="fill">
            {EXPERT_BADGE_COPY[badge]}
          </Badge>
        )}
      </div>
      <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.3, fontWeight: 800 }}>
        {recipe.title}
      </h1>
      {recipe.summary && (
        <p style={{ margin: 0, fontSize: 16, color: "var(--sp-fg-secondary)" }}>
          {recipe.summary}
        </p>
      )}
      <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-hint)" }}>
        {recipe.creator.nickname}
        {updated ? ` · 업데이트 ${updated}` : ""}
        {recipe.version.no > 1 ? ` · v${recipe.version.no}` : ""}
        {recipe.forked_from && (
          <>
            {" · 원작 "}
            <Link
              href={`/r/${recipe.forked_from.public_id}`}
              style={{ color: "var(--sp-fg-primary)" }}
            >
              「{recipe.forked_from.title}」
            </Link>
            {` (${recipe.forked_from.creator_nickname})`}
          </>
        )}
      </p>
    </header>
  );
}

function SimilarGrid({
  items,
  title,
}: {
  items: RecipeCardProps[];
  title: string;
}) {
  if (items.length === 0) return null;
  return (
    <Section title={title} id="similar-heading">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          gap: 16,
        }}
      >
        {items.map((c) => (
          <RecipeCard key={c.href} {...c} />
        ))}
      </div>
    </Section>
  );
}

function JsonLd({ recipe }: { recipe: RecipeDetail }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: recipe.title,
    description: recipe.summary || undefined,
    category: CATEGORY_LABEL[recipe.category],
    brand: { "@type": "Brand", name: recipe.creator.nickname },
    offers: {
      "@type": "Offer",
      price: recipe.price_krw,
      priceCurrency: "KRW",
      availability:
        recipe.status === "stopped"
          ? "https://schema.org/Discontinued"
          : "https://schema.org/InStock",
    },
  };
  return (
    <script
      type="application/ld+json"
      // JSON from our own public fields; "<" escaped so text can't close the script tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** Category body (PRM / AGT / SKL). Public meta only. */
export function RecipeBody({ recipe }: { recipe: RecipeDetail }) {
  if (recipe.category === "prompt") return <PromptSections recipe={recipe} />;
  if (recipe.category === "agent") return <AgentSections recipe={recipe} />;
  return <SkillSections recipe={recipe} />;
}

export function RecipeDetailView({
  recipe,
  referenceData,
  similar,
  actions,
  refBand,
  samePosts = [],
}: {
  recipe: RecipeDetail;
  referenceData: ReferenceData;
  similar: RecipeCardProps[];
  actions: ReactNode;
  refBand: ReactNode;
  samePosts?: GalleryPostDTO[];
}) {
  const meta = recipe.version.meta;
  return (
    <main data-screen-label="Recipe detail" style={pageStyle}>
      <JsonLd recipe={recipe} />
      {refBand}
      {meta.regulated && (
        <Callout color="warning" title="검토 보조로만 써 주세요">
          {REGULATED_COPY[meta.regulated]}
        </Callout>
      )}
      <Header recipe={recipe} labels={referenceData} />
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
        <div className="md:order-2">{actions}</div>
        <div className="flex flex-col gap-10 md:order-1">
          <StatBar
            size="lg"
            items={[
              {
                label: "다운로드",
                value: recipe.stats.downloads.toLocaleString("ko-KR"),
                icon: "DownloadOutlineIcon",
              },
              {
                label: "SAME",
                value: recipe.stats.same_count.toLocaleString("ko-KR"),
                icon: "CheckCircleOutlineIcon",
              },
              {
                label: "좋아요",
                value: recipe.stats.likes.toLocaleString("ko-KR"),
                icon: "HeartOutlineIcon",
              },
            ]}
          />
          <RecipeBody recipe={recipe} />
          <SameResults recipe={recipe} posts={samePosts} />
          {recipe.version.changelog && recipe.version.no > 1 && (
            <Section title="업데이트 내용">
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "var(--sp-fg-secondary)",
                }}
              >
                v{recipe.version.no} · {recipe.version.changelog}
              </p>
            </Section>
          )}
        </div>
      </div>
      <SimilarGrid items={similar} title="비슷한 레시피" />
    </main>
  );
}

/** STOP-01~03: reason, holder/owner note (slot), similar recipes. No claim button for anyone. */
export function StopView({
  recipe,
  similar,
  viewerNote,
}: {
  recipe: RecipeDetail;
  similar: RecipeCardProps[];
  viewerNote: ReactNode;
}) {
  const reason = STOP_REASON_COPY[recipe.stopped_reason ?? "other"];
  return (
    <main data-screen-label="Recipe stopped" style={pageStyle}>
      <JsonLd recipe={recipe} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Badge
          size="sm"
          color="danger"
          variant="subtle"
          style={{ alignSelf: "flex-start" }}
        >
          판매 중지
        </Badge>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
          {recipe.title}
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: "var(--sp-fg-secondary)" }}>
          지금은 받을 수 없어요. {reason} 이미 받은 사람은 받은 버전을 계속 쓸 수 있어요.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-hint)" }}>
          {CATEGORY_LABEL[recipe.category]} · {recipe.creator.nickname}
        </p>
      </div>
      {viewerNote}
      <SimilarGrid
        items={similar.slice(0, 3)}
        title="이 레시피 대신 둘러보세요"
      />
    </main>
  );
}
