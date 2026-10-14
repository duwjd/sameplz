// SELL (W4, MVP 「내 레시피」): status order, rejection → 「고쳐서 다시 제출」 (F5-6), new version needs a
// changelog (F5-7), visibility, share links with field errors and click counts, views (F5-10), and
// the paid-launch waitlist (F5-14). Recipes are set up through the service-role submit RPC.
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginAsNewUser } from "../fixtures/auth";
import { rejectVersion, submitRecipeAs } from "../fixtures/recipes";

test.describe("SELL 판매자 센터", () => {
  test("SELL 비회원은 로그인 안내", async ({ page }) => {
    await page.goto("/my/seller");
    await expect(
      page.getByText("로그인하면 내 레시피를 볼 수 있어요"),
    ).toBeVisible();
  });

  test("SELL 올린 게 없으면 빈 화면 + 올리기", async ({ page, context }) => {
    await loginAsNewUser(context, { completeSignup: true });
    await page.goto("/my/seller");
    await expect(page.getByText("아직 올린 레시피가 없어요")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "레시피 올리기" }).first(),
    ).toHaveAttribute("href", "/my/seller/upload");
  });

  test("F5-14 「유료 판매 오픈 알림 신청」 한 번만, 다시 누르면 「신청했어요」와 취소", async ({
    page,
    context,
  }) => {
    await loginAsNewUser(context, { completeSignup: true });
    await page.goto("/my/seller");
    await page.getByRole("button", { name: "스킬" }).click();
    await page
      .getByRole("button", { name: "유료 판매 오픈 알림 신청" })
      .click();
    await expect(
      page.getByRole("button", { name: "신청했어요" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "신청했어요" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "신청 취소하기" }).click();
    await expect(
      page.getByRole("button", { name: "유료 판매 오픈 알림 신청" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "유료 판매 오픈 알림 신청" }),
    ).toBeVisible();
  });

  test("F5-6 반려가 맨 위, 사유 + 「고쳐서 다시 제출」 → 원문을 불러와 다시 제출", async ({
    page,
    context,
  }) => {
    const me = await loginAsNewUser(context, { completeSignup: true });
    await submitRecipeAs(me.id, { title: "공개 레시피 하나" });
    const agent = await submitRecipeAs(me.id, {
      category: "agent",
      title: "주문 정리 에이전트",
      body: "AGENT-ORIGINAL-MARKER 주문 메일을 시트로 정리해요",
    });
    expect(agent.status).toBe("in_review");
    await rejectVersion(
      agent.versionId,
      "R12",
      "안 하는 일을 더 자세히 적어 주세요.",
    );

    await page.goto("/my/seller");
    const first = page.getByRole("article").first();
    await expect(first.getByText("반려", { exact: true })).toBeVisible();
    await expect(
      first.getByText("반려 사유: 「하는 일」이 빠졌어요"),
    ).toBeVisible();
    await expect(
      first.getByText("안 하는 일을 더 자세히 적어 주세요."),
    ).toBeVisible();

    await first.getByRole("link", { name: "고쳐서 다시 제출" }).click();
    await expect(
      page.getByText("반려 사유: 「하는 일」이 빠졌어요"),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: /에이전트/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("button", { name: "다음" }).click();
    await expect(page.getByLabel("제목")).toHaveValue("주문 정리 에이전트");
    await expect(page.getByLabel("설정·지침 원문")).toHaveValue(
      /AGENT-ORIGINAL-MARKER/,
    );
    await page.getByText("API 키·비밀번호·토큰을 지웠어요").click();
    await page.getByRole("button", { name: "다음" }).click();
    await expect(page.getByLabel("결과물 1 설명")).toHaveValue("e2e 결과물");
    await page.getByRole("button", { name: "다음" }).click();

    // F5-7: a new version needs a changelog.
    await page.getByRole("button", { name: "다음" }).click();
    await expect(
      page.getByText("이번 버전에서 바뀐 점을 써 주세요."),
    ).toBeVisible();
    await expect(page.getByLabel("바뀐 점")).toBeFocused();
    await page.getByLabel("바뀐 점").fill("안 하는 일을 더 적었어요");
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "검사하고 올리기" }).click();
    await expect(page.getByText("사람이 확인하고 있어요")).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/my/seller");
    await expect(
      page.getByRole("article").first()
        .getByText("사람 확인 중", { exact: true }),
    ).toBeVisible();
  });

  test("F5-7 「새 버전 올리기」 → v2 공개, 원문은 지난 버전에서 불러옴", async ({
    page,
    context,
  }) => {
    const me = await loginAsNewUser(context, { completeSignup: true });
    const r = await submitRecipeAs(me.id, {
      title: "버전 테스트 레시피",
      body: "PROMPT-ORIGINAL-MARKER [직업] 사진",
    });
    await page.goto("/my/seller");
    await page.getByRole("link", { name: "새 버전 올리기" }).click();
    await expect(page.getByText("v2을 올려요")).toBeVisible();
    await page.getByRole("button", { name: "다음" }).click();
    await expect(page.getByLabel("프롬프트 본문")).toHaveValue(
      /PROMPT-ORIGINAL-MARKER/,
    );
    await page.getByLabel("한 줄 설명").fill("두 번째 버전이에요");
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByLabel("바뀐 점").fill("설명을 다듬었어요");
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "검사하고 올리기" }).click();
    await expect(page.getByText("레시피를 공개했어요")).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/my/seller");
    await expect(
      page.getByRole("article").first().getByText("v2"),
    ).toBeVisible();
    await page.goto(`/r/${r.publicId}`);
    await expect(page.getByText("두 번째 버전이에요").first()).toBeVisible();
  });

  test("SELL-03 공개 ↔ 비공개: 비공개면 상세가 404", async ({
    page,
    context,
  }) => {
    const me = await loginAsNewUser(context, { completeSignup: true });
    const r = await submitRecipeAs(me.id, { title: "공개 전환 레시피" });
    await page.goto("/my/seller");
    await page.getByRole("button", { name: "비공개로 바꾸기" }).click();
    await expect(page.getByText("비공개", { exact: true })).toBeVisible();
    expect((await page.request.get(`/r/${r.publicId}`)).status()).toBe(404);
    await page.getByRole("button", { name: "공개하기" }).click();
    await expect(page.getByText("공개 중", { exact: true })).toBeVisible();
    expect((await page.request.get(`/r/${r.publicId}`)).status()).toBe(200);
  });

  test("F5-10 공유 링크: 이름 규칙·중복은 칸 아래 오류, 만든 링크의 클릭과 조회 수가 쌓인다", async ({
    page,
    context,
    browser,
  }) => {
    const me = await loginAsNewUser(context, { completeSignup: true });
    const r = await submitRecipeAs(me.id, { title: "공유 링크 레시피" });
    await page.goto("/my/seller");
    const input = page.getByLabel("새 링크 이름");

    await input.fill("AB-1");
    await page.getByRole("button", { name: "링크 만들기" }).click();
    await expect(
      page.getByText("링크 이름은 영문 소문자·숫자로 6~12자예요.").first(),
    ).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");

    await input.fill("demo01"); // seed link on another recipe: codes are unique site-wide
    await page.getByRole("button", { name: "링크 만들기" }).click();
    await expect(
      page.getByText("이미 있는 링크 이름이에요. 다른 이름을 써 주세요."),
    ).toBeVisible();

    const code = `e2e${randomUUID().replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
    await input.fill(code);
    await page.getByRole("button", { name: "링크 만들기" }).click();
    await expect(page.getByText(`?ref=${code}`)).toBeVisible();

    // A visitor follows the link: one click and one view.
    const guest = await browser.newContext();
    const visitor = await guest.newPage();
    await visitor.goto(`/r/${r.publicId}?ref=${code}`);
    await expect(
      visitor.getByRole("heading", { name: "공유 링크 레시피" }),
    ).toBeVisible();
    await expect
      .poll(
        async () => {
          await page.reload();
          return page
            .getByRole("listitem")
            .filter({ hasText: `?ref=${code}` })
            .last()
            .textContent();
        },
        { timeout: 15_000 },
      )
      .toContain("클릭 1");
    await expect(
      page
        .getByRole("group", { name: /최근 30일 숫자/ })
        .getByText("1")
        .first(),
    ).toBeVisible();
    await guest.close();
  });
});
