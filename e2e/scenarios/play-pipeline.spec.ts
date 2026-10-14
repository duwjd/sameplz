// W5 gate (F4-2~5, F4-7, F4-15, F4-16): POST /api/play/runs → mock provider → webhook → settle, with
// the failure matrix rows that the API path decides. The /play screen comes with PR G.
import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  adminDb,
  available,
  CHEAP,
  callSweeper,
  cellRow,
  loginAsPlayer,
  mockSign,
  runBody,
  waitTerminal,
} from "../fixtures/play";

test.describe.configure({ mode: "serial" }); // the budget test pauses the shared monthly budget

const kstMonth = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

test("F4-2 a blank run is held, generated, stored and captured once", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  const res = await context.request.post("/api/play/runs", { data: runBody() });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.cellIds).toHaveLength(1);
  const cell = await waitTerminal(body.cellIds[0]);
  expect(cell.status).toBe("succeeded");
  expect(cell.result_path).toBe(`${user.id}/${cell.id}.png`);
  expect(await available(user.id)).toBe(270 - CHEAP.credits);
  // The stored prompt is gone once every cell is terminal; the response never carried it.
  expect(JSON.stringify(body)).not.toContain("등대");
});

test("FM-18 the same clientRequestId returns the existing run without a second hold", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  const data = runBody();
  const first = await context.request.post("/api/play/runs", { data });
  expect(first.status()).toBe(201);
  const again = await context.request.post("/api/play/runs", { data });
  expect(again.status()).toBe(200);
  const [a, b] = [await first.json(), await again.json()];
  expect(b).toMatchObject({ runId: a.runId, existing: true });
  await waitTerminal(a.cellIds[0]);
  expect(await available(user.id)).toBe(270 - CHEAP.credits);
});

test("FM-5 a model error returns the credits", async ({ context }) => {
  const user = await loginAsPlayer(context);
  const res = await context.request.post("/api/play/runs", {
    data: runBody({ prompt: "실패 시험 [[mock:error]]" }),
  });
  expect(res.status()).toBe(201);
  const cell = await waitTerminal((await res.json()).cellIds[0]);
  expect(cell).toMatchObject({
    status: "failed",
    error_code: "MODEL_ERROR",
    result_path: null,
  });
  expect(await available(user.id)).toBe(270);
});

test("FM-4 a provider safety block charges nothing and records a signal", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  const res = await context.request.post("/api/play/runs", {
    data: runBody({ prompt: "차단 시험 [[mock:safety]]" }),
  });
  const cell = await waitTerminal((await res.json()).cellIds[0]);
  expect(cell).toMatchObject({
    status: "blocked",
    error_code: "SAFETY_BLOCKED",
  });
  expect(await available(user.id)).toBe(270);
  const { count } = await adminDb()
    .from("abuse_signals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", "moderation_block");
  expect(count).toBe(1);
});

test("FM-6 a result that fails our output check is removed, refunded, and still spends the budget", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  const db = adminDb();
  const before = (
    await db
      .from("generation_budget")
      .select("spent")
      .eq("month", kstMonth())
      .single()
  ).data!.spent as number;
  const res = await context.request.post("/api/play/runs", {
    data: runBody({ prompt: "결과 차단 시험 [[mock:result-block]]" }),
  });
  const cell = await waitTerminal((await res.json()).cellIds[0]);
  expect(cell).toMatchObject({
    status: "blocked",
    error_code: "RESULT_BLOCKED",
    result_path: null,
  });
  expect(await available(user.id)).toBe(270);
  const after = (
    await db
      .from("generation_budget")
      .select("spent")
      .eq("month", kstMonth())
      .single()
  ).data!.spent as number;
  expect(after - before).toBeGreaterThanOrEqual(CHEAP.credits);
  const listed = await db.storage.from("play-results").list(user.id);
  expect(listed.data ?? []).toHaveLength(0);
});

test("FM-21 a provider 429 keeps the cell queued; the sweeper fails it later and returns the credits", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  const res = await context.request.post("/api/play/runs", {
    data: runBody({ prompt: "대기 시험 [[mock:rate]]" }),
  });
  expect(res.status()).toBe(201);
  const id = (await res.json()).cellIds[0];
  const queued = await cellRow(id);
  expect(queued).toMatchObject({
    status: "queued",
    error_code: "PROVIDER_BUSY",
  });
  expect(await available(user.id)).toBe(270 - CHEAP.credits);

  // Age the cell past the 10-minute window with its lease over, then run the sweeper.
  const db = adminDb();
  const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  await db
    .from("play_cells")
    .update({ created_at: old, next_attempt_at: old })
    .eq("id", id);
  const swept = await callSweeper(context.request);
  expect(swept.status()).toBe(200);
  expect(await cellRow(id)).toMatchObject({
    status: "failed",
    error_code: "PROVIDER_UNAVAILABLE",
  });
  expect(await available(user.id)).toBe(270);
});

