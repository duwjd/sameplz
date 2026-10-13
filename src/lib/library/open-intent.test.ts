import { describe, expect, it } from "vitest";
import { markOpenIntent, takeOpenIntent } from "./open-intent";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("open intent (LIB ?open=)", () => {
  it("F3-5 opens only after the click, once", () => {
    const s = memoryStorage();
    expect(takeOpenIntent("e1", s, 0)).toBe(false); // bare link
    markOpenIntent("e1", s, 0);
    expect(takeOpenIntent("e1", s, 1000)).toBe(true);
    expect(takeOpenIntent("e1", s, 1000)).toBe(false); // consumed
  });
  it("ignores another row or a stale marker", () => {
    const s = memoryStorage();
    markOpenIntent("e1", s, 0);
    expect(takeOpenIntent("e2", s, 1000)).toBe(false);
    markOpenIntent("e1", s, 0);
    expect(takeOpenIntent("e1", s, 61_000)).toBe(false);
  });
});
