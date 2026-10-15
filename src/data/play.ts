// PLAY pipeline DAL (generation-pipeline skill, docs/plans/PLAY.md "PR F가 지킬 SQL 계약").
// Every cell is finished in its own RPC call (one transaction per cell). Provider objects and
// prompts never reach logs, responses or Realtime payloads.
import "server-only";
import { promptBodyForRun, renderedPromptForSubmit } from "@/data/secrets";
import { activeAdapter, adapterFor, webhookBase } from "@/lib/generation";
import { buildInput } from "@/lib/generation/input";
import { mockOutputBlocked } from "@/lib/generation/providers/mock";
import {
  ProviderSubmitError,
  type ProviderAdapter,
  type ProviderOutcome,
} from "@/lib/generation/types";
import { checkImage } from "@/lib/moderation/play";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffMatches, type MediaMime } from "@/lib/upload/media";
import { parseRecipeMeta } from "@/lib/recipe/detail";
import { detectVariables } from "@/lib/validation/upload";

export const REFS_BUCKET = "play-refs";
export const RESULTS_BUCKET = "play-results";
export const MAX_RESULT_BYTES = 50 * 1024 * 1024;
export const MAX_REF_BYTES = 10 * 1024 * 1024;
const REF_URL_SECONDS = 600; // provider fetch window (F4-8: ≤ 10 minutes)

const RESULT_EXT: Partial<Record<MediaMime, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const REF_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;
export type RefMime = keyof typeof REF_EXT;
export const isRefMime = (m: unknown): m is RefMime =>
  typeof m === "string" && Object.hasOwn(REF_EXT, m);

const admin = () => createAdminClient();

// ---------------------------------------------------------------- run context

export type RunMode = "own" | "free" | "blank";

/**
 * Template and declared [변수] for own / free modes (authorization inside promptBodyForRun). The
 * declared names are the version's public [변수] list — the same names the /play form shows. An
 * owner's recipe with an empty list falls back to the tokens in its own body.
 */
export async function recipeTemplate(
  userId: string,
  mode: Exclude<RunMode, "blank">,
  versionId: string,
): Promise<{ template: string; variables: string[] } | null> {
  const template = await promptBodyForRun(userId, mode, versionId);
  if (!template) return null;
  const { data: v } = await admin()
    .from("recipe_versions")
    .select("public_meta")
    .eq("id", versionId)
    .maybeSingle();
  const declared = parseRecipeMeta(v?.public_meta).variables.map((x) => x.name);
  // Only the owner may fall back to the tokens in the body: for a received recipe they would name
  // parts of the hidden original (they come back in INVALID_VARIABLES errors).
  return {
    template,
    variables: declared.length || mode === "free" ? declared : detectVariables(template),
  };
}

// ---------------------------------------------------------------- references (F4-7, F4-8)

export async function createRefUpload(
  userId: string,
  mime: RefMime,
  size: number,
) {
  const { data, error } = await admin().rpc("create_play_ref", {
    p_user: userId,
    p_ext: REF_EXT[mime],
    p_mime: mime,
    p_size: size,
  });
  const r = data as {
    ok?: boolean;
    reason?: string;
    id?: string;
    path?: string;
  } | null;
  if (error || !r) return { ok: false as const, reason: "FAILED" };
  if (!r.ok || !r.id || !r.path)
    return { ok: false as const, reason: r.reason ?? "FAILED" };
  const signed = await admin()
    .storage.from(REFS_BUCKET)
    .createSignedUploadUrl(r.path);
  if (signed.error || !signed.data)
    return { ok: false as const, reason: "FAILED" };
  return {
    ok: true as const,
    id: r.id,
    path: r.path,
    token: signed.data.token,
  };
}

async function headOf(bucket: string, path: string): Promise<Uint8Array> {
  const signed = await admin().storage.from(bucket).createSignedUrl(path, 60);
  if (signed.error || !signed.data) return new Uint8Array();
  try {
    const res = await fetch(signed.data.signedUrl, {
      headers: { range: "bytes=0-31" },
      cache: "no-store",
    });
    return res.ok
      ? new Uint8Array(await res.arrayBuffer()).subarray(0, 32)
      : new Uint8Array();
  } catch {
    return new Uint8Array();
  }
}

