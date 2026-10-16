import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  AdminFallback,
  AdminShell,
  adminCard,
} from "@/components/admin/AdminShell";
import { ReviewDecision } from "@/components/admin/ReviewDecision";
import { Badge } from "@/components/ds";
import { getReviewDetail } from "@/data/admin";
import { readVersionOriginalsForAdmin } from "@/data/secrets";
import { changedHunks, lineDiff, type DiffLine } from "@/lib/admin/diff";
import { RECIPE_STATUS_LABEL, REVIEW_REASON_LABEL } from "@/lib/admin/copy";
import { requireAdmin } from "@/lib/auth/admin";
import { kstDateTime } from "@/lib/play/copy";

const pre = {
  margin: 0,
  padding: 12,
  borderRadius: 8,
  background: "var(--sp-bg-secondary)",
  fontSize: 13,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
  maxHeight: 420,
  overflow: "auto",
};

function Diff({ lines }: { lines: (DiffLine | null)[] }) {
  if (!lines.length)
    return (
      <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
        바뀐 줄이 없어요.
      </p>
    );
  return (
    <pre style={pre} aria-label="바뀐 줄">
      {lines.map((l, k) =>
        l === null ? (
          <span
            key={k}
            style={{ display: "block", color: "var(--sp-fg-hint)" }}
          >
            ⋯
          </span>
        ) : (
          <span
            key={k}
            style={{
              display: "block",
              background:
                l.op === "add"
                  ? "var(--sp-bg-success-soft)"
                  : l.op === "del"
                    ? "var(--sp-bg-danger-soft)"
                    : "transparent",
            }}
          >
            {l.op === "add" ? "+ " : l.op === "del" ? "- " : "  "}
            {l.text}
          </span>
        ),
      )}
    </pre>
  );
}

const json = (v: unknown) => (v == null ? "" : JSON.stringify(v, null, 2));

async function Review({
  params,
}: {
  params: PageProps<"/admin/reviews/[versionId]">["params"];
}) {
  const admin = await requireAdmin();
  const { versionId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(versionId)) notFound();
  const [d, originals] = await Promise.all([
    getReviewDetail(admin, versionId),
    readVersionOriginalsForAdmin(admin, versionId),
  ]);
  if (!d) notFound();
  const original = originals?.current ?? "";
  const originalDiff = changedHunks(
    lineDiff(originals?.previous ?? "", original),
  );
  const metaDiff = changedHunks(
    lineDiff(json(d.previousMeta), json(d.publicMeta)),
  );
  return (
    <AdminShell
      active="reviews"
      title={`${d.recipe.title} · v${d.versionNo}`}
      description={`${d.recipe.creator} · ${RECIPE_STATUS_LABEL[d.recipe.status] ?? d.recipe.status}${
        d.queue
          ? ` · ${REVIEW_REASON_LABEL[d.queue.reason] ?? d.queue.reason} · ${kstDateTime(d.queue.createdAt)} 올라옴`
          : ""
      }`}
    >
      <p style={{ margin: 0, fontSize: 14 }}>
        <Link href="/admin/reviews">← 심사 큐</Link>
      </p>

      <section aria-labelledby="rv-summary" style={adminCard}>
        <h2
          id="rv-summary"
          style={{ margin: 0, fontSize: 16, fontWeight: 700 }}
        >
          공개 정보
        </h2>
        <p style={{ margin: 0, fontSize: 14 }}>
          {d.recipe.summary || "요약 없음"}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-secondary)" }}>
          변경 내용: {d.changelog || "없음"} · 요청:{" "}
          {d.queue?.visibility === "private" ? "비공개" : "공개"}
          {d.hasScripts ? " · 스크립트 포함" : ""}
        </p>
        {d.media.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {d.media.map((m, k) =>
              m.kind === "video" ? (
                <video
                  key={k}
                  src={m.url}
                  controls
                  preload="metadata"
                  width={160}
                  aria-label={m.alt || "결과 영상"}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={k}
                  src={m.url}
                  alt={m.alt || "결과 이미지"}
                  width={160}
                  style={{ borderRadius: 8 }}
                />
              ),
            )}
          </div>
        )}
        {d.files.length > 0 && (
          <p style={{ margin: 0, fontSize: 13 }}>
            첨부:{" "}
            {d.files
              .map((f) => `${f.name}(${Math.ceil(f.size / 1024)}KB)`)
              .join(", ")}
          </p>
        )}
      </section>

      <section aria-labelledby="rv-checks" style={adminCard}>
        <h2 id="rv-checks" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          자동 검사
        </h2>
        {d.checks.length === 0 ? (
          <p
            style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}
          >
            검사 기록이 없어요.
          </p>
        ) : (
          d.checks.map((c, k) => (
            <div
              key={k}
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <span style={{ fontSize: 14 }}>
                {c.layer}층 {c.checker && `· ${c.checker}`}{" "}
                <Badge
                  size="sm"
                  color={
                    c.result === "pass"
                      ? "success"
                      : c.result === "fail"
                        ? "danger"
                        : "warning"
                  }
                >
                  {c.result === "pass"
                    ? "통과"
                    : c.result === "fail"
                      ? "실패"
                      : "사람 확인"}
                </Badge>
              </span>
              {c.findings.length > 0 && (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {c.findings.map((f, j) => (
                    <li key={j}>
                      <b>{f.code}</b> {f.field && `· ${f.field}`} {f.note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>

      <section aria-labelledby="rv-diff" style={adminCard}>
        <h2 id="rv-diff" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          {originals?.previousNo
            ? `v${originals.previousNo}과 비교`
            : "첫 버전"}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-secondary)" }}>
          원문은 관리자에게만 보여요. 화면을 찍거나 옮기지 마세요.
        </p>
        <h3 style={{ margin: 0, fontSize: 14 }}>원문</h3>
        <Diff lines={originalDiff} />
        <details>
          <summary style={{ fontSize: 14, cursor: "pointer" }}>
            원문 전체 보기
          </summary>
          <pre style={{ ...pre, marginTop: 8 }}>
            {original || "원문이 비어 있어요."}
          </pre>
        </details>
        <h3 style={{ margin: 0, fontSize: 14 }}>공개 메타([변수]·설정·단계)</h3>
        <Diff lines={metaDiff} />
      </section>

      {d.open ? (
        <ReviewDecision versionId={d.versionId} />
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          이미 결정된 심사예요.
        </p>
      )}
    </AdminShell>
  );
}

export default function AdminReviewPage(
  props: PageProps<"/admin/reviews/[versionId]">,
) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Review params={props.params} />
    </Suspense>
  );
}
