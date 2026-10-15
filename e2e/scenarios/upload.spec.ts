// UP (W4, MVP free upload): 5 steps, step errors with focus (F5-1), drafts (UP-08), layer 1
// rejection with 「고치러 가기」 (F5-3), agents to human review (F5-6), live recipe shows the
// uploaded result. Layer 2 runs with MODERATION_PROVIDER=mock.
import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import { loginAsNewUser } from "../fixtures/auth";

// 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function startPrompt(page: Page) {
  await page.goto("/my/seller/upload");
  await page.getByRole("radio", { name: /프롬프트/ }).click();
  await page.getByRole("radio", { name: "이미지", exact: true }).click();
  await page.getByRole("button", { name: "다음" }).click();
}

async function fillPromptContent(page: Page, title: string, body: string) {
  await page.getByLabel("제목").fill(title);
  await page.getByLabel("한 줄 설명").fill("셀카 한 장으로 프로필 사진");
  await page.getByRole("button", { name: "마케팅·SNS" }).click();
  await page.getByLabel("프롬프트 본문").fill(body);
  await page.locator("#up-prompt-variables-0-description").fill("사진 속 직업");
  await page.locator("#up-prompt-variables-0-example").fill("개발자");
  await page.getByRole("button", { name: "다음" }).click();
}

async function uploadResult(page: Page) {
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "result.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByLabel("결과물 1 설명")).toBeVisible();
  await page.getByLabel("결과물 1 설명").fill("네이비 셔츠 프로필 사진");
}

