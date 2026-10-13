"use client";
// m:login (F7-1): wireframe copy. Email login is out of MVP; signup bonus copy waits for credits (W5).
import type { CSSProperties } from "react";
import { Dialog, DialogBody, DialogHeader, Icon } from "@/components/ds";

export type LoginProvider = "kakao" | "naver" | "google";

// Brand button colors follow each provider's login button guide (not design-system tokens).
const BRAND: Record<LoginProvider, { label: string; style: CSSProperties }> = {
  kakao: {
    label: "카카오로 계속하기",
    style: {
      background: "#FEE500",
      color: "rgba(0,0,0,0.85)",
      border: "1px solid #FEE500",
    },
  },
  naver: {
    label: "네이버로 계속하기",
    style: {
      background: "#03C75A",
      color: "#FFFFFF",
      border: "1px solid #03C75A",
    },
  },
  google: {
    label: "구글로 계속하기",
    style: {
      background: "var(--sp-bg-surface)",
      color: "var(--sp-fg-normal)",
      border: "1px solid var(--sp-border-normal)",
    },
  },
};

export function LoginDialog({
  open,
  error,
  busy,
  onSelect,
  onClose,
}: {
  open: boolean;
  error: string | null;
  busy: boolean;
  onSelect: (provider: LoginProvider) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <DialogHeader title="로그인하고 이어서 할게요" onClose={onClose} />
      <DialogBody>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingBottom: 8,
          }}
        >
          <p
            style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}
          >
            하려던 일은 로그인 뒤에 바로 이어서 해요.
          </p>
          {(["kakao", "naver", "google"] as const).map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => onSelect(p)}
              style={{
                ...BRAND[p].style,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 48,
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: busy ? "progress" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {p === "google" && <Icon name="GoogleColorIcon" size={18} />}
              {BRAND[p].label}
            </button>
          ))}
          <p
            role="alert"
            style={{
              margin: 0,
              minHeight: 20,
              fontSize: 13,
              color: "var(--sp-fg-danger)",
            }}
          >
            {error ?? ""}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-hint)" }}>
            처음이면 자동으로 가입돼요.
          </p>
        </div>
      </DialogBody>
    </Dialog>
  );
}
