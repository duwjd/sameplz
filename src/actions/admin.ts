"use server";
// ADM actions (F8-1~3). zod → verified admin (profiles.role) → service RPC (re-checks the role,
// writes admin_actions) → D18 media sync → updateTag. Every decision carries a reason.
import { updateTag } from "next/cache";
import { z } from "zod";
import { syncRecipeMedia } from "@/data/media-sync";
import { recipeTag } from "@/data/recipe";
import { getAdmin } from "@/lib/auth/admin";
import { REJECT_CODES } from "@/lib/moderation/reject-codes";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminResult =
  { ok: true; duplicate?: boolean } | { ok: false; reason: string };

const rpcCode = (e: { code?: string; message: string } | null) =>
  e?.code === "P0001" ? e.message : "FAILED";

async function afterRecipeChange(publicId: string | null) {
  // D18: results follow the recipe (public bucket only while live or stopped).
  await syncRecipeMedia().catch(() => null);
  if (publicId) updateTag(recipeTag(publicId));
  updateTag("rankings");
  updateTag("collections");
  updateTag("sitemap");
  updateTag("gallery");
}

async function publicIdOf(recipeId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("recipes")
    .select("public_id")
    .eq("id", recipeId)
    .maybeSingle();
  return data?.public_id ?? null;
}

// ---------------------------------------------------------------- review (F8-1)

const ReviewInput = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), versionId: z.uuid() }),
  z.object({
    decision: z.literal("reject"),
    versionId: z.uuid(),
    code: z.enum(REJECT_CODES),
    note: z.string().trim().max(500).default(""),
  }),
]);

export async function decideReview(input: unknown): Promise<AdminResult> {
  const parsed = ReviewInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID" };
  const admin = await getAdmin();
  if (!admin) return { ok: false, reason: "NOT_ADMIN" };
  const p = parsed.data;
  const { data, error } = await createAdminClient().rpc("admin_decide_review", {
    p_actor: admin.id,
    p_version: p.versionId,
    p_decision: p.decision,
    p_code: p.decision === "reject" ? p.code : null,
    p_note: p.decision === "reject" ? p.note || null : null,
  });
  if (error) return { ok: false, reason: rpcCode(error) };
  await afterRecipeChange(
    (data as { public_id?: string } | null)?.public_id ?? null,
  );
  return { ok: true };
}

// ---------------------------------------------------------------- recipe status (F8-3)

const STOP_REASONS = [
  "rights_claim",
  "policy_violation",
  "misleading",
  "quality",
  "other",
] as const;

const StatusInput = z.object({
  recipeId: z.uuid(),
  action: z.enum(["stop", "takedown", "restore"]),
  reason: z.enum(STOP_REASONS).nullable().default(null),
  note: z.string().trim().max(500).default(""),
});

export async function setRecipeStatus(input: unknown): Promise<AdminResult> {
  const parsed = StatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID" };
  const admin = await getAdmin();
  if (!admin) return { ok: false, reason: "NOT_ADMIN" };
  const p = parsed.data;
  if (p.action !== "restore" && !p.reason)
    return { ok: false, reason: "REASON_REQUIRED" };
  if (p.action === "restore" && !p.note)
    return { ok: false, reason: "REASON_REQUIRED" };
  const { data, error } = await createAdminClient().rpc(
    "admin_set_recipe_status",
    {
      p_actor: admin.id,
      p_recipe: p.recipeId,
      p_action: p.action,
      p_reason: p.reason ?? "",
      p_note: p.note || null,
    },
  );
  if (error) return { ok: false, reason: rpcCode(error) };
  await afterRecipeChange(
    (data as { public_id?: string } | null)?.public_id ?? null,
  );
  return { ok: true };
}

// ---------------------------------------------------------------- reports (F8-2)

const ReportInput = z.object({
  reportId: z.uuid(),
  /** What happens to the target before the answer goes out. */
  decision: z.enum(["dismiss", "stop", "takedown", "hide_post"]),
  reason: z.enum(STOP_REASONS).nullable().default(null),
  answer: z.string().trim().min(1).max(200),
});

