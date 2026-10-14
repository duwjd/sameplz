// Playground helpers (local Supabase only). The app must run with GENERATION_PROVIDER=mock and
// MODERATION_PROVIDER=mock; the mock provider calls our webhook itself (e2e/CLAUDE.md).
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";
import { loginAsNewUser, localSupabaseEnv, type TestUser } from "./auth";

export function adminDb() {
  const env = localSupabaseEnv();
  return createClient(env.url, env.secretKey, {
    auth: { persistSession: false },
  });
}

/** Signed-up member with this month's 270C and the AI notice acknowledged. */
export async function loginAsPlayer(
  context: BrowserContext,
): Promise<TestUser> {
  const user = await loginAsNewUser(context, { completeSignup: true });
  const db = adminDb();
  const grant = await db.rpc("complete_signup_credits", {
    p_user: user.id,
    p_device_hash: null,
    p_ip_hash: null,
  });
  if (grant.error) throw grant.error;
  const ack = await db
    .from("profiles")
    .update({ ai_notice_ack_at: new Date().toISOString() })
    .eq("id", user.id);
  if (ack.error) throw ack.error;
  return user;
}

/** GPT Image 2.5 Flare medium = ceil(0.01317 × 805) = 11C (model_prices v1). */
export const CHEAP = {
  model: "gpt-image-2.5-flare",
  credits: 11,
  version: 1,
} as const;

export function runBody(over: Record<string, unknown> = {}) {
  return {
    clientRequestId: randomUUID(),
    mode: "blank",
    recipeVersionId: null,
    prompt: "푸른 바다 위 등대, 수채화",
    cells: [{ model: CHEAP.model, params: {}, count: 1 }],
    priceVersions: { [CHEAP.model]: CHEAP.version },
    expectedTotal: CHEAP.credits,
    ...over,
  };
}

export async function available(userId: string): Promise<number> {
  const { data, error } = await adminDb()
    .from("credit_accounts")
    .select("available")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data.available as number;
}

export interface CellRow {
  id: string;
  status: string;
  error_code: string | null;
  result_path: string | null;
  attempts: number;
}

export async function cellRow(cellId: string): Promise<CellRow> {
  const { data, error } = await adminDb()
    .from("play_cells")
    .select("id, status, error_code, result_path, attempts")
    .eq("id", cellId)
    .single();
  if (error) throw error;
  return data as CellRow;
}

/** Wait until the mock webhook has settled the cell. */
export async function waitTerminal(
  cellId: string,
  timeoutMs = 15_000,
): Promise<CellRow> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const c = await cellRow(cellId);
    if (
      ["succeeded", "failed", "blocked", "canceled", "expired"].includes(
        c.status,
      )
    )
      return c;
    if (Date.now() > until) return c;
    await new Promise((r) => setTimeout(r, 250));
  }
}
