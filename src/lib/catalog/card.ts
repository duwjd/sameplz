import type { RecipeCardProps, ResultKind } from "@/components/ds";
import type { Database } from "@/types/database.types";

// Generated function return types mark every column non-null; prompt_kind is null for agents/skills.
export type SearchRow = Omit<
  Database["public"]["Functions"]["search_recipes"]["Returns"][number],
  "prompt_kind"
> & { prompt_kind: string | null };

export interface ReferenceData {
  jobs: Record<string, string>;
  tools: Record<string, string>;
}

const KIND: Record<string, ResultKind> = {
  image: "이미지",
  video: "영상",
  text: "텍스트",
};

export const recipeHref = (publicId: string) => `/r/${publicId}`;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Card subtitle for non-visual recipes: skills show the package, agents the runtime. */
export function mediaLabelFor(
  category: string,
  filters: unknown,
  ref: ReferenceData,
): string | undefined {
  const f = (filters && typeof filters === "object" ? filters : {}) as Record<
    string,
    unknown
  >;
  if (category === "skill") {
    const files =
      typeof f.files === "number" && f.files > 0 ? ` · 파일 ${f.files}개` : "";
    const format = str(f.format);
    return `SKILL.md${format ? ` · ${format}` : ""}${files}`;
  }
  if (category === "agent") {
    const runtime = str(f.runtime);
    return runtime ? `${ref.tools[runtime] ?? runtime}에서 실행` : "에이전트";
  }
  return undefined;
}

/** search_recipes row → RecipeCard props (public fields only). */
export function toRecipeCard(
  row: SearchRow,
  ref: ReferenceData,
): RecipeCardProps {
  const category = row.category as RecipeCardProps["category"];
  return {
    title: row.title,
    creator: row.creator_nickname,
    job: row.job_codes[0]
      ? (ref.jobs[row.job_codes[0]] ?? undefined)
      : undefined,
    category,
    kind: row.prompt_kind ? KIND[row.prompt_kind] : undefined,
    price: row.price_krw,
    tools: row.tool_codes.map((t) => ref.tools[t] ?? t),
    downloads: row.downloads,
    same: row.same_count,
    likes: row.likes,
    mediaLabel: mediaLabelFor(row.category, row.filters, ref),
    href: recipeHref(row.public_id),
  };
}
