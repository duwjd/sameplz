import { NextResponse, type NextRequest } from "next/server";
import { checkRefs, recipeTemplate, startRun, submitCell } from "@/data/play";
import { deviceHash, ipHash } from "@/lib/abuse/fingerprint";
import { getViewer } from "@/lib/auth/account";
import {
  checkVariables,
  MAX_RENDERED_CHARS,
  renderPrompt,
} from "@/lib/generation/input";
import { checkRunText } from "@/lib/moderation/play";
import { createAdminClient } from "@/lib/supabase/admin";
import { RUN_ERROR_STATUS, RunRequestSchema } from "@/lib/validation/play";

const MAX_BODY = 32 * 1024;

function fail(code: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error: code, ...extra },
    {
      status: RUN_ERROR_STATUS[code] ?? 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/**
 * PLAY-04 / F4-2: start a run. zod → verified claims → mode + variables → input moderation →
 * server-side render → start_run (all checks and holds in SQL) → provider fan-out.
 * The response carries ids only: never the prompt, the template or provider objects.
 */
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY)
    return fail("INVALID_REQUEST");
  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail("INVALID_REQUEST");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail("INVALID_REQUEST");
  }
  const parsed = RunRequestSchema.safeParse(json);
  if (!parsed.success) return fail("INVALID_REQUEST");
  const req = parsed.data;

  const viewer = await getViewer();
  if (!viewer) return fail("LOGIN_REQUIRED");
  if (!viewer.signupComplete) return fail("SIGNUP_INCOMPLETE");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return fail("FAILED");
  // Cheap gate before the costly checks (suspended, AI notice, 10 attempts/min).
  const { data: gate, error: gateError } = await createAdminClient().rpc("play_precheck", {
    p_user: viewer.id,
  });
  if (gateError) return fail("FAILED");
  if (gate) return fail(gate);

  // Mode and variables (PLAY-01/02). Blank mode sends the user's own prompt.
  let rendered: string;
  let moderated: string[];
  if (req.mode === "blank") {
    rendered = req.prompt.trim();
    moderated = [rendered];
  } else {
    const t = await recipeTemplate(viewer.id, req.mode, req.recipeVersionId!);
    if (!t) return fail("NOT_ENTITLED");
    const errors = checkVariables(t.variables, req.variables);
    if (errors.length) return fail("INVALID_VARIABLES", { fields: errors });
    rendered = renderPrompt(t.template, req.variables);
    // The whole rendered prompt: the recipe body too (an own recipe may not have passed review).
    moderated = [rendered];
  }
  if (rendered.length > MAX_RENDERED_CHARS) return fail("INVALID_VARIABLES");

  // F4-7: input text, then reference images, before anything is held.
  const verdict = await checkRunText(moderated);
  if (verdict === "unavailable") return fail("MODERATION_UNAVAILABLE");
  if (verdict === "blocked") {
    await createAdminClient().rpc("record_play_input_block", {
      p_user: viewer.id,
    });
    return fail("SAFETY_BLOCKED");
  }
  const refs = await checkRefs(viewer.id, req.referenceIds);
  if (refs !== "ok") {
    if (refs === "SAFETY_BLOCKED")
      await createAdminClient().rpc("record_play_input_block", {
        p_user: viewer.id,
      });
    return fail(refs);
  }

  const runIp = await ipHash(secret);
  const runDevice = await deviceHash(secret);
  const started = await startRun({
    userId: viewer.id,
    clientRequestId: req.clientRequestId,
    mode: req.mode,
    recipeVersionId: req.recipeVersionId,
    variables: req.mode === "blank" ? {} : req.variables,
    cells: req.cells,
    priceVersions: req.priceVersions,
    expectedTotal: req.expectedTotal,
    referenceIds: req.referenceIds,
    faceConsent: req.faceConsent,
    renderedPrompt: rendered,
    ipHash: runIp,
    deviceHash: runDevice,
  });
  if (!started.ok)
    return fail(
      started.reason,
      started.shortfall ? { shortfall: started.shortfall } : {},
    );

  // Fan out (F4-3). A repeated client_request_id returns the existing run without resubmitting;
  // anything left queued is picked up by the sweeper.
  // F4-11: a blank run keeps the user's own prompt so a result can become an upload draft.
  if (!started.existing && req.mode === "blank")
    await createAdminClient().rpc("set_run_prompt_text", {
      p_run: started.runId,
      p_user: viewer.id,
      p_text: rendered,
    });
  if (!started.existing) {
    // D13 linked accounts: the device that generates is recorded too (hashes only).
    await createAdminClient()
      .rpc("record_member_device", {
        p_user: viewer.id,
        p_device_hash: runDevice,
        p_ip_hash: runIp as string,
      })
      .then(
        () => null,
        () => null,
      );
    await Promise.allSettled(started.cellIds.map((id) => submitCell(id)));
  }

  return NextResponse.json(
    {
      runId: started.runId,
      cellIds: started.cellIds,
      existing: started.existing,
    },
    {
      status: started.existing ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
