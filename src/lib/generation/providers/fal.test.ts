import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appIdOf, falAdapter, falSignedMessage, verifyWith } from "./fal";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const other = generateKeyPairSync("ed25519");

function signed(body: string, ts = Math.floor(Date.now() / 1000)) {
  const msg = [
    "req-1",
    "user-1",
    String(ts),
    createHash("sha256").update(body, "utf8").digest("hex"),
  ].join("\n");
  const headers = new Headers({
    "x-fal-webhook-request-id": "req-1",
    "x-fal-webhook-user-id": "user-1",
    "x-fal-webhook-timestamp": String(ts),
    "x-fal-webhook-signature": sign(
      null,
      Buffer.from(msg),
      privateKey,
    ).toString("hex"),
  });
  return headers;
}

describe("F4-4 fal webhook signature", () => {
  const body = JSON.stringify({
    request_id: "req-1",
    status: "OK",
    payload: {},
  });

  it("F4-4 accepts a valid ED25519 signature over the raw body", () => {
    const h = signed(body);
    const m = falSignedMessage(h, body)!;
    expect(verifyWith([publicKey], m, h.get("x-fal-webhook-signature")!)).toBe(
      true,
    );
  });
  it("FM-11 rejects a changed body", () => {
    const h = signed(body);
    const m = falSignedMessage(h, body + " ")!;
    expect(verifyWith([publicKey], m, h.get("x-fal-webhook-signature")!)).toBe(
      false,
    );
  });
  it("FM-11 rejects another key", () => {
    const h = signed(body);
    expect(
      verifyWith(
        [other.publicKey],
        falSignedMessage(h, body)!,
        h.get("x-fal-webhook-signature")!,
      ),
    ).toBe(false);
  });
  it("FM-11 rejects a replayed timestamp outside ±300 s", () => {
    const h = signed(body, Math.floor(Date.now() / 1000) - 301);
    expect(falSignedMessage(h, body)).toBeNull();
  });
  it("FM-11 rejects missing headers and malformed signatures", () => {
    expect(falSignedMessage(new Headers(), body)).toBeNull();
    const h = signed(body);
    expect(verifyWith([publicKey], falSignedMessage(h, body)!, "zz")).toBe(
      false,
    );
  });
});

describe("F4-4 fal events", () => {
  it("F4-4 OK with an image is a success with one output", () => {
    const e = falAdapter.parseEvent(
      JSON.stringify({
        request_id: "r",
        status: "OK",
        payload: {
          images: [
            { url: "https://v3.fal.media/a.png" },
            { url: "https://v3.fal.media/b.png" },
          ],
        },
      }),
    );
    expect(e).toEqual({
      requestId: "r",
      outcome: { state: "succeeded", outputs: ["https://v3.fal.media/a.png"] },
    });
  });
  it("F4-4 OK with a video", () => {
    expect(
      falAdapter.parseEvent(
        JSON.stringify({
          request_id: "r",
          status: "OK",
          payload: { video: { url: "https://fal.media/v.mp4" } },
        }),
      )?.outcome,
    ).toEqual({ state: "succeeded", outputs: ["https://fal.media/v.mp4"] });
  });
  it("F4-4 OK without payload (large result) needs a lookup", () => {
    expect(
      falAdapter.parseEvent(
        JSON.stringify({ request_id: "r", status: "OK", payload: null }),
      )?.outcome,
    ).toEqual({
      state: "pending",
    });
  });
  it("FM-4 content_policy_violation is a safety block", () => {
    const e = falAdapter.parseEvent(
      JSON.stringify({
        request_id: "r",
        status: "ERROR",
        payload: { detail: [{ type: "content_policy_violation", msg: "x" }] },
      }),
    );
    expect(e?.outcome).toEqual({ state: "safety_blocked" });
  });
  it("FM-5 other errors are model errors", () => {
    expect(
      falAdapter.parseEvent(
        JSON.stringify({ request_id: "r", status: "ERROR", error: "boom" }),
      )?.outcome,
    ).toEqual({
      state: "failed",
      code: "MODEL_ERROR",
    });
  });
  it("F4-4 garbage is ignored", () => {
    expect(falAdapter.parseEvent("not json")).toBeNull();
    expect(falAdapter.parseEvent(JSON.stringify({ status: "OK" }))).toBeNull();
  });
  it("F4-3 status / result URLs use owner/app only", () => {
    expect(appIdOf("fal-ai/kling-video/v3/pro/text-to-video")).toBe(
      "fal-ai/kling-video",
    );
    expect(appIdOf("openai/gpt-image-2")).toBe("openai/gpt-image-2");
  });
  it("F4-4 outputs are only fetched from fal hosts over https", async () => {
    expect(
      await falAdapter.fetchOutput("http://v3.fal.media/a.png", 10),
    ).toBeNull();
    expect(
      await falAdapter.fetchOutput("https://evil.example/a.png", 10),
    ).toBeNull();
    expect(
      await falAdapter.fetchOutput("https://fal.media.evil.example/a.png", 10),
    ).toBeNull();
  });
});
