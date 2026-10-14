// R01~R16 rejection copy (UP 반려 문구, ADM review templates). `step` is the upload step a
// 「고치러 가기」 link jumps to.

export const REJECT_CODES = [
  "R01",
  "R02",
  "R03",
  "R04",
  "R05",
  "R06",
  "R07",
  "R08",
  "R09",
  "R10",
  "R11",
  "R12",
  "R13",
  "R14",
  "R15",
  "R16",
] as const;
export type RejectCode = (typeof REJECT_CODES)[number];
export type UploadStep = 1 | 2 | 3 | 4 | 5;

export const REJECT_COPY: Record<
  RejectCode,
  { title: string; fix: string; step: UploadStep }
> = {
  R01: {
    title: "결과물이 부족해요",
    fix: "결과물을 1개 이상 올려 주세요.",
    step: 3,
  },
  R02: {
    title: "결과물을 보정하거나 잘랐어요",
    fix: "레시피로 바로 나온 결과물을 올려 주세요.",
    step: 3,
  },
  R03: {
    title: "결과물이 서로 너무 비슷해요",
    fix: "변수를 바꿔 나온 다른 결과물을 올려 주세요.",
    step: 3,
  },
  R04: {
    title: "같은 결과가 다시 나오지 않아요",
    fix: "레시피와 설정으로 다시 만들 수 있는 결과물을 올려 주세요.",
    step: 3,
  },
  R05: {
    title: "어디에 쓰는지 알기 어려워요",
    fix: "제목과 한 줄 설명에 쓰임새를 적어 주세요.",
    step: 2,
  },
  R06: {
    title: "내용이 너무 단순해요",
    fix: "레시피만의 설정이나 단계를 더 적어 주세요.",
    step: 2,
  },
  R07: {
    title: "다른 레시피와 너무 비슷해요",
    fix: "직접 만든 레시피인지 다시 확인해 주세요.",
    step: 2,
  },
  R08: {
    title: "숨은 지시문이나 보이지 않는 문자가 있어요",
    fix: "표시된 위치의 문구나 문자를 지워 주세요.",
    step: 2,
  },
  R09: {
    title: "쓸 수 없는 표현이 있어요",
    fix: "표시된 칸의 표현을 고쳐 주세요.",
    step: 2,
  },
  R10: {
    title: "전문 영역을 단정해서 말해요",
    fix: "세무·법률·의료 내용은 참고용이라고 적어 주세요.",
    step: 2,
  },
  R11: {
    title: "키·비밀번호·개인정보가 들어 있어요",
    fix: "표시된 값을 지우고 「키를 넣지 않았어요」를 확인해 주세요.",
    step: 2,
  },
  R12: {
    title: "「하는 일」이 빠졌어요",
    fix: "에이전트가 하는 일과 안 하는 일을 적어 주세요.",
    step: 2,
  },
  R13: {
    title: "실행 기록이 실제와 달라요",
    fix: "실제로 실행한 기록만 올려 주세요.",
    step: 2,
  },
  R14: {
    title: "썸네일에 가격 글자가 있어요",
    fix: "가격이 적히지 않은 결과물로 바꿔 주세요.",
    step: 3,
  },
  R15: {
    title: "변수 설명이 비어 있어요",
    fix: "[변수]마다 설명과 예시를 적어 주세요.",
    step: 2,
  },
  R16: {
    title: "얼굴·실존 인물·상표를 허락 없이 썼어요",
    fix: "허락받지 않은 얼굴·인물·상표가 없는 결과물로 바꿔 주세요.",
    step: 3,
  },
};

export function isRejectCode(code: unknown): code is RejectCode {
  return (
    typeof code === "string" &&
    (REJECT_CODES as readonly string[]).includes(code)
  );
}

/** One check finding, stored in auto_checks.findings and shown on the result step. */
export interface Finding {
  code: RejectCode;
  severity: "fail" | "review";
  step: UploadStep;
  /** Form field path, e.g. "prompt.body", "agent.does.0" — the 「고치러 가기」 focus target. */
  field: string;
  note: string;
  index?: number;
  line?: number;
}

export type CheckResult = "pass" | "review" | "fail";

export function resultOf(findings: Pick<Finding, "severity">[]): CheckResult {
  if (findings.some((f) => f.severity === "fail")) return "fail";
  if (findings.length > 0) return "review";
  return "pass";
}