/**
 * The viewer's own, unexpired, really-uploaded reference images: type matches the bytes, size cap,
 * and they pass image moderation. Checked at run time, right before anything is held or sent.
 */
export async function checkRefs(
  userId: string,
  ids: string[],
): Promise<
  "ok" | "INVALID_REFERENCE" | "SAFETY_BLOCKED" | "MODERATION_UNAVAILABLE"
> {
  if (ids.length === 0) return "ok";
  const db = admin();
  const { data: rows } = await db
    .from("play_refs")
    .select("id, path, mime, delete_after")
    .eq("user_id", userId)
    .in("id", ids);
  if (!rows || rows.length !== ids.length) return "INVALID_REFERENCE";
  for (const r of rows) {
    if (new Date(r.delete_after).getTime() <= Date.now() || !isRefMime(r.mime))
      return "INVALID_REFERENCE";
    const info = await db.storage.from(REFS_BUCKET).info(r.path);
    const size = Number(info.data?.size ?? NaN);
    if (info.error || !(size > 0) || size > MAX_REF_BYTES)
      return "INVALID_REFERENCE";
    if (!sniffMatches(r.mime, await headOf(REFS_BUCKET, r.path)))
      return "INVALID_REFERENCE";
    const signed = await db.storage
      .from(REFS_BUCKET)
      .createSignedUrl(r.path, 60);
    if (signed.error || !signed.data) return "INVALID_REFERENCE";
    const verdict = await checkImage(signed.data.signedUrl);
    if (verdict === "blocked") return "SAFETY_BLOCKED";
    if (verdict === "unavailable") return "MODERATION_UNAVAILABLE";
  }
  return "ok";
}

// ---------------------------------------------------------------- start (F4-2)

export interface StartRunArgs {
  userId: string;
  clientRequestId: string;
  mode: RunMode;
  recipeVersionId: string | null;
  variables: Record<string, string>;
  cells: { model: string; params: Record<string, unknown>; count: number }[];
  priceVersions: Record<string, number>;
  expectedTotal: number;
  referenceIds: string[];
  faceConsent: boolean;
  renderedPrompt: string;
  ipHash: string | null;
  deviceHash: string | null;
}

export type StartRunResult =
  | { ok: true; runId: string; cellIds: string[]; existing: boolean }
  | { ok: false; reason: string; shortfall?: number };

export async function startRun(a: StartRunArgs): Promise<StartRunResult> {
  const { data, error } = await admin().rpc("start_run", {
    p_user: a.userId,
    p_client_request_id: a.clientRequestId,
    p_mode: a.mode,
    // Nullable SQL args: null must be sent (an omitted named arg makes PostgREST miss the function).
    p_recipe_version_id: a.recipeVersionId as string,
    p_variables: a.variables,
    p_cells: a.cells,
    p_price_versions: a.priceVersions,
    p_reference_ids: a.referenceIds,
    p_face_consent: a.faceConsent,
    p_rendered_prompt: a.renderedPrompt,
    p_ip_hash: a.ipHash as string,
    p_device_hash: a.deviceHash as string,
    p_expected_total: a.expectedTotal,
  });
  if (error || !data) {
    console.error("[play] start_run failed", error?.code);
    return { ok: false, reason: "FAILED" };
  }
  const r = data as {
    ok: boolean;
    reason?: string;
    shortfall?: number;
    run_id?: string;
    cell_ids?: string[];
    existing?: boolean;
  };
  if (!r.ok || !r.run_id)
    return { ok: false, reason: r.reason ?? "FAILED", shortfall: r.shortfall };
  return {
    ok: true,
    runId: r.run_id,
    cellIds: r.cell_ids ?? [],
    existing: Boolean(r.existing),
  };
}

// ---------------------------------------------------------------- terminal transitions

