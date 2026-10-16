// F7-7: 개인정보처리방침. Every retention period here is enforced in SQL (pg_cron jobs and
// withdraw_account) — change them together. D13 (hashes only), D19 (play results), D20 (abuse records).
import type { Metadata } from "next";
import {
  PolicyList,
  PolicyPage,
  PolicySection,
  PolicyTable,
  policyHelp,
  policyP,
} from "@/components/policy/PolicyPage";
import {
  CONTACT_EMAIL,
  OPERATOR_NAME,
  PRIVACY_OFFICER,
  RECORD_RETENTION,
} from "@/lib/policy/operator";

export const metadata: Metadata = {
  title: "개인정보처리방침 · SAMEPLZ",
  description:
    "SAMEPLZ가 어떤 개인정보를 왜 모으고, 얼마나 보관하고, 누구에게 맡기는지 알려요.",
};

// GA4 / Sentry (D21) are listed only once they are switched on, so the policy never claims more than runs.
const GA_ON = Boolean(process.env.NEXT_PUBLIC_GA_ID);
const SENTRY_ON = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

const PROCESSORS: [string, string, string, string][] = [
  [
    "Supabase Inc.",
    "미국(데이터는 서울 리전에 저장)",
    "회원 정보·서비스 데이터 저장, 로그인 처리",
    "탈퇴하거나 위탁 계약이 끝날 때까지",
  ],
  [
    "Vercel Inc.",
    "미국(서울 리전에서 실행)",
    "웹 서비스 호스팅, 접속 기록 처리",
    "위탁 계약이 끝날 때까지",
  ],
  [
    "Features & Labels, Inc.(fal)",
    "미국",
    "플레이그라운드 결과물 생성(프롬프트·레퍼런스 이미지 전달)",
    "생성 처리가 끝날 때까지",
  ],
  [
    "OpenAI, L.L.C.",
    "미국",
    "올린 레시피(원문 포함)와 플레이그라운드 프롬프트·이미지 결과물의 안전 검사",
    "검사 처리가 끝날 때까지",
  ],
  [
    "Anthropic, PBC",
    "미국",
    "올린 레시피(원문 포함)의 안전 검사",
    "검사 처리가 끝날 때까지",
  ],
  [
    "Google LLC",
    "미국",
    GA_ON ? "Google 로그인, 방문 통계(Google Analytics)" : "Google 로그인",
    "탈퇴하거나 위탁 계약이 끝날 때까지",
  ],
  ...(SENTRY_ON
    ? [
        [
          "Functional Software, Inc.(Sentry)",
          "미국",
          "오류 기록(프롬프트·원문은 보내지 않아요)",
          "공급자 보관 기간이 지나면 자동 삭제",
        ] as [string, string, string, string],
      ]
    : []),
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      path="/privacy"
      eyebrow="정책"
      title="개인정보처리방침"
      intro={`${OPERATOR_NAME}(이하 「운영자」)는 SAMEPLZ를 운영하면서 필요한 개인정보만 모으고, 정한 기간이 지나면 지워요.`}
    >
      <PolicySection title="1. 모으는 정보와 목적">
        <PolicyTable
          label="모으는 정보와 목적"
          head={["언제", "모으는 정보", "목적"]}
          rows={[
            [
              "가입·로그인",
              "로그인 계정 식별자(Google·카카오·네이버), 이메일(Google·네이버만, 카카오는 받지 않아요), 이름 또는 닉네임, 프로필 사진",
              "회원 확인, 로그인 유지",
            ],
            [
              "가입 마무리",
              "약관·개인정보처리방침 동의와 만 18세 이상 확인 시각, 동의한 문구 버전",
              "동의 기록, 연령 제한",
            ],
            ["프로필 꾸미기(선택)", "핸들, 닉네임, 소개, 직무", "프로필 표시"],
            [
              "서비스 이용",
              "받은 레시피, 올린 레시피와 결과물, 플레이그라운드 프롬프트·레퍼런스·결과물, SAME 인증·좋아요·팔로우·신고, 크레딧 지급·사용 기록, 알림",
              "서비스 제공, 신고 처리",
            ],
            [
              "접속할 때 자동으로",
              `IP 주소와 기기 쿠키(sp_did)를 서버 비밀 키로 바꾼 해시값, 로그인 세션 쿠키${GA_ON ? ", 방문 통계 쿠키(Google Analytics)" : ""}`,
              `부정 이용과 중복 가입 방지, 실행 횟수 제한, 조회수 집계${GA_ON ? ", 서비스 개선" : ""}`,
            ],
          ]}
        />
        <p style={policyHelp}>
          IP 주소와 기기 쿠키는 원래 값을 저장하지 않고, 되돌릴 수 없는 해시값만
          저장해요. 주민등록번호·결제 정보는 모으지 않아요.
        </p>
      </PolicySection>

      <PolicySection title="2. 보관 기간">
        <PolicyList
          items={[
            "프로필(닉네임·핸들·소개·사진·직무): 탈퇴하면 바로 지우고 「탈퇴한 회원」으로 바꿔요. 알림·팔로우·좋아요·작성 중인 초안도 바로 지워요.",
            "로그인 이메일과 계정 식별자: 탈퇴하면 바로 되돌릴 수 없게 지워요.",
            `갤러리 글, 플레이그라운드 기록과 결과물(「저장」한 것 포함), 내가 한 신고: 탈퇴 후 ${RECORD_RETENTION} 보관한 뒤 삭제. 갤러리 글은 탈퇴 전에 직접 지울 수도 있어요.`,
            "올린 레시피: 이미 받은 사람이 계속 쓸 수 있게 「탈퇴한 회원」 이름으로 판매가 멈춘 채 남아요. 누가 올렸는지 알 수 있는 정보는 남기지 않아요. 지우길 원하면 고객센터로 알려 주세요.",
            "「저장」하지 않은 플레이그라운드 결과물: 만든 지 30일 뒤 삭제",
            "플레이그라운드 프롬프트 기록: 30일 뒤 삭제",
            "레퍼런스 업로드(얼굴 사진 포함), 제출하지 않은 올리기 결과물: 24시간 뒤 삭제",
            "실행 횟수 제한 기록: 2일 뒤 삭제",
            "레시피 조회 기록(해시): 100일 뒤 삭제",
            "기기·IP 해시와 부정 이용 기록: 회원인 동안, 그리고 탈퇴 후 1년까지 보관한 뒤 삭제(탈퇴 후 다시 가입해 무료 크레딧을 또 받는 것을 막기 위해서예요)",
            `동의 기록과 크레딧 지급·사용 기록: 분쟁 대비로 탈퇴 후 ${RECORD_RETENTION} 보관한 뒤 삭제`,
          ]}
        />
      </PolicySection>

      <PolicySection title="3. 처리 위탁과 국외 이전">
        <p style={policyP}>
          서비스를 제공하려고 아래 업체에 개인정보 처리를 맡기고, 이 과정에서
          정보가 국외로 옮겨져요. 모두 서비스 이용 계약을 지키는 데 필요한
          위탁이에요. 정보는 이용할 때마다 인터넷으로 암호화해서 보내요. 국외
          이전을 원하지 않으면 서비스를 쓰지 않거나 탈퇴할 수 있지만, 그러면
          서비스를 이용할 수 없어요.
        </p>
        <PolicyTable
          label="처리 위탁과 국외 이전"
          head={["받는 곳", "나라", "맡기는 일·보내는 정보", "보관 기간"]}
          rows={PROCESSORS}
        />
        <p style={policyHelp}>
          카카오·네이버 로그인은 국내 업체(카카오, 네이버)를 거쳐요. 운영자는
          개인정보를 팔거나 광고 목적으로 다른 곳에 주지 않아요.
        </p>
      </PolicySection>

      <PolicySection title="4. 쿠키">
        <p style={policyP}>
          로그인을 유지하는 세션 쿠키와, 부정 이용을 막는 기기 쿠키(sp_did,
          2년)를 써요.
          {GA_ON
            ? " Google Analytics로 어떤 화면이 많이 쓰이는지도 봐요. 회원 번호·이메일·프롬프트는 보내지 않고, 마이페이지·플레이그라운드·관리 화면에서는 통계를 모으지 않아요."
            : ""}{" "}
          브라우저 설정에서 쿠키를 막을 수 있어요. 로그인 세션 쿠키를 막으면
          로그인이 유지되지 않아요.
        </p>
      </PolicySection>

      <PolicySection title="5. 내 정보에 대한 권리">
        <PolicyList
          items={[
            "마이페이지 > 프로필에서 내 정보를 보고 고칠 수 있어요.",
            "마이페이지 > 계정에서 언제든 탈퇴할 수 있어요.",
            `열람·정정·삭제·처리 정지를 원하면 ${CONTACT_EMAIL}로 알려 주세요. 10일 안에 답해요.`,
            "만 18세 미만은 가입할 수 없어요. 18세 미만의 정보가 모인 걸 알게 되면 바로 지워요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="6. 안전하게 지키는 방법">
        <PolicyList
          items={[
            "모든 통신을 암호화하고, 데이터베이스는 행 단위 접근 제한을 걸어 본인 정보만 보이게 해요.",
            "레시피 원문과 프롬프트는 서비스 운영에 꼭 필요한 곳에서만 읽고, 기록(로그)에 남기지 않아요.",
            "관리 화면은 운영자만 열 수 있고, 모든 조치는 사유와 함께 기록돼요.",
          ]}
        />
      </PolicySection>

      <PolicySection title="7. 개인정보 보호책임자">
        <p style={policyP}>
          개인정보 보호책임자: {PRIVACY_OFFICER} · 연락처: {CONTACT_EMAIL}
        </p>
        <p style={policyHelp}>
          개인정보 침해 상담은 개인정보침해신고센터(국번 없이 118,
          privacy.kisa.or.kr)나 개인정보분쟁조정위원회(1833-6972,
          kopico.go.kr)에도 할 수 있어요.
        </p>
      </PolicySection>

      <PolicySection title="8. 바뀔 때">
        <p style={policyP}>
          이 방침을 바꾸면 시행 7일 전에 서비스 안에서 알려요. 모으는 정보나
          맡기는 곳이 늘어나면 시행 30일 전에 알려요.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
