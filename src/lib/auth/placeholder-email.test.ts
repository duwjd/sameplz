import { describe, expect, it } from "vitest";
import { isPlaceholderEmail, realEmail } from "./placeholder-email";

describe("isPlaceholderEmail", () => {
  it("treats Naver placeholders and missing emails as no email", () => {
    expect(isPlaceholderEmail("n_abc@naver.users.sameplz.invalid")).toBe(true);
    expect(isPlaceholderEmail("N_ABC@NAVER.USERS.SAMEPLZ.INVALID")).toBe(true);
    expect(isPlaceholderEmail(null)).toBe(true);
    expect(isPlaceholderEmail("")).toBe(true);
  });

  it("keeps real emails", () => {
    expect(isPlaceholderEmail("someone@gmail.com")).toBe(false);
    expect(realEmail("someone@gmail.com")).toBe("someone@gmail.com");
    expect(realEmail("n_x@naver.users.sameplz.invalid")).toBeNull();
  });
});
