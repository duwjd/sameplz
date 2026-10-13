// The only module allowed to read hidden originals (recipe_version_secrets via open_original,
// private.play_prompts later). Never cached; the result goes only to the entitlement holder.
import "server-only";
import type { Viewer } from "@/lib/auth/account";
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
