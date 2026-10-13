// HOME sample data, transcribed from the design handoff (SAMEPLZ Home.dc.html).
// Placeholder until the catalog DAL (src/data) feeds rankings, gallery and creators.
import type {
  GalleryTileProps,
  HeroBannerSlide,
  RankCardProps,
  RecipeCardProps,
  RecipeCategory,
  TabItem,
} from "@/components/ds";

type HomeRecipe = Omit<RecipeCardProps, "href" | "onClick" | "style"> & {
  move: RankCardProps["move"];
};

export const ALL_RECIPES: HomeRecipe[] = [
  {
    title: "셀카 → 링크드인 프로필 사진",
    creator: "사진관K",
    job: "인사·채용",
    kind: "이미지",
    tools: ["ChatGPT", "Gemini"],
    price: 4900,
    downloads: 18900,
    same: 5320,
    likes: 7400,
    move: 5,
  },
  {
    title: "한국어 번역투 교정",
    creator: "문장공방",
    job: "사무·기획",
    category: "skill",
    mediaLabel: "SKILL.md · 텍스트 · 파일 3개",
    tools: ["Claude", "ChatGPT", "Gemini CLI"],
    price: 0,
    downloads: 15200,
    same: 3100,
    likes: 5200,
    move: 6,
  },
  {
    title: "감성 카페 메뉴 사진 톤",
    creator: "무드랩",
    job: "마케팅·SNS",
    kind: "이미지",
    tools: ["ChatGPT", "Gemini"],
    price: 0,
    downloads: 12400,
    same: 2210,
    likes: 4100,
    move: 8,
  },
  {
    title: "스마트스토어 상세페이지 카피",
    creator: "상세장인",
    job: "커머스·셀러",
    kind: "텍스트",
    tools: ["ChatGPT", "Claude"],
    price: 19000,
    downloads: 4120,
    same: 530,
    likes: 1490,
    move: 0,
  },
  {
    title: "제품 사진 → 상세 연출 컷 6종",
    creator: "상세장인",
    job: "커머스·셀러",
    kind: "이미지",
    tools: ["Midjourney", "Seedream"],
    price: 9900,
    downloads: 3240,
    same: 412,
    likes: 1280,
    move: 3,
  },
  {
    title: "인스타 카드뉴스 10장 기획",
    creator: "카드뉴스공방",
    job: "마케팅·SNS",
    kind: "텍스트",
    tools: ["ChatGPT", "Claude"],
    price: 12000,
    downloads: 2750,
    same: 380,
    likes: 910,
    move: 1,
  },
  {
    title: "9:16 제품 언박싱 숏폼 8초",
    creator: "숏폼공장",
    job: "콘텐츠·영상",
    kind: "영상",
    tools: ["Veo", "Kling"],
    price: 14900,
    downloads: 1880,
    same: 260,
    likes: 690,
    move: 12,
  },
  {
    title: "네이버 블로그 SEO 글 구조",
    creator: "블로그연구소",
    job: "마케팅·SNS",
    category: "skill",
    mediaLabel: "SKILL.md · 블로그 HTML · 파일 4개",
    tools: ["Claude", "Codex", "Cursor"],
    price: 29000,
    downloads: 1880,
    same: 240,
    likes: 700,
    move: 4,
  },
  {
    title: "블로그 키워드 → 글감 노션 정리",
    creator: "블로그연구소",
    job: "마케팅·SNS",
    category: "agent",
    mediaLabel: "키워드 → … → 노션 정리",
    tools: ["Claude"],
    price: 19000,
    downloads: 1320,
    same: 190,
    likes: 480,
    move: 7,
  },
  {
    title: "스마트스토어 리뷰 답글 초안 에이전트",
    creator: "동네사장",
    job: "CS·고객응대",
    category: "agent",
    mediaLabel: "새 리뷰 가져오기 → … → 승인 요청",
    tools: ["Claude", "n8n"],
    price: 24000,
    downloads: 720,
    same: 96,
    likes: 330,
    move: "new",
  },
  {
    title: "향수 무드 시네마틱 컷",
    creator: "무드랩",
    job: "콘텐츠·영상",
    kind: "영상",
    tools: ["Seedance", "Runway"],
    price: 19000,
    downloads: 960,
    same: 131,
    likes: 520,
    move: -2,
  },
];

/** 인기 점수: 다운로드 + SAME×4 + 좋아요×0.5 (기획서 v0.5, 운영하며 조정) */
export const popularity = (
  r: Pick<HomeRecipe, "downloads" | "same" | "likes">,
) => (r.downloads ?? 0) + (r.same ?? 0) * 4 + (r.likes ?? 0) * 0.5;

export type RankTab = "all" | RecipeCategory;

