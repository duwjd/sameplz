import { expect, test } from "@playwright/test";

test("app responds on /", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
});
