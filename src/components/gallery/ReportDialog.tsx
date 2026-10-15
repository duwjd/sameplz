"use client";
// m:report (F6-3): one of four reasons + details. First answer within one business day (ACTV-04).
import { useState } from "react";
import { createReport } from "@/actions/gallery";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Radio,
  Textarea,
} from "@/components/ds";

export const REPORT_REASONS = [
  { value: "misleading", label: "설명과 달라요 (적힌 결과가 안 나와요)" },
  { value: "malicious", label: "이상한 지시나 악성 코드가 의심돼요" },
  { value: "rights", label: "남의 결과물을 가져왔어요" },
  { value: "prohibited", label: "금지된 내용이에요" },
] as const;

const REASON_COPY: Record<string, string> = {
  ALREADY_REPORTED: "이미 신고했어요. 답을 드릴 때까지 기다려 주세요.",
  RATE_LIMITED: "오늘은 더 신고할 수 없어요. 내일 다시 해 주세요.",
  NOT_FOUND: "이미 내려간 대상이에요.",
};

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "recipe" | "post";
  targetId: string;
}) {
  const { notify } = useAuth();
  const [reason, setReason] =
    useState<(typeof REPORT_REASONS)[number]["value"]>("misleading");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await createReport({ targetType, targetId, reason, detail });
    setBusy(false);
    if (!r.ok) {
      setError(
        REASON_COPY[r.reason] ??
          "신고를 접수하지 못했어요. 잠시 뒤에 다시 해 주세요.",
      );
      return;
    }
    notify("신고를 접수했어요. 1영업일 안에 첫 답을 드려요.");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <DialogHeader title="신고하기" onClose={onClose} />
      <DialogBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <fieldset
          style={{
            border: 0,
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            사유
          </legend>
          {REPORT_REASONS.map((r) => (
            <Radio
              key={r.value}
              name="report-reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              label={r.label}
            />
          ))}
        </fieldset>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          내용 (선택)
          <Textarea
            value={detail}
            maxLength={500}
            rows={3}
            onChange={(e) => setDetail(e.target.value)}
          />
        </label>
        {error && (
          <p
            role="alert"
            style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-danger)" }}
          >
            {error}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" color="secondary" onClick={onClose}>
          닫기
        </Button>
        <Button color="danger" disabled={busy} onClick={() => void submit()}>
          신고 접수하기
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
