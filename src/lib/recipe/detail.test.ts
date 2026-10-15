import { describe, expect, it } from "vitest";
import {
  maskedTemplate,
  parseRecipePublic,
  playDisabledReason,
} from "./detail";

const base = {
  id: "aaaaaaaa-0000-0000-0000-000000000018",
  public_id: "rmjposter01",
  category: "prompt",
  prompt_kind: "image",
  title: "레트로 영화 포스터 스타일",
  summary: "요약",
  status: "live",
  stopped_reason: null,
  stopped_at: null,
  price_krw: 0,
  job_codes: ["design"],
  tool_codes: ["midjourney"],
  search_tags: [],
  filters: { ratio: "3/4" },
  published_at: "2026-10-05T00:00:00Z",
  version: {
    id: "bbbbbbbb-0000-0000-0000-000000000018",
    no: 1,
    changelog: "첫 버전",
    approved_at: "2026-10-12T00:00:00Z",
    has_scripts: false,
    meta: {
      variables: [{ name: "인물 사진", example: "상반신" }],
      settings: [{ label: "비율", value: "3:4" }],
    },
  },
  creator: {
    handle: "photok",
    nickname: "사진관K",
    avatar_url: null,
    bio: null,
    is_staff: false,
    expert_badge: null,
  },
  tools: [{ code: "midjourney", label: "Midjourney", has_api: false }],
  media: [],
  files: [],
  stats: { downloads: 7, same_count: 3, likes: 6 },
  forked_from: null,
};

describe("recipe detail payload", () => {
  it("parses the public payload", () => {
    const r = parseRecipePublic(base);
    expect(r?.version.meta.variables).toEqual([{ name: "인물 사진", example: "상반신" }]);
    expect(r?.version.meta.flow).toEqual([]);
  });

  it("drops malformed meta entries instead of failing the page", () => {
    const r = parseRecipePublic({
      ...base,
      version: {
        ...base.version,
        meta: { variables: [{ name: "" }, { name: "제품명" }, 3], regulated: "astrology" },
      },
    });
    expect(r?.version.meta.variables).toEqual([{ name: "제품명" }]);
    expect(r?.version.meta.regulated).toBeUndefined();
  });

  it("F1-7 null / non-recipe payload → 404", () => {
    expect(parseRecipePublic(null)).toBeNull();
    expect(parseRecipePublic({ status: "private" })).toBeNull();
  });

  it("F2-5 tools without an API give the specific reason", () => {
    const r = parseRecipePublic(base)!;
    expect(playDisabledReason(r)).toMatch(/^Midjourney는 API가 없어/);
    const withApi = parseRecipePublic({
      ...base,
      tools: [...base.tools, { code: "seedream", label: "Seedream", has_api: true }],
    })!;
    // W5: the playground is open, so a recipe with an API tool can run.
    expect(playDisabledReason(withApi)).toBe("");
  });

  it("F2-2 masked template carries variables only", () => {
    const t = maskedTemplate([{ name: "옷 색" }, { name: "배경" }]);
    expect(t).toContain("[옷 색]");
    expect(t).toContain("[배경]");
    expect(t.replace(/\[[^\]]+\]/g, "")).toMatch(/^[x ]+$/);
  });
});
