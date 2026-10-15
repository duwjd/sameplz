import { describe, expect, it } from "vitest";
import { buildInput, checkVariables, renderPrompt } from "./input";

describe("PLAY-02 variables", () => {
  it("PLAY-02 every declared [변수] needs a non-empty value", () => {
    expect(
      checkVariables(["상품명", "톤"], { 상품명: "텀블러", 톤: " " }),
    ).toEqual([{ name: "톤", code: "EMPTY" }]);
  });
  it("PLAY-02 refuses values over 500 chars and undeclared names", () => {
    expect(checkVariables(["a"], { a: "x".repeat(501), b: "y" })).toEqual([
      { name: "a", code: "TOO_LONG" },
      { name: "b", code: "UNKNOWN" },
    ]);
  });
  it("PLAY-02 passes when every variable is filled", () => {
    expect(checkVariables(["a"], { a: "ok" })).toEqual([]);
  });
});

describe("F4-2 server-side render", () => {
  it("F4-2 replaces declared tokens, keeps unknown brackets", () => {
    expect(
      renderPrompt("[상품명] 사진, [ 톤 ] 느낌, [기타]", {
        상품명: "텀블러",
        톤: "따뜻한",
      }),
    ).toBe("텀블러 사진, 따뜻한 느낌, [기타]");
  });
  it("F4-2 a value cannot inject another variable (single pass)", () => {
    expect(renderPrompt("[a] / [b]", { a: "[b]", b: "B" })).toBe("[b] / B");
  });
  it("F4-2 repeated tokens all render", () => {
    expect(renderPrompt("[a]-[a]", { a: "x" })).toBe("x-x");
  });
});

describe("F4-3 provider input", () => {
  it("F4-3 image: one output, WxH size becomes {width,height}", () => {
    expect(
      buildInput({
        kind: "image",
        prompt: "p",
        params: { image_size: "1024x768", quality: "medium" },
        refParam: null,
        refUrls: [],
      }),
    ).toEqual({
      prompt: "p",
      image_size: { width: 1024, height: 768 },
      quality: "medium",
      num_images: 1,
    });
  });
  it("F4-8 references go to the model's list or single param", () => {
    expect(
      buildInput({
        kind: "image",
        prompt: "p",
        params: {},
        refParam: "image_urls",
        refUrls: ["u1", "u2"],
      }).image_urls,
    ).toEqual(["u1", "u2"]);
    const v = buildInput({
      kind: "video",
      prompt: "p",
      params: { duration: "5" },
      refParam: "start_image_url",
      refUrls: ["u1"],
    });
    expect(v).toEqual({ prompt: "p", duration: "5", start_image_url: "u1" });
    expect(v).not.toHaveProperty("num_images");
  });
});
