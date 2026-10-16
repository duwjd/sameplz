// D21 GA4 events. No-ops without NEXT_PUBLIC_GA_ID or before gtag loads. Parameters are public ids and
// counts only — never user ids, emails, prompts or variable values (privacy policy §4).
type Params = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsEvent = "same_claim" | "same_cert_post";

/** Paths where nothing is sent — views or events (private screens, privacy policy §4). */
export const UNTRACKED = [
  "/my",
  "/play",
  "/admin",
  "/welcome",
  "/auth",
  "/blocked",
];
export const isTracked = (path: string) =>
  !UNTRACKED.some((p) => path === p || path.startsWith(`${p}/`));

export function track(event: AnalyticsEvent, params: Params = {}) {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_GA_ID) return;
  if (!isTracked(window.location.pathname)) return;
  // Path only, never the query string (search terms, ref codes).
  window.gtag?.("event", event, {
    ...params,
    page_location: `${window.location.origin}${window.location.pathname}`,
  });
}
