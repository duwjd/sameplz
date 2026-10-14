import { describe, expect, it } from "vitest";
import {
  detectVariables,
  emptyUploadForm,
  syncVariables,
  validateStep,
  type UploadForm,
} from "./upload";

const prompt = (): UploadForm => ({
  ...emptyUploadForm(),
  category: "prompt",
  promptKind: "image",
  title: "링크드인 프로필 사진",
  summary: "셀카 한 장으로 프로필 사진",
  jobCodes: ["marketing"],
  prompt: {
    body: "[직업] 느낌의 [배경] 앞 사진",
    variables: [
      { name: "직업", description: "사진 속 직업", example: "개발자" },
      { name: "배경", description: "뒤 배경", example: "사무실" },
    ],
    settings: [],
  },
  media: [
    {
      path: "u/1.png",
      kind: "image",
      ratio: "1/1",
      alt: "결과",
      ai: true,
      url: "https://x/1.png",
    },
  ],
});

const fields = (form: UploadForm, step: 1 | 2 | 3 | 4) =>
  validateStep(step, form).map((e) => e.field);

describe("UP-04 [변수] detection", () => {
  it("finds bracketed names in order without duplicates", () => {
    expect(detectVariables("[직업] 앞 [배경], 다시 [직업]")).toEqual([
      "직업",
      "배경",
    ]);
  });

  it("ignores empty, multi-line and over-long brackets", () => {
    expect(
      detectVariables("[] [ ] [줄\n바꿈] [" + "가".repeat(31) + "]"),
    ).toEqual([]);
  });

  it("syncVariables keeps typed descriptions and adds or drops by the body", () => {
    const v = syncVariables("[배경] [조명]", [
      { name: "직업", description: "a", example: "b" },
      { name: "배경", description: "뒤", example: "사무실" },
    ]);
    expect(v).toEqual([
      { name: "배경", description: "뒤", example: "사무실" },
      { name: "조명", description: "", example: "" },
    ]);
  });
});

describe("F5-1 step validation", () => {
  it("step 1 needs a category, and a kind for prompts", () => {
    expect(fields(emptyUploadForm(), 1)).toEqual(["category"]);
    expect(fields({ ...emptyUploadForm(), category: "prompt" }, 1)).toEqual([
      "promptKind",
    ]);
    expect(fields({ ...emptyUploadForm(), category: "skill" }, 1)).toEqual([]);
  });

  it("step 2 without a title points at the title first", () => {
    const errors = validateStep(2, { ...prompt(), title: " " });
    expect(errors[0]).toEqual({
      field: "title",
      message: "제목을 2자 이상 써 주세요.",
    });
  });

  it("step 2 checks title, summary, job and tag limits", () => {
    expect(fields({ ...prompt(), title: "가".repeat(41) }, 2)).toContain(
      "title",
    );
    expect(fields({ ...prompt(), summary: "가".repeat(61) }, 2)).toContain(
      "summary",
    );
    expect(fields({ ...prompt(), jobCodes: [] }, 2)).toContain("jobCodes");
    expect(fields({ ...prompt(), jobCodes: ["a", "b", "c"] }, 2)).toContain(
      "jobCodes",
    );
    expect(
      fields(
        { ...prompt(), tags: Array.from({ length: 11 }, (_, i) => `t${i}`) },
        2,
      ),
    ).toContain("tags");
    expect(fields(prompt(), 2)).toEqual([]);
  });

  it("F5-2 R15: every variable needs a description and an example", () => {
    const form = prompt();
    form.prompt.variables[1] = { name: "배경", description: "", example: "" };
    expect(fields(form, 2)).toEqual([
      "prompt.variables.1.description",
      "prompt.variables.1.example",
    ]);
  });

  it("prompt needs a body", () => {
    expect(
      fields(
        { ...prompt(), prompt: { body: "", variables: [], settings: [] } },
        2,
      ),
    ).toEqual(["prompt.body"]);
  });

  it("skill needs SKILL.md text or an inspected zip", () => {
    const form: UploadForm = {
      ...prompt(),
      category: "skill",
      promptKind: null,
    };
    expect(fields(form, 2)).toEqual(["skill.skillMd"]);
    expect(
      fields(
        { ...form, skill: { ...form.skill, skillMd: "---\nname: a\n---" } },
        2,
      ),
    ).toEqual([]);
    expect(
      fields(
        {
          ...form,
          skill: {
            ...form.skill,
            source: "zip",
            zip: { path: "u/z/a.zip", filename: "a.zip", size: 10 },
          },
        },
        2,
      ),
    ).toEqual([]);
  });

  it("F5-6 agent needs flow, does, does-not, the original and the no-keys check", () => {
    const form: UploadForm = {
      ...prompt(),
      category: "agent",
      promptKind: null,
    };
    expect(fields(form, 2)).toEqual([
      "agent.flow",
      "agent.does",
      "agent.doesNot",
      "agent.config",
      "agent.noKeys",
    ]);
    const ok: UploadForm = {
      ...form,
      agent: {
        ...form.agent,
        flow: ["메일 읽기"],
        does: ["요약"],
        doesNot: ["답장"],
        config: '{"nodes":[]}',
        noKeys: true,
      },
    };
    expect(fields(ok, 2)).toEqual([]);
  });

  it("F5-2 R01 step 3 needs at least one result, at most 8", () => {
    expect(fields({ ...prompt(), media: [] }, 3)).toEqual(["media"]);
    expect(
      fields({ ...prompt(), media: Array(9).fill(prompt().media[0]) }, 3),
    ).toEqual(["media"]);
    expect(validateStep(3, { ...prompt(), media: [] })[0].message).toContain(
      "결과물",
    );
  });

  it("UP-05 every result needs alt text", () => {
    const form = prompt();
    form.media = [{ ...form.media[0], alt: " " }];
    expect(fields(form, 3)).toEqual(["media.0.alt"]);
  });

  it("F5-7 step 4: a new version needs a changelog", () => {
    expect(fields({ ...prompt(), recipeId: "a" }, 4)).toEqual(["changelog"]);
    expect(
      fields({ ...prompt(), recipeId: "a", changelog: "배경 변수 추가" }, 4),
    ).toEqual([]);
    expect(fields(prompt(), 4)).toEqual([]);
  });
});
