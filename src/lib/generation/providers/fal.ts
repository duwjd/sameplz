// fal queue adapter (D8). Submit → webhook (ED25519 over request_id\nuser_id\ntimestamp\nsha256(body))
// → status/result lookups for the sweeper. Wire objects stay inside this file.
import "server-only";
import {
  createHash,
  createPublicKey,
  verify,
  type KeyObject,
} from "node:crypto";
import {
  ProviderSubmitError,
  type ProviderAdapter,
  type ProviderOutcome,
  type WebhookEvent,
} from "../types";

const QUEUE = "https://queue.fal.run";
const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
const JWKS_TTL_MS = 12 * 3600 * 1000;
const SKEW_SECONDS = 300;
const TIMEOUT_MS = 20_000;
const JWKS_FORCE_MIN_MS = 5 * 60 * 1000;
/** fal result files come from its CDN only; redirects are re-checked against the same list. */
const OUTPUT_HOSTS = [/^([a-z0-9-]+\.)*fal\.media$/];
export const isOutputHost = (u: URL) =>
  u.protocol === "https:" && OUTPUT_HOSTS.some((h) => h.test(u.hostname));

function key(): string {
  const k = process.env.FAL_KEY;
  if (!k) throw new ProviderSubmitError("transient");
  return k;
}

