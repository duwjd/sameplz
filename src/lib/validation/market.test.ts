import { describe, expect, it } from "vitest";
import { marketHref, parseMarketQuery } from "./market";

describe("parseMarketQuery", () => {
  it("F1-4 defaults: popular sort, page 1, no filters", () => {
    expect(parseMarketQuery({})).toEqual({
      q: null,
      category: null,
      job: null,
      tool: null,
      sort: "popular",
      page: 1,
    });
  });

  it("trims the query, caps it at 100 chars and drops blank queries", () => {
    expect(parseMarketQuery({ q: "  세무  " }).q).toBe("세무");
    expect(parseMarketQuery({ q: "가".repeat(150) }).q).toHaveLength(100);
    expect(parseMarketQuery({ q: "   " }).q).toBeNull();
  });

  it("drops invalid sort, page, codes and categories instead of failing", () => {
    const q = parseMarketQuery({
      sort: "price",
      page: "-3",
      job: "DROP TABLE",
      category: "x",
    });
    expect(q.sort).toBe("popular");
    expect(q.page).toBe(1);
    expect(q.job).toBeNull();
    expect(q.category).toBeNull();
  });

  it("takes the category from the path slug before the query string", () => {
    expect(parseMarketQuery({ category: "agent" }, "skills").category).toBe(
      "skill",
    );
    expect(parseMarketQuery({ category: "agent" }).category).toBe("agent");
  });

  it("uses the first value of repeated params", () => {
    expect(parseMarketQuery({ q: ["보고", "엑셀"] }).q).toBe("보고");
  });
});

describe("marketHref", () => {
  it("omits defaults and keeps category in the query only on /market", () => {
    expect(marketHref("/market", { sort: "popular", page: 1 })).toBe("/market");
    expect(marketHref("/market", { q: "세무", category: "skill" })).toBe(
      "/market?q=%EC%84%B8%EB%AC%B4&category=skill",
    );
    expect(
      marketHref("/market/skills", { category: "skill", sort: "new" }),
    ).toBe("/market/skills?sort=new");
  });
});
