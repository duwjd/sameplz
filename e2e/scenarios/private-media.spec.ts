// D18 (B): a recipe's results are reachable at the public URL only while the recipe is public.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { loginAsNewUser } from "../fixtures/auth";
import { adminDb, callSweeper } from "../fixtures/play";
import { approveVersion, submitRecipeAs } from "../fixtures/recipes";

const publicUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"}/storage/v1/object/public/recipe-media/${path}`;

/** D18 moves run in the sweeper; another worker's sweep may hold the recipe's lease for a moment. */
async function publicStatus(request: APIRequestContext, path: string) {
  await callSweeper(request);
  return (await request.get(publicUrl(path))).status();
}

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
  await expect
    .poll(() => publicStatus(request, r.mediaPath))
    .toBeGreaterThanOrEqual(400);

  await approveVersion(r.versionId);
  await expect.poll(() => publicStatus(request, r.mediaPath)).toBe(200);
  const db = adminDb();
  expect(
    (await db.storage.from("recipe-media-draft").info(r.mediaPath)).error,
  ).not.toBeNull();

  await db.from("recipes").update({ status: "private" }).eq("id", r.recipeId);
  await expect
    .poll(() => publicStatus(request, r.mediaPath))
    .toBeGreaterThanOrEqual(400);
  // Still there for the owner (signed URL from the draft bucket).
  expect(
    (await db.storage.from("recipe-media-draft").info(r.mediaPath)).error,
  ).toBeNull();
});
