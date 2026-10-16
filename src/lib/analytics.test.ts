import { describe, expect, it } from "vitest";
import { isTracked } from "./analytics";

describe("D21 GA4 paths", () => {
  it("never tracks private screens (privacy policy §4)", () => {
    for (const p of [
      "/my",
      "/my/library",
      "/play",
      "/admin/users/x",
      "/welcome",
      "/auth/kakao",
      "/blocked",
    ])
      expect(isTracked(p), p).toBe(false);
  });
  it("tracks public screens", () => {
    for (const p of [
      "/",
      "/market",
      "/r/rcafetone01",
      "/gallery",
      "/guide",
      "/mypage-like-slug",
    ])
      expect(isTracked(p), p).toBe(true);
  });
});
