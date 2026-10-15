// UP upload form: shape shared by the wizard (client) and the submit / draft actions (server).
// The zod schema bounds what the server accepts; validateStep gives per-field Korean errors for
// 「다음」 (F5-1). Neither decides publishing — the server re-checks and the SQL RPC is final.
import { z } from "zod";

export const CATEGORIES = ["prompt", "skill", "agent"] as const;
export const PROMPT_KINDS = ["image", "video", "text"] as const;
export const RATIOS = ["1/1", "3/4", "4/3", "4/5", "9/16", "16/9"] as const;
export const MAX_MEDIA = 8;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_SKILL_ZIP_BYTES = 5 * 1024 * 1024;

const str = (max: number) => z.string().max(max).catch("");
const strList = (item: number, max: number) =>
  z.array(z.string().max(item)).max(max).catch([]);

const Variable = z.object({
  name: z.string().max(30),
  description: z.string().max(120),
  example: z.string().max(80),
});

const MediaItem = z.object({
  path: z.string().max(200),
  kind: z.enum(["image", "video"]),
  ratio: z.enum(RATIOS),
  alt: z.string().max(120),
  ai: z.boolean(),
  /** Public preview URL (display only; the server rebuilds it from `path`). */
  url: z.string().max(500),
});
export type UploadMedia = z.infer<typeof MediaItem>;

const SkillZip = z.object({
  path: z.string().max(200),
  filename: z.string().max(120),
  size: z.number().int().nonnegative(),
});

export const UploadFormSchema = z.object({
  recipeId: z.guid().nullable().catch(null),
  /** F6-2: a fork draft remembers its origin (set by 「이걸로 만들기」, applied after submit). */
  forkOf: z
    .object({ recipeId: z.guid(), publicId: z.string().max(16), title: z.string().max(60) })
    .nullable()
    .catch(null)
    .default(null),
  category: z.enum(CATEGORIES).nullable().catch(null),
  promptKind: z.enum(PROMPT_KINDS).nullable().catch(null),
  title: str(60),
  summary: str(80),
  jobCodes: strList(40, 4),
  toolCodes: strList(40, 12),
  tags: strList(30, 12),
  prompt: z
    .object({
      body: str(20_000),
      variables: z.array(Variable).max(20).catch([]),
      settings: z
        .array(
          z.object({ label: z.string().max(20), value: z.string().max(80) }),
        )
        .max(10)
        .catch([]),
    })
    .catch({ body: "", variables: [], settings: [] }),
  skill: z
    .object({
      source: z.enum(["md", "zip"]).catch("md"),
      skillMd: str(60_000),
      zip: SkillZip.nullable().catch(null),
      examples: z
        .array(
          z.object({ user: z.string().max(500), reply: z.string().max(500) }),
        )
        .max(3)
        .catch([]),
      before: str(500),
      after: str(500),
    })
    .catch({
      source: "md",
      skillMd: "",
      zip: null,
      examples: [],
      before: "",
      after: "",
    }),
  agent: z
    .object({
      flow: strList(60, 8),
      integrations: strList(40, 10),
      runtime: str(40),
      does: strList(80, 10),
      doesNot: strList(80, 10),
      prepare: strList(80, 10),
      config: str(60_000),
      noKeys: z.boolean().catch(false),
    })
    .catch({
      flow: [],
      integrations: [],
      runtime: "",
      does: [],
      doesNot: [],
      prepare: [],
      config: "",
      noKeys: false,
    }),
  media: z
    .array(MediaItem)
    .max(MAX_MEDIA + 4)
    .catch([]),
  visibility: z.enum(["public", "private"]).catch("public"),
  changelog: str(600),
});
export type UploadForm = z.infer<typeof UploadFormSchema>;

export function emptyUploadForm(): UploadForm {
  return UploadFormSchema.parse({});
}

/** UP-04: `[변수]` names in the order they first appear. */
export function detectVariables(body: string): string[] {
  const seen: string[] = [];
  for (const m of body.matchAll(/\[([^[\]\n]{1,30})\]/g)) {
    const name = m[1].trim();
    if (name && !seen.includes(name)) seen.push(name);
  }
  return seen;
}

/** Variables follow the body: keep what was typed for names still used, add blanks for new ones. */
export function syncVariables(
  body: string,
  current: UploadForm["prompt"]["variables"],
) {
  return detectVariables(body).map(
    (name) =>
      current.find((v) => v.name === name) ?? {
        name,
        description: "",
        example: "",
      },
  );
}

