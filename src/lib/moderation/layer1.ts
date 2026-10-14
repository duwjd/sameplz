// F5-3 auto check layer 1: deterministic rules over every text the creator typed. Runs on the
// server at submit (and in the browser as a preview — the server result is the one stored).
import { detectVariables } from "@/lib/validation/upload";
import {
  REJECT_COPY,
  resultOf,
  type CheckResult,
  type Finding,
  type RejectCode,
} from "./reject-codes";

export interface TextField {
  field: string;
  text: string;
}

export interface Layer1Input {
  category: "prompt" | "skill" | "agent";
  fields: TextField[];
  prompt?: {
    body: string;
    variables: { name: string; description: string; example: string }[];
  };
}

const MAX_PER_FIELD = 10;
const MAX_FINDINGS = 30;

const hex = (cp: number) =>
  "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
const isPictographic = (cp: number | undefined) =>
  cp !== undefined &&
  /\p{Extended_Pictographic}/u.test(String.fromCodePoint(cp));
const isEmojiJoinable = (cp: number | undefined) =>
  isPictographic(cp) ||
  cp === 0xfe0f ||
  (cp !== undefined && cp >= 0x1f3fb && cp <= 0x1f3ff);

/** Characters that render as nothing (or reorder text) and can carry hidden instructions. */
function hiddenKind(
  cp: number,
  prev: number | undefined,
  next: number | undefined,
  prevWasVs: boolean,
) {
  if (cp >= 0xe0000 && cp <= 0xe007f) return "태그 문자";
  if (cp === 0x200d)
    return isEmojiJoinable(prev) && isPictographic(next) ? null : "폭 0 문자";
  if (
    cp === 0x200b ||
    cp === 0x200c ||
    (cp >= 0x2060 && cp <= 0x2064) ||
    cp === 0xfeff ||
    cp === 0x180e ||
    cp === 0x00ad
  )
    return "폭 0 문자";
  if (
    cp === 0x200e ||
    cp === 0x200f ||
    cp === 0x061c ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2066 && cp <= 0x2069)
  )
    return "글자 방향 제어 문자";
  if (cp >= 0xe0100 && cp <= 0xe01ef) return "비표준 변형 선택자";
  // A single FE00–FE0F after a character is ordinary (❤️, 1️⃣); runs of them are not.
  if (
    cp >= 0xfe00 &&
    cp <= 0xfe0f &&
    (prevWasVs || (next !== undefined && next >= 0xfe00 && next <= 0xfe0f))
  )
    return "비표준 변형 선택자";
  return null;
}

