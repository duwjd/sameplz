// F7-7: 이용약관 for the free MVP (no payments, sales or payouts — seller terms and the 통신판매중개
// notice come with the paid phase). TERMS_VERSION (src/lib/auth/account.ts) names this text.
import type { Metadata } from "next";
import Link from "next/link";
import {
  PolicyList,
  PolicyPage,
  PolicySection,
  policyP,
} from "@/components/policy/PolicyPage";
import { CONTACT_EMAIL, OPERATOR_NAME } from "@/lib/policy/operator";

export const metadata: Metadata = {
  title: "이용약관 · SAMEPLZ",
  description: "SAMEPLZ 무료 서비스 이용약관이에요.",
};

export default function TermsPage() {
  return (
    <PolicyPage
      path="/terms"
      eyebrow="정책"
      title="이용약관"
      intro={`이 약관은 ${OPERATOR_NAME}(이하 「운영자」)가 운영하는 SAMEPLZ(이하 「서비스」)를 쓰는 조건을 정해요.`}
    >
      <PolicySection title="제1조 서비스">
        <p style={policyP}>
          서비스는 AI 레시피(프롬프트·스킬·에이전트)를 올리고 받고,
          플레이그라운드에서 결과물을 만들어 보고, 결과물을 갤러리에 공유하는
          곳이에요. 지금 서비스의 모든 레시피와 기능은 무료예요. 유료 판매를
          열게 되면 바뀌는 약관을 미리 알리고 다시 동의를 받아요.
        </p>
      </PolicySection>

      <PolicySection title="제2조 가입과 계정">
        <PolicyList
          items={[
            "만 18세 이상만 가입할 수 있어요. 가입할 때 만 18세 이상인지 직접 확인해 주세요.",
            "Google·카카오·네이버 계정으로 로그인해요. 계정은 본인만 쓰고, 다른 사람에게 빌려주거나 넘기지 않아요.",
            "다른 사람을 사칭하거나 무료 크레딧을 더 받으려고 여러 계정을 만들면 안 돼요.",
            "언제든 마이페이지 > 계정에서 탈퇴할 수 있어요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="제3조 레시피 라이선스">
        <PolicyList
          items={[
            "받은 레시피는 본인 일과 업무에 자유롭게 쓸 수 있어요.",
            "레시피 원문을 다시 팔거나, 다른 사람에게 나눠 주거나, 다른 서비스에 올리면 안 돼요.",
            "레시피를 올린 사람(크리에이터)이 판매를 멈춰도, 이미 받은 버전은 계속 쓸 수 있어요. 운영 정책에 따라 게시가 중단된 레시피는 받은 사람도 더 열 수 없어요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="제4조 올린 콘텐츠">
        <PolicyList
          items={[
            "레시피·결과물·글의 권리는 올린 사람에게 있어요. 올린 사람은 서비스 안에서 보여 주고, 검색되게 하고, 미리보기를 만드는 데 필요한 범위로 운영자가 쓸 수 있게 허락해요.",
            "직접 만들었거나 쓸 권리가 있는 것만 올려 주세요.",
            "레시피는 공개 전에 안전 검사를 거쳐요. 검사는 숨은 지시와 금지 콘텐츠를 걸러 내는 절차이고, 품질이나 효과를 판단하지 않아요.",
            "금지 콘텐츠 정책을 어기거나 권리 침해 신고가 들어오면, 운영자는 사유를 알리고 판매 중지·게시중단·글 숨김을 할 수 있어요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="제5조 플레이그라운드와 크레딧">
        <PolicyList
          items={[
            "크레딧은 플레이그라운드 생성에만 쓰는 서비스 안의 포인트예요. 현금 가치가 없고, 현금으로 바꾸거나 다른 사람에게 보낼 수 없어요.",
            "매월 무료 크레딧을 드리고, 하루에 쓸 수 있는 양에 한도가 있어요. 남은 크레딧은 다음 달로 넘어가지 않아요. 지급량과 한도는 이용 안내에 있어요.",
            "전체 생성 비용이 한도에 닿으면 그달 생성을 잠시 멈출 수 있어요.",
            "플레이그라운드 결과물은 생성형 AI가 만들어요. 결과물에는 AI 생성 표시가 붙고, 이 표시를 지우거나 AI가 만들지 않은 것처럼 쓰면 안 돼요.",
            "「저장」하지 않은 결과물은 만든 지 30일 뒤에 지워져요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="제6조 이용 제한">
        <p style={policyP}>
          약관이나 금지 콘텐츠 정책을 어기면 운영자는 사유를 알리고 아래 순서로
          이용을 제한할 수 있어요. 위반이 무거우면 단계를 건너뛸 수 있어요.
        </p>
        <PolicyList
          items={[
            "경고",
            "판매 정지: 새 레시피와 새 버전을 올릴 수 없어요.",
            "계정 정지: 정해진 기간 동안 받기·만들기·올리기·글쓰기를 할 수 없어요.",
            "차단: 서비스를 더 쓸 수 없어요.",
          ]}
        />
        <p style={policyP}>
          짧은 시간에 너무 많이 실행하거나 안전 필터에 반복해서 걸리면, 생성이
          자동으로 멈추고 사람이 확인해요. 제한에 이의가 있으면 고객센터(
          {CONTACT_EMAIL})로 알려 주세요.
        </p>
      </PolicySection>

      <PolicySection title="제7조 탈퇴">
        <PolicyList
          items={[
            "탈퇴하면 남은 무료 크레딧은 사라지고, 받은 레시피는 더 열 수 없어요.",
            "올린 레시피는 판매가 멈춰서 더는 새로 받을 수 없어요. 갤러리 글은 「탈퇴한 회원」 이름으로 남고, 원하면 탈퇴 전에 직접 지울 수 있어요.",
            "부정 이용을 막기 위해 일부 기록을 정해진 기간 보관해요. 자세한 건 개인정보처리방침에 있어요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="제8조 책임">
        <PolicyList
          items={[
            "레시피와 AI 결과물은 참고용이에요. 세무·법률·의료·투자처럼 전문가 판단이 필요한 일에 그대로 쓰지 말고, 꼭 사람이 확인해 주세요.",
            "운영자는 레시피가 원하는 결과를 낸다고 약속하지 않아요. 무료 서비스라 운영자의 고의나 중대한 과실이 아니면 이용 중 생긴 손해를 책임지지 않아요.",
            "공급자 장애나 점검으로 서비스가 잠시 멈출 수 있어요. 미리 알 수 있으면 먼저 알려 드려요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="제9조 약관 변경과 문의">
        <p style={policyP}>
          약관을 바꾸면 시행 7일 전에(이용자에게 불리하면 30일 전에) 서비스
          안에서 알려요. 바뀐 약관에 동의하지 않으면 탈퇴할 수 있어요. 문의는
          고객센터({CONTACT_EMAIL})로 보내 주세요. 개인정보는{" "}
          <Link href="/privacy">개인정보처리방침</Link>, 금지 기준은{" "}
          <Link href="/policy/content">금지 콘텐츠 정책</Link>을 따라요.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
