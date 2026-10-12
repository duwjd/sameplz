import { defineConfig, devices } from "@playwright/test";

// Runs against the local app (pnpm dev / pnpm start) and local Supabase. See e2e/CLAUDE.md.
export default defineConfig({
  testDir: "./e2e/scenarios",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
