// SCN 6 (MVP: no trial, no top-up — docs/specs/SCN.md): a member receives a free recipe, generates
// with this month's free credits, and posts the result as a SAME 인증 marked 「여기서 생성」; the credit
// history shows the use. Mock provider (GENERATION_PROVIDER=mock).
import { expect, test, type Page } from "@playwright/test";
import { adminDb, available, loginAsPlayer } from "../fixtures/play";

const model = (page: Page, name: RegExp) =>
  page.getByRole("checkbox", { name }).filter({ visible: true });
const runButton = (page: Page) =>
  page.locator("#play-run").filter({ visible: true });

test("SCN 6 F2-1 F4-2 F6-1 무료 받기 → 월 무료 크레딧으로 생성 → SAME 인증 「여기서 생성」", async ({
  page,
  context,
}) => {
  const user = await loginAsPlayer(context);
  const before = await available(user.id);
  expect(before).toBe(270); // D11 monthly free credits

  // Receive the free recipe on its detail page.
  await page.goto("/r/rdetailcopy");
  await page.getByRole("button", { name: "무료로 SAME 하기" }).click();
  await expect(page.getByText(/라이브러리에 담았어요/)).toBeVisible();

  // Straight into the playground with the received recipe selected.
  await page.getByRole("button", { name: "바로 만들어 보기" }).click();
  await expect(page).toHaveURL(/\/play\?recipe=rdetailcopy/);
  await model(page, /^GPT Image 2\.5 Flare/).click();
  await page
    .getByRole("button", { name: "예시로 채우기" })
    .filter({ visible: true })
    .click();
  await runButton(page).click();
  const result = page
    .getByRole("figure", { name: "GPT Image 2.5 Flare 결과" })
    .filter({ visible: true })
    .first();
  await expect(result.getByRole("img", { name: /AI 생성 이미지/ })).toBeVisible(
    {
      timeout: 15_000,
    },
  );
  // Charged once, from this month's free credits.
  await expect.poll(() => available(user.id)).toBeLessThan(before);

  // The result becomes a SAME 인증 as it is.
  await result.getByRole("button", { name: "SAME 인증 올리기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("플레이그라운드 결과를 그대로 올려요"),
  ).toBeVisible();
  const title = `SCN6 결과 ${Date.now() % 100000}`;
  await dialog.getByLabel("한 줄 소개").fill(title);
  await dialog.getByRole("button", { name: "올리기" }).click();
  await expect(
    page
      .getByText("SAME 인증을 올렸어요. 갤러리 맨 위에 보여요.")
      .filter({ visible: true }),
  ).toBeVisible();

  await page.goto("/gallery");
  const post = page
    .getByRole("list", { name: "갤러리" })
    .getByRole("listitem")
    .filter({ hasText: title });
  await expect(post).toContainText("여기서 생성");

  // The credit history shows the generation.
  await page.goto("/my/credits");
  await expect(page.getByText("플레이그라운드 사용").first()).toBeVisible();
  const { count } = await adminDb()
    .from("gallery_posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .eq("kind", "same_cert")
    .eq("generated_here", true);
  expect(count).toBe(1);
});
