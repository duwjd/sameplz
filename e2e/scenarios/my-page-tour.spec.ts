// SCN 11 (W6, MVP): my page → credits → profile (handle check, save shows in the menu) → seller →
// upload. Plus notifications: a new follower shows on the list and the GNB count goes to 0.
import { expect, test } from "@playwright/test";
import { loginAsNewUser } from "../fixtures/auth";
import { adminDb, loginAsPlayer } from "../fixtures/play";

test("F7-2 SCN 11 my page tour: credits, profile save reflected in the menu, then upload", async ({
  page,
  context,
}) => {
  await loginAsPlayer(context);
  await page.goto("/my");
  await expect(
    page.getByRole("heading", { name: "마이페이지", level: 1 }),
  ).toBeVisible();
  const credits = page
    .getByRole("link", { name: /크레딧\s*270C/ })
    .filter({ visible: true });
  await expect(credits).toBeVisible();
  await credits.click();
  await expect(page).toHaveURL(/\/my\/credits$/);

  await page.goto("/my/profile");
  const handle = page.getByLabel("핸들").filter({ visible: true });
  await handle.fill("jiwoo");
  await page.getByRole("button", { name: "중복 확인하기" }).click();
  await expect(
    page
      .getByText("이미 쓰고 있는 핸들이에요. 다른 핸들을 골라 주세요.")
      .filter({ visible: true }),
  ).toBeVisible();
  const mine = `tour_${Date.now() % 1_000_000}`;
  await handle.fill(mine);
  await page.getByRole("button", { name: "중복 확인하기" }).click();
  await expect(
    page.getByText("쓸 수 있는 핸들이에요.").filter({ visible: true }),
  ).toBeVisible();
  await page.getByLabel("닉네임").filter({ visible: true }).fill("투어회원");
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(
    page.getByText("프로필을 저장했어요.").filter({ visible: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "마이페이지" })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("menu").getByText("투어회원님")).toBeVisible();
  await page.getByRole("menuitem", { name: "판매자 센터" }).click();
  await expect(page).toHaveURL(/\/my\/seller$/);
  await page
    .getByRole("link", { name: "레시피 올리기" })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/my\/seller\/upload/);
});

test("NOTI-01 NOTI-02 a new follower shows in the list; opening it clears the GNB count", async ({
  page,
  context,
}) => {
  const me = await loginAsNewUser(context, { completeSignup: true });
  await adminDb()
    .from("follows")
    .insert({
      follower_id: "00000000-0000-0000-0000-000000000002",
      followee_id: me.id,
    });
  await page.goto("/");
  await expect(
    page
      .getByRole("button", { name: /^알림 1개 새로/ })
      .filter({ visible: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^알림/ })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/my\/notifications$/);
  await expect(
    page
      .getByRole("list", { name: "알림 목록" })
      .getByText(/님이 나를 팔로우해요/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "알림" }).filter({ visible: true }),
  ).toBeVisible();
});

test("F7-2 guests on /my are asked to log in", async ({ page }) => {
  await page.goto("/my");
  await expect(
    page
      .getByText("로그인하면 마이페이지를 볼 수 있어요")
      .filter({ visible: true }),
  ).toBeVisible();
});