test("F4-1 a changed quote is refused with 409 and nothing is held", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  const res = await context.request.post("/api/play/runs", {
    data: runBody({ expectedTotal: 10 }),
  });
  expect(res.status()).toBe(409);
  expect(await res.json()).toEqual({ error: "PRICE_CHANGED" });
  const v2 = await context.request.post("/api/play/runs", {
    data: runBody({ priceVersions: { [CHEAP.model]: 2 } }),
  });
  expect(v2.status()).toBe(409);
  expect(await available(user.id)).toBe(270);
});

test("F4-7 blocked input text is refused before any hold", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  const res = await context.request.post("/api/play/runs", {
    data: runBody({ prompt: "입력 차단 [[mock:block]]" }),
  });
  expect(res.status()).toBe(422);
  expect(await res.json()).toEqual({ error: "SAFETY_BLOCKED" });
  const { count } = await adminDb()
    .from("play_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  expect(count).toBe(0);
  expect(await available(user.id)).toBe(270);
});

test("F4-16 a cell over the 135C daily limit is refused (DAILY_LIMIT)", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  // GPT Image 2 high 1024² = ceil(0.211 × 805) = 170C.
  const res = await context.request.post("/api/play/runs", {
    data: runBody({
      cells: [{ model: "gpt-image-2", params: { quality: "high" }, count: 1 }],
      priceVersions: { "gpt-image-2": 1 },
      expectedTotal: 170,
    }),
  });
  expect(res.status()).toBe(403);
  expect(await res.json()).toEqual({ error: "DAILY_LIMIT" });
  expect(await available(user.id)).toBe(270);
});

test("F4-2 free mode renders the received recipe on the server; the original never comes back", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  const db = adminDb();
  const recipe = "aaaaaaaa-0000-0000-0000-000000000004";
  const version = "bbbbbbbb-0000-0000-0000-000000000004";
  const granted = await db
    .from("entitlements")
    .insert({
      user_id: user.id,
      recipe_id: recipe,
      version_id: version,
      source: "free",
    });
  expect(granted.error).toBeNull();

  const missing = await context.request.post("/api/play/runs", {
    data: runBody({
      mode: "free",
      recipeVersionId: version,
      prompt: "",
      variables: {},
    }),
  });
  expect(missing.status()).toBe(400);
  expect((await missing.json()).error).toBe("INVALID_VARIABLES");

  const res = await context.request.post("/api/play/runs", {
    data: runBody({
      mode: "free",
      recipeVersionId: version,
      prompt: "",
      variables: { 변수: "텀블러" },
    }),
  });
  expect(res.status()).toBe(201);
  const text = await res.text();
  expect(text).not.toContain("SAMEPLZ-SECRET-SAMPLE");
  const cell = await waitTerminal(JSON.parse(text).cellIds[0]);
  expect(cell.status).toBe("succeeded");

  const other = await context.request.post("/api/play/runs", {
    data: runBody({
      mode: "free",
      recipeVersionId: "bbbbbbbb-0000-0000-0000-000000000005",
      prompt: "",
      variables: { 변수: "x" },
    }),
  });
  expect(other.status()).toBe(404);
  expect(await other.text()).not.toContain("SAMEPLZ-SECRET-SAMPLE");
});

test("F4-15 the kill switch: a paused budget refuses runs (BUDGET_EXHAUSTED)", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  const db = adminDb();
  const month = kstMonth();
  await db
    .from("generation_budget")
    .update({ state: "paused" })
    .eq("month", month);
  try {
    const res = await context.request.post("/api/play/runs", {
      data: runBody(),
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ error: "BUDGET_EXHAUSTED" });
    expect(await available(user.id)).toBe(270);
  } finally {
    await db
      .from("generation_budget")
      .update({ state: "open" })
      .eq("month", month);
  }
});

