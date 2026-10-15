// SCN 5 (W6): a holder posts a SAME 인증 → it tops the gallery, shows on the recipe, counts as SAME;
// posting needs the entitlement and goes through the server (direct inserts are refused, pgTAP).
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { loginAsNewUser } from "../fixtures/auth";
import { adminDb } from "../fixtures/play";

const RECIPE_ID = "aaaaaaaa-0000-0000-0000-000000000004";
const RECIPE_PID = "rdetailcopy";

test("F6-1 SCN 5 a holder's SAME 인증 lands on top of the gallery and on the recipe", async ({
  page,
  context,
}) => {
  const user = await loginAsNewUser(context, {
    completeSignup: true,
    nickname: "인증러",
  });
  await adminDb().from("entitlements").insert({
    user_id: user.id,
    recipe_id: RECIPE_ID,
    version_id: "bbbbbbbb-0000-0000-0000-000000000004",
    source: "free",
  });
  const before = (
    await adminDb().rpc("get_recipe_public", { p_public_id: RECIPE_PID })
  ).data as {
    stats: { same_count: number };
  };

  await page.goto(`/r/${RECIPE_PID}`);
  await page
    .getByRole("button", { name: "SAME 인증 올리기" })
    .filter({ visible: true })
    .click();
  const dialog = page.getByRole("dialog");
  const png = await sharp({
    create: { width: 96, height: 96, channels: 3, background: "#88aacc" },
  })
    .png()
    .toBuffer();
  await dialog
    .locator("#up-same-media")
    .setInputFiles({ name: "mine.png", mimeType: "image/png", buffer: png });
  await expect(
    dialog.getByRole("img", { name: "올릴 결과 미리보기" }),
  ).toBeVisible();
  const title = `우리 가게 버전 ${Date.now() % 100000}`;
  await dialog.getByLabel("한 줄 소개").fill(title);
  await dialog.getByRole("button", { name: "올리기" }).click();
  await expect(
    page
      .getByText("SAME 인증을 올렸어요. 갤러리 맨 위에 보여요.")
      .filter({ visible: true }),
  ).toBeVisible();

  await page.goto("/gallery");
  const first = page
    .getByRole("list", { name: "갤러리" })
    .getByRole("listitem")
    .first();
  await expect(first).toContainText(title);
  await expect(first).toContainText("SAME 인증");
  await expect(
    first.getByRole("img", { name: /우리 가게 버전/ }),
  ).toHaveAttribute("src", /\/storage\/v1\/object\/public\/recipe-media\//);

  const after = (
    await adminDb().rpc("get_recipe_public", { p_public_id: RECIPE_PID })
  ).data as {
    stats: { same_count: number };
  };
  expect(after.stats.same_count).toBe(before.stats.same_count + 1);
  await page.goto(`/r/${RECIPE_PID}`);
  await expect(
    page
      .getByRole("list", { name: "따라 만든 결과" })
      .getByText(title)
      .filter({ visible: true }),
  ).toBeVisible();
});

test.describe("EX", () => {
  test("GAL-04 without a received recipe, 「내 결과 올리기」 explains how to start", async ({
    page,
    context,
  }) => {
    await loginAsNewUser(context, { completeSignup: true });
    await page.goto("/gallery");
    await page
      .getByRole("button", { name: "내 결과 올리기" })
      .filter({ visible: true })
      .click();
    await expect(
      page.getByRole("dialog").getByText("먼저 레시피를 받아 보세요"),
    ).toBeVisible();
  });

  test("GAL EX SAME 인증만 보기 hides originals", async ({ page }) => {
    await page.goto("/gallery");
    await page.getByRole("button", { name: "SAME 인증만" }).filter({ visible: true }).click();
    const list = page.getByRole("list", { name: "갤러리" });
    await expect(page.getByRole("button", { name: "SAME 인증만" }).filter({ visible: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(list).toHaveAttribute("aria-busy", "false");
    const texts = await list.getByRole("listitem").allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain("SAME 인증");
  });

  test("GAL guests are asked to log in to like", async ({ page }) => {
    await page.goto("/gallery");
    await page
      .getByRole("list", { name: "갤러리" })
      .getByRole("button", { name: /^좋아요/ })
      .first()
      .click();
    await expect(
      page.getByRole("dialog").filter({ visible: true }),
    ).toBeVisible();
  });

  test("F6-3 a member reports a gallery post", async ({ page, context }) => {
    await loginAsNewUser(context, { completeSignup: true });
    await page.goto("/gallery");
    await page
      .getByRole("list", { name: "갤러리" })
      .getByRole("button", { name: "신고" })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("남의 결과물", { exact: true }).click();
    await dialog.getByRole("button", { name: "신고 접수하기" }).click();
    await expect(
      page
        .getByText("신고를 접수했어요. 1영업일 안에 첫 답을 드려요.")
        .filter({ visible: true }),
    ).toBeVisible();
  });
});
