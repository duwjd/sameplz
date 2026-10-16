"use client";
// ADM recipes (F8-3): stop (holders keep using), take down (hidden from everyone), or restore.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setRecipeStatus } from "@/actions/admin";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdminField, adminSelect } from "@/components/admin/fields";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Textarea,
} from "@/components/ds";
import { adminError, OPS_REASONS, type OpsReason } from "@/lib/admin/copy";

type Action = "stop" | "takedown" | "restore";

const ACTION_COPY: Record<Action, { label: string; confirm: string }> = {
  stop: {
    label: "판매 중지하기",
    confirm: "새로 받을 수 없게 돼요. 이미 받은 사람은 받은 버전을 계속 써요.",
  },
  takedown: {
    label: "게시중단하기",
    confirm:
      "상세·검색·갤러리에서 모두 사라지고, 이미 받은 사람도 원문과 파일을 열 수 없어요. 크리에이터에게 알림이 가요.",
  },
  restore: {
    label: "복원하기",
    confirm:
      "게시중단이면 게시중단 직전 상태(공개·판매 중지·비공개 등)로 돌아가 받은 사람이 다시 써요. 운영이 멈춘 판매 중지면 다시 공개돼요.",
  },
};

export function RecipeStatusForm({
  recipeId,
  title,
  status,
}: {
  recipeId: string;
  title: string;
  status: string;
}) {
  const router = useRouter();
  const { notify } = useAuth();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState<OpsReason | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = (k: string) => `rs-${recipeId}-${k}`;

  const available: Action[] = [
    ...(status === "live" ? (["stop"] as const) : []),
    ...(["live", "stopped", "private", "in_review"].includes(status)
      ? (["takedown"] as const)
      : []),
    ...(status === "taken_down" || status === "stopped"
      ? (["restore"] as const)
      : []),
  ];
  if (!available.length) return null;

  const close = () => {
    setAction(null);
    setError(null);
  };
  const submit = async () => {
    if (!action) return;
    if (action !== "restore" && !reason) {
      setError("사유를 골라 주세요.");
      document.getElementById(id("reason"))?.focus();
      return;
    }
    if (action === "restore" && !note.trim()) {
      setError("복원하는 이유를 메모에 남겨 주세요.");
      document.getElementById(id("note"))?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    let r: Awaited<ReturnType<typeof setRecipeStatus>>;
    try {
      r = await setRecipeStatus({
        recipeId,
        action,
        reason: action === "restore" ? null : reason,
        note,
      });
    } catch {
      r = { ok: false, reason: "FAILED" };
    } finally {
      setBusy(false);
    }
    if (!r.ok) {
      setError(adminError(r.reason));
      return;
    }
    notify(
      `「${title}」 ${ACTION_COPY[action].label.replace("하기", "")}했어요.`,
    );
    close();
    setReason("");
    setNote("");
    router.refresh();
  };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {available.map((a) => (
        <Button
          key={a}
          size="sm"
          variant="outline"
          color={a === "restore" ? "secondary" : "danger"}
          onClick={() => setAction(a)}
          aria-label={`「${title}」 ${ACTION_COPY[a].label}`}
        >
          {ACTION_COPY[a].label}
        </Button>
      ))}
      <Dialog open={action !== null} onClose={close} size="sm">
        <DialogHeader
          title={action ? `「${title}」 ${ACTION_COPY[action].label}` : ""}
          onClose={close}
        />
        <DialogBody
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            {action ? ACTION_COPY[action].confirm : ""}
          </p>
          {action && action !== "restore" && (
            <AdminField
              id={id("reason")}
              label="사유 (크리에이터와 상세 화면에 보여요)"
              error={error && !reason ? error : null}
            >
              <select
                id={id("reason")}
                value={reason}
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
            id={id("note")}
            label={
              action === "restore"
                ? "메모 (필수, 운영 기록)"
                : "메모 (선택, 운영 기록)"
            }
            error={error && (reason || action === "restore") ? error : null}
          >
            <Textarea
              id={id("note")}
              value={note}
              maxLength={500}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
            />
          </AdminField>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" color="secondary" onClick={close}>
            닫기
          </Button>
          <Button
            color={action === "restore" ? "primary" : "danger"}
            disabled={busy}
            onClick={() => void submit()}
          >
            {action ? ACTION_COPY[action].label : ""}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
