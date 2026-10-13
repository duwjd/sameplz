import { describe, expect, it } from "vitest";
import { readShareRef, saveShareRef } from "./share-ref";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("share ref (F2-3)", () => {
  it("keeps the code for the same recipe within 30 minutes", () => {
    const s = memoryStorage();
    saveShareRef("rlinkedin01", "demo01", s, 0);
    expect(readShareRef("rlinkedin01", s, 29 * 60 * 1000)).toBe("demo01");
  });
  it("ignores other recipes, expired or malformed codes", () => {
    const s = memoryStorage();
    saveShareRef("rlinkedin01", "demo01", s, 0);
    expect(readShareRef("rcafetone01", s, 1000)).toBeNull();
    expect(readShareRef("rlinkedin01", s, 31 * 60 * 1000)).toBeNull();
    saveShareRef("rlinkedin01", "BAD CODE", s, 0);
    expect(readShareRef("rlinkedin01", s, 1000)).toBeNull();
  });
});
