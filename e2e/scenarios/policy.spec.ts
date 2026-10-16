import { expect, test } from "@playwright/test";
import { loginAsNewUser } from "../fixtures/auth";

// F7-7: policy documents are reachable from every footer and readable before signup is finished.
const DOCS = [
  { label: "이용 안내", path: "/guide", heading: "편하게 쓰려면 알아 둘 것" },
  { label: "이용약관", path: "/terms", heading: "이용약관" },
  { label: "개인정보처리방침", path: "/privacy", heading: "개인정보처리방침" },
  {
    label: "금지 콘텐츠 정책",
    path: "/policy/content",
    heading: "금지 콘텐츠 정책",
  },
  { label: "AI 고지", path: "/policy/ai", heading: "AI 고지" },
];

// Copy rule (.claude/rules/ux-copy-a11y.md): no 검증·인증·보장·100%·무조건 (SAME 인증 / 본인인증 allowed).
const BANNED = /검증|인증|보장|100%|무조건/;
const ALLOWED = /SAME 인증|본인인증/g;

test.describe("F7-7 정책 문서", () => {
  test("F7-7 푸터 링크마다 정책 문서가 열린다", async ({ page }) => {
    for (const doc of DOCS) {
      await page.goto("/");
      const footer = page.getByRole("navigation", { name: "정책" });
      await footer.getByRole("link", { name: doc.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${doc.path}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: doc.heading }),
      ).toBeVisible();
    }
  });

  test("F7-7 이용 안내 칩을 누르면 해당 섹션으로 간다", async ({ page }) => {
    await page.goto("/guide");
    const toc = page.getByRole("navigation", { name: "섹션 이동" });
    for (const [label, id] of [
      ["라이선스", "license"],
      ["안전 검사", "safety"],
      ["크레딧", "credits"],
      ["금지와 신고", "banned"],
    ]) {
      await toc.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    // D17: no won value for credits; MVP has no refund section.
    await expect(page.getByText(/1크레딧 = \d+원|1C\s*=\s*\d+원/)).toHaveCount(
      0,
    );
    await expect(page.locator("#refund")).toHaveCount(0);
  });

  test("F7-7 처리방침에 위탁·국외 이전 업체와 보관 기간이 있다", async ({
    page,
  }) => {
    await page.goto("/privacy");
    // The 받는 곳 column of the processor table. GA4 / Sentry rows appear once they are switched on (D21).
    for (const name of [
      "Supabase Inc.",
      "Vercel Inc.",
      "Features & Labels, Inc.(fal)",
      "OpenAI, L.L.C.",
      "Anthropic, PBC",
      "Google LLC",
    ]) {
      await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText(/탈퇴 후 1년까지/)).toBeVisible();
    await expect(page.getByText(/만든 지 30일 뒤 삭제/)).toBeVisible();
    await expect(page.getByText(/24시간 뒤 삭제/)).toBeVisible();
  });

  test("F7-7 정책 문서에 금지어가 없다", async ({ page }) => {
    for (const doc of DOCS) {
      await page.goto(doc.path);
      const text = (await page.locator("main").innerText()).replace(
        ALLOWED,
        "",
      );
      expect(text, doc.path).not.toMatch(BANNED);
    }
  });

  test("F7-7 가입 마무리 전에도 정책 문서를 읽을 수 있다", async ({
    page,
    context,
  }) => {
    await loginAsNewUser(context, { nickname: "읽는회원" });
    for (const doc of DOCS) {
      await page.goto(doc.path);
      await expect(
        page.getByRole("heading", { level: 1, name: doc.heading }),
      ).toBeVisible();
      // AuthProvider must not bounce these to /welcome.
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(new RegExp(`${doc.path}$`));
    }
    await page.goto("/welcome");
    const terms = page.getByRole("link", { name: "이용약관" }).first();
    await expect(terms).toHaveAttribute("href", "/terms");
    const privacy = page.getByRole("link", { name: "개인정보 수집·이용" });
    await expect(privacy).toHaveAttribute("href", "/privacy");
  });
});
