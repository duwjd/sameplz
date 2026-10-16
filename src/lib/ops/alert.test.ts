import { afterEach, describe, expect, it, vi } from "vitest";
import { budgetAlertText, postOpsAlert, slaAlertText } from "./alert";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("F4-15 budget alerts", () => {
  it("F4-15 80% and 100% messages carry month and usage only", () => {
    expect(
      budgetAlertText({
        month: "2026-11-01",
        level: 80,
        cap: 40250,
        used: 32400,
        state: "open",
      }),
    ).toBe(
      "[SAMEPLZ] 11월 생성 예산의 80%를 썼어요 (32,400C / 40,250C). 100%가 되면 이번 달 생성이 마감돼요.",
    );
    expect(
      budgetAlertText({
        month: "2026-11-01",
        level: 100,
        cap: 40250,
        used: 40250,
        state: "open",
      }),
    ).toContain("11월 생성이 마감됐어요 (예산 소진");
    expect(
      budgetAlertText({
        month: "2026-11-01",
        level: 100,
        cap: 40250,
        used: 100,
        state: "paused",
      }),
    ).toContain("수동 정지");
  });

  it("F4-15 without a webhook nothing is sent", async () => {
    vi.stubEnv("OPS_ALERT_WEBHOOK_URL", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await postOpsAlert("x")).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("F4-15 only https webhooks, and only a 2xx counts as sent", async () => {
    vi.stubEnv("OPS_ALERT_WEBHOOK_URL", "http://hooks.example.test/x");
    expect(await postOpsAlert("x")).toBe(false);
    vi.stubEnv("OPS_ALERT_WEBHOOK_URL", "https://hooks.example.test/x");
    const ok = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", ok);
    expect(await postOpsAlert("hello")).toBe(true);
    expect(
      JSON.parse(
        (ok.mock.calls[0] as unknown as [URL, RequestInit])[1].body as string,
      ),
    ).toEqual({
      text: "hello",
      content: "hello",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 500 })),
    );
    expect(await postOpsAlert("hello")).toBe(false);
  });
});

describe("slaAlertText", () => {
  it("F8-1 F8-2 심사·신고 수를 한 줄로 알린다", () => {
    const t = slaAlertText([
      { kind: "review_24h", id: "v1", since: "2026-10-14T00:00:00Z" },
      { kind: "review_24h", id: "v2", since: "2026-10-14T00:00:00Z" },
      { kind: "report_20h", id: "r1", since: "2026-10-14T00:00:00Z" },
    ]);
    expect(t).toContain("24시간 넘은 심사 2건");
    expect(t).toContain("신고 1건");
    expect(t).not.toContain("v1");
  });
  it("F8-1 알릴 것이 없으면 보내지 않는다", () => {
    expect(slaAlertText([])).toBeNull();
  });
});