export async function resolveReport(input: unknown): Promise<AdminResult> {
  const parsed = ReportInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID" };
  const admin = await getAdmin();
  if (!admin) return { ok: false, reason: "NOT_ADMIN" };
  const p = parsed.data;
  const db = createAdminClient();
  const { data: rep } = await db
    .from("reports")
    .select("id, target_type, target_id, status")
    .eq("id", p.reportId)
    .maybeSingle();
  if (!rep) return { ok: false, reason: "NOT_FOUND" };
  if (rep.status !== "open") return { ok: false, reason: "NOT_OPEN" };

  // The target the action applies to comes from the report row, never from the client.
  let recipeId: string | null = null;
  if (p.decision === "stop" || p.decision === "takedown") {
    if (!p.reason) return { ok: false, reason: "REASON_REQUIRED" };
    if (rep.target_type === "recipe") recipeId = rep.target_id;
    else {
      const { data: post } = await db
        .from("gallery_posts")
        .select("recipe_id")
        .eq("id", rep.target_id)
        .maybeSingle();
      recipeId = post?.recipe_id ?? null;
    }
    if (!recipeId) return { ok: false, reason: "NOT_FOUND" };
    const { error } = await db.rpc("admin_set_recipe_status", {
      p_actor: admin.id,
      p_recipe: recipeId,
      p_action: p.decision,
      p_reason: p.reason,
      p_note: p.answer,
    });
    if (error) {
      // Already in the asked-for state is fine (the report still gets its answer); anything else
      // (e.g. stopping a private recipe) did nothing and must not be closed as 「조치함」.
      const { data: now } = await db
        .from("recipes")
        .select("status")
        .eq("id", recipeId)
        .maybeSingle();
      const done =
        rpcCode(error) === "INVALID_STATE" &&
        (now?.status === "taken_down" ||
          (p.decision === "stop" && now?.status === "stopped"));
      if (!done) return { ok: false, reason: rpcCode(error) };
    }
  } else if (p.decision === "hide_post") {
    if (rep.target_type !== "post") return { ok: false, reason: "NOT_A_POST" };
    const { data: hidden, error } = await db.rpc("admin_hide_post", {
      p_actor: admin.id,
      p_post: rep.target_id,
      p_reason: p.answer,
    });
    if (error) return { ok: false, reason: rpcCode(error) };
    recipeId = (hidden as { recipe_id?: string } | null)?.recipe_id ?? null;
  }
  // The action is committed: refresh caches and media now, even if the answer below fails.
  if (recipeId) await afterRecipeChange(await publicIdOf(recipeId));

  const { error } = await db.rpc("admin_resolve_report", {
    p_actor: admin.id,
    p_report: rep.id,
    p_outcome: p.decision === "dismiss" ? "dismissed" : "actioned",
    p_answer: p.answer,
  });
  if (error) return { ok: false, reason: rpcCode(error) };
  return { ok: true };
}

// ---------------------------------------------------------------- members (F8-4)

const SanctionInput = z.object({
  userId: z.uuid(),
  level: z.enum(["warning", "seller_suspended", "account_suspended", "banned"]),
  reason: z.enum([
    "policy_violation",
    "rights_claim",
    "abuse",
    "spam",
    "other",
  ]),
  note: z.string().trim().max(500).default(""),
  days: z.number().int().min(1).max(365).nullable().default(null),
});

export async function sanctionUser(input: unknown): Promise<AdminResult> {
  const parsed = SanctionInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID" };
  const admin = await getAdmin();
  if (!admin) return { ok: false, reason: "NOT_ADMIN" };
  const p = parsed.data;
  const { error } = await createAdminClient().rpc("admin_sanction", {
    p_actor: admin.id,
    p_user: p.userId,
    p_level: p.level,
    p_reason: p.reason,
    p_note: p.note,
    // Warnings and bans have no period.
    p_days: (p.level === "seller_suspended" || p.level === "account_suspended"
      ? p.days
      : null) as number,
  });
  return error ? { ok: false, reason: rpcCode(error) } : { ok: true };
}

const LiftInput = z.object({
  sanctionId: z.uuid(),
  note: z.string().trim().min(1).max(500),
});

export async function liftSanction(input: unknown): Promise<AdminResult> {
  const parsed = LiftInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "REASON_REQUIRED" };
  const admin = await getAdmin();
  if (!admin) return { ok: false, reason: "NOT_ADMIN" };
  const { error } = await createAdminClient().rpc("admin_lift_sanction", {
    p_actor: admin.id,
    p_sanction: parsed.data.sanctionId,
    p_note: parsed.data.note,
  });
  return error ? { ok: false, reason: rpcCode(error) } : { ok: true };
}

const ResumeInput = z.object({
  userId: z.uuid(),
  note: z.string().trim().min(1).max(500),
});

export async function liftGenerationSuspension(
  input: unknown,
): Promise<AdminResult> {
  const parsed = ResumeInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "REASON_REQUIRED" };
  const admin = await getAdmin();
  if (!admin) return { ok: false, reason: "NOT_ADMIN" };
  const { error } = await createAdminClient().rpc(
    "admin_lift_generation_suspension",
    { p_actor: admin.id, p_user: parsed.data.userId, p_note: parsed.data.note },
  );
  return error ? { ok: false, reason: rpcCode(error) } : { ok: true };
}

const AdjustInput = z.object({
  userId: z.uuid(),
  amount: z
    .number()
    .int()
    .min(-1000)
    .max(1000)
    .refine((n) => n !== 0),
  reason: z.string().trim().min(1).max(200),
  /** Generated once per opened form, so a double submit adjusts once. */
  idem: z.uuid(),
});

/** Money: the amount is the admin's input, the SQL function does the ledger work (rule 4). */
export async function adjustCredits(input: unknown): Promise<AdminResult> {
  const parsed = AdjustInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_AMOUNT" };
  const admin = await getAdmin();
  if (!admin) return { ok: false, reason: "NOT_ADMIN" };
  const p = parsed.data;
  const { data, error } = await createAdminClient().rpc(
    "admin_adjust_credits",
    {
      p_actor: admin.id,
      p_user: p.userId,
      p_amount: p.amount,
      p_reason: p.reason,
      p_idem: p.idem,
    },
  );
  if (error) return { ok: false, reason: rpcCode(error) };
  return {
    ok: true,
    duplicate: Boolean((data as { duplicate?: boolean } | null)?.duplicate),
  };
}