test("FM-9 the same webhook delivered twice settles once and keeps the result", async ({ context, request }) => {
  const user = await loginAsPlayer(context);
  const res = await context.request.post("/api/play/runs", { data: runBody() });
  const id = (await res.json()).cellIds[0];
  const done = await waitTerminal(id);
  expect(done.status).toBe("succeeded");
  const db = adminDb();
  const { data: row } = await db.from("play_cells").select("provider_request_id").eq("id", id).single();
  // Only the token hash is stored: give the cell a known token to replay the provider's event.
  const token = randomUUID();
  await db
    .from("play_cells")
    .update({ webhook_token_hash: createHash("sha256").update(token).digest("hex") })
    .eq("id", id);
  const body = JSON.stringify({
    request_id: row!.provider_request_id,
    status: "OK",
    payload: { url: "mock://image/ok/x" },
  });
  const again = await request.post(`/api/webhooks/generation/mock?cell=${id}&t=${token}`, {
    data: body,
    headers: { "content-type": "application/json", "x-mock-signature": mockSign(body) },
  });
  expect(again.status()).toBe(200);
  const wrong = await request.post(`/api/webhooks/generation/mock?cell=${id}&t=not-the-token`, {
    data: body,
    headers: { "content-type": "application/json", "x-mock-signature": mockSign(body) },
  });
  expect(wrong.status()).toBe(401);
  expect(await cellRow(id)).toMatchObject({ status: "succeeded", result_path: done.result_path });
  expect(await available(user.id)).toBe(270 - CHEAP.credits);
  const listed = await db.storage.from("play-results").list(user.id);
  expect((listed.data ?? []).map((f) => f.name)).toContain(`${id}.png`);
});

test("FM-7 a cell long past its deadline is looked up, cancelled and expired; the credits come back", async ({
  context,
}) => {
  const user = await loginAsPlayer(context);
  const res = await context.request.post("/api/play/runs", {
    data: runBody({ prompt: "시간 초과 시험 [[mock:timeout]]" }),
  });
  const id = (await res.json()).cellIds[0];
  expect((await cellRow(id)).status).toBe("submitted");
  expect(await available(user.id)).toBe(270 - CHEAP.credits);
  const db = adminDb();
  const before = (await db.from("generation_budget").select("spent").eq("month", kstMonth()).single()).data!
    .spent as number;
  await db
    .from("play_cells")
    .update({ deadline_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString() })
    .eq("id", id);
  expect((await callSweeper(context.request)).status()).toBe(200);
  expect(await cellRow(id)).toMatchObject({ status: "expired", error_code: "TIMEOUT" });
  expect(await available(user.id)).toBe(270);
  // It reached the provider, so the budget still counts it (D12).
  const after = (await db.from("generation_budget").select("spent").eq("month", kstMonth()).single()).data!
    .spent as number;
  expect(after - before).toBeGreaterThanOrEqual(CHEAP.credits);
});

test.describe("EX", () => {
  test("PLAY guest gets 401 LOGIN_REQUIRED", async ({ request }) => {
    const res = await request.post("/api/play/runs", { data: runBody() });
    expect(res.status()).toBe(401);
  });

  test("FM-11 webhooks with a bad signature or token are refused", async ({
    context,
    request,
  }) => {
    await loginAsPlayer(context);
    const res = await context.request.post("/api/play/runs", {
      data: runBody({ prompt: "웹훅 시험 [[mock:timeout]]" }),
    });
    const id = (await res.json()).cellIds[0];
    const body = JSON.stringify({
      request_id: "mock-ok-image-00000000-0000-0000-0000-000000000000",
      status: "OK",
    });
    const unsigned = await request.post(
      `/api/webhooks/generation/mock?cell=${id}&t=x`,
      {
        data: body,
        headers: {
          "content-type": "application/json",
          "x-mock-signature": "0".repeat(64),
        },
      },
    );
    expect(unsigned.status()).toBe(401);
    const fal = await request.post(
      `/api/webhooks/generation/fal?cell=${id}&t=x`,
      { data: body },
    );
    expect(fal.status()).toBe(404); // inactive provider
    expect((await cellRow(id)).status).toBe("submitted");
  });

  test("PLAY cron needs the shared secret", async ({ request }) => {
    expect((await request.post("/api/cron/play-sweeper")).status()).toBe(401);
    expect(
      (
        await request.post("/api/cron/play-sweeper", {
          headers: { authorization: "Bearer wrong" },
        })
      ).status(),
    ).toBe(401);
  });
});
