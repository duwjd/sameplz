// SCN 9 (W3, MVP): a stopped recipe shows the reason and similar recipes, never a claim button;
// holders keep their version, the creator sees a status note. Search engines are told it is gone.
import { expect, test } from "@playwright/test";
import { loginAsNewUser, loginAsSeedUser } from "../fixtures/auth";

const URL = "/r/rstopped001";

test.describe("SCN 9 판매 중지된 레시피", () => {
  test("F2-4 비회원: 사유 + 비슷한 레시피, 받기 버튼 없음, noindex·Discontinued", async ({
    page,
  }) => {
    const res = await page.goto(URL);
    expect(res!.status()).toBe(200);
    await expect(page.getByText("판매 중지", { exact: true })).toBeVisible();
    await expect(page.getByText(/크리에이터가 판매를 멈췄어요/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "이 레시피 대신 둘러보세요" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /SAME 하기/ })).toHaveCount(
      0,
    );
    await expect(page.getByText("받은 버전 열기")).toHaveCount(0);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    const ld = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    expect(ld).toContain("https://schema.org/Discontinued");
  });

  test("F2-4 안 받은 회원: 받기 버튼 없음", async ({ page, context }) => {
    await loginAsNewUser(context, { completeSignup: true });
    await page.goto(URL);
    await expect(page.getByText(/크리에이터가 판매를 멈췄어요/)).toBeVisible();
    await expect(page.getByRole("button", { name: /SAME 하기/ })).toHaveCount(
      0,
    );
    await expect(page.getByText("받은 버전 열기")).toHaveCount(0);
  });

  test("F2-4 받은 회원(jiwoo): 받은 버전은 계속 쓴다", async ({
    page,
    context,
  }) => {
    await loginAsSeedUser(context, "jiwoo");
    await page.goto(URL);
    await expect(page.getByText("받은 버전은 계속 쓸 수 있어요").filter({ visible: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "받은 버전 열기" }),
    ).toHaveAttribute("href", /^\/my\/library\?open=/);
  });

  test("F2-4 만든 사람: 판매 중지 띠 + 일반 상세", async ({
    page,
    context,
  }) => {
    await loginAsSeedUser(context, "sangse");
    await page.goto(URL);
    await expect(
      page.getByText("판매를 멈춘 내 레시피예요").filter({ visible: true }),
    ).toBeVisible();
    // Creator still sees the normal detail body.
    await expect(
      page.getByRole("heading", { name: "프롬프트 미리보기" }),
    ).toBeVisible();
  });
});
