// SCN 12 (W6, MVP): withdrawal tells what disappears (free credits) → the confirm check is required →
// withdraw → guest home → the SAME 인증 stays as 「탈퇴한 회원」 → the same login starts a new member.
import { expect, test } from "@playwright/test";
import { localSupabaseEnv } from "../fixtures/auth";
import { adminDb, loginAsPlayer } from "../fixtures/play";

test("F7-6 SCN 12 withdraw, the SAME 인증 stays as 「탈퇴한 회원」, and the same email starts over", async ({
  page,
  context,
}) => {
  const user = await loginAsPlayer(context);
  const db = adminDb();
  await db.from("entitlements").insert({
    user_id: user.id,
    recipe_id: "aaaaaaaa-0000-0000-0000-000000000004",
    version_id: "bbbbbbbb-0000-0000-0000-000000000004",
    source: "free",
  });
  const title = `떠나기 전 인증 ${Date.now() % 100000}`;
  const { error } = await db.from("gallery_posts").insert({
    author_id: user.id,
    recipe_id: "aaaaaaaa-0000-0000-0000-000000000004",
    kind: "same_cert",
    title,
    status: "visible",
  });
  expect(error).toBeNull();

  await page.goto("/my/account");
  await page.getByRole("button", { name: "회원 탈퇴하기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("이번 달 무료 크레딧 270C")).toBeVisible();
  await dialog.getByRole("button", { name: "탈퇴하기" }).click();
  await expect(
    dialog.getByText("안내를 확인했다는 칸에 체크해 주세요."),
  ).toBeVisible();
  await dialog.getByText("위 내용을 확인했고 탈퇴할게요").click();
  await dialog.getByRole("button", { name: "탈퇴하기" }).click();

  await expect(page).toHaveURL(/\/\?withdrawn=1$/, { timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: "로그인" }).filter({ visible: true }),
  ).toBeVisible();

  await page.goto("/gallery");
  const post = page
    .getByRole("list", { name: "갤러리" })
    .getByRole("listitem")
    .filter({ hasText: title });
  await expect(post).toContainText("탈퇴한 회원");

  const { data: profile } = await db
    .from("profiles")
    .select("deleted_at, nickname")
    .eq("id", user.id)
    .single();
  expect(profile).toMatchObject({ nickname: "탈퇴한 회원" });
  expect(profile!.deleted_at).not.toBeNull();
  const { data: credit } = await db
    .from("credit_accounts")
    .select("available")
    .eq("user_id", user.id)
    .single();
  expect(credit!.available).toBe(0);

  // The same email signs up again as a different, new member.
  const env = localSupabaseEnv();
  const { createClient } = await import("@supabase/supabase-js");
  const again = await createClient(env.url, env.secretKey, {
    auth: { persistSession: false },
  }).auth.admin.createUser({
    email: user.email,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  expect(again.error).toBeNull();
  expect(again.data.user!.id).not.toBe(user.id);
});
