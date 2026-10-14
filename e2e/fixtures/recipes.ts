// Test-only recipe setup through the same service-role RPC the upload action uses (local Supabase only).
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { localSupabaseEnv } from "./auth";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const admin = () => {
  const env = localSupabaseEnv();
  return createClient(env.url, env.secretKey, {
    auth: { persistSession: false },
  });
};

export interface SubmittedRecipe {
  recipeId: string;
  publicId: string;
  versionId: string;
  status: string;
}

/** Submits a recipe for `ownerId` with an uploaded 1×1 result, as if both check layers passed. */
export async function submitRecipeAs(
  ownerId: string,
  opts: {
    category?: "prompt" | "agent";
    title: string;
    visibility?: "public" | "private";
    body?: string;
    recipeId?: string;
    changelog?: string;
  },
): Promise<SubmittedRecipe> {
  const db = admin();
  const path = `${ownerId}/${randomUUID()}.png`;
  const up = await db.storage
    .from("recipe-media")
    .upload(path, PNG, { contentType: "image/png" });
  if (up.error) throw up.error;
  const category = opts.category ?? "prompt";
  const payload = {
    ...(opts.recipeId
      ? { recipe_id: opts.recipeId }
      : { category, prompt_kind: category === "prompt" ? "image" : null }),
    title: opts.title,
    summary: "e2e 테스트 레시피예요",
    job_codes: ["marketing"],
    tool_codes: [],
    search_tags: [],
    filters: {},
    public_meta:
      category === "prompt"
        ? {
            variables: [
              { name: "직업", description: "사진 속 직업", example: "개발자" },
            ],
          }
        : {
            flow: ["메일 읽기"],
            does: ["정리해요"],
            does_not: ["보내지 않아요"],
          },
    secret:
      category === "prompt"
        ? { prompt_body: opts.body ?? "[직업] 프로필 사진" }
        : { agent_config: { instructions: opts.body ?? "메일을 정리해요" } },
    media: [{ path, kind: "image", ratio: "1/1", alt: "e2e 결과물", ai: true }],
    files: [],
    checks: [
      { layer: 1, result: "pass", findings: [], checker: "e2e" },
      { layer: 2, result: "pass", findings: [], checker: "e2e" },
    ],
    visibility: opts.visibility ?? "public",
    changelog: opts.changelog ?? "",
  };
  const { data, error } = await db.rpc("submit_recipe_version", {
    p_owner: ownerId,
    p_payload: payload,
  });
  if (error) throw error;
  const r = data as {
    recipe_id: string;
    public_id: string;
    version_id: string;
    status: string;
  };
  return {
    recipeId: r.recipe_id,
    publicId: r.public_id,
    versionId: r.version_id,
    status: r.status,
  };
}

/** The seed admin rejects a version in the review queue (ADM UI is W6). */
export async function rejectVersion(
  versionId: string,
  code: string,
  note: string,
) {
  const { error } = await admin().rpc("admin_decide_review", {
    p_actor: "00000000-0000-0000-0000-000000000011",
    p_version: versionId,
    p_decision: "reject",
    p_code: code,
    p_note: note,
  });
  if (error) throw error;
}
