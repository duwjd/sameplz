import { describe, expect, it } from "vitest";
import { formatCount, formatCredit, formatWon } from "./format";

describe("formatWon", () => {
  it("shows 무료 for 0 and won with separators otherwise", () => {
    expect(formatWon(0)).toBe("무료");
    expect(formatWon(9900)).toBe("9,900원");
  });
});

describe("formatCount", () => {
  it("abbreviates to 만/천 with one decimal and drops .0", () => {
    expect(formatCount(12400)).toBe("1.2만");
    expect(formatCount(10000)).toBe("1만");
    expect(formatCount(3240)).toBe("3.2천");
    expect(formatCount(412)).toBe("412");
  });
});

describe("formatCredit", () => {
  it("appends C with separators", () => {
    expect(formatCredit(1240)).toBe("1,240C");
  });
});