test.describe("UP 레시피 올리기", () => {
  test("UP 비회원은 로그인 안내", async ({ page }) => {
    await page.goto("/my/seller/upload");
    await expect(
      page.getByText("로그인하면 레시피를 올릴 수 있어요"),
    ).toBeVisible();
  });

  test("F5-1 제목 없이 다음: 칸 아래 오류 + 포커스", async ({
    page,
    context,
  }) => {
    await loginAsNewUser(context, { completeSignup: true });
    await page.goto("/my/seller/upload");
    await page.getByRole("button", { name: "다음" }).click();
    await expect(page.getByText("어떤 레시피인지 골라 주세요.")).toBeVisible();

    await page.getByRole("radio", { name: /프롬프트/ }).click();
    await page.getByRole("radio", { name: "이미지", exact: true }).click();
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "다음" }).click();
    const title = page.getByLabel("제목");
    await expect(page.getByText("제목을 2자 이상 써 주세요.")).toBeVisible();
    await expect(title).toBeFocused();
    await expect(title).toHaveAttribute("aria-invalid", "true");
  });

  test("UP-08 쓰다 나가면 「이어서 / 새로 시작」", async ({
    page,
    context,
  }) => {
    await loginAsNewUser(context, { completeSignup: true });
    await startPrompt(page);
    await page.getByLabel("제목").fill("초안 테스트 레시피");
    // Debounced save; the first server action on a cold dev server compiles first.
    await expect(page.getByText("초안을 저장했어요")).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(
      page.getByRole("status").getByText("쓰던 초안이 있어요"),
    ).toBeVisible();
    await page.getByRole("button", { name: "이어서 쓰기" }).click();
    await expect(page.getByLabel("제목")).toHaveValue("초안 테스트 레시피");

    await page.reload();
    await page.getByRole("button", { name: "새로 시작" }).click();
    await expect(page.getByText("초안을 지웠어요")).toBeVisible();
    await expect(page.getByRole("radio", { name: /프롬프트/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await page.reload();
    await expect(
      page.getByRole("status").getByText("쓰던 초안이 있어요"),
    ).toHaveCount(0);
  });

  test("UP-01 프롬프트 5단계 → 공개 → 상세에 결과물, 원문은 없음", async ({
    page,
    context,
  }) => {
    await loginAsNewUser(context, { completeSignup: true });
    const title = `프로필 사진 ${Date.now() % 100000}`;
    const marker = `UPLOAD-SECRET-${Date.now()}`;
    await startPrompt(page);
    await fillPromptContent(page, title, `${marker} [직업] 느낌의 프로필 사진`);

    // R01: no result → stays on step 3 with the error.
    await page.getByRole("button", { name: "다음" }).click();
    await expect(
      page.getByText("결과물을 1개 이상 올려 주세요."),
    ).toBeVisible();
    await uploadResult(page);
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("radio", { name: /공개/ }).first().click();
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "검사하고 올리기" }).click();

    await expect(page.getByText("레시피를 공개했어요")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "상세 화면 보기" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const img = page.getByRole("img", { name: "네이비 셔츠 프로필 사진" });
    await expect(img).toHaveAttribute(
      "src",
      /\/storage\/v1\/object\/public\/recipe-media\//,
    );
    await expect(page.getByText("사진 속 직업")).toBeVisible();

    const html = await (await page.request.get(page.url())).text();
    expect(html).not.toContain(marker);
    expect(html).toContain('property="og:image"');
  });

  test("F5-3 보이지 않는 문자 → 검사 실패 → 「고치러 가기」", async ({
    page,
    context,
  }) => {
    await loginAsNewUser(context, { completeSignup: true });
    await startPrompt(page);
    await fillPromptContent(page, "숨은 문자 레시피", "프로필​사진 [직업]");
    await uploadResult(page);
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "검사하고 올리기" }).click();

    await expect(
      page.getByText("숨은 지시문이나 보이지 않는 문자가 있어요"),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "고치러 가기" }).first().click();
    await expect(page.getByLabel("프롬프트 본문")).toBeFocused();
  });

  test("F5-6 에이전트는 사람 확인 중", async ({ page, context }) => {
    await loginAsNewUser(context, { completeSignup: true });
    await page.goto("/my/seller/upload");
    await page.getByRole("radio", { name: /에이전트/ }).click();
    await page.getByRole("button", { name: "다음" }).click();

    await page.getByLabel("제목").fill("주문 메일 정리 에이전트");
    await page.getByLabel("한 줄 설명").fill("새 주문 메일을 시트로 정리해요");
    await page.getByRole("button", { name: "커머스·셀러" }).click();
    await page.getByRole("button", { name: "다음" }).click();
    await expect(
      page.getByText("키·비밀번호를 지웠는지 확인해 주세요."),
    ).toBeVisible();
    await expect(page.locator("#up-agent-flow")).toBeFocused();

    await page.locator("#up-agent-flow").fill("새 주문 메일 읽기");
    await page.locator("#up-agent-does").fill("주문을 시트에 정리해요");
    await page
      .locator("#up-agent-doesNot")
      .fill("고객에게 메일을 보내지 않아요");
    await page.getByLabel("설정·지침 원문").fill('{"nodes":[]}');
    await page.getByText("API 키·비밀번호·토큰을 지웠어요").click();
    await page.getByRole("button", { name: "다음" }).click();
    await uploadResult(page);
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "검사하고 올리기" }).click();
    await expect(page.getByText("사람이 확인하고 있어요")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("F5-5 스킬 zip: 스크립트가 있으면 사람 확인, 폴더 이름이 다르면 거절", async ({
    page,
    context,
  }) => {
    await loginAsNewUser(context, { completeSignup: true });
    const md =
      "---\nname: tax-checklist\ndescription: 종합소득세 서류를 점검해요.\n---\n\n# 점검표\n";
    await page.goto("/my/seller/upload");
    await page.getByRole("radio", { name: /스킬/ }).click();
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByLabel("제목").fill("세금 서류 점검 스킬");
    await page.getByLabel("한 줄 설명").fill("빠진 서류를 찾아 줘요");
    await page.getByRole("button", { name: "사무·기획" }).click();
    await page.getByRole("radio", { name: /zip 올리기/ }).click();

    const zipInput = page.locator('input[type="file"][accept*="zip"]');
    await zipInput.setInputFiles({
      name: "wrong.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zipSync({ "other-name/SKILL.md": strToU8(md) })),
    });
    await expect(
      page.getByText("폴더 이름과 SKILL.md의 name이 같아야 해요."),
    ).toBeVisible();

    await zipInput.setInputFiles({
      name: "tax-checklist.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(
        zipSync({
          "tax-checklist/SKILL.md": strToU8(md),
          "tax-checklist/scripts/run.py": strToU8("print(1)"),
        }),
      ),
    });
    await expect(page.getByText("tax-checklist · 파일 2개")).toBeVisible();
    await expect(
      page.getByText("스크립트가 있어 사람이 한 번 확인한 뒤 공개돼요."),
    ).toBeVisible();
    await page.getByRole("button", { name: "다음" }).click();
    await uploadResult(page);
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "검사하고 올리기" }).click();
    await expect(page.getByText("사람이 확인하고 있어요")).toBeVisible({
      timeout: 20_000,
    });
  });
});