async function finish(
  cellId: string,
  status: "succeeded" | "failed" | "blocked" | "canceled" | "expired",
  errorCode: string | null,
  opts: { resultPath?: string; providerBilled?: boolean } = {},
): Promise<boolean> {
  const { data, error } = await admin().rpc("finish_cell", {
    p_cell: cellId,
    p_status: status,
    p_error_code: errorCode ?? undefined,
    p_result_path: opts.resultPath,
    p_provider_billed: opts.providerBilled ?? false,
  });
  if (error) {
    console.error("[play] finish_cell failed", error.code);
    throw new Error("finish_cell");
  }
  return Boolean((data as { finished?: boolean } | null)?.finished);
}

// ---------------------------------------------------------------- submit (F4-3, FM-3/17/21)

interface Claim {
  ok: boolean;
  reason?: string;
  token: string;
  provider: string;
  kind: "image" | "video";
  endpoint: string;
  ref_param: string | null;
  params: Record<string, unknown>;
  user_id: string;
  reference_ids: string[];
}

async function refUrls(
  userId: string,
  ids: string[],
): Promise<string[] | null> {
  if (ids.length === 0) return [];
  const db = admin();
  const { data: rows } = await db
    .from("play_refs")
    .select("id, path")
    .eq("user_id", userId)
    .in("id", ids);
  if (!rows || rows.length !== ids.length) return null;
  const urls: string[] = [];
  for (const id of ids) {
    const row = rows.find((r) => r.id === id)!;
    const s = await db.storage
      .from(REFS_BUCKET)
      .createSignedUrl(row.path, REF_URL_SECONDS);
    if (s.error || !s.data) return null;
    urls.push(s.data.signedUrl);
  }
  return urls;
}

/** Claim → render input → provider submit → submitted / requeued / finished. Safe to call twice. */
export async function submitCell(cellId: string): Promise<void> {
  const db = admin();
  const { data } = await db.rpc("claim_cell_submit", { p_cell: cellId });
  const c = data as Claim | null;
  if (!c?.ok) return;
  const adapter = activeAdapter();
  const base = webhookBase();
  const prompt = await renderedPromptForSubmit(cellId);
  const refs = await refUrls(c.user_id, c.reference_ids ?? []);
  if (!base || !prompt) {
    await db.rpc("requeue_cell", {
      p_cell: cellId,
      p_error_code: "PROVIDER_UNAVAILABLE",
    });
    return;
  }
  if (!refs) {
    await finish(cellId, "failed", "INVALID_REFERENCE");
    return;
  }
  const webhookUrl = `${base}/api/webhooks/generation/${adapter.name}?cell=${cellId}&t=${c.token}`;
  const input = buildInput({
    kind: c.kind,
    prompt,
    params: c.params,
    refParam: c.ref_param,
    refUrls: refs,
  });

  let requestId: string | null = null;
  for (let attempt = 0; attempt < 2 && !requestId; attempt++) {
    try {
      requestId = (await adapter.submit({ endpoint: c.endpoint, input, webhookUrl })).requestId;
    } catch (e) {
      const failure = e instanceof ProviderSubmitError ? e.failure : "unknown";
      if (failure === "transient" && attempt === 0) continue; // one immediate retry on a definite 5xx
      if (failure === "safety_blocked") await finish(cellId, "blocked", "SAFETY_BLOCKED");
      else if (failure === "invalid_input") await finish(cellId, "failed", "INVALID_INPUT");
      // The job may exist at the provider: never resubmit it (no double billing). It counts as spent.
      else if (failure === "unknown")
        await finish(cellId, "failed", "PROVIDER_ERROR", { providerBilled: true });
      else await db.rpc("requeue_cell", { p_cell: cellId, p_error_code: "PROVIDER_BUSY" });
      return;
    }
  }
  if (!requestId) return;
  const { data: marked } = await db.rpc("mark_cell_submitted", {
    p_cell: cellId,
    p_provider_request_id: requestId,
  });
  // The cell ended meanwhile (sweeper / duplicate): the provider job is not wanted.
  if (marked === false) await adapter.cancel(c.endpoint, requestId);
}

// ---------------------------------------------------------------- finalize (F4-4/5/7, FM-4~7/12/13)

function resultMime(bytes: Uint8Array, declared: string): MediaMime | null {
  const candidates = Object.keys(RESULT_EXT) as MediaMime[];
  if (candidates.includes(declared as MediaMime) && sniffMatches(declared as MediaMime, bytes))
    return declared as MediaMime;
  return candidates.find((m) => sniffMatches(m, bytes)) ?? null;
}

