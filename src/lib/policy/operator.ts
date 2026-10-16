// F7-7: operator details shown in the policy pages and the footer (legal review is the operator's).
export const OPERATOR_NAME = "김정원";
export const PRIVACY_OFFICER = "김정원";
export const CONTACT_EMAIL = "2000jeongwon43@gmail.com";
export const POLICY_EFFECTIVE_DATE = "2026년 10월 16일";
/** How long consent and credit records, gallery posts, playground runs and reports are kept after
 * withdrawal (private.purge_withdrawn_members; PIPA art. 21: destroy once the purpose ends). No law requires
 * longer for a free service; the paid phase adds 전자상거래법 5-year records for orders. */
export const RECORD_RETENTION = "1년";

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