/** Agent original: a JSON object (workflow export) or plain instructions. */
export function parseAgentConfig(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t) return null;
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const v: unknown = JSON.parse(t);
      if (v && typeof v === "object" && !Array.isArray(v))
        return v as Record<string, unknown>;
      return Array.isArray(v) ? { workflow: v } : null;
    } catch {
      return null;
    }
  }
  return { instructions: t };
}

export interface FieldError {
  field: string;
  message: string;
}

const blank = (s: string) => s.trim() === "";

export function validateStep(
  step: 1 | 2 | 3 | 4,
  form: UploadForm,
): FieldError[] {
  const errors: FieldError[] = [];
  const err = (field: string, message: string) =>
    errors.push({ field, message });

  if (step === 1) {
    if (!form.category) err("category", "어떤 레시피인지 골라 주세요.");
    else if (form.category === "prompt" && !form.promptKind)
      err("promptKind", "결과물 종류를 골라 주세요.");
  }

  if (step === 2) {
    const title = form.title.trim();
    if (title.length < 2) err("title", "제목을 2자 이상 써 주세요.");
    else if (title.length > 40) err("title", "제목은 40자까지 쓸 수 있어요.");
    if (blank(form.summary)) err("summary", "한 줄 설명을 써 주세요.");
    else if (form.summary.trim().length > 60)
      err("summary", "한 줄 설명은 60자까지 쓸 수 있어요.");
    if (form.jobCodes.length < 1 || form.jobCodes.length > 2)
      err("jobCodes", "직무를 1~2개 골라 주세요.");
    if (
      form.tags.length > 10 ||
      form.tags.some((t) => t.trim().length < 1 || t.trim().length > 20)
    )
      err("tags", "검색 태그는 20자 이하로 10개까지 넣을 수 있어요.");

    if (form.category === "prompt") {
      if (blank(form.prompt.body))
        err("prompt.body", "프롬프트 본문을 써 주세요.");
      form.prompt.variables.forEach((v, i) => {
        if (blank(v.description))
          err(
            `prompt.variables.${i}.description`,
            `[${v.name}]의 설명을 적어 주세요.`,
          );
        if (blank(v.example))
          err(
            `prompt.variables.${i}.example`,
            `[${v.name}]의 예시를 적어 주세요.`,
          );
      });
    }
    if (form.category === "skill") {
      if (form.skill.source === "zip") {
        if (!form.skill.zip) err("skill.zip", "스킬 zip 파일을 올려 주세요.");
      } else if (blank(form.skill.skillMd))
        err("skill.skillMd", "SKILL.md 내용을 붙여 넣어 주세요.");
    }
    if (form.category === "agent") {
      const a = form.agent;
      if (!a.flow.some((x) => !blank(x)))
        err("agent.flow", "실행 단계를 1개 이상 적어 주세요.");
      if (!a.does.some((x) => !blank(x)))
        err("agent.does", "에이전트가 하는 일을 적어 주세요.");
      if (!a.doesNot.some((x) => !blank(x)))
        err("agent.doesNot", "에이전트가 하지 않는 일을 적어 주세요.");
      if (blank(a.config))
        err("agent.config", "받는 사람이 쓸 설정이나 지침 원문을 넣어 주세요.");
      else if (!parseAgentConfig(a.config))
        err(
          "agent.config",
          "JSON 형식이 맞지 않아요. 지침이면 글로 써 주세요.",
        );
      if (!a.noKeys)
        err("agent.noKeys", "키·비밀번호를 지웠는지 확인해 주세요.");
    }
  }

  if (step === 3) {
    if (form.media.length < 1) err("media", "결과물을 1개 이상 올려 주세요.");
    else if (form.media.length > MAX_MEDIA)
      err("media", `결과물은 ${MAX_MEDIA}개까지 올릴 수 있어요.`);
    // Alt text is required: screen readers and the visible 「AI 생성」 caption depend on it.
    form.media.forEach((m, i) => {
      if (blank(m.alt))
        err(`media.${i}.alt`, `결과물 ${i + 1}을 설명하는 글을 적어 주세요.`);
    });
  }

  if (step === 4) {
    if (form.recipeId && blank(form.changelog))
      err("changelog", "이번 버전에서 바뀐 점을 써 주세요.");
    else if (form.changelog.trim().length > 500)
      err("changelog", "바뀐 점은 500자까지 쓸 수 있어요.");
  }
  return errors;
}

/** First step whose checks fail, or null when 1–4 are complete. */
export function firstInvalidStep(form: UploadForm): 1 | 2 | 3 | 4 | null {
  for (const s of [1, 2, 3, 4] as const)
    if (validateStep(s, form).length) return s;
  return null;
}