export interface CellRef {
  cellId: string;
  userId: string;
  kind: "image" | "video";
}

/** A temporary failure while finalizing: the provider resends (webhook 5xx) or the sweeper retries. */
export class RetryLater extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const logError = (where: string, e: unknown) =>
  // Class name only: provider messages can carry response text (hidden-content rule 4).
  console.error(`[play] ${where}`, e instanceof Error ? e.name : "error");

/**
 * Apply a provider outcome to one cell. A temporary problem (download, storage, moderation down)
 * throws RetryLater unless `final` — then the cell fails, credits return, the budget counts it.
 */
export async function applyOutcome(
  cell: CellRef,
  outcome: ProviderOutcome,
  adapter: ProviderAdapter,
  opts: { final: boolean },
): Promise<void> {
  if (outcome.state === "pending") return;
  if (outcome.state === "safety_blocked") {
    await finish(cell.cellId, "blocked", "SAFETY_BLOCKED", { providerBilled: true });
    return;
  }
  if (outcome.state === "failed") {
    await finish(cell.cellId, "failed", outcome.code, { providerBilled: outcome.code === "OUTPUT_LOST" });
    return;
  }
  const temporary = async (code: string) => {
    if (!opts.final) throw new RetryLater(code);
    await finish(cell.cellId, "failed", code, { providerBilled: true });
  };

  const url = outcome.outputs[0];
  const file = await adapter.fetchOutput(url, MAX_RESULT_BYTES);
  if (!file) return temporary("OUTPUT_LOST");
  const mime = resultMime(file.bytes.subarray(0, 32), file.contentType);
  if (!mime || (mime.startsWith("video/") ? "video" : "image") !== cell.kind) {
    await finish(cell.cellId, "failed", "OUTPUT_LOST", { providerBilled: true });
    return;
  }
  const db = admin();
  const path = `${cell.userId}/${cell.cellId}.${RESULT_EXT[mime]}`;
  // Provider bytes stored as-is (C2PA / SynthID survive, F4-9).
  const up = await db.storage.from(RESULTS_BUCKET).upload(path, file.bytes, { contentType: mime, upsert: true });
  if (up.error) return temporary("STORAGE_FAILED");

  let verdict: "pass" | "blocked" | "unavailable" = "pass";
  if (adapter.name === "mock") verdict = mockOutputBlocked(url) ? "blocked" : "pass";
  else if (cell.kind === "image") {
    const s = await db.storage.from(RESULTS_BUCKET).createSignedUrl(path, 120);
    verdict = s.error || !s.data ? "unavailable" : await checkImage(s.data.signedUrl);
  }

  // Settle first, clean up after: a losing duplicate never removes the winner's file.
  const keepIfWinner = async () => {
    const { data: now } = await db.from("play_cells").select("status, result_path").eq("id", cell.cellId).maybeSingle();
    if (!(now?.status === "succeeded" && now.result_path === path))
      await db.storage.from(RESULTS_BUCKET).remove([path]);
  };
  if (verdict === "unavailable") {
    if (!opts.final) {
      await keepIfWinner();
      throw new RetryLater("MODERATION_UNAVAILABLE");
    }
    await finish(cell.cellId, "failed", "MODERATION_UNAVAILABLE", { providerBilled: true });
    await keepIfWinner();
    return;
  }
  if (verdict === "blocked") {
    await finish(cell.cellId, "blocked", "RESULT_BLOCKED", { providerBilled: true });
    await keepIfWinner();
    return;
  }
  if (!(await finish(cell.cellId, "succeeded", null, { resultPath: path }))) await keepIfWinner();
}

// ---------------------------------------------------------------- webhook (F4-4, FM-9/10/11)

