// W5 gate (F4-2~5, F4-7, F4-15, F4-16): POST /api/play/runs → mock provider → webhook → settle, with
// the failure matrix rows that the API path decides, then the /play screen and /my/credits.
import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
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
  const granted = await db.from("entitlements").insert({
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
      variables: {
        상품명: "텀블러",
        "장점 3개": "가볍고 튼튼함",
        말투: "친근하게",
      },
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

test("FM-9 the same webhook delivered twice settles once and keeps the result", async ({
  context,
  request,
}) => {
  const user = await loginAsPlayer(context);
  const res = await context.request.post("/api/play/runs", { data: runBody() });
  const id = (await res.json()).cellIds[0];
  const done = await waitTerminal(id);
  expect(done.status).toBe("succeeded");
  const db = adminDb();
  const { data: row } = await db
    .from("play_cells")
    .select("provider_request_id")
    .eq("id", id)
    .single();
  // Only the token hash is stored: give the cell a known token to replay the provider's event.
  const token = randomUUID();
  await db
    .from("play_cells")
    .update({
      webhook_token_hash: createHash("sha256").update(token).digest("hex"),
    })
    .eq("id", id);
  const body = JSON.stringify({
    request_id: row!.provider_request_id,
    status: "OK",
    payload: { url: "mock://image/ok/x" },
  });
  const again = await request.post(
    `/api/webhooks/generation/mock?cell=${id}&t=${token}`,
    {
      data: body,
      headers: {
        "content-type": "application/json",
        "x-mock-signature": mockSign(body),
      },
    },
  );
  expect(again.status()).toBe(200);
  const wrong = await request.post(
    `/api/webhooks/generation/mock?cell=${id}&t=not-the-token`,
    {
      data: body,
      headers: {
        "content-type": "application/json",
        "x-mock-signature": mockSign(body),
      },
    },
  );
  expect(wrong.status()).toBe(401);
  expect(await cellRow(id)).toMatchObject({
    status: "succeeded",
    result_path: done.result_path,
  });
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
  const before = (
    await db
      .from("generation_budget")
      .select("spent")
      .eq("month", kstMonth())
      .single()
  ).data!.spent as number;
  await db
    .from("play_cells")
    .update({
      deadline_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    })
    .eq("id", id);
  expect((await callSweeper(context.request)).status()).toBe(200);
  expect(await cellRow(id)).toMatchObject({
    status: "expired",
    error_code: "TIMEOUT",
  });
  expect(await available(user.id)).toBe(270);
  // It reached the provider, so the budget still counts it (D12).
  const after = (
    await db
      .from("generation_budget")
      .select("spent")
      .eq("month", kstMonth())
      .single()
  ).data!.spent as number;
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

// ---------------------------------------------------------------- PLAY screen (PLAY-01~07, CRD)
// Same file as the API rows: every test that generates or touches the shared budget runs serially.

const model = (page: Page, name: RegExp) =>
  page.getByRole("checkbox", { name }).filter({ visible: true });
const runButton = (page: Page) =>
  page.locator("#play-run").filter({ visible: true });

test.describe("PLAY screen", () => {
  test("PLAY guest is asked to log in", async ({ page }) => {
    await page.goto("/play");
    await expect(
      page
        .getByText("로그인하면 바로 만들어 볼 수 있어요")
        .filter({ visible: true }),
    ).toBeVisible();
  });

  test("PLAY-04 PLAY-05 a blank prompt run shows the AI notice, the quote, the result and the credit history", async ({
    page,
    context,
  }) => {
    const player = await loginAsPlayer(context);
    // The fixture acknowledged the notice; reset it so the first-run popup shows (F4-9).
    await adminDb()
      .from("profiles")
      .update({ ai_notice_ack_at: null })
      .eq("id", player.id);

    await page.goto("/play");
    await expect(
      page.getByTestId("play-balance").filter({ visible: true }),
    ).toHaveText("270C");
    await page
      .getByLabel("프롬프트")
      .filter({ visible: true })
      .fill("푸른 바다 위 등대, 수채화");
    await model(page, /^GPT Image 2\.5 Flare/).click();
    await expect(runButton(page)).toHaveText("만들기 · 11C");
    await runButton(page).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("이 화면의 결과물은 생성형 AI로 만들었어요"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "확인하고 만들기" }).click();

    const result = page
      .getByRole("figure", { name: "GPT Image 2.5 Flare 결과" })
      .filter({ visible: true })
      .first();
    await expect(
      result.getByRole("img", { name: /AI 생성 이미지/ }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(result.getByText("AI 생성", { exact: true })).toBeVisible();
    await expect(
      page.getByTestId("play-balance").filter({ visible: true }),
    ).toHaveText("259C");

    await result.getByRole("button", { name: "저장" }).click();
    await expect(
      result.getByRole("button", { name: "저장됨" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.goto("/my/credits");
    await expect(
      page.getByTestId("crd-available").filter({ visible: true }),
    ).toHaveText("259C");
    await expect(
      page.getByText("플레이그라운드 사용").filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText("-11C").filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText("이번 달 무료 크레딧").filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test("FM-5 a model error shows the refund in the cell", async ({
    page,
    context,
  }) => {
    await loginAsPlayer(context);
    await page.goto("/play");
    await page
      .getByLabel("프롬프트")
      .filter({ visible: true })
      .fill("실패 시험 [[mock:error]]");
    await model(page, /^GPT Image 2\.5 Flare/).click();
    await runButton(page).click();
    await expect(
      page
        .getByText("모델 오류로 만들지 못했어요 · 11C를 돌려드렸어요")
        .filter({ visible: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId("play-balance").filter({ visible: true }),
    ).toHaveText("270C");
  });

  test("F2-5 PLAY-02 the detail button opens the received recipe; empty [변수] is caught under the field", async ({
    page,
    context,
  }) => {
    const user = await loginAsPlayer(context);
    await adminDb().from("entitlements").insert({
      user_id: user.id,
      recipe_id: "aaaaaaaa-0000-0000-0000-000000000004",
      version_id: "bbbbbbbb-0000-0000-0000-000000000004",
      source: "free",
    });
    await page.goto("/r/rdetailcopy");
    await page
      .getByRole("button", { name: "바로 만들어 보기" })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/play\?recipe=rdetailcopy$/);
    await expect(
      page.getByText("받은 무료 레시피").filter({ visible: true }),
    ).toBeVisible();

    await model(page, /^GPT Image 2\.5 Flare/).click();
    await runButton(page).click();
    const field = page.getByLabel("[상품명]").filter({ visible: true });
    await expect(
      page
        .getByText(/\[상품명\]을\(를\) 채워 주세요/)
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    // hidden-content: the playground page never carries the original.
    expect(await page.content()).not.toContain("SAMEPLZ-SECRET-SAMPLE");

    await page
      .getByRole("button", { name: "예시로 채우기" })
      .filter({ visible: true })
      .click();
    await expect(field).toHaveValue("저자극 수분크림");
    await runButton(page).click();
    await expect(
      page
        .getByRole("img", {
          name: /GPT Image 2\.5 Flare로 만든 AI 생성 이미지/,
        })
        .filter({ visible: true })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("F4-16 a model whose cheapest setting is over the daily limit cannot be picked", async ({
    page,
    context,
  }) => {
    await loginAsPlayer(context);
    await page.goto("/play");
    const kling = model(page, /^Kling 3 Standard/);
    await expect(kling).toHaveAttribute("aria-disabled", "true");
    await expect(kling).toContainText("하루 한도(135C)를 넘어요");
  });

  test("F4-15 when this month's budget is closed the run button is off and says when it reopens", async ({
    page,
    context,
  }) => {
    await loginAsPlayer(context);
    const db = adminDb();
    await db
      .from("generation_budget")
      .update({ state: "paused" })
      .eq("month", kstMonth());
    try {
      await page.goto("/play");
      await page
        .getByLabel("프롬프트")
        .filter({ visible: true })
        .fill("마감 시험");
      await model(page, /^GPT Image 2\.5 Flare/).click();
      await expect(runButton(page)).toBeDisabled();
      await expect(
        page
          .getByText(/이번 달 생성이 마감됐어요 · \d+월 1일에 다시 열려요/)
          .filter({ visible: true }),
      ).toBeVisible();
    } finally {
      await db
        .from("generation_budget")
        .update({ state: "open" })
        .eq("month", kstMonth());
    }
  });
});
