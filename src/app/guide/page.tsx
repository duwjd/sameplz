// GUIDE-01~05 (F7-7): what to know before using SAMEPLZ. MVP: no refund section (everything is free,
// refunds are the paid phase) and no won value for credits (D17).
import type { Metadata } from "next";
import Link from "next/link";
import {
  PolicyList,
  PolicyPage,
  PolicySection,
  PolicyTable,
  policyHelp,
  policyP,
} from "@/components/policy/PolicyPage";

export const metadata: Metadata = {
  title: "이용 안내 · SAMEPLZ",
  description:
    "레시피 라이선스, 안전 검사, 무료 크레딧, 금지와 신고를 한 곳에서 안내해요.",
};

const TOC = [
  { id: "license", label: "라이선스" },
  { id: "safety", label: "안전 검사" },
  { id: "credits", label: "크레딧" },
  { id: "banned", label: "금지와 신고" },
];

export default function GuidePage() {
  return (
    <PolicyPage
      path="/guide"
      eyebrow="이용 안내"
      title="편하게 쓰려면 알아 둘 것"
      toc={TOC}
    >
      <PolicySection id="license" title="라이선스">
        <p style={policyP}>
          받은 레시피는 본인 일과 업무에 자유롭게 쓸 수 있어요. 원문을 다시
          팔거나 다른 사람에게 나눠 주는 건 안 돼요.
        </p>
        <p style={policyHelp}>
          지금은 개인용·업무용을 나누지 않아요. 필요해지면 나눠서 미리
          안내할게요. 레시피로 만든 결과물의 저작권이 누구에게 있는지는
          SAMEPLZ가 판단해 드릴 수 없어요.
        </p>
      </PolicySection>

      <PolicySection id="safety" title="안전 검사">
        <p style={policyP}>
          올라온 레시피는 공개 전에 아래처럼 확인해요. 안전 검사는 레시피의
          품질이나 효과를 따지는 심사가 아니고, 숨은 지시나 금지 콘텐츠를 걸러
          내는 절차예요.
        </p>
        <PolicyTable
          label="공개 전 안전 검사"
          head={["대상", "확인하는 것", "공개까지"]}
          rows={[
            [
              "프롬프트",
              "숨은 지시문, 보이지 않는 문자, 금지 표현 자동 검사",
              "검사가 끝나면 바로",
            ],
            [
              "지침만 있는 스킬",
              "위 검사 + 외부 주소 검사",
              "검사가 끝나면 바로",
            ],
            ["스크립트가 있는 스킬·에이전트", "위 검사 + 사람 확인", "1~2일"],
          ]}
        />
        <p style={policyHelp}>
          새 버전도 같은 검사를 거쳐요. 확인하는 동안에는 지난 버전이 그대로
          보여요.
        </p>
      </PolicySection>

      <PolicySection id="credits" title="크레딧">
        <PolicyList
          items={[
            "크레딧은 플레이그라운드에서 결과물을 만들 때만 써요. 레시피는 모두 무료라 크레딧이 들지 않아요.",
            "매월 1일 0시(한국 시간)에 270C를 드려요. 월 중간에 가입해도 그달 전액을 드려요.",
            "하루에 쓸 수 있는 크레딧은 135C까지예요. 남은 크레딧은 다음 달로 넘어가지 않아요.",
            "실행 전에 몇 크레딧이 드는지 먼저 보여 드려요. 모델 오류로 실패하면 크레딧을 돌려드리고, 안전 필터에 걸리면 차감하지 않아요.",
            "크레딧은 현금으로 바꾸거나 다른 사람에게 보낼 수 없어요.",
            "같은 기기에서 두 번째 계정을 만들면 그달 무료 크레딧은 나가지 않아요.",
          ]}
        />
      </PolicySection>

      <PolicySection id="banned" title="금지와 신고">
        <PolicyList
          items={[
            "세무 신고 대리·제출, 개별 법률 판단, 진단·처방, 투자 매매 신호",
            "블로그 대량 자동 발행, AI 탐지 회피",
            "실존 인물 사칭, 동의 없는 다른 사람 얼굴 사진, 다른 사람 결과물 무단 사용",
          ]}
        />
        <p style={policyHelp}>
          세무·법률 같은 전문 영역은 사람이 검토할 때 돕는 레시피만 올릴 수
          있어요. 문제가 있는 레시피나 글을 신고하면 1영업일 안에 첫 답을
          드려요. 저작권 침해 신고는 확인되면 바로 게시를 멈추고,
          명예훼손·사생활 침해 신고는 최대 30일까지 임시로 비공개할 수 있어요.
          자세한 기준은 <Link href="/policy/content">금지 콘텐츠 정책</Link>에
          있어요.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
