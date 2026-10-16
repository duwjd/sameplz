// PLAY / CRD read DAL: the /play screen and /my/credits. Viewer-scoped reads go through the user's
// client (RLS: own runs, cells, holds, ledger); result files are private and get short signed URLs.
// No originals here — the template is only read inside src/data/secrets.ts when a run starts.
import "server-only";
import type { Viewer } from "@/lib/auth/account";
import { parseRecipeMeta } from "@/lib/recipe/detail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const RESULTS_BUCKET = "play-results";
// Short-lived (F4-8 ≤ 10 min): polling and refreshes re-sign anyway, and a copied link soon stops working.
const RESULT_URL_SECONDS = 600;

// ---------------------------------------------------------------- models

export interface PlayParam {
  name: string;
  label: string;
  values: (string | number | boolean)[];
  default: string | number | boolean;
}

export interface PlayModelDTO {
  id: string;
  label: string;
  kind: "image" | "video";
  refMax: number;
  params: PlayParam[];
  /** Credits for one cell at the default params (quote_play), null when it could not be priced. */
  baseCredits: number | null;
}

export async function getPlayModels(): Promise<PlayModelDTO[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("models")
    .select("id, label, kind, ref_max, params, sort")
    .order("sort");
  const rows = data ?? [];
  const prices = await Promise.all(
    rows.map(async (m) => {
      const { data: q } = await supabase.rpc("quote_play", {
        p_cells: [{ model: m.id, params: {}, count: 1 }],
        p_refs: 0,
      });
      return (q as { total?: number } | null)?.total ?? null;
    }),
  );
  return rows.map((m, i) => ({
    id: m.id,
    label: m.label,
    kind: m.kind as "image" | "video",
    refMax: m.ref_max,
    params: Object.entries(
      (m.params ?? {}) as Record<
        string,
        { label?: string; values?: unknown[]; default?: unknown }
      >,
    ).map(([name, p]) => ({
      name,
      label: p.label ?? name,
      values: (p.values ?? []) as PlayParam["values"],
      default: p.default as PlayParam["default"],
    })),
    baseCredits: prices[i],
  }));
}

// ---------------------------------------------------------------- recipes the viewer can run

export interface PlayVariable {
  name: string;
  description?: string;
  example?: string;
}

export interface PlayRecipeDTO {
  publicId: string;
  title: string;
  versionId: string;
  mode: "own" | "free";
  variables: PlayVariable[];
}

/** Own prompt recipes (not stopped) and received live prompt recipes, latest version each. */
export async function getPlayRecipes(viewer: Viewer): Promise<PlayRecipeDTO[]> {
  const supabase = await createClient();
  const [own, received] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, public_id, title, status, current_version_id")
      .eq("owner_id", viewer.id)
      .eq("category", "prompt")
      .not("status", "in", "(stopped,taken_down)")
      .not("current_version_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("entitlements")
      .select("recipe_id")
      .eq("user_id", viewer.id)
      .is("revoked_at", null)
      .limit(200),
  ]);
  const ownRows = own.data ?? [];
  const ownIds = new Set(ownRows.map((r) => r.id));
  const receivedIds = (received.data ?? [])
    .map((e) => e.recipe_id)
    .filter((id) => !ownIds.has(id));
  const { data: recv } = receivedIds.length
    ? await supabase
        .from("recipes")
        .select("id, public_id, title, status, current_version_id")
        .in("id", receivedIds)
        .eq("category", "prompt")
        .eq("status", "live")
        .not("current_version_id", "is", null)
    : { data: [] as typeof ownRows };
  const rows = [
    ...ownRows.map((r) => ({ ...r, mode: "own" as const })),
    ...(recv ?? []).map((r) => ({ ...r, mode: "free" as const })),
  ];
  if (!rows.length) return [];
  // Public meta only ([변수] names, help, examples). Read with the admin client: an own recipe's
  // version under review is not readable through public RLS.
  const { data: versions } = await createAdminClient()
    .from("recipe_versions")
    .select("id, public_meta")
    .in(
      "id",
      rows.map((r) => r.current_version_id!),
    );
  const metaOf = new Map(
    (versions ?? []).map((v) => [v.id, parseRecipeMeta(v.public_meta)]),
  );
  return rows.map((r) => ({
    publicId: r.public_id,
    title: r.title,
    versionId: r.current_version_id!,
    mode: r.mode,
    variables: (metaOf.get(r.current_version_id!)?.variables ?? []).map(
      (v) => ({
        name: v.name,
        description: v.description,
        example: v.example,
      }),
    ),
  }));
}

