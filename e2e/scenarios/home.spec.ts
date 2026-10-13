import { expect, test } from "@playwright/test";

// HOME (F1-1): guest sees banner → HOME-02 → HOME-03 → HOME-04 → HOME-05, from seeded DB data.
test.describe("홈", () => {
  test("F1-1 섹션 순서와 TOP 10 탭", async ({ page }) => {
    await page.goto("/");
    const headings = page.locator("main h2");
    await expect(headings).toHaveText([
      "저거랑 같은 걸로 주세요.",
      "이번 주 다운로드 많은",
      "실시간 인기 TOP 10",
      "지금 뜨는 결과물",
      "인기 크리에이터",
    ]);
    await expect(page.getByText(/기준 · 1시간마다 갱신/)).toBeVisible();

    await page.getByRole("tab", { name: "스킬" }).click();
    await expect(page.getByRole("tab", { name: "스킬" })).toHaveAttribute("aria-selected", "true");

    // F1-2: stopped recipes never reach the home lists.
    await expect(page.getByText("쿠팡 로켓 상세 문구")).toHaveCount(0);
  });

  test("F1-1 배너를 직접 넘기면 자동 넘김이 멈춘다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "다음 배너" }).click();
    await expect(page.getByRole("button", { name: "자동 넘김 시작" })).toBeVisible();
  });
});
