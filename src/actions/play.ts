"use server";
import { z } from "zod";
import { createRefUpload, isRefMime, MAX_REF_BYTES } from "@/data/play";
import { getMyRuns, type PlayRunDTO } from "@/data/playground";
import { getViewer, sanctionBlock } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RunCellSchema } from "@/lib/validation/play";

type Gate = "LOGIN_REQUIRED" | "SIGNUP_INCOMPLETE" | "ACCOUNT_SUSPENDED";

async function member(): Promise<{ id: string } | Gate> {
  const viewer = await getViewer();
  if (!viewer) return "LOGIN_REQUIRED";
  if (!viewer.signupComplete) return "SIGNUP_INCOMPLETE";
  if (sanctionBlock(viewer, "account")) return "ACCOUNT_SUSPENDED";
  return viewer;
}

// ---------------------------------------------------------------- quote (PLAY-04, F4-1)

const QuoteInput = z.object({
  cells: z.array(RunCellSchema).min(1).max(3),
  refs: z.number().int().min(0).max(4).default(0),
});

export type QuoteDTO = {
  total: number;
  priceVersions: Record<string, number>;
  cells: {
    model: string;
    params: Record<string, unknown>;
    credits: number;
    count: number;
    exceedsDailyLimit: boolean;
  }[];
  dailyLimit: number;
  remainingToday: number;
  exceedsRemaining: boolean;
};

/** Server-computed estimate; the run sends back priceVersions and total and is refused if they moved. */
export async function quotePlay(
  input: unknown,
): Promise<
  { ok: true; quote: QuoteDTO } | { ok: false; reason: Gate | "INVALID_PARAMS" }
> {
  const parsed = QuoteInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_PARAMS" };
  const who = await member();
  if (typeof who === "string") return { ok: false, reason: who };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_play", {
    p_cells: parsed.data.cells,
    p_refs: parsed.data.refs,
  });
  if (error || !data) return { ok: false, reason: "INVALID_PARAMS" };
  const q = data as {
    total: number;
    price_versions: Record<string, number>;
    cells: {
      model: string;
      params: Record<string, unknown>;
      credits: number;
      count: number;
      exceeds_daily_limit: boolean;
    }[];
    daily_limit: number;
    remaining_today: number;
    exceeds_remaining: boolean;
  };
  return {
    ok: true,
    quote: {
      total: q.total,
      priceVersions: q.price_versions,
      cells: q.cells.map((c) => ({
        model: c.model,
        params: c.params,
        credits: c.credits,
        count: c.count,
        exceedsDailyLimit: c.exceeds_daily_limit,
      })),
      dailyLimit: q.daily_limit,
      remainingToday: q.remaining_today,
      exceedsRemaining: q.exceeds_remaining,
    },
  };
}

// ---------------------------------------------------------------- AI notice (F4-9)

export async function ackAiNotice(): Promise<{ ok: boolean }> {
  const who = await member();
  if (typeof who === "string") return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ack_ai_notice");
  return { ok: !error };
}

// ---------------------------------------------------------------- reference upload (F4-8)

const RefInput = z.object({
  mime: z.string(),
  size: z.number().int().min(1).max(MAX_REF_BYTES),
});

/** Server-minted signed upload slot in the private play-refs bucket (deleted after 24 h). */
export async function createPlayRefUpload(
  input: unknown,
): Promise<
  | { ok: true; id: string; path: string; token: string }
  | { ok: false; reason: Gate | "INVALID_FILE" | "RATE_LIMITED" | "FAILED" }
> {
  const parsed = RefInput.safeParse(input);
  if (!parsed.success || !isRefMime(parsed.data.mime))
    return { ok: false, reason: "INVALID_FILE" };
  const who = await member();
  if (typeof who === "string") return { ok: false, reason: who };
  const r = await createRefUpload(who.id, parsed.data.mime, parsed.data.size);
  if (!r.ok)
    return {
      ok: false,
      reason:
        r.reason === "RATE_LIMITED" || r.reason === "INVALID_FILE"
          ? r.reason
          : "FAILED",
    };
  return r;
}

// ---------------------------------------------------------------- runs (PLAY-05/06)

const RunIds = z.array(z.guid()).min(1).max(20);

/** Fresh state of the viewer's own runs (after a Realtime hint or while polling). RLS-scoped. */
export async function refreshRuns(input: unknown): Promise<PlayRunDTO[]> {
  const parsed = RunIds.safeParse(input);
  if (!parsed.success) return [];
  const who = await member();
  if (typeof who === "string") return [];
  const { data: allowed } = await createAdminClient().rpc("hit_play_refresh", {
    p_user: who.id,
  });
  if (allowed !== true) return [];
  return getMyRuns({ runIds: parsed.data, limit: parsed.data.length });
}

const SaveInput = z.object({ cellId: z.guid(), saved: z.boolean() });

/** D19: a saved result is kept; unsaved ones are deleted 30 days after they were made. */
export async function saveResult(input: unknown): Promise<{ ok: boolean }> {
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const who = await member();
  if (typeof who === "string") return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_play_cell", {
    p_cell: parsed.data.cellId,
    p_saved: parsed.data.saved,
  });
  return { ok: !error && data === true };
}
