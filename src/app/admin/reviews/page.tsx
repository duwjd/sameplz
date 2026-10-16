import Link from "next/link";
import { Suspense } from "react";
import {
  AdminFallback,
  AdminShell,
  adminCell,
  adminTable,
} from "@/components/admin/AdminShell";
import { Badge, EmptyState } from "@/components/ds";
import { getReviewQueue, REVIEW_SLA_HOURS } from "@/data/admin";
import { REVIEW_REASON_LABEL } from "@/lib/admin/copy";
import { requireAdmin } from "@/lib/auth/admin";
import { kstDateTime } from "@/lib/play/copy";

const CATEGORY: Record<string, string> = {
  prompt: "프롬프트",
  agent: "에이전트",
  skill: "스킬",
};

async function Reviews() {
  const admin = await requireAdmin();
  const rows = await getReviewQueue(admin);
  return (
    <AdminShell
      active="reviews"
      title="심사 큐"
      description={`오래된 것부터 보여요. ${REVIEW_SLA_HOURS}시간이 지나면 표시하고 운영 채널에 알려요.`}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="CheckCircleOutlineIcon"
          title="기다리는 심사가 없어요"
          description="새로 올라온 레시피가 사람 확인으로 오면 여기에 보여요."
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={adminTable}>
            <thead>
              <tr>
                {[
                  "레시피",
                  "종류",
                  "크리에이터",
                  "보류 이유",
                  "요청",
                  "올라온 때",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    style={{ ...adminCell, fontWeight: 600 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.versionId}>
                  <td style={adminCell}>
                    <Link href={`/admin/reviews/${r.versionId}`}>
                      {r.title} · v{r.versionNo}
                    </Link>
                  </td>
                  <td style={adminCell}>
                    {CATEGORY[r.category] ?? r.category}
                  </td>
                  <td style={adminCell}>{r.creator}</td>
                  <td style={adminCell}>
                    {REVIEW_REASON_LABEL[r.reason] ?? r.reason}
                  </td>
                  <td style={adminCell}>
                    {r.visibility === "public" ? "공개" : "비공개"}
                  </td>
                  <td style={adminCell}>
                    {kstDateTime(r.createdAt)}{" "}
                    {r.overdue && (
                      <Badge color="danger" size="sm">
                        {REVIEW_SLA_HOURS}시간 지남
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Reviews />
    </Suspense>
  );
}