/** Provider endpoint a cell was submitted to (reference runs use the edit / image-to-video one). */
async function cellEndpoint(cellId: string): Promise<string | null> {
  const { data } = await admin()
    .from("play_cells")
    .select("models!inner(endpoint, ref_endpoint), play_runs!inner(reference_ids)")
    .eq("id", cellId)
    .maybeSingle();
  const row = data as {
    models?: { endpoint: string; ref_endpoint: string | null };
    play_runs?: { reference_ids: string[] };
  } | null;
  if (!row?.models) return null;
  return (row.play_runs?.reference_ids?.length ?? 0) > 0 && row.models.ref_endpoint
    ? row.models.ref_endpoint
    : row.models.endpoint;
}

export type WebhookVerdict = 200 | 401 | 404 | 500;

/**
 * Raw-body signature first, then the per-cell token, then the event. 2xx only after the cell state
 * is stored (a 5xx makes the provider resend). Videos are acknowledged once running and finalized
 * in `later` (the provider's first delivery times out in ~15 s); if that fails, the sweeper polls.
 */
export async function handleWebhook(args: {
  provider: string;
  cellId: string | null;
  token: string | null;
  headers: Headers;
  rawBody: string;
  later: (task: () => Promise<void>) => void;
}): Promise<WebhookVerdict> {
  const adapter = adapterFor(args.provider);
  if (!adapter) return 404;
  if (!(await adapter.verifyWebhook(args.headers, args.rawBody))) {
    console.warn("[play] webhook signature rejected", args.provider);
    return 401;
  }
  if (!args.cellId || !args.token) return 401;
  const db = admin();
  const { data: v } = await db.rpc("verify_cell_token", {
    p_cell: args.cellId,
    p_token: args.token,
  });
  const cell = v as {
    ok: boolean;
    status?: string;
    provider_request_id?: string | null;
    user_id?: string;
    kind?: "image" | "video";
  } | null;
  if (!cell?.ok || !cell.user_id || !cell.kind) return 401;

  const event = adapter.parseEvent(args.rawBody);
  if (!event) return 200; // not an event we act on
  if (cell.provider_request_id && cell.provider_request_id !== event.requestId) return 200; // older attempt
  if (!["queued", "submitted", "running"].includes(cell.status ?? "")) return 200; // already settled
  if (!cell.provider_request_id)
    await db.rpc("attach_provider_request", {
      p_cell: args.cellId,
      p_provider_request_id: event.requestId,
    });

  const ref: CellRef = { cellId: args.cellId, userId: cell.user_id, kind: cell.kind };
  try {
    let outcome = event.outcome;
    if (outcome.state === "pending") {
      // "OK" without an inline payload (large results): look the result up.
      const endpoint = await cellEndpoint(args.cellId);
      outcome = endpoint ? await adapter.poll(endpoint, event.requestId) : outcome;
    }
    if (outcome.state === "pending") {
      await db.rpc("mark_cell_running", { p_cell: args.cellId });
    } else if (cell.kind === "video" && outcome.state === "succeeded") {
      // Large file: acknowledge now, finalize after the response. If that fails the sweeper polls.
      await db.rpc("mark_cell_running", { p_cell: args.cellId });
      const done = outcome;
      args.later(async () => {
        await applyOutcome(ref, done, adapter, { final: false }).catch((e) => logError("video finalize", e));
      });
    } else {
      await applyOutcome(ref, outcome, adapter, { final: false });
    }
    await db.rpc("record_webhook_event", {
      p_provider: adapter.name,
      p_event_key: event.requestId,
      p_cell: args.cellId,
    });
    return 200;
  } catch (e) {
    if (!(e instanceof RetryLater)) logError("webhook finalize", e);
    return 500; // the provider resends; after its retries, the sweeper polls
  }
}

// ---------------------------------------------------------------- sweeper (FM-7/8/17/21, D19)

interface SweepTargets {
  finish: { cell: string; status: "failed" | "expired"; error_code: string }[];
  resubmit: string[];
  poll: { cell: string; provider_request_id: string | null; endpoint: string; deadline_at: string }[];
  expired_refs: { id: string; path: string }[];
  expired_results: { id: string; path: string }[];
}

export interface SweepReport {
  skipped: boolean;
  finished: number;
  resubmitted: number;
  polled: number;
  purgedRefs: number;
  purgedResults: number;
}

/** After this long past the deadline a temporary finalize problem fails the cell (credits back). */
const FINAL_AFTER_MS = 6 * 3600 * 1000;

