"use client";
import { SiteFooter } from "@/components/ds";
import {
  CONTACT_EMAIL,
  OPERATOR_NAME,
  POLICY_DOCS,
  contactHref,
} from "@/lib/policy/operator";

// F7-7 / HOME-06: policy links (개인정보처리방침 bold), 고객센터 and the operator line.
// MVP has no sales, so the 통신판매중개 notice is replaced by a free-service notice (paid phase restores it).
export function AppFooter() {
  const contact = contactHref();
  return (
    <SiteFooter
      links={[
        ...POLICY_DOCS.map((d) => ({
          label: d.label,
          href: d.href,
          strong: d.href === "/privacy",
        })),
        { label: "고객센터", href: contact },
      ]}
      notice="SAMEPLZ의 레시피는 지금 모두 무료예요. 결과물은 생성형 AI로 만들었어요."
      company={`운영 ${OPERATOR_NAME} · ${CONTACT_EMAIL}`}
    />
  );
}
