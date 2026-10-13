import { describe, expect, it } from "vitest";
import { mediaLabelFor, toRecipeCard, type SearchRow } from "./card";

const ref = {
  jobs: { tax: "세무·회계", office: "사무·기획" },
  tools: { claude: "Claude", n8n: "n8n", chatgpt: "ChatGPT" },
};

const row: SearchRow = {
  public_id: "rtaxcheck01",
  title: "종합소득세 검토 보조 체크리스트",
  summary: "세무사 상담 전에 빠진 서류를 확인하는 점검표예요",
  category: "skill",
  prompt_kind: null,
  price_krw: 0,
  creator_nickname: "SAMEPLZ 운영팀",
  creator_handle: "sameplz",
  job_codes: ["tax"],
  tool_codes: ["claude", "unknown_tool"],
  filters: { format: "점검표", files: 2 },
  downloads: 3,
  same_count: 1,
  likes: 4,
  popularity: 9,
  published_at: "2026-10-10T00:00:00Z",
  score: 4,
  total_count: 1,
};

describe("toRecipeCard", () => {
  it("maps public fields, labels and the detail link", () => {
    expect(toRecipeCard(row, ref)).toEqual({
      title: "종합소득세 검토 보조 체크리스트",
      creator: "SAMEPLZ 운영팀",
      job: "세무·회계",
      category: "skill",
      kind: undefined,
      price: 0,
      tools: ["Claude", "unknown_tool"],
      downloads: 3,
      same: 1,
      likes: 4,
      mediaLabel: "SKILL.md · 점검표 · 파일 2개",
      href: "/r/rtaxcheck01",
    });
  });

  it("maps prompt kinds to result kinds", () => {
    expect(
      toRecipeCard({ ...row, category: "prompt", prompt_kind: "video" }, ref)
        .kind,
    ).toBe("영상");
  });
});

describe("mediaLabelFor", () => {
  it("labels agents by runtime and prompts not at all", () => {
    expect(mediaLabelFor("agent", { runtime: "n8n" }, ref)).toBe(
      "n8n에서 실행",
    );
    expect(mediaLabelFor("agent", {}, ref)).toBe("에이전트");
    expect(mediaLabelFor("prompt", { ratio: "1/1" }, ref)).toBeUndefined();
    expect(mediaLabelFor("skill", null, ref)).toBe("SKILL.md");
  });
});
