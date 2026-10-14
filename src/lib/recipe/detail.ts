// get_recipe_public payload → typed detail. public_meta is free-form jsonb written by creators
// (W4 upload) and ops, so every field is parsed defensively: bad shapes drop to empty, never throw.
import { z } from "zod";

const text = (max = 500) => z.string().trim().min(1).max(max);
/** Array of T, silently dropping entries that don't parse. */
const listOf = <T extends z.ZodType>(item: T, max = 20) =>
  z
    .array(z.unknown())
    .max(200)
    .catch([])
    .transform((xs) =>
      xs
        .map((x) => item.safeParse(x))
        .filter((r) => r.success)
        .map((r) => r.data as z.infer<T>)
        .slice(0, max),
    );

export const REGULATED = ["tax", "legal", "medical"] as const;
export type Regulated = (typeof REGULATED)[number];

const Meta = z
  .object({
    // prompt
    variables: listOf(
      z.object({
        name: text(30),
        description: text(120).optional().catch(undefined),
        example: text(80).optional().catch(undefined),
      }),
    ),
    settings: listOf(z.object({ label: text(20), value: text(80) })),
    // skill
    examples: listOf(z.object({ user: text(), reply: text() }), 3),
    before: text().optional().catch(undefined),
    after: text().optional().catch(undefined),
    install: listOf(
      z.object({
        tool: text(30),
        steps: z.array(text(120)).min(1).max(5),
        command: text(200).optional(),
      }),
      6,
    ),
    // agent
    flow: listOf(text(60), 8),
    sample_log: listOf(text(200), 30),
    runtime: text(40).optional().catch(undefined),
    integrations: listOf(text(40), 10),
    prepare: listOf(text(80), 10),
    does: listOf(text(80), 10),
    does_not: listOf(text(80), 10),
    // F2-6
    regulated: z.enum(REGULATED).optional().catch(undefined),
  })
  .catch({
    variables: [],
    settings: [],
    examples: [],
    install: [],
    flow: [],
    sample_log: [],
    integrations: [],
    prepare: [],
    does: [],
    does_not: [],
  });
export type RecipeMeta = z.infer<typeof Meta>;

export const STOP_REASONS = [
  "creator_request",
  "rights_claim",
  "policy_violation",
  "misleading",
  "quality",
  "other",
] as const;
export type StopReason = (typeof STOP_REASONS)[number];

/** STOP-01 copy per reason code. */
export const STOP_REASON_COPY: Record<StopReason, string> = {
  creator_request: "크리에이터가 판매를 멈췄어요.",
  rights_claim: "권리 침해 신고가 들어와 확인하고 있어요.",
  policy_violation: "운영 정책에 맞지 않아 판매를 멈췄어요.",
  misleading: "설명과 결과가 달라 판매를 멈췄어요.",
  quality: "결과가 안정적으로 나오지 않아 판매를 멈췄어요.",
  other: "운영 사정으로 판매를 멈췄어요.",
};

const Count = z.coerce.number().int().nonnegative().catch(0);

