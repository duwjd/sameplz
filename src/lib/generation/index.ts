// Generation provider selection (D8). Tests, CI and e2e always run GENERATION_PROVIDER=mock; the mock
// adapter is never reachable when the server runs a real provider.
import "server-only";
import { falAdapter } from "./providers/fal";
import { mockAdapter } from "./providers/mock";
import type { ProviderAdapter, ProviderName } from "./types";

export function activeProvider(): ProviderName {
  return process.env.GENERATION_PROVIDER === "mock" ? "mock" : "fal";
}

/** The adapter for a webhook path segment; null for an unknown or inactive provider. */
export function adapterFor(name: string): ProviderAdapter | null {
  if (name !== activeProvider()) return null;
  return name === "mock" ? mockAdapter : falAdapter;
}

export const activeAdapter = (): ProviderAdapter =>
  activeProvider() === "mock" ? mockAdapter : falAdapter;

/** Public base URL the provider calls back (GENERATION_WEBHOOK_BASE_URL, else the site URL). */
export function webhookBase(): string | null {
  const base =
    process.env.GENERATION_WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  return base ? base.replace(/\/$/, "") : null;
}

export * from "./types";
