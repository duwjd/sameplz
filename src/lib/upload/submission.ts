// Upload form → texts to check and the submit_recipe_version payload. Pure: the action does I/O.
// public_meta is what the detail page shows (parsed by src/lib/recipe/detail.ts); originals go only
// into `secret` and never into public_meta, filters or check findings.
import type { Finding } from "@/lib/moderation/reject-codes";
import type { TextField } from "@/lib/moderation/layer1";
import { parseAgentConfig, type UploadForm } from "@/lib/validation/upload";

const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);

export interface SkillPackage {
  skillMd: string;
  hasScripts: boolean;
  sha256: string;
  /** Texts inside the zip (besides SKILL.md) for the checks. */
  texts: { path: string; text: string }[];
  /** The stored zip, offered to buyers as the attachment (set once the checks pass). */
  file: { path: string; filename: string; size: number; sha256: string } | null;
  /** Server-rebuilt zip awaiting storage, and whether some text was too large to check. */
  rebuilt?: { name: string; bytes: Uint8Array };
  unscanned?: boolean;
  fileCount: number;
}

/** Every creator-typed text, keyed by the field the 「고치러 가기」 link focuses. */
export function checkTexts(
  form: UploadForm,
  skill?: SkillPackage | null,
): TextField[] {
  const t: TextField[] = [
    { field: "title", text: form.title },
    { field: "summary", text: form.summary },
    { field: "tags", text: form.tags.join(" ") },
    { field: "changelog", text: form.changelog },
    ...form.media.map((m, i) => ({ field: `media.${i}.alt`, text: m.alt })),
  ];
  if (form.category === "prompt") {
    t.push({ field: "prompt.body", text: form.prompt.body });
    form.prompt.variables.forEach((v, i) =>
      t.push({
        field: `prompt.variables.${i}.description`,
        text: `${v.description}\n${v.example}`,
      }),
    );
    form.prompt.settings.forEach((s, i) =>
      t.push({ field: `prompt.settings.${i}`, text: `${s.label} ${s.value}` }),
    );
  }
  if (form.category === "skill") {
    const mdField = form.skill.source === "zip" ? "skill.zip" : "skill.skillMd";
    if (skill) {
      t.push({ field: mdField, text: skill.skillMd });
      for (const x of skill.texts)
        if (!x.path.endsWith("/SKILL.md"))
          t.push({ field: "skill.zip", text: x.text });
    }
    form.skill.examples.forEach((e, i) =>
      t.push({ field: `skill.examples.${i}`, text: `${e.user}\n${e.reply}` }),
    );
    t.push(
      { field: "skill.before", text: form.skill.before },
      { field: "skill.after", text: form.skill.after },
    );
  }
  if (form.category === "agent") {
    const a = form.agent;
    a.flow.forEach((x, i) => t.push({ field: `agent.flow.${i}`, text: x }));
    a.does.forEach((x, i) => t.push({ field: `agent.does.${i}`, text: x }));
    a.doesNot.forEach((x, i) =>
      t.push({ field: `agent.doesNot.${i}`, text: x }),
    );
    a.prepare.forEach((x, i) =>
      t.push({ field: `agent.prepare.${i}`, text: x }),
    );
    t.push({ field: "agent.integrations", text: a.integrations.join(" ") });
    t.push({ field: "agent.config", text: a.config });
  }
  return t.filter((x) => x.text.trim());
}

export function buildPublicMeta(form: UploadForm): Record<string, unknown> {
  if (form.category === "prompt")
    return {
      variables: form.prompt.variables.map((v) => ({
        name: v.name.trim(),
        description: v.description.trim(),
        example: v.example.trim(),
      })),
      settings: form.prompt.settings
        .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
        .filter((s) => s.label && s.value),
    };
  if (form.category === "skill")
    return {
      examples: form.skill.examples
        .map((e) => ({ user: e.user.trim(), reply: e.reply.trim() }))
        .filter((e) => e.user && e.reply),
      ...(form.skill.before.trim() ? { before: form.skill.before.trim() } : {}),
      ...(form.skill.after.trim() ? { after: form.skill.after.trim() } : {}),
    };
  const a = form.agent;
  return {
    flow: clean(a.flow),
    integrations: clean(a.integrations),
    prepare: clean(a.prepare),
    does: clean(a.does),
    does_not: clean(a.doesNot),
    ...(a.runtime.trim() ? { runtime: a.runtime.trim() } : {}),
  };
}

export function buildFilters(
  form: UploadForm,
  skill?: SkillPackage | null,
): Record<string, unknown> {
  if (form.category === "prompt")
    return form.media[0] ? { ratio: form.media[0].ratio } : {};
  if (form.category === "skill")
    return skill && skill.fileCount > 1 ? { files: skill.fileCount } : {};
  return form.agent.runtime.trim()
    ? { runtime: form.agent.runtime.trim() }
    : {};
}

export interface CheckRecord {
  layer: 1 | 2;
  result: "pass" | "review";
  findings: Finding[];
  checker: string;
}

/** Payload for public.submit_recipe_version (service role). */
export function buildPayload(
  form: UploadForm,
  ctx: {
    checks: CheckRecord[];
    skill?: SkillPackage | null;
    contentSha256: string;
  },
) {
  const secret =
    form.category === "prompt"
      ? { prompt_body: form.prompt.body }
      : form.category === "skill"
        ? { skill_md: ctx.skill?.skillMd ?? "" }
        : { agent_config: parseAgentConfig(form.agent.config) };
  return {
    ...(form.recipeId
      ? { recipe_id: form.recipeId }
      : { category: form.category }),
    ...(form.category === "prompt" && !form.recipeId
      ? { prompt_kind: form.promptKind }
      : {}),
    title: form.title.trim(),
    summary: form.summary.trim(),
    job_codes: form.jobCodes,
    tool_codes: form.toolCodes,
    search_tags: [...new Set(clean(form.tags))],
    filters: buildFilters(form, ctx.skill),
    public_meta: buildPublicMeta(form),
    secret,
    media: form.media.map((m) => ({
      path: m.path,
      kind: m.kind,
      ratio: m.ratio,
      alt: m.alt.trim(),
      ai: m.ai,
    })),
    files: ctx.skill?.file ? [ctx.skill.file] : [],
    checks: ctx.checks,
    visibility: form.visibility,
    changelog: form.changelog.trim(),
    has_scripts:
      form.category === "skill" ? Boolean(ctx.skill?.hasScripts) : false,
    content_sha256: ctx.contentSha256,
  };
}