const PATTERNS: {
  code: RejectCode;
  severity: Finding["severity"];
  re: RegExp;
  note: string;
}[] = [
  {
    code: "R08",
    severity: "fail",
    re: /(이전|앞|위)(의|에서)?\s*(모든\s*)?(지시|명령|지침|규칙)(사항)?(을|를|은|는|들)?\s*(모두\s*|전부\s*|다\s*)?무시/g,
    note: "앞선 지시를 무시하라는 문구가 있어요.",
  },
  {
    code: "R08",
    severity: "fail",
    re: /\b(ignore|disregard|forget)\s+(all\s+|any\s+)?(of\s+)?(the\s+|your\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules|messages)/gi,
    note: "앞선 지시를 무시하라는 문구가 있어요.",
  },
  {
    code: "R08",
    severity: "fail",
    re: /시스템\s*프롬프트(를|을)?\s*(출력|보여|알려|공개|유출|말해|그대로)/g,
    note: "시스템 프롬프트를 드러내라는 문구가 있어요.",
  },
  {
    code: "R08",
    severity: "fail",
    re: /\b(reveal|print|show|output|leak|repeat)\s+(your|the)\s+(system\s+prompt|hidden\s+instructions|instructions\s+above)/gi,
    note: "시스템 프롬프트를 드러내라는 문구가 있어요.",
  },
  {
    code: "R08",
    severity: "fail",
    re: /사용자(에게|한테)\s*(이\s*(사실|내용)을\s*)?(알리지|말하지|보여\s*주지|밝히지)\s*(마|말)/g,
    note: "사용자에게 숨기라는 문구가 있어요.",
  },
  {
    code: "R08",
    severity: "fail",
    re: /\b(do\s+not|don't|never)\s+(tell|inform|reveal\s+(this\s+)?to|let)\s+the\s+user/gi,
    note: "사용자에게 숨기라는 문구가 있어요.",
  },
  {
    code: "R08",
    severity: "fail",
    re: /\byou\s+are\s+now\s+(in\s+)?(dan|developer\s+mode|jailbroken|unrestricted)/gi,
    note: "제한을 푸는 문구가 있어요.",
  },
  {
    code: "R08",
    severity: "fail",
    re: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z|da|k)?sh\b|\b(ba|z)?sh\s+<\(\s*(curl|wget)\b/gi,
    note: "내려받은 스크립트를 바로 실행하는 명령이 있어요.",
  },
  {
    code: "R08",
    severity: "fail",
    re: /[A-Za-z0-9+/]{200,}={0,2}/g,
    note: "200자가 넘는 인코딩된 문자열이 있어요.",
  },
  {
    code: "R08",
    severity: "review",
    re: /(https?:\/\/|(?<![/\w.])www\.)[^\s<>"')\]]+/gi,
    note: "링크가 있어 사람이 확인해요.",
  },
  {
    code: "R11",
    severity: "fail",
    re: /\bsk-[A-Za-z0-9_-]{20,}|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{36,}|\bAIza[0-9A-Za-z_-]{35}|\bxox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    note: "API 키나 비밀 키로 보이는 값이 있어요.",
  },
  {
    code: "R11",
    severity: "fail",
    re: /(?<!\d)\d{6}-[1-4]\d{6}(?!\d)/g,
    note: "주민등록번호로 보이는 값이 있어요.",
  },
];

function lineAt(text: string, index: number) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Rule findings for one text field (step 2 — every typed text lives on the content step). */
export function scanText(field: string, text: string): Finding[] {
  const out: Finding[] = [];
  const push = (f: Omit<Finding, "step" | "line" | "field">) => {
    if (out.length < MAX_PER_FIELD)
      out.push({
        ...f,
        field,
        step: REJECT_COPY[f.code].step,
        line: f.index === undefined ? undefined : lineAt(text, f.index),
      });
  };

  // Hidden characters, one finding per consecutive run.
  const cps = Array.from(text, (c) => c.codePointAt(0)!);
  let offset = 0;
  let run: {
    index: number;
    first: number;
    count: number;
    kind: string;
  } | null = null;
  let prevWasVs = false;
  const flush = () => {
    if (!run) return;
    const extra = run.count > 1 ? ` 외 ${run.count - 1}개` : "";
    push({
      code: "R08",
      severity: "fail",
      index: run.index,
      note: `보이지 않는 ${run.kind}(${hex(run.first)}${extra})가 있어요.`,
    });
    run = null;
  };
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i];
    const kind = hiddenKind(cp, cps[i - 1], cps[i + 1], prevWasVs);
    prevWasVs = cp >= 0xfe00 && cp <= 0xfe0f;
    if (kind) {
      if (run) run.count++;
      else run = { index: offset, first: cp, count: 1, kind };
    } else flush();
    offset += cp > 0xffff ? 2 : 1;
  }
  flush();

  for (const p of PATTERNS) {
    for (const m of text.matchAll(p.re))
      push({
        code: p.code,
        severity: p.severity,
        index: m.index,
        note: p.note,
      });
  }
  return out.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

function variableFindings(
  prompt: NonNullable<Layer1Input["prompt"]>,
): Finding[] {
  const used = detectVariables(prompt.body);
  const declared = prompt.variables.map((v) => v.name.trim());
  const f = (field: string, note: string): Finding => ({
    code: "R15",
    severity: "fail",
    step: 2,
    field,
    note,
  });
  return [
    ...used
      .filter((n) => !declared.includes(n))
      .map((n) =>
        f("prompt.variables", `본문의 [${n}]을 변수로 등록해 주세요.`),
      ),
    ...declared
      .filter((n) => !used.includes(n))
      .map((n) => f("prompt.variables", `[${n}]이 본문에 없어요.`)),
    ...prompt.variables.flatMap((v, i) => {
      if (!v.description.trim())
        return [
          f(
            `prompt.variables.${i}.description`,
            `[${v.name}]의 설명을 적어 주세요.`,
          ),
        ];
      if (!v.example.trim())
        return [
          f(
            `prompt.variables.${i}.example`,
            `[${v.name}]의 예시를 적어 주세요.`,
          ),
        ];
      return [];
    }),
  ];
}

export function runLayer1(input: Layer1Input): {
  result: CheckResult;
  findings: Finding[];
} {
  const findings = [
    ...input.fields.flatMap((x) => scanText(x.field, x.text)),
    ...(input.category === "prompt" && input.prompt
      ? variableFindings(input.prompt)
      : []),
  ];
  // Fails first so the cap never hides a blocking finding behind warnings.
  findings.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "fail" ? -1 : 1,
  );
  const capped = findings.slice(0, MAX_FINDINGS);
  return { result: resultOf(capped), findings: capped };
}
