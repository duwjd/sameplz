// D21: server errors go to Sentry (only when a DSN is set). The reporter keeps the path and method
// and drops bodies, headers, cookies and query strings (src/lib/ops/sentry.ts).
import type { Instrumentation } from "next";

export function register() {}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const { captureError } = await import("@/lib/ops/sentry");
  await captureError({
    error,
    source: "server",
    path: request.path,
    method: request.method,
    tags: { router: context.routerKind, route_type: context.routeType },
  });
};
