// F8-4: where a banned account lands after being signed out (terms §6). Static, noindex.
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ds";
import { CONTACT_EMAIL, contactHref } from "@/lib/policy/operator";

export const metadata: Metadata = {
  title: "이용이 제한된 계정이에요 · SAMEPLZ",
  robots: { index: false },
};

export default function BlockedPage() {
  const contact = contactHref();
  return (
    <main
      data-screen-label="Blocked"
      style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px 96px" }}
    >
      <EmptyState
        icon="LockOutlineIcon"
        titleAs="h1"
        title="이용이 제한된 계정이에요"
        description="운영 정책에 따라 이 계정은 SAMEPLZ를 더 쓸 수 없어요. 사유는 계정으로 보낸 알림에 있어요. 이의가 있으면 고객센터로 알려 주세요."
        actions={
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {contact ? (
              <a href={contact} style={{ fontWeight: 700, color: "var(--sp-fg-normal)" }}>
                고객센터 {CONTACT_EMAIL}
              </a>
            ) : null}
            <Link href="/terms" style={{ color: "var(--sp-fg-secondary)" }}>
              이용약관 제6조 보기
            </Link>
          </div>
        }
      />
    </main>
  );
}