// ---------------------------------------------------------------- runs (PLAY-05/06)

export type CellStatus =
  | "queued"
  | "submitted"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked"
  | "canceled"
  | "expired";

export interface PlayCellDTO {
  id: string;
  modelId: string;
  modelLabel: string;
  kind: "image" | "video";
  params: Record<string, unknown>;
  credits: number;
  status: CellStatus;
  errorCode: string | null;
  url: string | null;
  saved: boolean;
  deleteAfter: string | null;
}

export interface PlayRunDTO {
  id: string;
  createdAt: string;
  mode: "own" | "free" | "blank";
  recipeTitle: string | null;
  /** The recipe a free / own run used (for 「SAME 인증 올리기」). */
  recipeId: string | null;
  cells: PlayCellDTO[];
}

export const isTerminal = (s: CellStatus) =>
  s === "succeeded" ||
  s === "failed" ||
  s === "blocked" ||
  s === "canceled" ||
  s === "expired";

/** The viewer's latest runs (or the given ones), newest first. RLS limits rows to the viewer. */
export async function getMyRuns(
  opts: { runIds?: string[]; limit?: number } = {},
): Promise<PlayRunDTO[]> {
  const supabase = await createClient();
  let q = supabase
    .from("play_runs")
    .select("id, created_at, mode, recipe_version_id")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (opts.runIds) q = q.in("id", opts.runIds);
  const { data: runs } = await q;
  if (!runs?.length) return [];
  const [{ data: cells }, { data: models }] = await Promise.all([
    supabase
      .from("play_cells")
      .select(
        "id, run_id, model_id, params, price_credits, status, error_code, result_path, saved_at, delete_after, created_at",
      )
      .in(
        "run_id",
        runs.map((r) => r.id),
      )
      .order("created_at"),
    createAdminClient().from("models").select("id, label, kind"),
  ]);
  const modelOf = new Map((models ?? []).map((m) => [m.id, m]));

  const paths = (cells ?? [])
    .map((c) => c.result_path)
    .filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await createAdminClient()
      .storage.from(RESULTS_BUCKET)
      .createSignedUrls(paths, RESULT_URL_SECONDS);
    for (const s of signed ?? [])
      if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const versionIds = [
    ...new Set(
      runs
        .map((r) => r.recipe_version_id)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const titles = new Map<string, string>();
  const recipeOf = new Map<string, string>();
  if (versionIds.length) {
    const admin = createAdminClient();
    const { data: vs } = await admin
      .from("recipe_versions")
      .select("id, recipe_id")
      .in("id", versionIds);
    const { data: rs } = await admin
      .from("recipes")
      .select("id, title")
      .in(
        "id",
        (vs ?? []).map((v) => v.recipe_id),
      );
    const titleOf = new Map((rs ?? []).map((r) => [r.id, r.title]));
    for (const v of vs ?? []) {
      titles.set(v.id, titleOf.get(v.recipe_id) ?? "");
      recipeOf.set(v.id, v.recipe_id);
    }
  }

  return runs.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    mode: r.mode as PlayRunDTO["mode"],
    recipeTitle: r.recipe_version_id
      ? (titles.get(r.recipe_version_id) ?? null)
      : null,
    recipeId: r.recipe_version_id ? (recipeOf.get(r.recipe_version_id) ?? null) : null,
    cells: (cells ?? [])
      .filter((c) => c.run_id === r.id)
      .map((c) => {
        const m = modelOf.get(c.model_id);
        return {
          id: c.id,
          modelId: c.model_id,
          modelLabel: m?.label ?? c.model_id,
          kind: (m?.kind ?? "image") as "image" | "video",
          params: (c.params ?? {}) as Record<string, unknown>,
          credits: c.price_credits,
          status: c.status as CellStatus,
          errorCode: c.error_code,
          url: c.result_path ? (urls.get(c.result_path) ?? null) : null,
          saved: Boolean(c.saved_at),
          deleteAfter: c.delete_after,
        };
      }),
  }));
}

