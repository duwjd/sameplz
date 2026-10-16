"use client";
// D21: uncaught browser errors go to Sentry when NEXT_PUBLIC_SENTRY_DSN is set (no user id, no query
// strings, prompt-like fields stripped). At most 20 per page load.
import { useEffect } from "react";
import { captureError } from "@/lib/ops/sentry";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function ErrorReporter() {
  useEffect(() => {
    if (!DSN) return;
    let sent = 0;
    const report = (error: unknown) => {
      if (sent >= 20) return;
      sent++;
      void captureError(
        { error, source: "client", path: window.location.pathname },
        DSN,
      );
    };
    const onError = (e: ErrorEvent) => report(e.error ?? new Error(e.message));
    const onRejection = (e: PromiseRejectionEvent) => report(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
