"use server";
import { updateTag } from "next/cache";
import { z } from "zod";
import { syncRecipeMedia } from "@/data/media-sync";
import { recipeTag } from "@/data/recipe";
import {
  createMediaUploadTarget,
  createSkillZipTarget,
  deleteMyDraft,
  hitJudgeBudget,
  hitUploadLimit,
  hitUploadTargetLimit,
  storeRebuiltSkillZip,
  readSkillZip,
  rememberFork,
  saveMyDraft,
  submitVersion,
  verifyMedia,
} from "@/data/upload";
import { getViewer, sanctionBlock, type Viewer } from "@/lib/auth/account";
import { runLayer1 } from "@/lib/moderation/layer1";
import { layer2OptionsFromEnv, runLayer2 } from "@/lib/moderation/layer2";
import type { Finding } from "@/lib/moderation/reject-codes";
import {
  inspectSkillMd,
  inspectSkillZip,
  SKILL_ERRORS,
} from "@/lib/moderation/skill-zip";
import { isMediaMime, mediaKindOf } from "@/lib/upload/media";
import { submitCopy } from "@/lib/upload/messages";
import {
  buildPayload,
  checkTexts,
  type CheckRecord,
  type SkillPackage,
} from "@/lib/upload/submission";
import {
  MAX_IMAGE_BYTES,
  MAX_SKILL_ZIP_BYTES,
  MAX_VIDEO_BYTES,
  UploadFormSchema,
  validateStep,
  type FieldError,
  type UploadForm,
} from "@/lib/validation/upload";

type Gate =
  | { ok: true; viewer: Viewer }
  | {
      ok: false;
      reason:
        | "LOGIN_REQUIRED"
        | "SIGNUP_INCOMPLETE"
        | "ACCOUNT_SUSPENDED"
        | "SELLER_SUSPENDED";
    };

async function creator(): Promise<Gate> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "LOGIN_REQUIRED" };
  if (!viewer.signupComplete) return { ok: false, reason: "SIGNUP_INCOMPLETE" };
  const blocked = sanctionBlock(viewer, "seller");
  if (blocked) return { ok: false, reason: blocked };
  return { ok: true, viewer };
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// ---------------------------------------------------------------- drafts (UP-08)

const DraftInput = z.object({
  form: z.unknown(),
  step: z.number().int().min(1).max(5),
});

/** Debounced from the wizard. Only the viewer's own draft row (RLS). */
export async function saveDraft(input: {
  form: UploadForm;
  step: number;
}): Promise<{ ok: boolean }> {
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const gate = await creator();
  if (!gate.ok) return { ok: false };
  const form = UploadFormSchema.parse(parsed.data.form ?? {});
  return { ok: await saveMyDraft(gate.viewer, form, parsed.data.step) };
}

/** 「새로 시작」 for a new recipe, or for a new version of `recipeId`. */
export async function discardDraft(
  input: { recipeId?: string | null } = {},
): Promise<{ ok: boolean }> {
  const parsed = z
    .object({ recipeId: z.guid().nullable().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false };
  const gate = await creator();
  if (!gate.ok) return { ok: false };
  return { ok: await deleteMyDraft(parsed.data.recipeId ?? null) };
}

// ---------------------------------------------------------------- uploads (UP-05)

const MediaUploadInput = z.object({
  mime: z.string().refine(isMediaMime),
  size: z.number().int().positive(),
});

export type UploadTargetResult =
  | { ok: true; path: string; token: string; bucket?: string }
  | { ok: false; message: string };

/** Signed upload URL for one result file; the server picks the path. */
export async function createMediaUpload(input: {
  mime: string;
  size: number;
}): Promise<UploadTargetResult> {
  const parsed = MediaUploadInput.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "PNG·JPG·WEBP·GIF 이미지나 MP4·WEBM 영상만 올릴 수 있어요.",
    };
  const gate = await creator();
  if (!gate.ok) return { ok: false, message: submitCopy(gate.reason).message };
  const mime = parsed.data.mime as Parameters<typeof mediaKindOf>[0];
  const video = mediaKindOf(mime) === "video";
  if (parsed.data.size > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES))
    return {
      ok: false,
      message: video
        ? "영상은 50MB까지 올릴 수 있어요."
        : "이미지는 10MB까지 올릴 수 있어요.",
    };
  if (!(await hitUploadTargetLimit(gate.viewer)))
    return { ok: false, message: submitCopy("RATE_LIMITED").message };
  const target = await createMediaUploadTarget(gate.viewer, mime);
  return target
    ? { ok: true, ...target }
    : { ok: false, message: submitCopy("FAILED").message };
}

