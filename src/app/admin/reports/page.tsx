import Link from "next/link";
import { Suspense } from "react";
import {
  AdminFallback,
  AdminShell,
  adminCard,
} from "@/components/admin/AdminShell";
import { ReportDecision } from "@/components/admin/ReportDecision";
import { Badge, EmptyState } from "@/components/ds";
import { getOpenReports, REPORT_SLA_HOURS } from "@/data/admin";
import { RECIPE_STATUS_LABEL, REPORT_REASON_LABEL } from "@/lib/admin/copy";
import { requireAdmin } from "@/lib/auth/admin";
import { recipeHref } from "@/lib/catalog/card";
import { kstDateTime } from "@/lib/play/copy";

async function Reports() {
  const admin = await requireAdmin();
  const rows = await getOpenReports(admin);
  return (
    <AdminShell
      active="reports"
      title="신고함"
      description={`오래된 것부터 보여요. 첫 답은 1영업일 안에, ${REPORT_SLA_HOURS}시간 무응답이면 운영 채널에 알려요. 답하면 같은 대상의 열린 신고가 함께 닫혀요.`}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="CheckCircleOutlineIcon"
          title="답할 신고가 없어요"
          description="새 신고가 들어오면 여기에 보여요."
        />
      ) : (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {rows.map((r) => (
            <li
              key={r.id}
              style={adminCard}
              aria-labelledby={`rep-${r.id}-title`}
            >
              <h2
                id={`rep-${r.id}-title`}
                style={{ margin: 0, fontSize: 15, fontWeight: 700 }}
              >
                {REPORT_REASON_LABEL[r.reason] ?? r.reason} ·{" "}
                {r.target.type === "recipe" ? "레시피" : "갤러리 글"} 「
                {r.target.title || "없어진 대상"}」{" "}
                <Badge size="sm" color="hint">
                  {RECIPE_STATUS_LABEL[r.target.status] ?? r.target.status}
                </Badge>{" "}
                {r.overdue && (
                  <Badge size="sm" color="danger">
                    {REPORT_SLA_HOURS}시간 무응답
                  </Badge>
                )}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--sp-fg-secondary)",
                }}
              >
                {r.reporter} · {kstDateTime(r.createdAt)} 접수
                {r.claim
                  ? ` · ${kstDateTime(r.claim.claimedAt)} 받음${r.claim.openedAt ? `, ${kstDateTime(r.claim.openedAt)} 열어 봄` : ", 아직 안 열어 봄"}`
                  : " · 받은 적 없음"}
                {r.sameTarget > 0
                  ? ` · 같은 대상 신고 ${r.sameTarget}건 더`
                  : ""}
              </p>
              {r.detail && (
                <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap" }}>
                  {r.detail}
                </p>
              )}
              {r.target.publicId &&
                (r.target.status === "live" ||
                  r.target.status === "stopped" ||
                  r.target.type === "post") && (
                  <p style={{ margin: 0, fontSize: 13 }}>
                    <Link href={recipeHref(r.target.publicId)} target="_blank">
                      레시피 상세 열기
                    </Link>
                  </p>
                )}
              <ReportDecision reportId={r.id} targetType={r.target.type} />
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Reports />
    </Suspense>
  );
}
