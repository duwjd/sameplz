// D18 (B): a recipe's results are reachable at the public URL only while the recipe is public.
import { expect, test } from "@playwright/test";
import { loginAsNewUser } from "../fixtures/auth";
import { adminDb, callSweeper } from "../fixtures/play";
import { approveVersion, submitRecipeAs } from "../fixtures/recipes";

const publicUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/storage/v1/object/public/recipe-media/${path}`;

test("D18 results stay private under review, go public on approval, and leave again when made private", async ({
  context,
  request,
}) => {
  const creator = await loginAsNewUser(context, { completeSignup: true });
  // An agent always waits for a person (D10): the version is in review.
  const r = await submitRecipeAs(creator.id, {
    category: "agent",
    title: "비공개 결과 시험",
    mediaBucket: "recipe-media-draft",
  });
  expect(r.status).toBe("in_review");
  expect((await callSweeper(request)).status()).toBe(200);
  expect(
    (await request.get(publicUrl(r.mediaPath))).status(),
  ).toBeGreaterThanOrEqual(400);

  await approveVersion(r.versionId);
  expect((await callSweeper(request)).status()).toBe(200);
  expect((await request.get(publicUrl(r.mediaPath))).status()).toBe(200);
  const db = adminDb();
  expect(
    (await db.storage.from("recipe-media-draft").info(r.mediaPath)).error,
  ).not.toBeNull();

  await db.from("recipes").update({ status: "private" }).eq("id", r.recipeId);
  expect((await callSweeper(request)).status()).toBe(200);
  expect(
    (await request.get(publicUrl(r.mediaPath))).status(),
  ).toBeGreaterThanOrEqual(400);
  // Still there for the owner (signed URL from the draft bucket).
  expect(
    (await db.storage.from("recipe-media-draft").info(r.mediaPath)).error,
  ).toBeNull();
});