export function rankRecipes(tab: RankTab): RankCardProps[] {
  return ALL_RECIPES.filter(
    (r) => tab === "all" || (r.category ?? "prompt") === tab,
  )
    .sort((a, b) => popularity(b) - popularity(a))
    .slice(0, 10)
    .map((r, i) => ({
      rank: i + 1,
      title: r.title,
      creator: r.creator,
      category: r.category ?? "prompt",
      kind: r.kind,
      price: r.price,
      move: r.move,
      mediaLabel: r.mediaLabel,
    }));
}

export const WEEKLY: RecipeCardProps[] = [0, 2, 4, 1].map((i) => {
  const { move, ...card } = ALL_RECIPES[i];
  return card;
});

export const RANK_TABS: TabItem[] = [
  { value: "all", label: "전체" },
  { value: "prompt", label: "프롬프트" },
  { value: "agent", label: "에이전트" },
  { value: "skill", label: "스킬" },
];

export const SLIDES: HeroBannerSlide[] = [
  {
    name: "서비스",
    eyebrow: "AI 레시피 플레이그라운드",
    title: "저거랑 같은 걸로 주세요.",
    description:
      "남이 만든 AI 결과물을 구경하다가 SAME을 누르면, 그걸 만든 프롬프트·에이전트·스킬을 그대로 받아요.",
    actions: [
      { label: "갤러리 구경하기", primary: true },
      { label: "마켓 둘러보기" },
    ],
    imageLabel: "결과물 콜라주 · 이미지 3장 + 영상 1개",
  },
  {
    name: "플레이그라운드",
    eyebrow: "플레이그라운드",
    title: "받기 전에 한 번 돌려 보세요",
    description:
      "안 받은 유료 레시피도 1번 무료 체험. 모델 3개를 나란히 놓고 비교해요.",
    actions: [{ label: "플레이그라운드 열기", primary: true }],
    imageLabel: "모델 3개 결과 비교 화면",
  },
  {
    name: "컬렉션",
    eyebrow: "이번 주 컬렉션",
    title: "스마트스토어 셀러 시작 팩",
    description:
      "상세 카피부터 연출 컷·리뷰 답글 에이전트까지 5개를 한 번에 봐요.",
    actions: [{ label: "팩 보기", primary: true }],
    imageLabel: "팩 표지 · 레시피 5개",
  },
  {
    name: "크리에이터",
    eyebrow: "크리에이터 모집",
    title: "내 프롬프트가 누군가의 SAME이 될 수 있어요",
    description:
      "직접 데려온 구매는 수수료 5%, 마켓에서 찾아온 구매는 15%. 매주 원화로 정산해요.",
    actions: [{ label: "판매 시작하기", primary: true }],
    imageLabel: "판매자 센터 대시보드 미리보기",
  },
];

export const FEED: GalleryTileProps[] = [
  {
    title: "링크드인 프로필 사진",
    creator: "사진관K",
    recipe: "셀카 → 링크드인 프로필 사진",
    ratio: "1/1",
    likes: 2100,
  },
  {
    title: "이어폰 언박싱 8초",
    creator: "숏폼공장",
    recipe: "9:16 제품 언박싱 숏폼 8초",
    ratio: "9/16",
    kind: "영상",
    likes: 880,
  },
  {
    title: "저도 해 봤어요, 네이비 셔츠",
    creator: "jiwoo_k",
    recipe: "셀카 → 링크드인 프로필 사진",
    ratio: "1/1",
    type: "same",
    madeHere: true,
    likes: 340,
  },
  {
    title: "수분크림 아침 햇살 컷",
    creator: "상세장인",
    recipe: "제품 사진 → 상세 연출 컷 6종",
    ratio: "3/4",
    likes: 1210,
  },
  {
    title: "향수 안개 시네마틱",
    creator: "무드랩",
    recipe: "향수 무드 시네마틱 컷",
    ratio: "16/9",
    kind: "영상",
    likes: 760,
  },
  {
    title: "라떼 사진 필름 톤 따라 하기",
    creator: "cafe_min",
    recipe: "감성 카페 메뉴 사진 톤",
    ratio: "1/1",
    type: "same",
    likes: 410,
  },
  {
    title: "점심 도시락 카드뉴스 1~3장",
    creator: "카드뉴스공방",
    recipe: "인스타 카드뉴스 10장 기획",
    ratio: "4/5",
    kind: "텍스트",
    likes: 520,
  },
  {
    title: "번역투 교정 전후",
    creator: "글쓰는하루",
    recipe: "한국어 번역투 교정",
    ratio: "4/3",
    kind: "텍스트",
    type: "same",
    likes: 260,
  },
];

export const CREATORS = [
  { name: "사진관K", followers: "1.2만", top: "링크드인 프로필 사진" },
  { name: "무드랩", followers: "8.3천", top: "감성 카페 메뉴 사진 톤" },
  { name: "상세장인", followers: "5.1천", top: "상세페이지 카피" },
  { name: "문장공방", followers: "4.7천", top: "한국어 번역투 교정" },
];
