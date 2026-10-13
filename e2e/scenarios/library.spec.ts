// LIB (W3, MVP): received recipes, 「원문 열기」 with watermark (F3-5), per-row update (F3-8),
// attachments through /api/files/[versionId] (holders only), stopped recipes keep working.
import { expect, test } from "@playwright/test";
import {
  grantEntitlement,
  loginAsNewUser,
  uploadRecipeFile,
} from "../fixtures/auth";

const CAFE = "aaaaaaaa-0000-0000-0000-000000000003";
const CAFE_V1 = "bbbbbbbb-0000-0000-0000-000000000003";
const STOPPED = "aaaaaaaa-0000-0000-0000-000000000015";
const STOPPED_V1 = "bbbbbbbb-0000-0000-0000-000000000015";
const TRANSLATE = "aaaaaaaa-0000-0000-0000-000000000002";
const TRANSLATE_V1 = "bbbbbbbb-0000-0000-0000-000000000002";
const SKILL_FILE = "eeeeeeee-0000-0000-0000-000000000001";

test.describe("LIB 라이브러리", () => {
  test("LIB 비회원은 로그인 안내", async ({ page }) => {
    await page.goto("/my/library");
    await expect(
      page.getByText("로그인하면 받은 레시피를 볼 수 있어요"),
    ).toBeVisible();
    await page.getByRole("button", { name: "로그인하기" }).click();
    await expect(
      page.getByRole("dialog", { name: "로그인하고 이어서 할게요" }),
    ).toBeVisible();
  });

  test("LIB 받은 게 없으면 갤러리로 안내", async ({ page, context }) => {
    await loginAsNewUser(context, { completeSignup: true });
    await page.goto("/my/library");
    await expect(page.getByText("아직 받은 게 없어요")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "갤러리 구경하기" }),
    ).toHaveAttribute("href", "/#gallery");
  });

  test("F3-5 원문 열기: 받은 버전 원문 + 받은 사람 표시, 상태가 열어 봄으로", async ({
    page,
    context,
  }) => {
    const user = await loginAsNewUser(context, {
      nickname: "원문열기",
      completeSignup: true,
    });
    await grantEntitlement(user.id, CAFE, CAFE_V1);
    await page.goto("/my/library");
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "감성 카페 메뉴 사진 톤" });
    await expect(row.getByText("열기 전")).toBeVisible();
    await row.getByRole("button", { name: /원문 열기/ }).click();
    const dialog = page.getByRole("dialog", {
      name: /감성 카페 메뉴 사진 톤 · v1 원문/,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("SAMEPLZ-SECRET-SAMPLE-03 [변수]");
    await expect(dialog.getByTestId("original-watermark")).toContainText(
      "원문열기(@",
    );
    await page.keyboard.press("Escape");
    await expect(row.getByText("열어 봄")).toBeVisible();
  });

  test("F3-5 공유된 ?open= 링크만으로는 원문이 열리지 않는다", async ({
    page,
    context,
  }) => {
    const user = await loginAsNewUser(context, { completeSignup: true });
    const id = await grantEntitlement(user.id, CAFE, CAFE_V1);
    await page.goto(`/my/library?open=${id}`);
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "감성 카페 메뉴 사진 톤" });
    await expect(row.getByText("열기 전")).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row.getByText("열기 전")).toBeVisible();
  });

  test("LIB 스킬 원문을 복사하면 받은 사람 표시가 함께 간다", async ({
    page,
    context,
  }) => {
    const user = await loginAsNewUser(context, {
      nickname: "스킬받음",
      completeSignup: true,
    });
    await grantEntitlement(user.id, TRANSLATE, TRANSLATE_V1);
    await page.goto("/my/library");
    await page
      .getByRole("listitem")
      .filter({ hasText: "한국어 번역투 교정" })
      .getByRole("button", { name: /원문 열기/ })
      .click();
    await expect(page.getByRole("dialog")).toContainText("<!-- 스킬받음(@");
  });

  test("F3-8 업데이트는 그 줄만 새 버전으로", async ({ page, context }) => {
    const user = await loginAsNewUser(context, { completeSignup: true });
    await grantEntitlement(user.id, CAFE, CAFE_V1);
    await page.goto("/my/library");
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "감성 카페 메뉴 사진 톤" });
    await expect(row.getByText(/새 버전 v2/)).toBeVisible();
    await row.getByRole("button", { name: /v2로 업데이트하기/ }).click();
    await expect(page.getByText("v2로 업데이트했어요.")).toBeVisible();
    await expect(row.getByText(/· v2 ·/)).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText(/새 버전 v2/)).toHaveCount(0);
    await row.getByRole("button", { name: /원문 열기/ }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "SAMEPLZ-SECRET-SAMPLE-03v2",
    );
  });

  test("F2-4 판매 종료된 레시피도 받은 버전은 열린다", async ({
    page,
    context,
  }) => {
    const user = await loginAsNewUser(context, { completeSignup: true });
    await grantEntitlement(user.id, STOPPED, STOPPED_V1);
    await page.goto("/my/library");
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "쿠팡 로켓 상세 문구" });
    await expect(row.getByText("판매 종료 · 계속 사용")).toBeVisible();
    await row.getByRole("button", { name: /원문 열기/ }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "판매가 멈췄지만 받은 버전은 계속 쓸 수 있어요.",
    );
  });

  test("F3-5 파일은 받은 사람만 서명 URL로 받는다", async ({
    page,
    context,
    browser,
  }) => {
    await uploadRecipeFile("seed/02/SKILL.md", "# 번역투 교정 스킬 (e2e)");
    const user = await loginAsNewUser(context, { completeSignup: true });
    await grantEntitlement(user.id, TRANSLATE, TRANSLATE_V1);
    const url = `/api/files/${TRANSLATE_V1}?file=${SKILL_FILE}`;

    const res = await page.request.get(url, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()["location"]).toMatch(
      /\/storage\/v1\/object\/sign\/recipe-files\//,
    );
    const file = await page.request.get(res.headers()["location"]);
    expect(await file.text()).toContain("번역투 교정 스킬");

    await page.goto("/my/library");
    await expect(
      page.getByRole("link", { name: /SKILL\.md 파일 받기/ }),
    ).toHaveAttribute("href", url);

    // Someone else (no entitlement) and a guest get the same 404.
    const other = await browser.newContext();
    await loginAsNewUser(other, { completeSignup: true });
    expect((await other.request.get(url, { maxRedirects: 0 })).status()).toBe(
      404,
    );
    await other.close();
    const guest = await browser.newContext();
    expect((await guest.request.get(url, { maxRedirects: 0 })).status()).toBe(
      404,
    );
    await guest.close();
  });
});