async function cellForPoll(cellId: string) {
  const { data } = await admin()
    .from("play_cells")
    .select("user_id, provider_request_id, deadline_at, models!inner(kind)")
    .eq("id", cellId)
    .maybeSingle();
  const r = data as {
    user_id: string;
    provider_request_id: string | null;
    deadline_at: string | null;
    models?: { kind: "image" | "video" };
  } | null;
  return r?.models ? { ...r, kind: r.models.kind } : null;
}

/**
 * One minute of sweeper work (one run per minute window, claim_play_sweep). Each cell is handled
 * in its own calls; the loop stops near the time budget and the rest waits for the next minute.
 */
export async function sweep(budgetMs = 40_000): Promise<SweepReport> {
  const started = Date.now();
  const left = () => Date.now() - started < budgetMs;
  const db = admin();
  const report: SweepReport = {
    skipped: false,
    finished: 0,
    resubmitted: 0,
    polled: 0,
    purgedRefs: 0,
    purgedResults: 0,
  };
  const { data: claimed } = await db.rpc("claim_play_sweep");
  if (claimed !== true) return { ...report, skipped: true };
  const { data, error } = await db.rpc("sweep_targets");
  if (error || !data) throw new Error("sweep_targets");
  const t = data as unknown as SweepTargets;
  const adapter = activeAdapter();

  for (const f of t.finish) {
    if (!left()) break;
    try {
      if (f.status === "expired") {
        // FM-7: one last lookup, then cancel at the provider; a job that reached it counts as spent.
        const c = await cellForPoll(f.cell);
        const endpoint = await cellEndpoint(f.cell);
        if (c?.provider_request_id && endpoint) {
          const outcome = await adapter.poll(endpoint, c.provider_request_id).catch(() => null);
          if (outcome && outcome.state !== "pending") {
            await applyOutcome({ cellId: f.cell, userId: c.user_id, kind: c.kind }, outcome, adapter, {
              final: true,
            });
            report.finished++;
            continue;
          }
          await adapter.cancel(endpoint, c.provider_request_id);
        }
        if (await finish(f.cell, "expired", "TIMEOUT", { providerBilled: Boolean(c?.provider_request_id) }))
          report.finished++;
      } else if (await finish(f.cell, f.status, f.error_code)) report.finished++;
    } catch (e) {
      logError("sweep finish", e);
    }
  }
  for (const id of t.resubmit) {
    if (!left()) break;
    try {
      await submitCell(id);
      report.resubmitted++;
    } catch (e) {
      logError("resubmit", e);
    }
  }
  for (const p of t.poll) {
    if (!left()) break;
    if (!p.provider_request_id) continue;
    const c = await cellForPoll(p.cell);
    if (!c) continue;
    const outcome = await adapter.poll(p.endpoint, p.provider_request_id).catch(() => null);
    if (!outcome) continue;
    const final = Date.now() - new Date(p.deadline_at).getTime() > FINAL_AFTER_MS;
    try {
      await applyOutcome({ cellId: p.cell, userId: c.user_id, kind: c.kind }, outcome, adapter, { final });
      report.polled++;
    } catch (e) {
      if (!(e instanceof RetryLater)) logError("poll finalize", e);
    }
  }

  // D19 / F4-8: remove files first, then forget only the ones actually removed.
  const refIds: string[] = [];
  if (t.expired_refs.length) {
    const r = await db.storage.from(REFS_BUCKET).remove(t.expired_refs.map((x) => x.path));
    if (!r.error) refIds.push(...t.expired_refs.map((x) => x.id));
  }
  const cellIds: string[] = [];
  if (t.expired_results.length) {
    const r = await db.storage.from(RESULTS_BUCKET).remove(t.expired_results.map((x) => x.path));
    if (!r.error) cellIds.push(...t.expired_results.map((x) => x.id));
  }
  if (refIds.length || cellIds.length) {
    await db.rpc("purge_play_files", { p_ref_ids: refIds, p_cell_ids: cellIds });
    report.purgedRefs = refIds.length;
    report.purgedResults = cellIds.length;
  }
  return report;
}
