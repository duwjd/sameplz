// SCN 8 (W6): 「이걸로 만들기」 from the gallery opens an upload draft that remembers the origin; the
// published fork shows 「원작」. A recipe that blocks forks has no button. MVP: no royalty (D1).
import { expect, test } from "@playwright/test";
import { loginAsNewUser } from "../fixtures/auth";
import { adminDb } from "../fixtures/play";

test.describe.configure({ mode: "serial" }); // the second test flips fork_allowed on a shared recipe

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("F6-2 SCN 8 a fork from the gallery is published free with its origin", async ({
  page,
  context,
}) => {
  await loginAsNewUser(context, { completeSignup: true });
  await page.goto("/gallery");
  // An original post of a prompt recipe that allows forks.
  const tile = page
    .getByRole("list", { name: "갤러리" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "이걸로 만들기" }) })
    .first();
  const origin = (
    await tile.getByRole("button").filter({ hasText: /./ }).allInnerTexts()
  ).join(" ");
  await tile.getByRole("button", { name: "이걸로 만들기" }).click();
  await expect(page).toHaveURL(/\/my\/seller\/upload$/);
  await page
    .getByRole("button", { name: "이어서 쓰기" })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByText(/을 바탕으로 만들어요$/).filter({ visible: true }),
  ).toBeVisible();

  const radio = page.getByRole("radio", { name: /프롬프트/ });
  if ((await radio.getAttribute("aria-checked")) !== "true")
    await radio.click();
  const image = page.getByRole("radio", { name: "이미지", exact: true });
  if ((await image.getAttribute("aria-checked")) !== "true")
    await image.click();
  await page.getByRole("button", { name: "다음" }).click();
  const title = `포크 레시피 ${Date.now() % 100000}`;
  await page.getByLabel("제목").fill(title);
  await page.getByLabel("한 줄 설명").fill("원작을 바탕으로 바꿔 봤어요");
  await page.getByRole("button", { name: "마케팅·SNS" }).click();
  await page.getByLabel("프롬프트 본문").fill("[메뉴] 를 감성 사진으로");
  await page.locator("#up-prompt-variables-0-description").fill("메뉴 이름");
  await page.locator("#up-prompt-variables-0-example").fill("라떼");
  await page.getByRole("button", { name: "다음" }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "r.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("결과물 1 설명").fill("라떼 사진");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("radio", { name: /공개/ }).first().click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "검사하고 올리기" }).click();
  await expect(page.getByText("레시피를 공개했어요")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "상세 화면 보기" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    page.getByText(/원작 「/).filter({ visible: true }),
  ).toBeVisible();
});

test("F6-2 SCN 8 a recipe that blocks forks shows no 「이걸로 만들기」", async ({
  page,
}) => {
  const db = adminDb();
  const { data: posts } = await db
    .from("gallery_posts")
    .select("recipe_id, title")
    .eq("status", "visible")
    .eq("kind", "original")
    .limit(1);
  const recipeId = posts![0].recipe_id;
  await db.from("recipes").update({ fork_allowed: false }).eq("id", recipeId);
  try {
    await page.goto("/gallery");
    const tile = page
      .getByRole("list", { name: "갤러리" })
      .getByRole("listitem")
      .filter({ hasText: posts![0].title });
    await expect(tile.first()).toBeVisible();
    await expect(
      tile.first().getByRole("button", { name: "이걸로 만들기" }),
    ).toHaveCount(0);
  } finally {
    await db.from("recipes").update({ fork_allowed: true }).eq("id", recipeId);
  }
});
