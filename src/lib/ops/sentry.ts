// D21 error tracking without the Sentry SDK: one event per error, posted as an envelope to the DSN's
// project. Off without a DSN. Never sends request bodies, cookies, headers, query strings or user ids,
// and strips prompt-like fields from messages and stacks (hidden-content rule 5, absolute rule 7).

export interface ParsedDsn {
  url: string;
  key: string;
}

/** https://<key>@<host>/<project> → envelope endpoint + public key; null when unusable. */
export function parseDsn(dsn: string | undefined | null): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+|\/+$/g, "");
    if (u.protocol !== "https:" || !u.username || !/^\d+$/.test(project))
      return null;
    return {
      url: `https://${u.host}/api/${project}/envelope/`,
      key: u.username,
    };
  } catch {
    return null;
  }
}

// Any key that contains one of these words (user_prompt, negative_prompt, promptText, sb-access-token…),
// quoted, escaped-quoted or bare; a bare value is taken to the end of the clause.
const SECRET_KEYS =
  /(\\?["']?)([\w-]*(?:prompt|body|input|variables|template|rendered|original|authorization|cookie|token|secret|password|answer|caption|bio)[\w-]*)\1\s*[:=]\s*(\\?"(?:[^"\\]|\\.)*?\\?"|'(?:[^'\\]|\\.)*'|[^\n,;}&]+)/gi;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const SB_KEY = /\bsb_(secret|publishable)_[A-Za-z0-9_-]+/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Postgres echoes row values and inputs.
const PG_ROW = /(Failing row contains|Key) \(.*?\)( =\(.*?\))?/g;
// Long quoted text in a message is user content more often than not (e.g. `"…" is not valid JSON`).
const LONG_QUOTED = /"[^"\n]{30,}"|'[^'\n]{30,}'/g;

/** Redacts prompt-like fields, credentials, row echoes, long quoted text and emails; caps the length. */
export function scrub(text: string, max = 2000): string {
  return text
    .replace(BEARER, "$1 [redacted]")
    .replace(JWT, "[jwt]")
    .replace(
      SECRET_KEYS,
      (_m, q: string, k: string) => `${q}${k}${q}=[redacted]`,
    )
    .replace(SB_KEY, "sb_$1_[redacted]")
    .replace(PG_ROW, "$1 ([redacted])")
    .replace(LONG_QUOTED, '"[redacted]"')
    .replace(EMAIL, "[email]")
    .slice(0, max);
}

/** Screens and APIs where members type prompts or see their own data: no message text at all. */
const PRIVATE_PATH = /^\/(my|play|admin|welcome|api\/play)(\/|$)/;

/** Path only: no query string (search terms, ref codes, tokens). */
export const pathOnly = (pathOrUrl: string) =>
  pathOrUrl.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0] || "/";

export interface ErrorReport {
  error: unknown;
  /** "server" | "client" | "cron" … */
  source: string;
  path?: string;
  method?: string;
  tags?: Record<string, string>;
}

const hex32 = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

export function buildEnvelope(r: ErrorReport, dsn: string, now = new Date()) {
  const err = r.error instanceof Error ? r.error : null;
  const digest =
    typeof r.error === "object" && r.error !== null && "digest" in r.error
      ? String((r.error as { digest: unknown }).digest)
      : undefined;
  const eventId = hex32();
  const quiet = r.path ? PRIVATE_PATH.test(pathOnly(r.path)) : false;
  const event = {
    event_id: eventId,
    timestamp: now.toISOString(),
    platform: "javascript",
    level: "error",
    environment:
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
    exception: {
      values: [
        {
          type: err?.name ?? "Error",
          value: quiet
            ? "[message withheld on a private screen]"
            : scrub(err?.message ?? String(r.error), 500),
        },
      ],
    },
    tags: {
      source: r.source,
      ...(r.method ? { method: r.method } : {}),
      ...(digest ? { digest } : {}),
      ...r.tags,
    },
    ...(r.path ? { transaction: pathOnly(r.path) } : {}),
    // On private screens keep the frames (file:line) and drop the message line.
    extra: err?.stack
      ? {
          stack: scrub(
            quiet ? err.stack.split("\n").slice(1).join("\n") : err.stack,
            4000,
          ),
        }
      : {},
  };
  return {
    eventId,
    body: [
      JSON.stringify({ event_id: eventId, sent_at: now.toISOString(), dsn }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event),
    ].join("\n"),
  };
}

/** Fire one event; resolves false (never throws) when off or failing. */
export async function captureError(
  r: ErrorReport,
  dsn: string | undefined = process.env.SENTRY_DSN ??
    process.env.NEXT_PUBLIC_SENTRY_DSN,
): Promise<boolean> {
  const parsed = parseDsn(dsn);
  if (!parsed || !dsn) return false;
  try {
    const { body } = buildEnvelope(r, dsn);
    const res = await fetch(parsed.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=sameplz/1`,
      },
      body,
      signal: AbortSignal.timeout(5000),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}
