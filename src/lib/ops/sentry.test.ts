import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildEnvelope,
  captureError,
  parseDsn,
  pathOnly,
  scrub,
} from "./sentry";

const DSN = "https://abc123@o42.ingest.us.sentry.io/4507";

describe("D21 sentry reporter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses a DSN into the envelope endpoint", () => {
    expect(parseDsn(DSN)).toEqual({
      url: "https://o42.ingest.us.sentry.io/api/4507/envelope/",
      key: "abc123",
    });
    expect(parseDsn("http://abc@o1.ingest.sentry.io/1")).toBeNull();
    expect(parseDsn("https://o1.ingest.sentry.io/1")).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
  });

  it("hidden-content strips prompts, credentials and emails", () => {
    const out = scrub(
      `failed {"prompt":"SAMEPLZ-SECRET-SAMPLE-01 원문","variables":{"a":1}} body=raw ` +
        `Authorization: Bearer eyJhbGciOi.abc cookie=sb-access=xyz sb_secret_ABCdef user@example.com`,
    );
    expect(out).not.toContain("SAMEPLZ-SECRET-SAMPLE");
    expect(out).not.toContain("eyJhbGciOi");
    expect(out).not.toContain("sb-access=xyz");
    expect(out).not.toContain("sb_secret_ABCdef");
    expect(out).not.toContain("user@example.com");
    expect(out).toContain("[redacted]");
  });

  it("hidden-content also catches prefixed keys, escaped JSON, JWTs, row echoes and long quoted text", () => {
    const cases = [
      '{"user_prompt":"PROMPT-A"}',
      '{"negative_prompt":"PROMPT-B"}',
      "promptText: PROMPT-C two words here",
      '{\\"prompt\\":\\"PROMPT-D\\"}',
      "Failing row contains (abc, PROMPT-E, 3)",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl",
      '"PROMPT-F 푸른 바다 위 등대, 수채화 아주 긴 프롬프트 문장" is not valid JSON',
    ];
    for (const c of cases) {
      const out = scrub(c);
      expect(out, c).not.toMatch(/PROMPT-[A-F]|eyJhbGciOi/);
    }
  });

  it("hidden-content sends no message text from private screens", () => {
    const { body } = buildEnvelope(
      {
        error: new Error("PROMPT-G something"),
        source: "client",
        path: "/play?x=1",
      },
      DSN,
    );
    const e = JSON.parse(body.split("\n")[2]);
    expect(e.exception.values[0].value).not.toContain("PROMPT-G");
    expect(JSON.stringify(e)).not.toContain("PROMPT-G");
  });

  it("sends the path without its query string", () => {
    expect(pathOnly("/market?q=세무&ref=abc123")).toBe("/market");
    expect(pathOnly("https://sameplz.vercel.app/r/x1?t=secret")).toBe("/r/x1");
  });

  it("builds one event with only scrubbed, non-personal fields", () => {
    const err = new Error('bad input {"prompt":"secret text"}');
    const { body } = buildEnvelope(
      {
        error: err,
        source: "server",
        path: "/api/play/runs?x=1",
        method: "POST",
      },
      DSN,
    );
    const [, item, event] = body.split("\n");
    expect(JSON.parse(item)).toEqual({ type: "event" });
    const e = JSON.parse(event);
    expect(e.transaction).toBe("/api/play/runs");
    expect(e.tags).toMatchObject({ source: "server", method: "POST" });
    expect(e.exception.values[0].value).not.toContain("secret text");
    // No user id / email field, no cookie (the stack keeps file paths only).
    expect(Object.keys(e)).not.toContain("user");
    expect(JSON.stringify(e)).not.toMatch(/cookie=|"user"|"email"/i);
  });

  it("does nothing without a DSN", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(
      await captureError(
        { error: new Error("x"), source: "server" },
        undefined,
      ),
    ).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("never throws when the endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(
      await captureError({ error: new Error("x"), source: "server" }, DSN),
    ).toBe(false);
  });
});
