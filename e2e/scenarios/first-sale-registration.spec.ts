// SCN 7 (W4, MVP): first free registration → shows up in market search → waitlist sign-up.
// No identity verification or price in the MVP (docs/specs/SCN.md). Layer 2 runs as mock.
import { expect, test } from "@playwright/test";
import { loginAsNewUser } from "../fixtures/auth";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("SCN 7 첫 무료 등록 → 마켓 검색에 뜸 → 유료 판매 오픈 알림 신청", async ({
  page,
  context,
}) => {
  await loginAsNewUser(context, { completeSignup: true });
  const tag = `첫등록${Date.now() % 1_000_000}`;
  const title = `스튜디오 프로필 ${tag}`;

  // Account menu → 판매자 센터 (empty) → 레시피 올리기
  await page.goto("/my/seller");
  await expect(
    page.getByText("아직 올린 레시피가 없어요").filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "레시피 올리기" }).first().click();

  await page.getByRole("radio", { name: /프롬프트/ }).click();
  await page.getByRole("radio", { name: "이미지", exact: true }).click();
  await page.getByRole("button", { name: "다음" }).click();

  await page.getByLabel("제목").fill(title);
  await page.getByLabel("한 줄 설명").fill("셀카 한 장으로 스튜디오 프로필");
  await page.getByRole("button", { name: "마케팅·SNS" }).click();
  await page.getByLabel("검색 태그").fill(tag);
  await page
    .getByLabel("프롬프트 본문")
    .fill("[배경] 앞 스튜디오 조명 프로필 사진");
  await page.locator("#up-prompt-variables-0-description").fill("사진 뒤 배경");
  await page.locator("#up-prompt-variables-0-example").fill("회색 벽");
  await page.getByRole("button", { name: "다음" }).click();

  // R01: no result yet.
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByText("결과물을 1개 이상 올려 주세요.")).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "result.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("결과물 1 설명").fill("회색 벽 앞 스튜디오 프로필");
  await page.getByRole("button", { name: "다음" }).click();

  // Step 4: public + the waitlist button (F5-14 on UP).
  await expect(page.getByRole("radio", { name: /^공개/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "유료 판매 오픈 알림 신청" }).click();
  await expect(
    page.getByText("신청했어요", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "검사하고 올리기" }).click();
  await expect(page.getByText("레시피를 공개했어요")).toBeVisible({
    timeout: 20_000,
  });

  // Shows up in market search right away.
  await page.goto(`/market?q=${encodeURIComponent(tag)}`);
  await expect(
    page.getByRole("link", { name: new RegExp(title) }).first(),
  ).toBeVisible();

  // Seller center: live, and the waitlist remembers the sign-up.
  await page.goto("/my/seller");
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: title })
      .getByText("공개 중", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("신청했어요", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
});