/** Status / result / cancel live under owner/app; the endpoint subpath is not part of them. */
export function appIdOf(endpoint: string): string {
  return endpoint.split("/").slice(0, 2).join("/");
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        authorization: `Key ${key()}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

const isSafety = (body: unknown) =>
  JSON.stringify(body ?? "").includes("content_policy_violation");

function outputsOf(payload: unknown): string[] {
  const p = payload as {
    images?: { url?: unknown }[];
    image?: { url?: unknown };
    video?: { url?: unknown };
  } | null;
  const urls = [
    ...(Array.isArray(p?.images) ? p.images.map((i) => i?.url) : []),
    p?.image?.url,
    p?.video?.url,
  ];
  return urls.filter((u): u is string => typeof u === "string").slice(0, 1);
}

let jwks: { at: number; keys: KeyObject[] } | null = null;
let lastFetchAt = 0;

/** Cached ED25519 keys. A forced refresh (key rotation) happens at most once per 5 minutes. */
async function publicKeys(force = false): Promise<KeyObject[]> {
  const fresh = jwks && Date.now() - jwks.at < JWKS_TTL_MS;
  if (fresh && (!force || Date.now() - lastFetchAt < JWKS_FORCE_MIN_MS)) return jwks!.keys;
  if (!fresh && jwks && Date.now() - lastFetchAt < 10_000) return jwks.keys;
  lastFetchAt = Date.now();
  let body: { keys?: { kty?: string; crv?: string; x?: string }[] } | null = null;
  try {
    const res = await fetch(JWKS_URL, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
    body = res.ok ? await res.json() : null;
  } catch {
    body = null;
  }
  if (!body || !Array.isArray(body.keys)) return jwks?.keys ?? [];
  const keys = body.keys
    .filter(
      (k) => k.kty === "OKP" && k.crv === "Ed25519" && typeof k.x === "string",
    )
    .flatMap((k) => {
      try {
        return [createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: k.x! }, format: "jwk" })];
      } catch {
        return [];
      }
    });
  jwks = { at: Date.now(), keys };
  return keys;
}

export function falSignedMessage(h: Headers, rawBody: string): Buffer | null {
  const requestId = h.get("x-fal-webhook-request-id");
  const userId = h.get("x-fal-webhook-user-id");
  const ts = h.get("x-fal-webhook-timestamp");
  if (!requestId || !userId || !ts || !/^\d{9,11}$/.test(ts)) return null;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > SKEW_SECONDS) return null;
  const digest = createHash("sha256").update(rawBody, "utf8").digest("hex");
  return Buffer.from([requestId, userId, ts, digest].join("\n"), "utf8");
}

function sameRequestId(h: Headers, rawBody: string): boolean {
  try {
    return (JSON.parse(rawBody) as { request_id?: unknown }).request_id === h.get("x-fal-webhook-request-id");
  } catch {
    return false;
  }
}

export function verifyWith(
  keys: KeyObject[],
  message: Buffer,
  signatureHex: string,
): boolean {
  if (!/^[0-9a-f]{128}$/i.test(signatureHex)) return false;
  const sig = Buffer.from(signatureHex, "hex");
  return keys.some((k) => {
    try {
      return verify(null, message, k, sig);
    } catch {
      return false;
    }
  });
}

export const falAdapter: ProviderAdapter = {
  name: "fal",

  async submit({ endpoint, input, webhookUrl }) {
    let res: Response;
    try {
      res = await call(
        `${QUEUE}/${endpoint}?fal_webhook=${encodeURIComponent(webhookUrl)}`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
    } catch (e) {
      if (e instanceof ProviderSubmitError) throw e;
      // Timeout / network: the job may already be queued at fal — never resubmit it.
      throw new ProviderSubmitError("unknown");
    }
    if (res.status === 429) throw new ProviderSubmitError("rate_limited");
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (isSafety(body)) throw new ProviderSubmitError("safety_blocked");
      throw new ProviderSubmitError(
        res.status >= 500 ? "transient" : "invalid_input",
      );
    }
    const body = (await res.json().catch(() => null)) as { request_id?: unknown } | null;
    if (typeof body?.request_id !== "string") throw new ProviderSubmitError("unknown");
    return { requestId: body.request_id };
  },

  async verifyWebhook(headers, rawBody) {
    const message = falSignedMessage(headers, rawBody);
    const sig = headers.get("x-fal-webhook-signature") ?? "";
    if (!message) return false;
    // fal signs every account's webhooks with the same keys: pin ours, and the signed request id
    // must be the one in the body.
    const account = process.env.FAL_USER_ID;
    if (account && headers.get("x-fal-webhook-user-id") !== account) return false;
    if (!account && process.env.VERCEL_ENV === "production") return false;
    if (!sameRequestId(headers, rawBody)) return false;
    if (verifyWith(await publicKeys(), message, sig)) return true;
    // Key rotation: refetch once before refusing.
    return verifyWith(await publicKeys(true), message, sig);
  },

  parseEvent(rawBody): WebhookEvent | null {
    let body: {
      request_id?: unknown;
      status?: unknown;
      payload?: unknown;
      error?: unknown;
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return null;
    }
    if (typeof body.request_id !== "string") return null;
    if (body.status === "OK") {
      const outputs = outputsOf(body.payload);
      // Large payloads arrive without `payload` (payload_error): fetch the result instead.
      return {
        requestId: body.request_id,
        outcome: outputs.length
          ? { state: "succeeded", outputs }
          : { state: "pending" },
      };
    }
    if (body.status === "ERROR")
      return {
        requestId: body.request_id,
        outcome:
          isSafety(body.payload) || isSafety(body.error)
            ? { state: "safety_blocked" }
            : { state: "failed", code: "MODEL_ERROR" },
      };
    return null;
  },

  async poll(endpoint, requestId): Promise<ProviderOutcome> {
    const base = `${QUEUE}/${appIdOf(endpoint)}/requests/${encodeURIComponent(requestId)}`;
    const st = await call(`${base}/status`).catch(() => null);
    // Unknown / not yet visible: keep waiting; the sweeper expires it after the deadline window.
    if (!st?.ok) return { state: "pending" };
    const status = ((await st.json().catch(() => null)) as { status?: unknown } | null)?.status;
    if (status !== "COMPLETED") return { state: "pending" };
    const res = await call(base).catch(() => null);
    if (!res) return { state: "pending" };
    const body = await res.json().catch(() => null);
    if (res.ok) {
      const outputs = outputsOf(body);
      return outputs.length
        ? { state: "succeeded", outputs }
        : { state: "failed", code: "OUTPUT_LOST" };
    }
    if (isSafety(body)) return { state: "safety_blocked" };
    return res.status >= 500
      ? { state: "pending" }
      : { state: "failed", code: "MODEL_ERROR" };
  },

  async cancel(endpoint, requestId) {
    await call(
      `${QUEUE}/${appIdOf(endpoint)}/requests/${encodeURIComponent(requestId)}/cancel`,
      { method: "PUT" },
    ).catch(() => undefined);
  },

  async fetchOutput(url, maxBytes) {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    if (!isOutputHost(u)) return null;
    return download(u, maxBytes);
  },
};

/** GET with a byte cap. Redirects are followed by hand (max 2), each target re-checked against the CDN list. */
export async function download(
  start: URL,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    let url = start;
    let res = await fetch(url, { signal: ctrl.signal, cache: "no-store", redirect: "manual" });
    for (let hop = 0; res.status >= 300 && res.status < 400; hop++) {
      const next = res.headers.get("location");
      if (hop >= 2 || !next) return null;
      url = new URL(next, url);
      if (!isOutputHost(url)) return null;
      res = await fetch(url, { signal: ctrl.signal, cache: "no-store", redirect: "manual" });
    }
    if (!res.ok || !res.body) return null;
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > maxBytes) return null;
    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const p of parts) {
      bytes.set(p, at);
      at += p.byteLength;
    }
    return {
      bytes,
      contentType: (res.headers.get("content-type") ?? "").split(";")[0].trim(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
