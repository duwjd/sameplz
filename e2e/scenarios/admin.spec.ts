// ADM (F8-1~3): /admin is admins only; review approve / reject, report → takedown → restore.
import { expect, test, type Browser } from "@playwright/test";
import {
  grantEntitlement,
  loginAsNewUser,
  loginAsSeedUser,
} from "../fixtures/auth";
import { adminDb, callSweeper } from "../fixtures/play";
import { submitRecipeAs } from "../fixtures/recipes";

const publicUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/storage/v1/object/public/recipe-media/${path}`;

async function adminPage(browser: Browser) {
  const context = await browser.newContext();
  await loginAsSeedUser(context, "admin");
  return { context, page: await context.newPage() };
}

const notifications = async (userId: string, kind: string) =>
  (
    await adminDb()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", kind)
  ).count ?? 0;

// One seed admin session at a time (logging in resets its throwaway password).
test.describe.configure({ mode: "serial" });

/** D18 moves run in the sweeper; another worker's sweep may hold the lease for a moment. */
async function publicStatus(
  request: import("@playwright/test").APIRequestContext,
  path: string,
) {
  await callSweeper(request);
  return (await request.get(publicUrl(path))).status();
}

test.describe("ADM 운영 화면", () => {
  test("ADM 비회원과 관리자가 아닌 회원은 /admin을 찾을 수 없다", async ({
    page,
    context,
  }) => {
    for (const path of [
      "/admin",
      "/admin/reviews",
      "/admin/reports",
      "/admin/recipes",
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: "찾는 페이지가 없어요" }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "운영 메뉴" }),
      ).toHaveCount(0);
    }
    await loginAsSeedUser(context, "jiwoo");
    await page.goto("/admin/reviews");
    await expect(
      page.getByRole("heading", { name: "찾는 페이지가 없어요" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "운영 메뉴" }),
    ).toHaveCount(0);
  });

  test("F8-1 심사 큐에서 승인하면 공개되고 결과물이 공개 버킷으로 가며 크리에이터에게 알린다", async ({
    browser,
    context,
    request,
  }) => {
    const creator = await loginAsNewUser(context, { completeSignup: true });
    const title = `승인 시험 ${Date.now() % 100000}`;
    const r = await submitRecipeAs(creator.id, {
      category: "agent",
      title,
      body: "ADMIN-E2E-ORIGINAL 메일을 정리해요",
      mediaBucket: "recipe-media-draft",
    });
    expect(r.status).toBe("in_review");

    const { context: ac, page } = await adminPage(browser);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "운영" })).toBeVisible();
    await page.getByRole("link", { name: "심사 큐" }).click();
    await page.getByRole("link", { name: `${title} · v1` }).click();
    await expect(
      page.getByRole("heading", { name: "자동 검사" }),
    ).toBeVisible();
    // The admin sees the original for the review (first version: every line is new).
    await expect(page.getByLabel("바뀐 줄").first()).toContainText(
      "ADMIN-E2E-ORIGINAL",
    );
    await page.getByRole("button", { name: "승인하기" }).click();
    await expect(page).toHaveURL(/\/admin\/reviews$/);
    await expect(page.getByRole("link", { name: `${title} · v1` })).toHaveCount(
      0,
    );
    await ac.close();

    const db = adminDb();
    const { data: rec } = await db
      .from("recipes")
      .select("status")
      .eq("id", r.recipeId)
      .single();
    expect(rec?.status).toBe("live");
    await expect.poll(() => publicStatus(request, r.mediaPath)).toBe(200);
    expect(await notifications(creator.id, "review_passed")).toBe(1);
    const { count } = await db
      .from("admin_actions")
      .select("id", { count: "exact", head: true })
      .eq("target_id", r.versionId)
      .eq("action", "review_approve");
    expect(count).toBe(1);
  });

  test("F8-1 반려 코드를 고르면 템플릿이 채워지고 크리에이터가 판매자 센터에서 사유를 본다", async ({
    browser,
    context,
    page: creatorPage,
  }) => {
    const creator = await loginAsNewUser(context, { completeSignup: true });
    const title = `반려 시험 ${Date.now() % 100000}`;
    const r = await submitRecipeAs(creator.id, {
      category: "agent",
      title,
      mediaBucket: "recipe-media-draft",
    });

    const { context: ac, page } = await adminPage(browser);
    await page.goto(`/admin/reviews/${r.versionId}`);
    await page.getByRole("button", { name: "반려하기" }).click();
    await expect(page.getByText("반려 코드를 골라 주세요.")).toBeVisible();
    await expect(page.getByLabel("반려 코드 (반려할 때만)")).toBeFocused();
    await page.getByLabel("반려 코드 (반려할 때만)").selectOption("R03");
    await expect(page.getByLabel(/크리에이터에게 보낼 메모/)).not.toHaveValue(
      "",
    );
    await page.getByRole("button", { name: "반려하기" }).click();
    await expect(page).toHaveURL(/\/admin\/reviews$/);
    await ac.close();

    const { data: q } = await adminDb()
      .from("review_queue")
      .select("state, reject_code")
      .eq("version_id", r.versionId)
      .single();
    expect(q).toEqual({ state: "rejected", reject_code: "R03" });
    expect(await notifications(creator.id, "review_rejected")).toBe(1);
    await creatorPage.goto("/my/seller");
    const row = creatorPage.getByRole("listitem").filter({ hasText: title });
    await expect(row.getByText("반려", { exact: true })).toBeVisible();
  });

  test("F8-2 F8-3 신고 → 게시중단: 모두에게 사라지고 받은 사람도 못 열며, 복원하면 게시중단 직전 상태(공개)로 돌아온다", async ({
    browser,
    context,
    request,
  }) => {
    const creator = await loginAsNewUser(context, { completeSignup: true });
    const title = `게시중단 시험 ${Date.now() % 100000}`;
    const r = await submitRecipeAs(creator.id, {
      title,
      mediaBucket: "recipe-media-draft",
    });
    expect(r.status).toBe("live");
    await expect.poll(() => publicStatus(request, r.mediaPath)).toBe(200);

    const hc = await browser.newContext();
    const holder = await loginAsNewUser(hc, { completeSignup: true });
    await grantEntitlement(holder.id, r.recipeId, r.versionId);
    const db = adminDb();
    const ins = await db.from("reports").insert({
      reporter_id: holder.id,
      target_type: "recipe",
      target_id: r.recipeId,
      reason: "rights",
      detail: "제 사진을 허락 없이 썼어요",
    });
    expect(ins.error).toBeNull();

    const { context: ac, page } = await adminPage(browser);
    await page.goto("/admin/reports");
    const card = page.getByRole("listitem").filter({ hasText: title });
    await expect(card.getByText("제 사진을 허락 없이 썼어요")).toBeVisible();
    await expect(card.getByText(/받음, 아직 안 열어 봄/)).toBeVisible();
    await card.getByLabel("결정").selectOption("takedown");
    await card.getByRole("button", { name: "결정하고 답하기" }).click();
    await expect(card.getByText("사유를 골라 주세요.")).toBeVisible();
    await card.getByLabel(/^사유/).selectOption("rights_claim");
    await card.getByRole("button", { name: "결정하고 답하기" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: title }),
    ).toHaveCount(0);

    // Hidden from everyone: detail 404, holder cannot open, results leave the public bucket.
    const { data: rec } = await db
      .from("recipes")
      .select("status, stopped_reason")
      .eq("id", r.recipeId)
      .single();
    expect(rec).toEqual({
      status: "taken_down",
      stopped_reason: "rights_claim",
    });
    const hp = await hc.newPage();
    await hp.goto(`/r/${r.publicId}`);
    await expect(
      hp.getByRole("heading", { name: "찾는 페이지가 없어요" }),
    ).toBeVisible();
    await hp.goto("/my/library");
    const row = hp.getByRole("listitem").filter({ hasText: title });
    await expect(row.getByText("게시중단 · 열 수 없어요")).toBeVisible();
    await expect(row.getByRole("button", { name: /원문 열기/ })).toHaveCount(0);
    await expect
      .poll(() => publicStatus(request, r.mediaPath))
      .toBeGreaterThanOrEqual(400);
    expect(await notifications(holder.id, "report_answered")).toBe(1);
    expect(await notifications(creator.id, "recipe_taken_down")).toBe(1);

    // Restore: back to the state before the takedown (live); the holder can open it again.
    await page.goto(`/admin/recipes?q=${r.publicId}`);
    await page.getByRole("button", { name: `「${title}」 복원하기` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "복원하기" }).click();
    await expect(
      dialog.getByText("복원하는 이유를 메모에 남겨 주세요."),
    ).toBeVisible();
    await dialog.getByLabel(/메모/).fill("권리자와 확인을 마쳤어요");
    await dialog.getByRole("button", { name: "복원하기" }).click();
    // The action waits for the D18 media move, which can take a while under parallel load.
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("cell", { name: /공개 중/ })).toBeVisible();
    await ac.close();
    await hp.goto("/my/library");
    await expect(
      hp
        .getByRole("listitem")
        .filter({ hasText: title })
        .getByRole("button", { name: /원문 열기/ }),
    ).toBeVisible();
    await hc.close();
  });
});
