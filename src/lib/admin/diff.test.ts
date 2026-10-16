import { describe, expect, it } from "vitest";
import { changedHunks, lineDiff } from "./diff";

describe("lineDiff", () => {
  it("F8-1 같은 원문이면 바뀐 줄이 없다", () => {
    expect(lineDiff("a\nb", "a\nb").every((l) => l.op === "same")).toBe(true);
  });
  it("F8-1 바뀐 줄은 지운 줄과 더한 줄로 보인다", () => {
    expect(lineDiff("a\nb\nc", "a\nB\nc")).toEqual([
      { op: "same", text: "a" },
      { op: "del", text: "b" },
      { op: "add", text: "B" },
      { op: "same", text: "c" },
    ]);
  });
  it("F8-1 첫 버전(이전 원문 없음)은 모두 더한 줄", () => {
    expect(lineDiff("", "x\ny").map((l) => l.op)).toEqual(["add", "add"]);
  });
  it("F8-1 끝에 더한 줄과 지운 줄", () => {
    expect(lineDiff("a", "a\nb").map((l) => l.op)).toEqual(["same", "add"]);
    expect(lineDiff("a\nb", "a").map((l) => l.op)).toEqual(["same", "del"]);
  });
});

describe("changedHunks", () => {
  it("F8-1 바뀐 곳 주변만 남기고 사이는 접는다", () => {
    const before = Array.from({ length: 20 }, (_, k) => `l${k}`).join("\n");
    const after = before.replace("l2\n", "L2\n").replace("l17\n", "L17\n");
    const h = changedHunks(lineDiff(before, after), 1);
    expect(h.filter((x) => x === null)).toHaveLength(1);
    expect(h.filter((x) => x && x.op !== "same")).toHaveLength(4);
  });
  it("F8-1 바뀐 곳이 없으면 비어 있다", () => {
    expect(changedHunks(lineDiff("a", "a"))).toEqual([]);
  });
});