const RecipePublic = z.object({
  id: z.guid(),
  public_id: z.string(),
  category: z.enum(["prompt", "agent", "skill"]),
  prompt_kind: z.enum(["image", "video", "text"]).nullable().catch(null),
  title: z.string(),
  summary: z.string().catch(""),
  status: z.enum(["live", "stopped"]),
  stopped_reason: z.enum(STOP_REASONS).nullable().catch(null),
  stopped_at: z.string().nullable().catch(null),
  price_krw: z.number().int().nonnegative(),
  job_codes: z.array(z.string()).catch([]),
  tool_codes: z.array(z.string()).catch([]),
  search_tags: z.array(z.string()).catch([]),
  filters: z.record(z.string(), z.unknown()).catch({}),
  published_at: z.string().nullable().catch(null),
  version: z.object({
    id: z.guid(),
    no: z.number().int(),
    changelog: z.string().catch(""),
    approved_at: z.string().nullable().catch(null),
    has_scripts: z.boolean().catch(false),
    meta: Meta,
  }),
  creator: z.object({
    handle: z.string(),
    nickname: z.string(),
    avatar_url: z.string().nullable().catch(null),
    bio: z.string().nullable().catch(null),
    is_staff: z.boolean().catch(false),
    expert_badge: z.enum(["tax_accountant", "lawyer"]).nullable().catch(null),
  }),
  tools: listOf(
    z.object({ code: z.string(), label: z.string(), has_api: z.boolean() }),
    20,
  ),
  media: listOf(
    z.object({
      id: z.string(),
      path: z.string().nullable().catch(null),
      kind: z.enum(["image", "video"]),
      ratio: z.string().nullable().catch(null),
      alt: z.string().nullable().catch(null),
      ai: z.boolean().catch(true),
    }),
    12,
  ),
  files: listOf(z.object({ name: z.string(), size: Count }), 50),
  stats: z
    .object({ downloads: Count, same_count: Count, likes: Count })
    .catch({ downloads: 0, same_count: 0, likes: 0 }),
  forked_from: z
    .object({
      public_id: z.string(),
      title: z.string(),
      creator_nickname: z.string(),
    })
    .nullable()
    .catch(null),
});
export type RecipeDetail = z.infer<typeof RecipePublic>;

/** null when the payload is missing or not a recipe (→ 404). */
export function parseRecipePublic(raw: unknown): RecipeDetail | null {
  if (raw == null) return null;
  const r = RecipePublic.safeParse(raw);
  return r.success ? r.data : null;
}

/** public_id shape (recipes.public_id check): anything else is a 404 without a DB call. */
export const isPublicId = (id: string) => /^[a-z0-9]{6,16}$/.test(id);

/**
 * F2-5 / PRM-07: why 「바로 만들어 보기」 is off. Playground (W5) is not open yet, so it is always off
 * in W3; tools without an API get the specific reason.
 */
export function playDisabledReason(recipe: RecipeDetail): string {
  const generators = recipe.tools;
  if (generators.length > 0 && generators.every((t) => !t.has_api)) {
    const names = generators.map((t) => t.label).join(", ");
    return `${names}는 API가 없어 여기서 바로 만들 수 없어요. 받은 뒤 ${names}에서 써 주세요.`;
  }
  return "플레이그라운드는 아직 열리지 않았어요. 지금은 받은 뒤 각 도구에서 써 주세요.";
}

export const REGULATED_COPY: Record<Regulated, string> = {
  tax: "세무 판단을 대신하지 않아요. 검토 보조로만 쓰고, 신고 전에는 세무사와 꼭 확인해 주세요.",
  legal:
    "법률 자문이 아니에요. 검토 보조로만 쓰고, 중요한 판단은 변호사와 꼭 확인해 주세요.",
  medical:
    "의료 진단이 아니에요. 참고용으로만 쓰고, 건강 문제는 의료진과 꼭 상담해 주세요.",
};

export const EXPERT_BADGE_COPY = {
  tax_accountant: "세무사 검수",
  lawyer: "변호사 검수",
} as const;

/** Masked prompt shape for PromptPreview: variable chips with filler words (never the original). */
export function maskedTemplate(variables: { name: string }[]): string {
  const filler = [
    "xxxx xxxxxx",
    "xxx xxxxx xxxx",
    "xxxxxx xxx",
    "xxxx xxxx xxxxx",
  ];
  if (variables.length === 0) return `${filler[0]} ${filler[1]} ${filler[2]}`;
  return variables
    .map((v, i) => `${filler[i % filler.length]} [${v.name}]`)
    .concat(filler[3])
    .join(" ");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** LIB: open a received recipe (PR C handles ?open=). */
export const libraryHref = (entitlementId: string) =>
  `/my/library?open=${entitlementId}`;
