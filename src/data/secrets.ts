// The only module allowed to read hidden originals (recipe_version_secrets via open_original,
// private.play_prompts via play_prompt_for_submit). Never cached; originals go only to the
// entitlement holder, and playground prompts only to start_run and the provider.
import "server-only";
import type { Viewer } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface OriginalDTO {
  versionNo: number;
  /** Prompt body, SKILL.md, or the agent config as formatted JSON. */
  text: string;
  format: "text" | "markdown" | "json";
  firstOpen: boolean;
  /** hidden-content rule 8: who received it (shown with the original). */
  watermark: string;
}

function kstDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * LIB-03 / F3-5: open the pinned version's original. open_original checks the entitlement belongs
 * to the caller (NOT_FOUND otherwise) and records the first open (stats only in MVP, D6).
 */
export async function openOriginal(
  viewer: Viewer,
  entitlementId: string,
): Promise<OriginalDTO | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_original", {
    p_entitlement_id: entitlementId,
  });
  if (error || !data) return null;
  const o = data as {
    version_no: number;
    prompt_body: string | null;
    skill_md: string | null;
    agent_config: unknown;
    claimed_at: string | null;
    first_open: boolean;
  };
  const [text, format]: [string, OriginalDTO["format"]] = o.prompt_body
    ? [o.prompt_body, "text"]
    : o.skill_md
      ? [o.skill_md, "markdown"]
      : o.agent_config != null
        ? [JSON.stringify(o.agent_config, null, 2), "json"]
        : ["", "text"];
  const watermark = `${viewer.nickname}(@${viewer.handle})님이 ${kstDate(o.claimed_at)}에 받은 원문이에요. 다른 사람에게 다시 팔거나 나눠 줄 수 없어요.`;
  // The mark travels with copied SKILL.md / agent config. Prompt bodies stay clean (a trailing
  // line would end up inside the generation prompt); they carry the on-screen mark only.
  const marked =
    format === "markdown"
      ? `${text}\n\n<!-- ${watermark} -->\n`
      : format === "json" &&
          o.agent_config &&
          typeof o.agent_config === "object" &&
          !Array.isArray(o.agent_config)
        ? JSON.stringify(
            {
              ...(o.agent_config as Record<string, unknown>),
              _received_by: watermark,
            },
            null,
            2,
          )
        : text;
  return {
    versionNo: o.version_no,
    text: marked,
    format,
    firstOpen: o.first_open,
    watermark,
  };
}

export interface OwnOriginalDTO {
  promptBody: string;
  skillMd: string;
  /** Agent original as the wizard shows it: JSON text, or the plain instructions it was made from. */
  agentConfig: string;
}

/**
 * UP-08 / F5-6 / F5-7: the owner's own latest original, to prefill 「고쳐서 다시 제출」 and
 * 「새 버전 올리기」. my_recipe_original is owner-only (NOT_FOUND otherwise). Never cached; returned
 * only to the owner through a server action.
 */
export async function readOwnOriginal(
  recipeId: string,
): Promise<OwnOriginalDTO | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_recipe_original", {
    p_recipe: recipeId,
  });
  if (error || !data) return null;
  const o = data as {
    prompt_body: string | null;
    skill_md: string | null;
    agent_config: unknown;
  };
  const cfg = o.agent_config;
  const agentConfig =
    cfg && typeof cfg === "object" && !Array.isArray(cfg)
      ? Object.keys(cfg).length === 1 &&
        typeof (cfg as { instructions?: unknown }).instructions === "string"
        ? (cfg as { instructions: string }).instructions
        : JSON.stringify(cfg, null, 2)
      : "";
  return {
    promptBody: o.prompt_body ?? "",
    skillMd: o.skill_md ?? "",
    agentConfig,
  };
}

/**
 * PLAY (F4-2): the prompt body a member may run, read on the server to render the run. Checks the
 * mode itself so no caller can read a body without the right to run it:
 *   own  — the caller's prompt recipe; not a rejected version, not a stopped recipe
 *   free — a live recipe the caller received, approved version
 * start_run checks ownership / entitlement again. Does not mark the original opened. The text and
 * its rendering go only to input moderation, start_run and the provider.
 */
export async function promptBodyForRun(
  userId: string,
  mode: "own" | "free",
  versionId: string,
): Promise<string | null> {
  const db = createAdminClient();
  // Two plain reads: recipes ↔ recipe_versions have several FKs, so an embed would be ambiguous.
  const { data: v } = await db
    .from("recipe_versions")
    .select("recipe_id, review_status")
    .eq("id", versionId)
    .maybeSingle();
  if (!v) return null;
  const { data: r } = await db
    .from("recipes")
    .select("owner_id, category, status")
    .eq("id", v.recipe_id)
    .maybeSingle();
  if (!r || r.category !== "prompt") return null;
  if (mode === "own") {
    if (r.owner_id !== userId) return null;
    if (
      v.review_status === "rejected" ||
      v.review_status === "draft" ||
      r.status === "stopped" ||
      r.status === "taken_down"
    )
      return null;
  } else {
    if (v.review_status !== "approved" || r.status !== "live") return null;
    const { data: e } = await db
      .from("entitlements")
      .select("id")
      .eq("user_id", userId)
      .eq("recipe_id", v.recipe_id)
      .eq("version_id", versionId) // F3-8: only the version they received
      .is("revoked_at", null)
      .limit(1);
    if (!e?.length) return null;
  }
  const { data, error } = await db
    .from("recipe_version_secrets")
    .select("prompt_body")
    .eq("version_id", versionId)
    .maybeSingle();
  if (error || !data?.prompt_body) return null;
  return data.prompt_body;
}

/** PLAY (F4-3): the rendered prompt of a queued cell, for (re)submission to the provider. */
export async function renderedPromptForSubmit(
  cellId: string,
): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc(
    "play_prompt_for_submit",
    { p_cell: cellId },
  );
  if (error || typeof data !== "string" || !data) return null;
  return data;
}

export interface AdminOriginalsDTO {
  current: string;
  previous: string | null;
  previousNo: number | null;
}

type SecretRow = {
  prompt_body: string | null;
  skill_md: string | null;
  agent_config: unknown;
};
const secretText = (s: SecretRow | null | undefined): string =>
  s?.prompt_body ??
  s?.skill_md ??
  (s?.agent_config != null ? JSON.stringify(s.agent_config, null, 2) : "");

/**
 * ADM review (F8-1): the original under review and the last approved one before it, for the
 * reviewer's diff. Admins only (checked again here); rendered on the server, never cached.
 */
export async function readVersionOriginalsForAdmin(
  admin: Viewer,
  versionId: string,
): Promise<AdminOriginalsDTO | null> {
  if (admin.role !== "admin") return null;
  const db = createAdminClient();
  const { data: v } = await db
    .from("recipe_versions")
    .select("recipe_id, version_no")
    .eq("id", versionId)
    .maybeSingle();
  if (!v) return null;
  const { data: prev } = await db
    .from("recipe_versions")
    .select("id, version_no")
    .eq("recipe_id", v.recipe_id)
    .not("approved_at", "is", null)
    .lt("version_no", v.version_no)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ids = prev ? [versionId, prev.id] : [versionId];
  const { data: rows } = await db
    .from("recipe_version_secrets")
    .select("version_id, prompt_body, skill_md, agent_config")
    .in("version_id", ids);
  const of = (id: string) => rows?.find((r) => r.version_id === id);
  return {
    current: secretText(of(versionId)),
    previous: prev ? secretText(of(prev.id)) : null,
    previousNo: prev?.version_no ?? null,
  };
}
