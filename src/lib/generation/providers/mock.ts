// Deterministic provider for CI / e2e (GENERATION_PROVIDER=mock, e2e/CLAUDE.md). It calls our own
// webhook shortly after submit. Failure types come from markers in the rendered prompt:
//   [[mock:error]] model error · [[mock:safety]] provider safety block · [[mock:timeout]] no webhook
//   [[mock:rate]] 429 on submit · [[mock:result-block]] result fails our output moderation
import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import {
  ProviderSubmitError,
  type ProviderAdapter,
  type ProviderOutcome,
  type WebhookEvent,
} from "../types";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const MP4_HEAD = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0x00,
  0x00, 0x00, 0x00, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
]);

type Flag = "ok" | "error" | "safety" | "timeout" | "result-block";

function secret(): string {
  const s = process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new ProviderSubmitError("transient");
  return s;
}

export const mockSignature = (body: string) =>
  createHmac("sha256", secret()).update(`mock-webhook:${body}`).digest("hex");

function flagOf(prompt: string): Flag {
  for (const f of ["error", "safety", "timeout", "result-block"] as const)
    if (prompt.includes(`[[mock:${f}]]`)) return f;
  return "ok";
}

function parseRequestId(
  id: string,
): { flag: Flag; kind: "image" | "video" } | null {
  const m =
    /^mock-(ok|error|safety|timeout|result-block)-(image|video)-[0-9a-f-]{36}$/.exec(
      id,
    );
  return m ? { flag: m[1] as Flag, kind: m[2] as "image" | "video" } : null;
}

function outcomeOf(id: string): ProviderOutcome {
  const p = parseRequestId(id);
  if (!p) return { state: "failed", code: "OUTPUT_LOST" };
  if (p.flag === "timeout") return { state: "pending" };
  if (p.flag === "error") return { state: "failed", code: "MODEL_ERROR" };
  if (p.flag === "safety") return { state: "safety_blocked" };
  return { state: "succeeded", outputs: [`mock://${p.kind}/${p.flag}/${id}`] };
}

export const mockAdapter: ProviderAdapter = {
  name: "mock",

  async submit({ endpoint, input, webhookUrl }) {
    const prompt = typeof input.prompt === "string" ? input.prompt : "";
    if (prompt.includes("[[mock:rate]]"))
      throw new ProviderSubmitError("rate_limited");
    const kind = endpoint.includes("video") ? "video" : "image";
    const requestId = `mock-${flagOf(prompt)}-${kind}-${randomUUID()}`;
    const outcome = outcomeOf(requestId);
    if (outcome.state !== "pending") {
      const body = JSON.stringify(
        outcome.state === "succeeded"
          ? {
              request_id: requestId,
              status: "OK",
              payload: { url: outcome.outputs[0] },
            }
          : { request_id: requestId, status: "ERROR", error: outcome.state },
      );
      // Delivered after the submit response, like a real provider.
      setTimeout(() => {
        void fetch(webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-mock-signature": mockSignature(body),
          },
          body,
        }).catch(() => undefined);
      }, 300);
    }
    return { requestId };
  },

  async verifyWebhook(headers, rawBody) {
    const got = headers.get("x-mock-signature") ?? "";
    const want = mockSignature(rawBody);
    return (
      got.length === want.length &&
      timingSafeEqual(Buffer.from(got), Buffer.from(want))
    );
  },

  parseEvent(rawBody): WebhookEvent | null {
    try {
      const body = JSON.parse(rawBody) as { request_id?: unknown };
      return typeof body.request_id === "string"
        ? { requestId: body.request_id, outcome: outcomeOf(body.request_id) }
        : null;
    } catch {
      return null;
    }
  },

  async poll(_endpoint, requestId) {
    return outcomeOf(requestId);
  },

  async cancel() {},

  async fetchOutput(url) {
    const m = /^mock:\/\/(image|video)\//.exec(url);
    if (!m) return null;
    return m[1] === "video"
      ? { bytes: new Uint8Array(MP4_HEAD), contentType: "video/mp4" }
      : {
          // A real-size image so the F4-9 face mark has room (the 1×1 is only a fallback).
          bytes: new Uint8Array(
            await sharp({ create: { width: 256, height: 256, channels: 3, background: "#f4f6f5" } })
              .png()
              .toBuffer()
              .catch(() => PNG_1X1),
          ),
          contentType: "image/png",
        };
  },
};

/** Mock output moderation: the result-block marker travels in the output URL. */
export const mockOutputBlocked = (url: string) =>
  url.includes("/result-block/");