export async function createSkillZipUpload(input: {
  size: number;
}): Promise<UploadTargetResult> {
  const parsed = z
    .object({ size: z.number().int().positive() })
    .safeParse(input);
  if (!parsed.success || parsed.data.size > MAX_SKILL_ZIP_BYTES)
    return { ok: false, message: "zip은 5MB까지 올릴 수 있어요." };
  const gate = await creator();
  if (!gate.ok) return { ok: false, message: submitCopy(gate.reason).message };
  if (!(await hitUploadTargetLimit(gate.viewer)))
    return { ok: false, message: submitCopy("RATE_LIMITED").message };
  const target = await createSkillZipTarget(gate.viewer, "skill");
  return target
    ? { ok: true, ...target }
    : { ok: false, message: submitCopy("FAILED").message };
}

export type SkillZipResult =
  | {
      ok: true;
      name: string;
      description: string;
      hasScripts: boolean;
      fileCount: number;
    }
  | { ok: false; message: string };

/** F5-5 preview right after the upload; submit inspects the stored bytes again. */
export async function inspectSkillZipUpload(input: {
  path: string;
}): Promise<SkillZipResult> {
  const parsed = z.object({ path: z.string().max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: SKILL_ERRORS.ZIP_INVALID };
  const gate = await creator();
  if (!gate.ok) return { ok: false, message: submitCopy(gate.reason).message };
  if (!(await hitUploadTargetLimit(gate.viewer)))
    return { ok: false, message: submitCopy("RATE_LIMITED").message };
  const bytes = await readSkillZip(gate.viewer, parsed.data.path);
  if (!bytes)
    return { ok: false, message: submitCopy("SKILL_INVALID").message };
  const r = await inspectSkillZip(bytes);
  if (!r.ok) return { ok: false, message: r.message };
  return {
    ok: true,
    name: r.name,
    description: r.description,
    hasScripts: r.hasScripts,
    fileCount: r.files.length,
  };
}

// ---------------------------------------------------------------- submit (UP-07, F5-3~F5-6)

export type SubmitResult =
  | {
      ok: true;
      publicId: string;
      status: string;
      review: boolean;
      recipeId?: string | null;
    }
  | {
      ok: false;
      reason: string;
      message: string;
      step?: number;
      errors?: FieldError[];
      findings?: Finding[];
    };

const fail = (
  reason: string,
  extra: Partial<Extract<SubmitResult, { ok: false }>> = {},
): SubmitResult => {
  const copy = submitCopy(reason);
  return {
    ok: false,
    reason,
    message: copy.message,
    ...(copy.step ? { step: copy.step } : {}),
    ...extra,
  };
};

/**
 * Server-authoritative skill package: the uploaded zip is re-read and inspected, and buyers get the
 * zip rebuilt from the checked entries (stored after the checks pass), never the uploaded bytes.
 */
async function skillPackage(
  viewer: Viewer,
  form: UploadForm,
): Promise<SkillPackage | { error: string }> {
  if (form.skill.source === "zip") {
    const zip = form.skill.zip;
    const bytes = zip ? await readSkillZip(viewer, zip.path) : null;
    if (!zip || !bytes) return { error: "SKILL_INVALID" };
    const r = await inspectSkillZip(bytes);
    if (!r.ok) return { error: r.message };
    return {
      skillMd: r.skillMd,
      hasScripts: r.hasScripts,
      sha256: r.sha256,
      texts: r.texts,
      file: null,
      rebuilt: { name: r.name, bytes: r.rebuilt },
      unscanned: r.unscanned,
      fileCount: r.files.length,
    };
  }
  const r = await inspectSkillMd(form.skill.skillMd);
  if (!r.ok) return { error: r.message };
  return {
    skillMd: form.skill.skillMd,
    hasScripts: r.hasScripts,
    sha256: r.sha256,
    texts: [],
    file: null,
    fileCount: 1,
  };
}

export async function submitRecipe(input: {
  form: UploadForm;
}): Promise<SubmitResult> {
  const raw = z.object({ form: z.unknown() }).safeParse(input);
  if (!raw.success) return fail("INVALID");
  const form = UploadFormSchema.parse(raw.data.form ?? {});
  const gate = await creator();
  if (!gate.ok) return fail(gate.reason);
  const { viewer } = gate;

  for (const step of [1, 2, 3, 4] as const) {
    const errors = validateStep(step, form);
    if (errors.length) return fail("INVALID", { step, errors });
  }
  if (!(await hitUploadLimit(viewer))) return fail("RATE_LIMITED");
  if (!(await verifyMedia(viewer, form.media))) return fail("MEDIA_INVALID");

  let skill: SkillPackage | null = null;
  if (form.category === "skill") {
    const pkg = await skillPackage(viewer, form);
    if ("error" in pkg) {
      const field = form.skill.source === "zip" ? "skill.zip" : "skill.skillMd";
      return pkg.error === "SKILL_INVALID"
        ? fail("SKILL_INVALID")
        : fail("INVALID", {
            step: 2,
            message: pkg.error,
            errors: [{ field, message: pkg.error }],
          });
    }
    skill = pkg;
  }

  const texts = checkTexts(form, skill);
  const l1 = runLayer1({
    category: form.category!,
    fields: texts,
    prompt: form.category === "prompt" ? form.prompt : undefined,
  });
  if (l1.result === "fail")
    return fail("CHECK_FAILED", { step: 5, findings: l1.findings });
  if (skill?.unscanned) {
    l1.findings.push({
      code: "R08",
      severity: "review",
      step: 2,
      field: "skill.zip",
      note: "파일이 커서 자동 검사를 다 못 했어요. 사람이 확인해요.",
    });
    l1.result = "review";
  }
  const l2 = await runLayer2(texts, {
    ...layer2OptionsFromEnv(),
    budgetExhausted: !(await hitJudgeBudget()),
  });
  if (l2.result === "fail")
    return fail("CHECK_FAILED", {
      step: 5,
      findings: [...l1.findings, ...l2.findings],
    });

  const checks: CheckRecord[] = [
    { layer: 1, result: l1.result, findings: l1.findings, checker: "rules-v1" },
    { layer: 2, result: l2.result, findings: l2.findings, checker: l2.checker },
  ];
  if (skill?.rebuilt) {
    const path = await storeRebuiltSkillZip(
      viewer,
      skill.rebuilt.name,
      skill.rebuilt.bytes,
    );
    if (!path) return fail("SKILL_INVALID");
    skill = {
      ...skill,
      file: {
        path,
        filename: `${skill.rebuilt.name}.zip`,
        size: skill.rebuilt.bytes.byteLength,
        sha256: skill.sha256,
      },
    };
  }
  const contentSha256 =
    skill?.sha256 ??
    (await sha256Hex(
      form.category === "prompt" ? form.prompt.body : form.agent.config,
    ));
  const outcome = await submitVersion(
    viewer,
    buildPayload(form, { checks, skill, contentSha256 }),
  );
  if (!outcome.ok) return fail(outcome.code);
  // F6-2: a first version made from a fork remembers the origin (not for new versions).
  if (!form.recipeId && form.forkOf && outcome.recipeId)
    await rememberFork(viewer, outcome.recipeId, form.forkOf.recipeId);

  // Detail and every popularity-ordered list may now include this recipe (W3 review requirement).
  // D18: a version that went live publishes its results before the page is shown again.
  await syncRecipeMedia().catch(() => null);
  updateTag(recipeTag(outcome.publicId));
  updateTag("rankings");
  updateTag("collections");
  updateTag("sitemap");
  return outcome;
}
