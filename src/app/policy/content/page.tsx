// F7-7: 금지 콘텐츠 정책 — what cannot be uploaded, generated or posted, and how reports are handled.
// Mirrors the auto checks and R-codes (src/lib/moderation/reject-codes.ts) and report reasons.
import type { Metadata } from "next";
import Link from "next/link";
import {
  PolicyList,
  PolicyPage,
  PolicySection,
  policyHelp,
  policyP,
} from "@/components/policy/PolicyPage";
import { CONTACT_EMAIL } from "@/lib/policy/operator";

export const metadata: Metadata = {
  title: "금지 콘텐츠 정책 · SAMEPLZ",
  description:
    "SAMEPLZ에 올리거나 만들 수 없는 콘텐츠와 신고 처리 절차를 알려요.",
};

export default function ContentPolicyPage() {
  return (
    <PolicyPage
      path="/policy/content"
      eyebrow="정책"
      title="금지 콘텐츠 정책"
      intro="레시피, 플레이그라운드 결과물, 갤러리 글 모두에 같은 기준을 써요."
    >
      <PolicySection title="올리거나 만들 수 없는 것">
        <PolicyList
          items={[
            "전문 판단을 대신하는 것: 세무 신고 대리·제출, 개별 사건의 법률 판단, 질병 진단·처방, 투자 매매 신호",
            "남용: 블로그·SNS 대량 자동 발행, AI 탐지 회피, 스팸·어뷰징 도구",
            "사람에 대한 침해: 실존 인물 사칭, 동의 없는 다른 사람 얼굴 사진이나 합성, 혐오·괴롭힘, 개인정보 노출",
            "권리 침해: 다른 사람 결과물·레시피 무단 사용, 상표·저작물 무단 사용",
            "위험한 것: 성적 콘텐츠, 미성년자를 성적으로 다루는 모든 것, 폭력·자해 조장, 불법 행위 안내",
            "숨은 동작: 숨은 지시문, 보이지 않는 문자, 악성 코드, 설명과 다르게 동작하는 스크립트",
            "비밀 정보: API 키·비밀번호·개인정보가 들어 있는 레시피",
          ]}
        />
        <p style={policyHelp}>
          세무·법률 같은 전문 영역은 사람이 검토할 때 돕는 레시피만 올릴 수
          있고, 결과를 단정해서 말하면 안 돼요.
        </p>
      </PolicySection>

      <PolicySection title="어떻게 걸러 내나요">
        <PolicyList
          items={[
            "레시피는 공개 전에 자동 검사를 거치고, 스크립트가 있으면 사람이 확인해요. 걸리면 사유와 고칠 방법을 알려 드려요.",
            "플레이그라운드 입력과 결과물은 안전 필터를 거쳐요. 걸린 결과는 보여 주지 않고, 크레딧은 차감하지 않아요.",
            "24시간 안에 안전 필터에 3번 걸리면 생성이 멈추고 사람이 확인해요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="신고와 처리">
        <PolicyList
          items={[
            "레시피 상세나 갤러리 글의 「신고」에서 사유(설명과 달라요, 이상한 지시나 악성 코드, 남의 결과물, 금지된 내용)를 골라 신고해요.",
            "1영업일 안에 첫 답을 드리고, 처리 결과를 알림으로 알려 드려요.",
            "확인되면 판매 중지, 게시중단, 글 숨김 가운데 하나로 조치해요. 게시중단된 레시피는 받은 사람도 더 열 수 없어요.",
            "저작권 침해 신고는 확인되면 바로 게시를 멈추고 올린 사람에게 알려요. 올린 사람이 권리를 소명하면 다시 공개할 수 있어요. 명예훼손·사생활 침해 신고는 최대 30일까지 임시로 비공개할 수 있어요.",
            "올린 사람에게도 사유를 알려 드려요. 반복하거나 위반이 무거우면 이용약관의 이용 제한 단계(경고 → 판매 정지 → 계정 정지 → 차단)를 적용해요.",
          ]}
        />
        <p style={policyP}>
          조치에 이의가 있거나 갤러리 밖에서 권리 침해를 알리고 싶으면{" "}
          {CONTACT_EMAIL}로 보내 주세요. 자세한 조건은{" "}
          <Link href="/terms">이용약관</Link>에 있어요.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
