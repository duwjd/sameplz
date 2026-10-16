"use client";
// ADM reports (F8-2): decide what happens to the target, then answer the reporter (required).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resolveReport } from "@/actions/admin";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdminField, adminSelect } from "@/components/admin/fields";
import { Button, Textarea } from "@/components/ds";
import {
  adminError,
  OPS_REASONS,
  REPORT_ANSWER_TEMPLATE,
  type OpsReason,
} from "@/lib/admin/copy";

type Decision = "dismiss" | "stop" | "takedown" | "hide_post";

export function ReportDecision({
  reportId,
  targetType,
}: {
  reportId: string;
  targetType: "recipe" | "post";
}) {
  const router = useRouter();
  const { notify } = useAuth();
  const [decision, setDecision] = useState<Decision>("dismiss");
  const [reason, setReason] = useState<OpsReason | "">("");
  const [answer, setAnswer] = useState(REPORT_ANSWER_TEMPLATE.dismiss);
  const [error, setError] = useState<{ field: string; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const id = (k: string) => `rep-${reportId}-${k}`;
  const needsReason = decision === "stop" || decision === "takedown";

  const submit = async () => {
    if (needsReason && !reason) {
      setError({ field: "reason", text: "사유를 골라 주세요." });
      document.getElementById(id("reason"))?.focus();
      return;
    }
    if (!answer.trim()) {
      setError({
        field: "answer",
        text: "신고한 사람에게 보낼 답변을 써 주세요.",
      });
      document.getElementById(id("answer"))?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    let r: Awaited<ReturnType<typeof resolveReport>>;
    try {
      r = await resolveReport({
        reportId,
        decision,
        reason: needsReason ? reason : null,
        answer,
      });
    } catch {
      r = { ok: false, reason: "FAILED" };
    } finally {
      setBusy(false);
    }
    if (!r.ok) {
      setError({ field: "answer", text: adminError(r.reason) });
      document.getElementById(id("answer"))?.focus();
      return;
    }
    notify("신고에 답했어요.");
    router.refresh();
  };

  const options: { value: Decision; label: string }[] = [
    { value: "dismiss", label: "기각 (그대로 두기)" },
    { value: "stop", label: "레시피 판매 중지" },
    { value: "takedown", label: "레시피 게시중단 (모두에게 숨김)" },
    ...(targetType === "post"
      ? [{ value: "hide_post" as const, label: "이 갤러리 글 숨기기" }]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <AdminField id={id("decision")} label="결정">
        <select
          id={id("decision")}
          value={decision}
          onChange={(e) => {
            const d = e.target.value as Decision;
            setDecision(d);
            setAnswer(REPORT_ANSWER_TEMPLATE[d]);
          }}
          style={adminSelect}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </AdminField>
      {needsReason && (
        <AdminField
          id={id("reason")}
          label="사유 (크리에이터와 상세 화면에 보여요)"
          error={error?.field === "reason" ? error.text : null}
        >
          <select
            id={id("reason")}
            value={reason}
            aria-invalid={error?.field === "reason" || undefined}
            aria-describedby={
              error?.field === "reason" ? `${id("reason")}-error` : undefined
            }
            onChange={(e) => setReason(e.target.value as OpsReason | "")}
            style={adminSelect}
          >
            <option value="">고르기</option>
            {OPS_REASONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </AdminField>
      )}
      <AdminField
        id={id("answer")}
        label="신고한 사람에게 보낼 답변 (200자)"
        error={error?.field === "answer" ? error.text : null}
      >
        <Textarea
          id={id("answer")}
          value={answer}
          maxLength={200}
          rows={3}
          aria-invalid={error?.field === "answer" || undefined}
          aria-describedby={
            error?.field === "answer" ? `${id("answer")}-error` : undefined
          }
          onChange={(e) => setAnswer(e.target.value)}
        />
      </AdminField>
      <div>
        <Button color="primary" disabled={busy} onClick={() => void submit()}>
          결정하고 답하기
        </Button>
      </div>
    </div>
  );
}
