import { expect, test, type Page } from "@playwright/test";
import { loginAsSeedUser } from "../fixtures/auth";

test("app responds on /", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
});

// SEC (W7 hardening): every response carries the security headers.
test("SEC security headers are set", async ({ page }) => {
  const res = await page.goto("/");
  const h = res!.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["x-powered-by"]).toBeUndefined();
});

function watchCsp(page: Page) {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (
      /Content Security Policy|Refused to (load|connect|execute|apply|frame)/i.test(
        m.text(),
      )
    )
      violations.push(m.text());
  });
  return violations;
}

// The CSP must not block anything the app itself loads (images, media, Supabase, Realtime, styles).
test("SEC main screens load without CSP violations", async ({
  page,
  context,
}) => {
  const violations = watchCsp(page);
  for (const path of ["/", "/market", "/gallery", "/guide", "/r/rlinkedin01"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  await loginAsSeedUser(context, "jiwoo");
  for (const path of ["/my", "/my/library", "/play", "/my/seller/upload"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});

// D21: without NEXT_PUBLIC_GA_ID / a Sentry DSN nothing is loaded or sent.
test("D21 no analytics or error-tracking requests without their keys", async ({ page }) => {
  const outbound: string[] = [];
  page.on("request", (r) => {
    if (/googletagmanager|google-analytics|sentry\.io/.test(r.url())) outbound.push(r.url());
  });
  await page.goto("/");
  await page.goto("/gallery");
  await page.waitForLoadState("networkidle");
  expect(outbound).toEqual([]);
});
