import { beforeEach, describe, expect, it } from "vitest";
import { clearIntent, readIntent, saveIntent } from "./intent";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("login intent (F7-1)", () => {
  let s: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    s = memoryStorage();
  });

  it("round-trips next + follow action", () => {
    saveIntent(
      { next: "/market?q=a", action: { type: "follow", handle: "photok" } },
      s,
      1000,
    );
    expect(readIntent(s, 2000)).toEqual({
      next: "/market?q=a",
      action: { type: "follow", handle: "photok" },
    });
  });

  it("expires after 30 minutes and is removed", () => {
    saveIntent({ next: "/" }, s, 0);
    expect(readIntent(s, 31 * 60 * 1000)).toBeNull();
    expect(s.getItem("sp_login_intent")).toBeNull();
  });

  it("sanitizes next and drops malformed actions", () => {
    s.setItem(
      "sp_login_intent",
      JSON.stringify({
        next: "https://evil.example",
        action: { type: "follow", handle: "Bad Handle" },
        savedAt: 0,
      }),
    );
    expect(readIntent(s, 1)).toEqual({ next: "/", action: undefined });
  });

  it("clears on cancel", () => {
    saveIntent({ next: "/" }, s);
    clearIntent(s);
    expect(readIntent(s)).toBeNull();
  });
});
