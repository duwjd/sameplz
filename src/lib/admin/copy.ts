// ADM copy (F8-1~3). Labels only; the decisions live in SQL (admin_* RPCs).

export const RECIPE_STATUS_LABEL: Record<string, string> = {
  in_review: "사람 확인 중",
  live: "공개 중",
  rejected: "반려",
  private: "비공개",
  stopped: "판매 중지",
  taken_down: "게시중단",
  missing: "없음",
  visible: "보임",
  pending_review: "확인 중",
  hidden: "숨김",
};

export const REVIEW_REASON_LABEL: Record<string, string> = {
  agent: "에이전트",
  scripts: "스크립트 포함",
  auto_check: "자동 검사 보류",
  moderation_unavailable: "검사 불가",
};

export const REPORT_REASON_LABEL: Record<string, string> = {
  misleading: "설명과 달라요",
  malicious: "이상한 지시·악성 코드 의심",
  rights: "남의 결과물",
  prohibited: "금지된 내용",
};

/** Ops stop / takedown reasons (creator_request is the creator's own). */
export const OPS_REASONS = [
  { value: "rights_claim", label: "권리 침해 신고" },
  { value: "policy_violation", label: "운영 정책 위반" },
  { value: "misleading", label: "설명과 결과가 다름" },
  { value: "quality", label: "결과가 안정적이지 않음" },
  { value: "other", label: "기타 운영 사정" },
] as const;
export type OpsReason = (typeof OPS_REASONS)[number]["value"];

/** Answer templates for reporters (edited before sending). */
export const REPORT_ANSWER_TEMPLATE: Record<string, string> = {
  dismiss:
    "신고 내용을 확인했어요. 지금은 운영 정책에 어긋나는 점을 찾지 못해 그대로 두기로 했어요. 알려 주셔서 고마워요.",
  stop: "신고 내용을 확인하고 이 레시피의 판매를 멈췄어요. 이미 받은 사람은 받은 버전을 계속 써요. 알려 주셔서 고마워요.",
  takedown:
    "신고 내용을 확인하고 이 레시피를 모두에게서 내렸어요. 알려 주셔서 고마워요.",
  hide_post:
    "신고 내용을 확인하고 이 갤러리 글을 숨겼어요. 알려 주셔서 고마워요.",
};

export const ADMIN_ERROR: Record<string, string> = {
  NOT_ADMIN: "관리자 권한이 없어요. 다시 로그인해 주세요.",
  NOT_IN_QUEUE: "이미 결정된 심사예요. 목록을 새로 고쳐 주세요.",
  NOT_OPEN: "이미 답변한 신고예요. 목록을 새로 고쳐 주세요.",
  NOT_FOUND: "대상을 찾지 못했어요. 목록을 새로 고쳐 주세요.",
  REASON_REQUIRED: "사유를 골라 주세요. 복원은 메모가 필요해요.",
  REJECT_CODE_REQUIRED: "반려 코드를 골라 주세요.",
  INVALID_STATE: "지금 상태에서는 할 수 없는 조치예요.",
  CREATOR_STOPPED:
    "크리에이터가 직접 멈춘 레시피라 운영자가 다시 열 수 없어요.",
  NO_APPROVED_VERSION:
    "승인된 버전이 없어서 다시 열 수 없어요. 심사부터 해 주세요.",
  OWNER_WITHDRAWN: "탈퇴한 크리에이터의 레시피라 다시 열 수 없어요.",
  RECIPE_TAKEN_DOWN:
    "게시중단된 레시피라 승인할 수 없어요. 반려로 닫거나 먼저 복원해 주세요.",
  NOT_A_POST: "갤러리 글 신고에만 쓸 수 있어요.",
  INVALID_LEVEL: "제재 단계를 골라 주세요.",
  INVALID_DAYS: "정지 기간은 1~365일이에요. 비우면 해제할 때까지예요.",
  CANNOT_SANCTION_ADMIN: "관리자 계정에는 제재를 걸 수 없어요.",
  ALREADY_LIFTED: "이미 해제한 제재예요. 화면을 새로 고쳐 주세요.",
  NOT_SUSPENDED: "생성이 멈춘 계정이 아니에요.",
  INVALID_AMOUNT: "조정은 -1000C~+1000C 사이로, 0은 안 돼요.",
  INSUFFICIENT: "쓸 수 있는 크레딧보다 많이 뺄 수 없어요(진행 중 실행분 제외).",
  NOTE_TOO_LONG: "메모는 500자까지예요.",
  IDEM_CONFLICT:
    "같은 조정 요청이 다른 금액으로 이미 처리됐어요. 화면을 새로 고쳐 원장을 확인해 주세요.",
  INVALID: "입력을 다시 확인해 주세요.",
};
export const adminError = (reason: string) =>
  ADMIN_ERROR[reason] ?? "처리하지 못했어요. 잠시 뒤에 다시 해 주세요.";

// F8-4 sanction ladder (terms §6). Admins pick the level; nothing escalates on its own.
export const SANCTION_LEVELS = [
  {
    value: "warning",
    label: "경고",
    help: "아무것도 막지 않고 알림만 보내요.",
  },
  {
    value: "seller_suspended",
    label: "판매 정지",
    help: "새 레시피와 새 버전을 올릴 수 없어요.",
  },
  {
    value: "account_suspended",
    label: "계정 정지",
    help: "받기·만들기·올리기·글쓰기를 할 수 없어요. 받은 레시피는 계속 열어요.",
  },
  {
    value: "banned",
    label: "차단",
    help: "로그아웃되고 다시 쓸 수 없어요. 월 무료 크레딧도 멈춰요.",
  },
] as const;
export type SanctionLevelValue = (typeof SANCTION_LEVELS)[number]["value"];
export const SANCTION_LEVEL_LABEL: Record<string, string> = Object.fromEntries(
  SANCTION_LEVELS.map((l) => [l.value, l.label]),
);

export const SANCTION_REASONS = [
  { value: "policy_violation", label: "운영 정책 위반" },
  { value: "rights_claim", label: "권리 침해" },
  { value: "abuse", label: "부정 이용(다계정·한도 회피)" },
  { value: "spam", label: "스팸·도배" },
  { value: "other", label: "기타 운영 사유" },
] as const;
export type SanctionReasonValue = (typeof SANCTION_REASONS)[number]["value"];
export const SANCTION_REASON_LABEL: Record<string, string> = Object.fromEntries(
  SANCTION_REASONS.map((r) => [r.value, r.label]),
);
