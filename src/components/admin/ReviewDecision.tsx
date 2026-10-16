"use client";
// ADM review (F8-1): approve, or reject with an R code whose template pre-fills the note.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { decideReview } from "@/actions/admin";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdminField, adminSelect } from "@/components/admin/fields";
import { Button, Textarea } from "@/components/ds";
import { adminError } from "@/lib/admin/copy";
import {
  REJECT_CODES,
  REJECT_COPY,
  type RejectCode,
} from "@/lib/moderation/reject-codes";

export function ReviewDecision({ versionId }: { versionId: string }) {
  const router = useRouter();
  const { notify } = useAuth();
  const [code, setCode] = useState<RejectCode | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (decision: "approve" | "reject") => {
    if (decision === "reject" && !code) {
      setError("반려 코드를 골라 주세요.");
      document.getElementById("review-code")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    let r: Awaited<ReturnType<typeof decideReview>>;
    try {
      r = await decideReview(
        decision === "approve"
          ? { decision, versionId }
          : { decision, versionId, code, note },
      );
    } catch {
      r = { ok: false, reason: "FAILED" };
    } finally {
      setBusy(false);
    }
    if (!r.ok) {
      setError(adminError(r.reason));
      return;
    }
    notify(decision === "approve" ? "승인했어요." : "반려했어요.");
    router.push("/admin/reviews");
    router.refresh();
  };

  return (
    <section
      aria-labelledby="review-decide"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 20,
        border: "1px solid var(--sp-border-normal)",
        borderRadius: 16,
      }}
    >
      <h2
        id="review-decide"
        style={{ margin: 0, fontSize: 16, fontWeight: 700 }}
      >
        결정
      </h2>
      <AdminField
        id="review-code"
        label="반려 코드 (반려할 때만)"
        error={error}
      >
        <select
          id="review-code"
          value={code}
          aria-describedby={error ? "review-code-error" : undefined}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => {
            const c = e.target.value as RejectCode | "";
            setCode(c);
            if (c) setNote(REJECT_COPY[c].fix);
          }}
          style={adminSelect}
        >
          <option value="">고르지 않음</option>
          {REJECT_CODES.map((c) => (
            <option key={c} value={c}>
              {c} · {REJECT_COPY[c].title}
            </option>
          ))}
        </select>
      </AdminField>
      <AdminField
        id="review-note"
        label="크리에이터에게 보낼 메모 (선택, 500자)"
      >
        <Textarea
          id="review-note"
          value={note}
          maxLength={500}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
        />
      </AdminField>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          color="primary"
          disabled={busy}
          onClick={() => void run("approve")}
        >
          승인하기
        </Button>
        <Button
          variant="outline"
          color="danger"
          disabled={busy}
          onClick={() => void run("reject")}
        >
          반려하기
        </Button>
      </div>
    </section>
  );
}
