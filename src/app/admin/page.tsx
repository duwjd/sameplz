import Link from "next/link";
import { Suspense } from "react";
import {
  AdminFallback,
  AdminShell,
  adminCard,
} from "@/components/admin/AdminShell";
import {
  getAdminOverview,
  REPORT_SLA_HOURS,
  REVIEW_SLA_HOURS,
} from "@/data/admin";
import { requireAdmin } from "@/lib/auth/admin";

async function Overview() {
  const admin = await requireAdmin();
  const o = await getAdminOverview(admin);
  const tiles = [
    {
      href: "/admin/reviews",
      label: "열린 심사",
      value: o.reviews,
      late: o.reviewsOverdue,
      lateLabel: `${REVIEW_SLA_HOURS}시간 지남`,
    },
    {
      href: "/admin/reports",
      label: "열린 신고",
      value: o.reports,
      late: o.reportsOverdue,
      lateLabel: `${REPORT_SLA_HOURS}시간 무응답`,
    },
  ];
  return (
    <AdminShell
      active="home"
      title="운영"
      description="심사는 1~2일, 신고 첫 답은 1영업일 안에 해요. 모든 결정은 사유와 함께 운영 기록에 남아요."
    >
      <section
        aria-label="처리할 일"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            style={{
              ...adminCard,
              textDecoration: "none",
              color: "var(--sp-fg-normal)",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--sp-fg-secondary)" }}>
              {t.label}
            </span>
            <b style={{ fontSize: 26 }}>{t.value}</b>
            <span
              style={{
                fontSize: 13,
                color: t.late > 0 ? "var(--sp-fg-danger)" : "var(--sp-fg-hint)",
                fontWeight: t.late > 0 ? 700 : 400,
              }}
            >
              {t.lateLabel} {t.late}건
            </span>
          </Link>
        ))}
      </section>
    </AdminShell>
  );
}

export default function AdminHomePage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Overview />
    </Suspense>
  );
}
