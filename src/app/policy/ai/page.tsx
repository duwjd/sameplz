// F7-7: AI 고지 — generated results are labelled (AI_NOTICE in src/lib/play/copy.ts, in-file mark for
// face-reference images), and what that means for the person using them.
import type { Metadata } from "next";
import {
  PolicyList,
  PolicyPage,
  PolicySection,
  policyHelp,
  policyP,
} from "@/components/policy/PolicyPage";

export const metadata: Metadata = {
  title: "AI 고지 · SAMEPLZ",
  description:
    "SAMEPLZ의 결과물이 생성형 AI로 만들어진다는 것과 AI 생성 표시를 알려요.",
};

export default function AiNoticePage() {
  return (
    <PolicyPage
      path="/policy/ai"
      eyebrow="정책"
      title="AI 고지"
      intro="SAMEPLZ의 레시피 결과물과 플레이그라운드 결과물은 생성형 AI로 만들어요."
    >
      <PolicySection title="AI 생성 표시">
        <PolicyList
          items={[
            "레시피 상세·갤러리·플레이그라운드의 결과물에는 「AI 생성」 표시가 붙어요. 화면에 보이는 표시와 대체 텍스트 둘 다 넣어요.",
            "얼굴 레퍼런스로 만든 이미지에는 파일 안에도 AI 표시를 넣어요. 표시를 넣지 못하면 결과를 보여 주지 않고 크레딧을 돌려드려요.",
            "플레이그라운드를 처음 쓸 때 「이 화면의 결과물은 생성형 AI로 만들었어요」 안내를 확인해 주세요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="결과물을 쓸 때">
        <PolicyList
          items={[
            "결과물을 밖에서 쓸 때 AI 표시를 지우거나, 사람이 만든 것처럼 속이지 말아 주세요.",
            "AI 결과물은 틀리거나 사실과 다를 수 있어요. 중요한 일에 쓰기 전에 꼭 사람이 확인해 주세요.",
            "AI 결과물의 저작권이 누구에게 있는지는 나라와 상황마다 달라서, SAMEPLZ가 판단해 드릴 수 없어요.",
            "실존 인물이나 다른 사람 얼굴로 만든 결과물은 그 사람의 동의 없이 쓰면 안 돼요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="쓰는 모델">
        <p style={policyP}>
          플레이그라운드는 fal을 통해 여러 이미지·영상 생성 모델을 써요. 실행
          화면에서 어떤 모델로 만드는지 고르고 볼 수 있어요. 입력과 이미지
          결과물은 안전 검사를 위해 OpenAI의 검사 도구를 거치고, 영상은 생성
          공급자의 안전 검사를 거쳐요.
        </p>
        <p style={policyHelp}>
          공급자에게 보내는 정보와 보관 기간은 개인정보처리방침의 「처리 위탁과
          국외 이전」에 있어요.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
