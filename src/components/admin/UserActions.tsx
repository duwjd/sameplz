"use client";
// ADM members (F8-4): sanction (the admin picks the level), lift, resume generation, adjust credits.
// Every action needs a reason; the SQL functions re-check the admin and write admin_actions.
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  adjustCredits,
  liftGenerationSuspension,
  liftSanction,
  sanctionUser,
} from "@/actions/admin";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdminField, adminSelect } from "@/components/admin/fields";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Textarea,
  TextInput,
} from "@/components/ds";
import {
  adminError,
  SANCTION_LEVELS,
  SANCTION_REASONS,
  type SanctionLevelValue,
  type SanctionReasonValue,
} from "@/lib/admin/copy";

type Result = { ok: true; duplicate?: boolean } | { ok: false; reason: string };

/** A button that opens a confirm dialog with fields, then runs one action. */
function ActionDialog({
  label,
  title,
  danger,
  children,
  onSubmit,
  done,
}: {
  label: string;
  title: string;
  danger?: boolean;
  children: (error: string | null) => ReactNode;
  /** Returns a local validation message, or runs the action. */
  onSubmit: () => string | Promise<Result>;
  done: string;
}) {
  const router = useRouter();
  const { notify } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setOpen(false);
    setError(null);
  };
  const submit = async () => {
    const r = onSubmit();
    if (typeof r === "string") {
      setError(r);
      return;
    }
    setBusy(true);
    setError(null);
    let res: Result;
    try {
      res = await r;
    } catch {
      res = { ok: false, reason: "FAILED" };
    } finally {
      setBusy(false);
    }
    if (!res.ok) {
      setError(adminError(res.reason));
      return;
    }
    notify(
      res.duplicate ? "이미 반영된 요청이에요. 다시 조정하지 않았어요." : done,
    );
    close();
    router.refresh();
  };
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        color={danger ? "danger" : "secondary"}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog open={open} onClose={close} size="sm">
        <DialogHeader title={title} onClose={close} />
        <DialogBody
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {children(error)}
          {error && (
            <p
              role="alert"
              style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-danger)" }}
            >
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" color="secondary" onClick={close}>
            닫기
          </Button>
          <Button
            color={danger ? "danger" : "primary"}
            disabled={busy}
            onClick={() => void submit()}
          >
            {label}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

export function SanctionForm({
  userId,
  nickname,
}: {
  userId: string;
  nickname: string;
}) {
  const [level, setLevel] = useState<SanctionLevelValue | "">("");
  const [reason, setReason] = useState<SanctionReasonValue | "">("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const timed = level === "seller_suspended" || level === "account_suspended";
  const help = SANCTION_LEVELS.find((l) => l.value === level)?.help;
  return (
    <ActionDialog
      label="제재하기"
      title={`「${nickname}」 제재하기`}
      danger
      done={`「${nickname}」에게 제재를 걸고 알렸어요.`}
      onSubmit={() => {
        if (!level) return "제재 단계를 골라 주세요.";
        if (!reason) return "사유를 골라 주세요.";
        const n = days.trim() ? Number(days) : null;
        if (timed && n !== null && (!Number.isInteger(n) || n < 1 || n > 365))
          return "정지 기간은 1~365일이에요. 비우면 해제할 때까지예요.";
        return sanctionUser({
          userId,
          level,
          reason,
          note,
          days: timed ? n : null,
        });
      }}
    >
      {() => (
        <>
          <AdminField id={`sx-${userId}-level`} label="단계">
            <select
              id={`sx-${userId}-level`}
              value={level}
              onChange={(e) =>
                setLevel(e.target.value as SanctionLevelValue | "")
              }
              style={adminSelect}
            >
              <option value="">고르기</option>
              {SANCTION_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </AdminField>
          {help && (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--sp-fg-secondary)",
              }}
            >
              {help}
            </p>
          )}
          <AdminField
            id={`sx-${userId}-reason`}
            label="사유 (회원 알림에 보여요)"
          >
            <select
              id={`sx-${userId}-reason`}
              value={reason}
              onChange={(e) =>
                setReason(e.target.value as SanctionReasonValue | "")
              }
              style={adminSelect}
            >
              <option value="">고르기</option>
              {SANCTION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </AdminField>
          {timed && (
            <AdminField
              id={`sx-${userId}-days`}
              label="기간(일, 비우면 해제할 때까지)"
            >
              <TextInput
                id={`sx-${userId}-days`}
                inputMode="numeric"
                value={days}
                onChange={(e) =>
                  setDays(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
              />
            </AdminField>
          )}
          <AdminField
            id={`sx-${userId}-note`}
            label="메모 (운영 기록, 회원에게 안 보여요)"
          >
            <Textarea
              id={`sx-${userId}-note`}
              value={note}
              maxLength={500}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
            />
          </AdminField>
        </>
      )}
    </ActionDialog>
  );
}

function NoteDialog({
  label,
  title,
  done,
  run,
}: {
  label: string;
  title: string;
  done: string;
  run: (note: string) => Promise<Result>;
}) {
  const [note, setNote] = useState("");
  const id = `nd-${label}-${title}`.replace(/\W+/g, "-");
  return (
    <ActionDialog
      label={label}
      title={title}
      done={done}
      onSubmit={() => (note.trim() ? run(note) : "이유를 메모에 남겨 주세요.")}
    >
      {() => (
        <AdminField id={id} label="이유 (필수, 운영 기록)">
          <Textarea
            id={id}
            value={note}
            maxLength={500}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
          />
        </AdminField>
      )}
    </ActionDialog>
  );
}

export function LiftSanctionButton({
  sanctionId,
  label,
}: {
  sanctionId: string;
  label: string;
}) {
  return (
    <NoteDialog
      label="해제하기"
      title={`${label} 해제하기`}
      done="제재를 풀고 회원에게 알렸어요."
      run={(note) => liftSanction({ sanctionId, note })}
    />
  );
}

export function ResumeGenerationButton({ userId }: { userId: string }) {
  return (
    <NoteDialog
      label="생성 다시 열기"
      title="멈춘 생성 다시 열기"
      done="생성을 다시 열었어요."
      run={(note) => liftGenerationSuspension({ userId, note })}
    />
  );
}

export function AdjustCreditsForm({
  userId,
  nickname,
}: {
  userId: string;
  nickname: string;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  // One key per form: a double click or a retried request adjusts once.
  const [idem, setIdem] = useState(() => crypto.randomUUID());
  return (
    <ActionDialog
      label="크레딧 조정하기"
      title={`「${nickname}」 크레딧 조정`}
      done="크레딧을 조정하고 회원에게 알렸어요."
      onSubmit={() => {
        const n = Number(amount);
        if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 1000)
          return "조정은 -1000C~+1000C 사이로, 0은 안 돼요.";
        if (!reason.trim()) return "사유를 적어 주세요. 회원 알림에 보여요.";
        const run = adjustCredits({ userId, amount: n, reason, idem });
        void run.then((r) => r.ok && setIdem(crypto.randomUUID()));
        return run;
      }}
    >
      {() => (
        <>
          <AdminField id={`adj-${userId}-amount`} label="조정량(C, 빼려면 -)">
            <TextInput
              id={`adj-${userId}-amount`}
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                // A changed request is a new request (new idem key).
                setAmount(e.target.value.replace(/[^\d-]/g, "").slice(0, 5));
                setIdem(crypto.randomUUID());
              }}
            />
          </AdminField>
          <p
            style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-secondary)" }}
          >
            더한 크레딧은 이번 달 리셋 때 함께 사라져요(이월 없음). 빼기는 진행
            중인 실행분을 건드리지 않아요.
          </p>
          <AdminField
            id={`adj-${userId}-reason`}
            label="사유 (회원 알림에 보여요)"
          >
            <Textarea
              id={`adj-${userId}-reason`}
              value={reason}
              maxLength={200}
              rows={2}
              onChange={(e) => {
                setReason(e.target.value);
                setIdem(crypto.randomUUID());
              }}
            />
          </AdminField>
        </>
      )}
    </ActionDialog>
  );
}
