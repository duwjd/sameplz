import { describe, expect, it, vi } from "vitest";
import { JUDGE_MODEL, runLayer2, type Layer2Options } from "./layer2";

const texts = [
  { field: "title", text: "링크드인 프로필 사진" },
  { field: "prompt.body", text: "[직업] 프로필 사진" },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const moderation = (flagged: boolean) => ({
  results: texts.map(() => ({ flagged, categories: { harassment: flagged } })),
});
const judge = (verdict: string) => ({
  content: [
    {
      type: "text",
      text: JSON.stringify({
        verdict,
        reasons:
          verdict === "pass"
            ? []
            : [{ field: "prompt.body", note: "과업 밖 지시" }],
      }),
    },
  ],
});

function live(
  fetchImpl: typeof fetch,
  extra: Partial<Layer2Options> = {},
): Layer2Options {
  return {
    provider: "live",
    openaiKey: "test-openai",
    anthropicKey: "test-anthropic",
    fetch: fetchImpl,
    ...extra,
  };
}

function router(mod: Response | Error, jud: Response | Error) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    const r = u.includes("openai") ? mod : jud;
    if (r instanceof Error) throw r;
    return r.clone();
  }) as unknown as typeof fetch;
}

describe("F5-4 layer 2: mock provider (CI / e2e)", () => {
  it("is deterministic and never calls the network", async () => {
    const f = vi.fn() as unknown as typeof fetch;
    expect(await runLayer2(texts, { provider: "mock", fetch: f })).toEqual({
      result: "pass",
      findings: [],
      checker: "mock",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("markers force review and fail", async () => {
    const review = await runLayer2(
      [{ field: "summary", text: "x [[mock:review]]" }],
      { provider: "mock" },
    );
    const fail = await runLayer2(
      [{ field: "summary", text: "x [[mock:fail]]" }],
      { provider: "mock" },
    );
    expect(review.result).toBe("review");
    expect(fail).toMatchObject({
      result: "fail",
      findings: [{ code: "R09", field: "summary" }],
    });
  });
});

describe("F5-4 layer 2: live", () => {
  it("without keys goes to human review as 'unavailable' and never calls out", async () => {
    const f = vi.fn() as unknown as typeof fetch;
    const r = await runLayer2(texts, { provider: "live", fetch: f });
    expect(r).toEqual({
      result: "review",
      findings: [],
      checker: "unavailable",
    });
    expect(f).not.toHaveBeenCalled();
    expect(
      (await runLayer2(texts, { provider: "live", openaiKey: "k", fetch: f }))
        .checker,
    ).toBe("unavailable");
  });

  it("passes when moderation is clean and the judge says pass", async () => {
    const f = router(json(moderation(false)), json(judge("pass")));
    const r = await runLayer2(texts, live(f));
    expect(r).toEqual({
      result: "pass",
      findings: [],
      checker: `omni-moderation-latest+${JUDGE_MODEL}`,
    });
    const [modCall, judgeCall] = (f as unknown as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(String(modCall[0])).toBe("https://api.openai.com/v1/moderations");
    expect(JSON.parse(modCall[1].body)).toMatchObject({
      model: "omni-moderation-latest",
    });
    expect(String(judgeCall[0])).toBe("https://api.anthropic.com/v1/messages");
    expect(JSON.parse(judgeCall[1].body)).toMatchObject({ model: JUDGE_MODEL });
  });

  it("moderation flag fails with R09 on the flagged field", async () => {
    const f = router(
      json({
        results: [
          { flagged: false, categories: {} },
          { flagged: true, categories: { violence: true } },
        ],
      }),
      json(judge("pass")),
    );
    const r = await runLayer2(texts, live(f));
    expect(r).toMatchObject({
      result: "fail",
      findings: [{ code: "R09", field: "prompt.body" }],
    });
  });

  it("judge review or fail both go to a human (no auto-reject on an LLM verdict)", async () => {
    for (const verdict of ["review", "fail"]) {
      const r = await runLayer2(
        texts,
        live(router(json(moderation(false)), json(judge(verdict)))),
      );
      expect(r.result).toBe("review");
      expect(r.findings[0]).toMatchObject({
        code: "R08",
        field: "prompt.body",
      });
    }
  });

  it.each([
    ["moderation HTTP error", json({}, 500), json(judge("pass"))],
    ["judge HTTP error", json(moderation(false)), json({}, 529)],
    ["network error", new Error("ECONNRESET"), json(judge("pass"))],
    [
      "judge not JSON",
      json(moderation(false)),
      json({ content: [{ type: "text", text: "음… 괜찮아 보여요" }] }),
    ],
    ["judge unknown verdict", json(moderation(false)), json(judge("maybe"))],
    [
      "moderation result count mismatch",
      json({ results: [] }),
      json(judge("pass")),
    ],
  ])("%s → review as unavailable", async (_label, mod, jud) => {
    const r = await runLayer2(texts, live(router(mod, jud)));
    expect(r).toMatchObject({ result: "review", checker: "unavailable" });
  });

  it("aborts a slow provider and goes to review", async () => {
    const slow = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    ) as unknown as typeof fetch;
    const r = await runLayer2(texts, live(slow, { timeoutMs: 20 }));
    expect(r).toMatchObject({ result: "review", checker: "unavailable" });
  });

  it("keeps provider text out of findings", async () => {
    const f = router(
      json(moderation(false)),
      json({
        content: [
          {
            type: "text",
            text:
              '{"verdict":"review","reasons":[{"field":"prompt.body","note":"' +
              "x".repeat(500) +
              '"}]}',
          },
        ],
      }),
    );
    const r = await runLayer2(texts, live(f));
    expect(r.findings.every((x) => x.note.length <= 120)).toBe(true);
  });

  it("very long input skips the judge and asks a human", async () => {
    const f = router(
      json({ results: [{ flagged: false, categories: {} }] }),
      json(judge("pass")),
    );
    const r = await runLayer2(
      [{ field: "skill.md", text: "가".repeat(60_001) }],
      live(f),
    );
    expect(r.result).toBe("review");
  });
});
