"use client";
// ACC-01/03/04 (F7-5, F7-6): login methods (one must remain), notification switches (required kinds
// always on), log out, and withdrawal with what goes and what stays.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setNotificationSetting, withdrawAccount } from "@/actions/account";
import { signOut } from "@/actions/auth";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Switch,
  Textarea,
} from "@/components/ds";
import { myCard } from "@/components/my/MyShell";
import type { LoginMethodDTO, NotificationSettingsDTO } from "@/data/account";
import { createClient } from "@/lib/supabase/client";

const PROVIDER: Record<string, string> = {
  google: "구글",
  kakao: "카카오",
  naver: "네이버",
  email: "이메일",
};

const REQUIRED = ["사람 확인 결과", "판매 중지", "신고 접수·답변"];

export function AccountView({
  methods,
  settings,
  credits,
}: {
  methods: LoginMethodDTO[];
  settings: NotificationSettingsDTO;
  credits: number;
}) {
  const router = useRouter();
  const { notify } = useAuth();
  const [s, setS] = useState(settings);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = async (
    kind: "version_update" | "same_cert" | "follow",
    key: keyof NotificationSettingsDTO,
  ) => {
    const next = !s[key];
    setS((cur) => ({ ...cur, [key]: next }));
    let ok = false;
    try {
      ok = (await setNotificationSetting({ kind, on: next })).ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      setS((cur) => ({ ...cur, [key]: !next }));
      notify("설정을 저장하지 못했어요. 다시 눌러 주세요.");
    }
  };

  const unlink = async (m: LoginMethodDTO) => {
    if (methods.length <= 1 || !m.identityId) return;
    const supabase = createClient();
    const { data } = await supabase.auth.getUserIdentities();
    const identity = data?.identities.find(
      (i) => (i.identity_id ?? i.id) === m.identityId,
    );
    const r = identity
      ? await supabase.auth.unlinkIdentity(identity)
      : { error: new Error("missing") };
    if (r.error)
      return notify(
        "지금은 연결을 해제할 수 없어요. 잠시 뒤에 다시 해 주세요.",
      );
    notify(`${PROVIDER[m.provider] ?? m.provider} 연결을 해제했어요.`);
    router.refresh();
  };

  const withdraw = async () => {
    if (!confirm) {
      setError("안내를 확인했다는 칸에 체크해 주세요.");
      document.getElementById("withdraw-confirm")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    let r: Awaited<ReturnType<typeof withdrawAccount>>;
    try {
      r = await withdrawAccount({ confirm: true, reason });
    } catch {
      r = { ok: false, reason: "FAILED" };
    }
    if (r.ok) {
      // A full reload drops every client-side session state (header, auth context, caches).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/?withdrawn=1");
      return;
    }
    setBusy(false);
    setError(
      r.reason === "GENERATION_IN_PROGRESS"
        ? "플레이그라운드에서 만드는 중인 결과가 있어요. 끝난 뒤에 탈퇴할 수 있어요."
        : r.reason === "AUTH_DELETE_FAILED"
          ? "정보는 지웠지만 로그인 정보 정리가 끝나지 않았어요. 「탈퇴하기」를 한 번 더 눌러 주세요."
          : "탈퇴하지 못했어요. 잠시 뒤에 다시 해 주세요.",
    );
    // Move focus to the message so screen readers hear why it stopped.
    requestAnimationFrame(() =>
      document.getElementById("withdraw-error")?.focus(),
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section aria-labelledby="acc-login" style={myCard}>
        <h2 id="acc-login" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          로그인 수단
        </h2>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {methods.map((m) => (
            <li
              key={`${m.provider}-${m.identityId}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
              }}
            >
              <b>{PROVIDER[m.provider] ?? m.provider}</b>
              <span style={{ color: "var(--sp-fg-secondary)" }}>
                {m.email ?? "연결됨"}
              </span>
              {m.identityId && methods.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  color="secondary"
                  style={{ marginLeft: "auto" }}
                  onClick={() => void unlink(m)}
                >
                  연결 해제하기
                </Button>
              )}
            </li>
          ))}
        </ul>
        {methods.length <= 1 && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-hint)" }}>
            로그인 수단은 하나 이상 남아야 해서 마지막 수단은 해제할 수 없어요.
          </p>
        )}
      </section>

      <section aria-labelledby="acc-noti" style={myCard}>
        <h2 id="acc-noti" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          알림 설정
        </h2>
        <Switch
          checked={s.versionUpdate}
          onChange={() => void toggle("version_update", "versionUpdate")}
          label="받은 레시피 새 버전"
        />
        <Switch
          checked={s.sameCert}
          onChange={() => void toggle("same_cert", "sameCert")}
          label="내 레시피에 SAME 인증"
        />
        <Switch
          checked={s.follow}
          onChange={() => void toggle("follow", "follow")}
          label="새 팔로워 · 팔로우한 크리에이터 새 레시피"
        />
        <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-hint)" }}>
          {REQUIRED.join(" · ")} 알림은 끌 수 없어요.
        </p>
      </section>

      <section aria-labelledby="acc-leave" style={myCard}>
        <h2 id="acc-leave" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          로그아웃 · 탈퇴
        </h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={signOut.bind(null, "/")}>
            <Button type="submit" variant="outline" color="secondary">
              로그아웃하기
            </Button>
          </form>
          <Button
            variant="ghost"
            color="danger"
            onClick={() => setWithdrawOpen(true)}
          >
            회원 탈퇴하기
          </Button>
        </div>
      </section>

      <Dialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        size="md"
      >
        <DialogHeader
          title="회원 탈퇴"
          onClose={() => setWithdrawOpen(false)}
        />
        <DialogBody
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div>
            <b style={{ fontSize: 14 }}>사라지는 것</b>
            <ul
              style={{
                margin: "6px 0 0",
                paddingLeft: 18,
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              <li>받은 레시피와 라이브러리</li>
              <li>이번 달 무료 크레딧 {credits}C</li>
              <li>알림·팔로우·좋아요, 쓰던 초안</li>
              <li>
                내가 올린 공개 레시피는 판매 중지돼요(받은 사람은 받은 버전을
                계속 써요)
              </li>
            </ul>
          </div>
          <div>
            <b style={{ fontSize: 14 }}>남는 것</b>
            <ul
              style={{
                margin: "6px 0 0",
                paddingLeft: 18,
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              <li>올린 SAME 인증은 「탈퇴한 회원」으로 남아요</li>
              <li>약관 동의 기록은 법에 따라 보관해요</li>
            </ul>
          </div>
          <p
            style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-secondary)" }}
          >
            같은 계정으로 다시 로그인하면 새 회원으로 시작해요. 이번 달 무료
            크레딧은 다시 받지 못할 수 있어요.
          </p>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            떠나는 이유 (선택)
            <Textarea
              value={reason}
              maxLength={200}
              rows={2}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Checkbox
            id="withdraw-confirm"
            checked={confirm}
            invalid={Boolean(error) && !confirm}
            aria-describedby={error ? "withdraw-error" : undefined}
            onChange={(e) => setConfirm(e.target.checked)}
            label="위 내용을 확인했고 탈퇴할게요"
          />
          {error && (
            <p
              id="withdraw-error"
              role="alert"
              tabIndex={-1}
              style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-danger)" }}
            >
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            color="secondary"
            onClick={() => setWithdrawOpen(false)}
          >
            닫기
          </Button>
          <Button
            color="danger"
            disabled={busy}
            onClick={() => void withdraw()}
          >
            탈퇴하기
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
