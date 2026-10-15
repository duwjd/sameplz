// PLAY / CRD copy (해요체, ux-copy-a11y). Shared by the /play client and server pages.
import type { CellStatus } from "@/data/playground";

export const isTerminal = (s: CellStatus) =>
  s === "succeeded" ||
  s === "failed" ||
  s === "blocked" ||
  s === "canceled" ||
  s === "expired";

const kst = (iso: string) =>
  new Date(new Date(iso).getTime() + 9 * 3600 * 1000);

/** "11월 1일" (KST). */
export function kstMonthDay(iso: string): string {
  const d = kst(iso);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

/** "10.15" (KST). */
export function kstShortDate(iso: string): string {
  const d = kst(iso);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** "10.15 14:03" (KST). */
export function kstDateTime(iso: string): string {
  const d = kst(iso);
  return `${kstShortDate(iso)} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** D11: monthly free grant (private.credit_policy). */
export const MONTHLY_GRANT = 270;

export const AI_NOTICE = "이 화면의 결과물은 생성형 AI로 만들었어요";

export const FACE_CONSENT =
  "본인 사진이거나 사진 속 인물의 동의를 받았어요 · 생성에만 쓰이고 학습에 쓰이지 않으며 24시간 뒤 자동 삭제돼요";

/** Run refusal (POST /api/play/runs error code) → what happened and what to do next. */
export function runErrorCopy(
  code: string,
  ctx: { nextResetAt?: string; dailyLimit?: number; shortfall?: number } = {},
): string {
  switch (code) {
    case "LOGIN_REQUIRED":
      return "로그인하고 만들어 보세요.";
    case "SIGNUP_INCOMPLETE":
      return "가입을 마치면 만들어 볼 수 있어요.";
    case "ADULT_REQUIRED":
      return "만 18세 이상만 만들 수 있어요.";
    case "AI_NOTICE_REQUIRED":
      return "생성형 AI 안내를 확인한 뒤 만들 수 있어요.";
    case "GENERATION_SUSPENDED":
      return "안전 필터에 여러 번 걸려 생성을 잠시 멈췄어요. 사람이 확인한 뒤 다시 열어 드려요.";
    case "DAILY_LIMIT":
      return `오늘 쓸 수 있는 ${ctx.dailyLimit ?? 135}C를 넘어서 만들 수 없어요. 설정을 줄이거나 내일 다시 해 주세요.`;
    case "INSUFFICIENT_CREDITS":
      return ctx.nextResetAt
        ? `이번 달 크레딧을 다 썼어요 · ${kstMonthDay(ctx.nextResetAt)}에 다시 채워져요`
        : "이번 달 크레딧을 다 썼어요 · 다음 달 1일에 다시 채워져요";
    case "BUDGET_EXHAUSTED":
      return ctx.nextResetAt
        ? `이번 달 생성이 마감됐어요 · ${kstMonthDay(ctx.nextResetAt)}에 다시 열려요`
        : "이번 달 생성이 마감됐어요 · 다음 달 1일에 다시 열려요";
    case "RATE_LIMITED":
      return "잠시 뒤에 다시 해 주세요.";
    case "PRICE_CHANGED":
      return "가격이 바뀌었어요 · 새 견적을 확인하고 다시 눌러 주세요.";
    case "SAFETY_BLOCKED":
      return "안전 필터에 걸려 만들지 않았어요 · 크레딧은 빠지지 않았어요. 입력을 고쳐 다시 해 주세요.";
    case "MODERATION_UNAVAILABLE":
      return "지금 안전 검사를 할 수 없어 만들지 못했어요 · 크레딧은 빠지지 않았어요. 잠시 뒤에 다시 해 주세요.";
    case "NOT_ENTITLED":
      return "이 레시피는 받은 뒤 만들어 볼 수 있어요.";
    case "INVALID_VARIABLES":
      return "[변수]를 모두 채워 주세요.";
    case "INVALID_REFERENCE":
      return "레퍼런스 이미지를 다시 올려 주세요. 올린 지 24시간이 지났거나 이 모델에 쓸 수 없어요.";
    case "FACE_CONSENT_REQUIRED":
      return "얼굴 사진 사용 동의에 체크해 주세요.";
    case "INVALID_PARAMS":
    case "INVALID_REQUEST":
      return "설정을 확인해 주세요. 고를 수 없는 값이 있어요.";
    default:
      return "서버가 응답하지 않아 만들지 못했어요. 크레딧은 빠지지 않았어요. 다시 해 주세요.";
  }
}

/** Failed / blocked cell → the line shown in its place (FM rows). */
export function cellErrorCopy(
  status: CellStatus,
  code: string | null,
  credits: number,
): string {
  if (status === "blocked")
    return code === "RESULT_BLOCKED"
      ? "결과가 안전 필터에 걸려 보여 드리지 않아요 · 크레딧은 빠지지 않았어요"
      : "안전 필터에 걸려 만들지 않았어요 · 크레딧은 빠지지 않았어요";
  if (status === "expired")
    return `시간이 오래 걸려 멈췄어요 · ${credits}C를 돌려드렸어요`;
  if (status === "canceled") return `취소했어요 · ${credits}C를 돌려드렸어요`;
  switch (code) {
    case "PROVIDER_UNAVAILABLE":
    case "PROVIDER_BUSY":
      return `지금 모델이 붐벼서 만들지 못했어요 · ${credits}C를 돌려드렸어요`;
    case "MODERATION_UNAVAILABLE":
      return `결과를 안전 검사하지 못해 보여 드리지 않아요 · ${credits}C를 돌려드렸어요`;
    default:
      return `모델 오류로 만들지 못했어요 · ${credits}C를 돌려드렸어요`;
  }
}

/** Human label for a model parameter value. */
export function paramValueLabel(
  name: string,
  v: string | number | boolean,
): string {
  if (typeof v === "boolean") return v ? "켜기" : "끄기";
  if (name === "duration") return `${v}초`;
  if (name === "quality")
    return (
      (
        {
          low: "낮음",
          medium: "보통",
          high: "높음",
          xhigh: "아주 높음",
        } as Record<string, string>
      )[String(v)] ?? String(v)
    );
  if (name === "image_size") return String(v).replace("x", "×");
  return String(v);
}
