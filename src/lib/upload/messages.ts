// Submit failure copy (해요체) and the step each one sends the creator back to.
import type { UploadStep } from "@/lib/moderation/reject-codes";

export const SUBMIT_COPY: Record<
  string,
  { message: string; step?: UploadStep }
> = {
  LOGIN_REQUIRED: { message: "로그인하고 다시 제출해 주세요." },
  SIGNUP_INCOMPLETE: { message: "가입을 마치면 레시피를 올릴 수 있어요." },
  ACCOUNT_SUSPENDED: { message: "이용이 제한된 계정이라 지금은 할 수 없어요. 자세한 건 알림을 확인해 주세요." },
  SELLER_SUSPENDED: { message: "레시피 올리기가 멈춘 계정이에요. 자세한 건 알림을 확인해 주세요." },
  RATE_LIMITED: {
    message: "제출이 너무 잦아요. 1시간 뒤에 다시 제출해 주세요.",
  },
  INVALID: { message: "아직 채우지 않은 칸이 있어요." },
  CHECK_FAILED: { message: "자동 검사에서 고칠 곳을 찾았어요." },
  MEDIA_INVALID: {
    message: "결과물 파일을 확인하지 못했어요. 다시 올려 주세요.",
    step: 3,
  },
  MEDIA_NOT_UPLOADED: {
    message: "결과물 파일을 확인하지 못했어요. 다시 올려 주세요.",
    step: 3,
  },
  SKILL_INVALID: {
    message: "스킬 파일을 확인하지 못했어요. 다시 올려 주세요.",
    step: 2,
  },
  FILE_NOT_UPLOADED: {
    message: "스킬 파일을 확인하지 못했어요. 다시 올려 주세요.",
    step: 2,
  },
  R01: { message: "결과물을 1개 이상 올려 주세요.", step: 3 },
  TOO_MANY_FILES: { message: "결과물은 8개까지 올릴 수 있어요.", step: 3 },
  ORIGINAL_REQUIRED: { message: "받는 사람이 쓸 원문을 넣어 주세요.", step: 2 },
  INVALID_HEADER: {
    message: "제목은 2~40자, 한 줄 설명은 60자까지예요.",
    step: 2,
  },
  INVALID_JOB_CODES: { message: "직무를 1~2개 골라 주세요.", step: 2 },
  INVALID_TOOL_CODES: { message: "도구를 다시 골라 주세요.", step: 2 },
  INVALID_TAGS: {
    message: "검색 태그는 20자 이하로 10개까지, 겹치지 않게 넣어 주세요.",
    step: 2,
  },
  INVALID_CATEGORY: { message: "어떤 레시피인지 골라 주세요.", step: 1 },
  CATEGORY_LOCKED: {
    message: "새 버전에서는 카테고리를 바꿀 수 없어요.",
    step: 1,
  },
  CHANGELOG_REQUIRED: {
    message: "이번 버전에서 바뀐 점을 써 주세요.",
    step: 4,
  },
  CHANGELOG_TOO_LONG: { message: "바뀐 점은 500자까지 쓸 수 있어요.", step: 4 },
  INVALID_VISIBILITY: { message: "공개 범위를 다시 골라 주세요.", step: 4 },
  REVIEW_PENDING: {
    message:
      "사람이 확인 중인 버전이 있어요. 확인이 끝나면 새 버전을 올릴 수 있어요.",
  },
  RECIPE_STOPPED: { message: "판매가 멈춘 레시피라 새 버전을 올릴 수 없어요." },
  RECIPE_TAKEN_DOWN: {
    message: "게시가 중단된 레시피라 새 버전을 올릴 수 없어요.",
  },
  NOT_FOUND: { message: "레시피를 찾지 못했어요." },
  PAYLOAD_TOO_LARGE: {
    message: "내용이 너무 길어요. 조금 줄여 주세요.",
    step: 2,
  },
  FAILED: { message: "제출하지 못했어요. 잠시 뒤 다시 시도해 주세요." },
};

/** Joins reviewer notes into running text: adds a full stop when the note has none. */
export const sentence = (s: string) => {
  const t = s.trim();
  return !t || /[.!?。]$|요$/.test(t) ? t : `${t}.`;
};

export const submitCopy = (code: string) =>
  SUBMIT_COPY[code] ?? SUBMIT_COPY.FAILED;
