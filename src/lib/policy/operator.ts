// F7-7: operator details shown in the policy pages and the footer. The {{…}} values are placeholders
// the operator fills in before launch (legal review is the operator's, docs/launch-checklist.md).
export const OPERATOR_NAME = "{{운영자 이름}}";
export const PRIVACY_OFFICER = "{{개인정보 보호책임자 이름}}";
export const CONTACT_EMAIL = "{{연락 이메일}}";
export const POLICY_EFFECTIVE_DATE = "{{시행일}}";
/** How long consent and credit-ledger history (append-only) is kept after withdrawal. */
export const RECORD_RETENTION = "{{동의·크레딧 기록 보관 기간}}";

/** Policy documents, in footer and in-page navigation order. */
export const POLICY_DOCS = [
  { href: "/guide", label: "이용 안내" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/policy/content", label: "금지 콘텐츠 정책" },
  { href: "/policy/ai", label: "AI 고지" },
] as const;

/** mailto: link for 고객센터 (inert text until the placeholder is filled). */
export const contactHref = () =>
  CONTACT_EMAIL.startsWith("{{") ? null : `mailto:${CONTACT_EMAIL}`;
