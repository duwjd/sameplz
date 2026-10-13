// SCN 1 (W3, MVP): a guest browses, presses 「무료로 SAME 하기」, logs in (fixture stands in for OAuth),
// finishes signup (terms + 18+) and lands back on the recipe with the claim done.
// SAME 인증 upload is W6 (gallery); this file stops at "received → library".
import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { localSupabaseEnv, loginAsNewUser } from "../fixtures/auth";

const SECRET = "SAMEPLZ-SECRET-SAMPLE-";

async function assertNoOriginal(request: APIRequestContext, path: string) {
  const html = await (await request.get(path)).text();
  expect(html).not.toContain(SECRET);
  const rsc = await (await request.get(path, { headers: { RSC: "1" } })).text();
  expect(rsc).not.toContain(SECRET);
}

test.describe("SCN 1 비회원으로 구경하다 SAME 하기", () => {
  test("F2-1 F7-1 비회원 → 로그인·가입 마무리 → 자동으로 받고 라이브러리 버튼", async ({
    page,
    context,
    request,
  }) => {
    await page.goto("/");
    await page
      .getByRole("search")
      .getByRole("searchbox", { name: "검색" })
      .fill("링크드인");
    await page
      .getByRole("search")
      .getByRole("searchbox", { name: "검색" })
      .press("Enter");
    await page
      .getByRole("link", { name: /셀카 → 링크드인 프로필 사진/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/r\/rlinkedin01$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "셀카 → 링크드인 프로필 사진",
      }),
    ).toBeVisible();
    // PRM-01·04: results first, variables only, AI label.
    await expect(page.getByText("AI 생성").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "프롬프트 미리보기" }),
    ).toBeVisible();
    await expect(page.getByText("[옷 색]").first()).toBeVisible();
    await assertNoOriginal(request, "/r/rlinkedin01");

    await page.getByRole("button", { name: "무료로 SAME 하기" }).click();
    await expect(
      page.getByRole("dialog", { name: "로그인하고 이어서 할게요" }),
    ).toBeVisible();
    const intent = await page.evaluate(() =>
      sessionStorage.getItem("sp_login_intent"),
    );
    expect(intent).toContain('"type":"claim"');
    expect(intent).toContain('"next":"/r/rlinkedin01"');

    // OAuth round trip stand-in: new account, signup not finished yet.
    await loginAsNewUser(context, { nickname: "처음온회원" });
    await page.goto("/r/rlinkedin01");
    // The signup guard confirms the viewer first; /welcome may compile on first hit in dev.
    await expect(page).toHaveURL(/\/welcome\?next=%2Fr%2Frlinkedin01/, {
      timeout: 15_000,
    });
    await page.getByText("모두 동의해요").click();
    await page.getByRole("button", { name: "동의하고 시작하기" }).click();

    await expect(page).toHaveURL(/\/r\/rlinkedin01$/, { timeout: 15_000 });
    await expect(
      page.getByText(
        "처음온회원님, 반가워요. 하던 걸 이어서 할게요. 라이브러리에 담았어요.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "라이브러리에서 열기" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: "무료로 SAME 하기" }),
    ).toHaveCount(0);

    // LIB: 「라이브러리에서 열기」 opens the received original right away.
    await page.getByRole("button", { name: "라이브러리에서 열기" }).click();
    await expect(page).toHaveURL(/\/my\/library\?open=/);
    const dialog = page.getByRole("dialog", {
      name: /셀카 → 링크드인 프로필 사진 · v1 원문/,
    });
    await expect(dialog).toContainText("SAMEPLZ-SECRET-SAMPLE-01", {
      timeout: 10_000,
    });
    await expect(dialog.getByTestId("original-watermark")).toContainText(
      "처음온회원",
    );
  });

  test("F2-1 로그인한 회원은 바로 받는다", async ({ page, context }) => {
    await loginAsNewUser(context, {
      nickname: "바로받기",
      completeSignup: true,
    });
    await page.goto("/r/rcardnews10");
    await page.getByRole("button", { name: "무료로 SAME 하기" }).click();
    await expect(page.getByText(/라이브러리에 담았어요/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: "라이브러리에서 열기" }),
    ).toBeVisible();
    // Idempotent: reload keeps the received state.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "라이브러리에서 열기" }),
    ).toBeVisible();
  });

  test("F2-2 안 받은 회원에게도 원문이 가지 않는다", async ({
    page,
    context,
  }) => {
    await loginAsNewUser(context, { completeSignup: true });
    for (const id of ["rlinkedin01", "rtranslate1", "rblognotion"]) {
      const res = await page.goto(`/r/${id}`);
      expect(await res!.text()).not.toContain(SECRET);
    }
  });

  test.describe("EX", () => {
    test("F2-5 Midjourney 전용 레시피는 「바로 만들어 보기」가 꺼져 있고 이유가 보인다", async ({
      page,
    }) => {
      await page.goto("/r/rmjposter01");
      await expect(
        page.getByRole("button", { name: "바로 만들어 보기" }),
      ).toBeDisabled();
      await expect(
        page.getByText(/Midjourney는 API가 없어 여기서 바로 만들 수 없어요/),
      ).toBeVisible();
    });

    test("F2-6 세무 레시피는 검토 보조 고지 띠가 있다", async ({ page }) => {
      await page.goto("/r/rtaxcheck01");
      await expect(page.getByText("검토 보조로만 써 주세요")).toBeVisible();
      await expect(page.getByText("세무사 검수")).toHaveCount(0);
    });

    test("F2-3 공유 링크로 들어오면 띠가 보이고 클릭은 한 번만 센다", async ({
      page,
    }) => {
      const env = localSupabaseEnv();
      const admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false },
      });
      const clicks = async () => {
        const { count, error } = await admin
          .from("share_link_clicks")
          .select("id", { count: "exact", head: true })
          .eq("link_id", "ffffffff-0000-0000-0000-000000000001");
        expect(error).toBeNull();
        return count ?? 0;
      };
      const before = await clicks();
      const band = page.getByText("사진관K님 링크로 들어왔어요.");
      await page.goto("/r/rlinkedin01?ref=demo01");
      await expect(band).toBeVisible({ timeout: 10_000 });
      const ref = await page.evaluate(() =>
        sessionStorage.getItem("sp_share_ref"),
      );
      expect(ref).toContain('"code":"demo01"');
      await page.reload();
      await expect(band).toBeVisible({ timeout: 10_000 });

      // Same visitor (IP-keyed) within 24h → at most one new row for both visits.
      expect(await clicks()).toBeLessThanOrEqual(before + 1);
      expect(await clicks()).toBeGreaterThanOrEqual(1);
    });

    test("F2-3 다른 레시피의 코드는 띠를 보이지 않는다", async ({ page }) => {
      await page.goto("/r/rcafetone01?ref=demo01");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/링크로 들어왔어요/)).toHaveCount(0);
    });

    test("SKL-04 도구 탭을 바꾸면 설치 단계가 바뀌고 설치 명령을 복사할 수 있다", async ({
      page,
    }) => {
      await page.goto("/r/rtranslate1");
      await expect(
        page.getByText("unzip translate-ko.zip -d ~/.claude/skills/"),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Claude" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("tab", { name: "ChatGPT" })).toBeFocused();
      await expect(page.getByRole("tabpanel")).toContainText(
        "GPT 지침에 SKILL.md 내용을 붙여 넣어요",
      );
    });

    test("AGT-03 「예시 실행 보기」로 실행 기록을 다시 재생한다", async ({
      page,
    }) => {
      await page.goto("/r/rblognotion");
      const log = page.getByRole("list", { name: "예시 실행 기록" });
      await expect(log.getByRole("listitem")).toHaveCount(4);
      await page.getByRole("button", { name: "예시 실행 보기" }).click();
      await expect(log.getByRole("listitem")).toHaveCount(4, {
        timeout: 5_000,
      });
      await expect(page.getByText("API 없음")).toHaveCount(0);
    });

    test("PRM 모바일은 아래에 SAME 바가 고정된다", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto("/r/rlinkedin01");
      await page.mouse.wheel(0, 4000);
      const bar = page
        .getByRole("region", { name: "SAME 바" })
        .getByRole("button", { name: "무료로 SAME 하기" });
      await expect(bar).toBeInViewport();
    });

    test("F1-7 없는·비공개·심사 중·반려 레시피는 같은 404", async ({
      request,
    }) => {
      for (const id of [
        "zz99zz",
        "rprivate001",
        "rinreview01",
        "rrejected01",
      ]) {
        const res = await request.get(`/r/${id}`);
        expect(res.status(), id).toBe(404);
        const html = await res.text();
        expect(html).toContain("찾는 페이지가 없어요");
        expect(html).not.toContain(SECRET);
      }
    });
  });
});
