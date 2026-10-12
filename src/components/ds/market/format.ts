import type { IconName } from "../icons/Icon";

/* SAMEPLZ formatters — shared by market, detail, playground and account components. */
const trim = (n: number) => String(Math.round(n * 10) / 10).replace(/\.0$/, "");

/** 9900 → "9,900원", 0 → "무료" */
export const formatWon = (n: number) =>
  n === 0 ? "무료" : Number(n).toLocaleString("ko-KR") + "원";

/** 12400 → "1.2만", 3240 → "3.2천", 412 → "412" */
export const formatCount = (n: number) =>
  n >= 10000 ? trim(n / 10000) + "만" : n >= 1000 ? trim(n / 1000) + "천" : String(n);

/** 1240 → "1,240C" (1 credit = 10원) */
export const formatCredit = (n: number) => Number(n).toLocaleString("ko-KR") + "C";

export type Category = "prompt" | "agent" | "skill" | "collection";

export const CATEGORY_LABEL: Record<Category, string> = {
  prompt: "프롬프트",
  agent: "에이전트",
  skill: "스킬",
  collection: "컬렉션",
};

export const KIND_ICON: Record<string, IconName> = {
  이미지: "ImageOutlineIcon",
  영상: "MovieIcon",
  텍스트: "MemoOutlineIcon",
  agent: "LightningIcon",
  skill: "CodeBlockIcon",
};