// ---------------------------------------------------------------- credits (CRD-01/03)

export interface CreditSummaryDTO {
  available: number;
  held: number;
  nextResetAt: string;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  suspended: boolean;
  aiNoticeAcked: boolean;
  /** F4-15: this month's generation budget is closed (paused or used up). */
  budgetClosed: boolean;
}

export async function getCreditSummary(
  viewer: Viewer,
): Promise<CreditSummaryDTO | null> {
  const supabase = await createClient();
  const [{ data }, { data: profile }, budget] = await Promise.all([
    supabase.rpc("my_credit_summary"),
    // profiles columns are not all client-readable: read the viewer's own flag on the server.
    createAdminClient()
      .from("profiles")
      .select("ai_notice_ack_at")
      .eq("id", viewer.id)
      .maybeSingle(),
    budgetClosed(),
  ]);
  const s = data as {
    available: number;
    held: number;
    next_reset_at: string;
    daily_limit: number;
    used_today: number;
    remaining_today: number;
    suspended: boolean;
  } | null;
  if (!s) return null;
  return {
    available: s.available,
    held: s.held,
    nextResetAt: s.next_reset_at,
    dailyLimit: s.daily_limit,
    usedToday: s.used_today,
    remainingToday: s.remaining_today,
    suspended: s.suspended,
    aiNoticeAcked: Boolean(profile?.ai_notice_ack_at),
    budgetClosed: budget,
  };
}

async function budgetClosed(): Promise<boolean> {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const month = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const { data } = await createAdminClient()
    .from("generation_budget")
    .select("cap_credits, reserved, spent, state")
    .eq("month", month)
    .maybeSingle();
  return (
    !data ||
    data.state !== "open" ||
    data.reserved + data.spent >= data.cap_credits
  );
}

export type CreditLineKind =
  "grant" | "use" | "returned" | "safety" | "holding" | "expire";

export interface CreditLineDTO {
  at: string;
  kind: CreditLineKind;
  /** Signed change to the balance shown on the line (0 for returned / safety). */
  delta: number;
  credits: number;
}

/** CRD-03: grants and expiries from the ledger, one line per generation from its hold. */
export async function getCreditHistory(
  viewer: Viewer,
  limit = 100,
): Promise<CreditLineDTO[]> {
  const supabase = await createClient();
  const [{ data: ledger }, { data: holds }] = await Promise.all([
    supabase
      .from("credit_ledger")
      .select("entry_type, delta, created_at")
      .eq("user_id", viewer.id)
      .in("entry_type", ["grant", "expire"])
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("credit_holds")
      .select("credits, state, outcome, created_at, settled_at")
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  const lines: CreditLineDTO[] = [
    ...(ledger ?? []).map((l) => ({
      at: l.created_at,
      kind: (l.entry_type === "grant" ? "grant" : "expire") as CreditLineKind,
      delta: l.delta,
      credits: Math.abs(l.delta),
    })),
    ...(holds ?? []).map((h) => {
      const kind: CreditLineKind =
        h.state === "held"
          ? "holding"
          : h.state === "captured"
            ? "use"
            : h.outcome === "safety_blocked"
              ? "safety"
              : "returned";
      return {
        at: h.settled_at ?? h.created_at,
        kind,
        delta: kind === "use" || kind === "holding" ? -h.credits : 0,
        credits: h.credits,
      };
    }),
  ];
  return lines.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
