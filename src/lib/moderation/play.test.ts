import { afterEach, describe, expect, it, vi } from "vitest";
import { checkImage, checkRunText, koreanBlocked } from "./play";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("F4-7 run input moderation", () => {
  it("F4-7 Korean blocked terms match across spacing", () => {
    expect(koreanBlocked("아동 포르노 사진")).toBe(true);
    expect(koreanBlocked("귀여운 강아지 사진")).toBe(false);
  });
  it("F4-7 blocked words refuse before any provider call", async () => {
    vi.stubEnv("MODERATION_PROVIDER", "live");
    vi.stubEnv("OPENAI_API_KEY", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await checkRunText(["미성년자 누드"])).toBe("blocked");
    expect(f).not.toHaveBeenCalled();
  });
  it("F4-7 no key in live mode is unavailable (the run is refused, not let through)", async () => {
    vi.stubEnv("MODERATION_PROVIDER", "live");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await checkRunText(["강아지"])).toBe("unavailable");
    expect(await checkImage("https://example.test/a.png")).toBe("unavailable");
  });
  it("F4-7 omni-moderation flagged → blocked, error → unavailable", async () => {
    vi.stubEnv("MODERATION_PROVIDER", "live");
    vi.stubEnv("OPENAI_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              results: [{ flagged: false }, { flagged: true }],
            }),
          ),
      ),
    );
    expect(await checkRunText(["a", "b"])).toBe("blocked");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500 })),
    );
    expect(await checkRunText(["a"])).toBe("unavailable");
  });
  it("F4-7 mock mode is deterministic", async () => {
    vi.stubEnv("MODERATION_PROVIDER", "mock");
    expect(await checkRunText(["[[mock:block]] x"])).toBe("blocked");
    expect(await checkRunText(["fine"])).toBe("pass");
    expect(await checkRunText([" "])).toBe("pass");
  });
});
