"use client";
// F5-14 「유료 판매 오픈 알림 신청」: one row per creator; pressing again shows 「신청했어요」 with cancel.
// Pressing the button is the consent; nothing is pre-checked (interest categories are optional).
import { useState, type CSSProperties } from "react";
import { Button, Chip } from "@/components/ds";
import { useAuth } from "@/components/auth/AuthProvider";
import { setWaitlist } from "@/actions/seller";
import { WAITLIST_CONSENT_COPY } from "@/lib/seller/waitlist";

const CATS = [
  { value: "prompt", label: "프롬프트" },
  { value: "skill", label: "스킬" },
  { value: "agent", label: "에이전트" },
] as const;

const box: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 20,
  borderRadius: 16,
  border: "1px solid var(--sp-border-normal)",
  background: "var(--sp-bg-secondary)",
};

export function WaitlistCard({
  initial,
  compact = false,
}: {
  initial: { joined: boolean; categories: string[] };
  compact?: boolean;
}) {
  const { notify } = useAuth();
  const [joined, setJoined] = useState(initial.joined);
  const [cats, setCats] = useState<string[]>(initial.categories);
  const [busy, setBusy] = useState(false);

  async function submit(join: boolean) {
    setBusy(true);
    const r = await setWaitlist({ join, categories: cats });
    setBusy(false);
    if (!r.ok)
      return notify("신청을 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    setJoined(r.joined);
    notify(
      r.joined
        ? "유료 판매가 열리면 알려 드릴게요."
        : "알림 신청을 취소했어요.",
    );
  }

  return (
    <section aria-labelledby="waitlist-title" style={box}>
      <h2
        id="waitlist-title"
        style={{ margin: 0, fontSize: compact ? 15 : 16, fontWeight: 700 }}
      >
        유료 판매는 준비 중이에요
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "var(--sp-fg-secondary)",
          lineHeight: 1.6,
        }}
      >
        {WAITLIST_CONSENT_COPY}
      </p>
      {!joined && (
        <div
          role="group"
          aria-label="관심 있는 카테고리(선택)"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          {CATS.map((c) => {
            const on = cats.includes(c.value);
            return (
              <Chip
                key={c.value}
                size="sm"
                selected={on}
                onClick={() =>
                  setCats(
                    on ? cats.filter((x) => x !== c.value) : [...cats, c.value],
                  )
                }
              >
                {c.label}
              </Chip>
            );
          })}
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {joined ? (
          <>
            <Button
              variant="outline"
              color="secondary"
              disabled
              aria-pressed="true"
            >
              신청했어요
            </Button>
            <Button
              variant="ghost"
              color="secondary"
              disabled={busy}
              onClick={() => submit(false)}
            >
              신청 취소하기
            </Button>
          </>
        ) : (
          <Button disabled={busy} onClick={() => submit(true)}>
            유료 판매 오픈 알림 신청
          </Button>
        )}
      </div>
    </section>
  );
}
