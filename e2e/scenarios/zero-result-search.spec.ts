import { expect, test, type Page } from "@playwright/test";

// SCN 10 · 검색 결과 없음 → 인기 검색어로 (guest, W2 gate). Seed: supabase/seed.sql.

async function gnbSearch(page: Page, term: string) {
  const box = page.getByRole("search").getByRole("searchbox", { name: "검색" });
  await box.fill(term);
  await box.press("Enter");
}

const results = (page: Page) => page.getByRole("region", { name: "검색 결과" });
const cards = (page: Page) => results(page).locator('a[href^="/r/"]');

test.describe("검색 결과 없음 → 인기 검색어로", () => {
  test("SCN 10 guest: zero results → popular term → two-letter Korean search", async ({
    page,
  }) => {
    await page.goto("/");

    await test.step("F1-6 0건이면 인기 검색어 칩 10개 + 「필터 초기화」", async () => {
      await gnbSearch(page, "없는검색어");
      await expect(page).toHaveURL(/\/market\?q=/);
      await expect(
        results(page).getByText("조건에 맞는 레시피가 없어요"),
      ).toBeVisible();
      const popular = page
        .getByRole("group", { name: "요즘 많이 찾는" })
        .getByRole("button");
      await expect(popular).toHaveCount(10);
      await expect(
        results(page).getByRole("button", { name: "필터 초기화" }),
      ).toBeVisible();
    });

    await test.step("F1-4 인기 검색어를 누르면 결과가 나오고 검색어가 칩으로 남는다", async () => {
      await page
        .getByRole("group", { name: "요즘 많이 찾는" })
        .getByRole("button", { name: "상세페이지" })
        .click();
      await expect(page).toHaveURL(
        /q=%EC%83%81%EC%84%B8%ED%8E%98%EC%9D%B4%EC%A7%80/,
      );
      await expect(cards(page).first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: "검색: 상세페이지 해제" }),
      ).toBeVisible();
    });

    await test.step("F1-5 두 글자 「세무」로 찾는다", async () => {
      await gnbSearch(page, "세무");
      await expect(
        results(page).getByText("종합소득세 검토 보조 체크리스트"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "검색: 세무 해제" }),
      ).toBeVisible();
    });
  });

  test.describe("EX", () => {
    test("F1-4 칩 하나를 지우면 그 조건만 풀린다", async ({ page }) => {
      await page.goto(
        "/market?q=" + encodeURIComponent("상세페이지") + "&job=commerce",
      );
      await page.getByRole("button", { name: "커머스·셀러 해제" }).click();
      await expect(page).toHaveURL(
        /\/market\?q=%EC%83%81%EC%84%B8%ED%8E%98%EC%9D%B4%EC%A7%80$/,
      );
      await expect(
        page.getByRole("button", { name: "검색: 상세페이지 해제" }),
      ).toBeVisible();
    });

    test("F1-6 이 탭엔 없고 다른 탭에 있으면 그쪽으로 안내한다", async ({
      page,
    }) => {
      await page.goto("/market/agents?job=tax");
      await expect(
        results(page).getByText("조건에 맞는 레시피가 없어요"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "스킬에 1개 있어요" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "마켓 전체에 1개 있어요" }),
      ).toBeVisible();
    });

    test("F1-4 판매 중지·심사 중 레시피는 목록과 검색에 없다", async ({
      page,
    }) => {
      await page.goto("/market?q=" + encodeURIComponent("쿠팡 로켓"));
      await expect(
        results(page).getByText("조건에 맞는 레시피가 없어요"),
      ).toBeVisible();
      await page.goto("/market");
      await expect(results(page).getByText("쿠팡 로켓 상세 문구")).toHaveCount(
        0,
      );
      await expect(
        results(page).getByText("채용공고 작성 도우미 에이전트"),
      ).toHaveCount(0);
    });
  });
});
