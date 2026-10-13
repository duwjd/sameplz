import { describe, expect, it } from "vitest";
import { safeNext, withAuthError } from "./next-path";

describe("safeNext", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNext("/market?q=세무#top")).toBe(
      "/market?q=%EC%84%B8%EB%AC%B4#top",
    );
    expect(safeNext("/")).toBe("/");
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "market",
    "/a\nb",
  ])("falls back to / for %s", (v) => {
    expect(safeNext(v)).toBe("/");
  });
});

describe("withAuthError", () => {
  it("adds auth_error and keeps the existing query", () => {
    expect(withAuthError("/market?q=a", "server_error")).toBe(
      "/market?q=a&auth_error=server_error",
    );
    expect(withAuthError("https://evil.example", "x")).toBe("/?auth_error=x");
  });
});

describe("safeNext — normalization bypasses (security review)", () => {
  it.each([
    "/..//evil.example",
    "/.//evil.example",
    "/%2e%2e//evil.example",
    "/a/..//evil.example",
    "/a/../..//evil.example",
  ])("rejects %s", (v) => {
    expect(safeNext(v)).toBe("/");
  });

  it("is idempotent", () => {
    for (const v of [
      "/market?q=a",
      "/..//evil.example",
      "/welcome?next=%2Fmarket",
    ]) {
      expect(safeNext(safeNext(v))).toBe(safeNext(v));
    }
  });
});
