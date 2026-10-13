import { expect, test } from "@playwright/test";
import { loginAsNewUser } from "../fixtures/auth";

// F7-1 login popup + F7-9 signup completion. Real OAuth is out of scope here; the fixture signs in.
test.describe("로그인", () => {
  test("F7-1 팝업: 버튼 3개, 닫으면 취소되고 포커스가 돌아온다", async ({
    page,
  }) => {
    await page.goto("/");
    const opener = page.getByRole("button", { name: "로그인" });
    await opener.click();
    const dialog = page.getByRole("dialog", {
      name: "로그인하고 이어서 할게요",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "닫기" })).toBeVisible();
    await expect(dialog.locator("button", { hasText: "계속하기" })).toHaveText([
      "카카오로 계속하기",
      "네이버로 계속하기",
      "구글로 계속하기",
    ]);
    await expect(dialog.getByText("처음이면 자동으로 가입돼요.")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "카카오로 계속하기" }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect(
      await page.evaluate(() => sessionStorage.getItem("sp_login_intent")),
    ).toBeNull();
  });

  test("F7-1 로그인 서버 오류면 창이 다시 열리고 이유를 알려 준다", async ({
    page,
  }) => {
    await page.goto("/market?auth_error=server_error");
    const dialog = page.getByRole("dialog", {
      name: "로그인하고 이어서 할게요",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveText(
      "오류: 로그인 서버가 응답하지 않았어요. 잠시 뒤 다시 눌러 주세요.",
    );
    await expect(page).toHaveURL(/\/market$/);
  });

  test("F7-1 사용자가 취소(access_denied)하면 조용히 넘어간다", async ({
    page,
  }) => {
    await page.goto("/market?auth_error=access_denied");
    await expect(page).toHaveURL(/\/market$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("F7-9 첫 로그인은 약관·18세 확인을 마쳐야 원래 화면으로 간다", async ({
    page,
    context,
  }) => {
    const user = await loginAsNewUser(context, { nickname: "새로온지우" });
    await page.goto("/market?q=" + encodeURIComponent("세무"));
    await expect(page).toHaveURL(/\/welcome\?next=/);
    await expect(
      page.getByRole("heading", { name: "가입을 마무리해 주세요" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "동의하고 시작하기" }).click();
    await expect(
      page.getByText("이용약관에 동의해야 가입할 수 있어요."),
    ).toBeVisible();
    await expect(
      page.getByText("만 18세 이상만 가입할 수 있어요."),
    ).toBeVisible();
    await expect(page.locator("#terms-input")).toBeFocused();

    await page.getByText("모두 동의해요").click();
    await page.getByRole("button", { name: "동의하고 시작하기" }).click();
    // Server action redirect + signup re-check can take a few seconds on a loaded CI runner.
    await expect(page).toHaveURL(/\/market\?q=%EC%84%B8%EB%AC%B4/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: "마이페이지" }),
    ).toBeVisible();
    expect(user.nickname).toBe("새로온지우");
  });

  test("F7-1 비회원 팔로우 → 로그인 뒤 이어서 팔로우된다", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    const follow = page.getByRole("button", { name: "사진관K 팔로우" });
    await follow.click();
    await expect(
      page.getByRole("dialog", { name: "로그인하고 이어서 할게요" }),
    ).toBeVisible();
    const intent = await page.evaluate(() =>
      sessionStorage.getItem("sp_login_intent"),
    );
    expect(intent).toContain('"handle":"photok"');

    // Stand-in for the OAuth round trip: sign in, keep the saved intent, come back.
    await loginAsNewUser(context, {
      nickname: "팔로우테스트",
      completeSignup: true,
    });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "사진관K 팔로잉" }),
    ).toBeVisible();
    await expect(
      page.getByText("팔로우테스트님, 반가워요. 하던 걸 이어서 할게요."),
    ).toBeVisible();
  });
});
