"use client";
// SELL (MVP): 「내 레시피」 — rejected → in review → private → live, 7/30/90-day numbers, visibility,
// share links (clicks only), 「새 버전 올리기」 / 「고쳐서 다시 제출」, and the paid-launch waitlist.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  SegmentedControl,
  TextInput,
} from "@/components/ds";
import { useAuth } from "@/components/auth/AuthProvider";
import { createShareLink, setRecipeVisibility } from "@/actions/seller";
import { REJECT_COPY } from "@/lib/moderation/reject-codes";
import { sentence } from "@/lib/upload/messages";
import type { MyRecipeDTO, RecipeStatus, SellerDays } from "@/data/seller";
import { WaitlistCard } from "./WaitlistCard";

const STATUS: Record<
  RecipeStatus,
  {
    label: string;
    color: "danger" | "warning" | "hint" | "success" | "contrast";
  }
> = {
  rejected: { label: "반려", color: "danger" },
  in_review: { label: "사람 확인 중", color: "warning" },
  private: { label: "비공개", color: "hint" },
  live: { label: "공개 중", color: "success" },
  stopped: { label: "판매 중지", color: "contrast" },
};
const CATEGORY = {
  prompt: "프롬프트",
  agent: "에이전트",
  skill: "스킬",
} as const;

const card: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: 20,
  borderRadius: 16,
  border: "1px solid var(--sp-border-normal)",
  background: "var(--sp-bg-surface)",
};
const hint: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--sp-fg-hint)",
  lineHeight: 1.6,
};
const editHref = (r: MyRecipeDTO) => `/my/seller/upload?recipe=${r.recipeId}`;

export function SellerGuest() {
  const { requireLogin } = useAuth();
  return (
    <EmptyState
      icon="LockOutlineIcon"
      title="로그인하면 내 레시피를 볼 수 있어요"
      description="올린 레시피의 상태와 반응을 여기서 확인해요."
      actions={
        <Button onClick={() => requireLogin({ next: "/my/seller" })}>
          로그인하기
        </Button>
      }
    />
  );
}

export function SellerView({
  rows,
  days,
  waitlist,
  submitted = null,
}: {
  rows: MyRecipeDTO[];
  days: SellerDays;
  waitlist: { joined: boolean; categories: string[] };
  /** Just submitted a new version from the wizard (UP-08). */
  submitted?: "live" | "review" | "private" | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <SegmentedControl
          aria-label="기간"
          items={[
            { value: "7", label: "7일" },
            { value: "30", label: "30일" },
            { value: "90", label: "90일" },
          ]}
          value={String(days)}
          onChange={(v) =>
            start(() =>
              router.replace(`/my/seller?days=${v}`, { scroll: false }),
            )
          }
        />
        <Link href="/my/seller/upload" style={{ textDecoration: "none" }}>
          <Button>레시피 올리기</Button>
        </Link>
      </div>

      {submitted && <SubmittedBanner kind={submitted} />}

      <WaitlistCard initial={waitlist} />

      {rows.length === 0 ? (
        <EmptyState
          icon="PlusBoxIcon"
          title="아직 올린 레시피가 없어요"
          description="결과물 1개와 함께 무료로 올리면 마켓에 바로 보여요."
          actions={
            <Link href="/my/seller/upload" style={{ textDecoration: "none" }}>
              <Button>레시피 올리기</Button>
            </Link>
          }
        />
      ) : (
        <ul
          aria-label="내 레시피"
          aria-busy={pending}
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {rows.map((r) => (
            <li key={r.recipeId}>
              <RecipeRow row={r} days={days} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SUBMITTED = {
  live: {
    title: "레시피를 공개했어요",
    text: "새 버전이 공개됐어요. 받은 사람은 라이브러리에서 골라서 업데이트해요.",
  },
  review: {
    title: "사람이 확인하고 있어요",
    text: "1~2일 안에 확인하고 결과를 알려 드려요. 그동안 지난 버전이 그대로 보여요.",
  },
  private: {
    title: "비공개로 저장했어요",
    text: "나만 볼 수 있어요. 공개로 바꾸면 마켓에 올라가요.",
  },
} as const;

function SubmittedBanner({ kind }: { kind: keyof typeof SUBMITTED }) {
  const c = SUBMITTED[kind];
  return (
    <section
      role="status"
      tabIndex={-1}
      ref={(el) => el?.focus()}
      aria-labelledby="submitted-title"
      style={{ ...card, background: "var(--sp-bg-secondary)", outline: "none" }}
    >
      <h2
        id="submitted-title"
        style={{ margin: 0, fontSize: 17, fontWeight: 700 }}
      >
        {c.title}
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
        {c.text}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 72 }}
    >
      <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>{label}</span>
      <strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
        {value.toLocaleString("ko-KR")}
      </strong>
    </div>
  );
}

function RecipeRow({ row, days }: { row: MyRecipeDTO; days: SellerDays }) {
  const router = useRouter();
  const { notify } = useAuth();
  const [busy, setBusy] = useState(false);
  const status = STATUS[row.status];
  const reject = row.reject?.code ? REJECT_COPY[row.reject.code] : null;
  const canEdit =
    (row.status === "live" || row.status === "private") &&
    !row.pendingVersionNo;

  async function toggle() {
    setBusy(true);
    const r = await setRecipeVisibility({
      recipeId: row.recipeId,
      visibility: row.status === "live" ? "private" : "public",
    });
    setBusy(false);
    if (!r.ok)
      return notify("공개 범위를 바꾸지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    notify(
      r.status === "live"
        ? "공개로 바꿨어요. 마켓에 보여요."
        : "비공개로 바꿨어요. 나만 볼 수 있어요.",
    );
    router.refresh();
  }

  return (
    <article aria-labelledby={`r-${row.recipeId}`} style={card}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Badge size="sm" color={status.color} variant="subtle">
              {status.label}
            </Badge>
            <Badge size="sm" color="hint" variant="subtle">
              {CATEGORY[row.category]}
            </Badge>
            {row.versionNo ? <span style={hint}>v{row.versionNo}</span> : null}
          </div>
          <h2
            id={`r-${row.recipeId}`}
            style={{ margin: 0, fontSize: 17, fontWeight: 700 }}
          >
            {row.status === "live" || row.status === "stopped" ? (
              <Link
                href={`/r/${row.publicId}`}
                // No prefetch: a prefetch racing a visibility change could re-cache the live page.
                prefetch={false}
                style={{ color: "inherit" }}
              >
                {row.title}
              </Link>
            ) : (
              row.title
            )}
          </h2>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          {(row.status === "live" || row.status === "private") && (
            <Button
              variant="outline"
              color="secondary"
              size="md"
              disabled={busy}
              onClick={toggle}
            >
              {row.status === "live" ? "비공개로 바꾸기" : "공개하기"}
            </Button>
          )}
          {canEdit && (
            <Link href={editHref(row)} style={{ textDecoration: "none" }}>
              <Button variant="outline" color="secondary" size="md">
                새 버전 올리기
              </Button>
            </Link>
          )}
        </div>
      </header>

      {row.reject && (
        <Callout
          color="danger"
          title={reject ? `반려 사유: ${reject.title}` : "반려됐어요"}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span>
              {sentence(
                row.reject?.note ??
                  reject?.fix ??
                  "사유를 확인하고 고쳐서 다시 제출해 주세요.",
              )}
              {row.reject?.note && reject ? ` ${reject.fix}` : ""}
            </span>
            <Link
              href={editHref(row)}
              style={{ textDecoration: "none", alignSelf: "flex-start" }}
            >
              <Button size="md">고쳐서 다시 제출</Button>
            </Link>
          </div>
        </Callout>
      )}
      {(row.status === "in_review" || row.pendingVersionNo) && (
        <p style={hint}>
          {row.pendingVersionNo ? `v${row.pendingVersionNo}을 ` : ""}사람이
          확인하고 있어요. 1~2일 안에 결과를 알려 드려요.
        </p>
      )}

      <div
        role="group"
        aria-label={`최근 ${days}일 숫자`}
        style={{ display: "flex", gap: 20, flexWrap: "wrap" }}
      >
        <Stat label="조회" value={row.views} />
        <Stat label="받은 사람" value={row.downloads} />
        <Stat label="SAME 인증" value={row.sameCount} />
        <Stat label="링크 클릭" value={row.linkClicks} />
      </div>

      {row.status === "live" && <ShareLinks row={row} />}
    </article>
  );
}

const SHARE_ERRORS: Record<string, string> = {
  INVALID_CODE: "링크 이름은 영문 소문자·숫자로 6~12자예요.",
  CODE_TAKEN: "이미 있는 링크 이름이에요. 다른 이름을 써 주세요.",
  TOO_MANY_LINKS: "링크는 레시피마다 20개까지 만들 수 있어요.",
  NOT_LIVE: "공개 중인 레시피만 링크를 만들 수 있어요.",
};

function ShareLinks({ row }: { row: MyRecipeDTO }) {
  const router = useRouter();
  const { notify } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = `link-${row.recipeId}`;
  const url = (c: string) =>
    `${window.location.origin}/r/${row.publicId}?ref=${c}`;

  async function create() {
    setBusy(true);
    const r = await createShareLink({ recipeId: row.recipeId, code });
    setBusy(false);
    if (!r.ok) {
      setError(
        SHARE_ERRORS[r.reason] ??
          "링크를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.",
      );
      document.getElementById(field)?.focus();
      return;
    }
    setError(null);
    setCode("");
    notify("공유 링크를 만들었어요.");
    router.refresh();
  }

  async function copy(c: string) {
    try {
      await navigator.clipboard.writeText(url(c));
      notify("링크를 복사했어요.");
    } catch {
      notify(`복사가 막혀 있어요. 주소를 직접 복사해 주세요: ${url(c)}`);
    }
  }

  return (
    <section
      aria-label="공유 링크"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        borderTop: "1px solid var(--sp-border-normal)",
        paddingTop: 14,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 14 }}>공유 링크</h3>
      <p style={hint}>링크로 들어온 사람 수만 세요. 지금은 수수료가 없어요.</p>
      {row.links.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {row.links.map((l) => (
            <li
              key={l.code}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                fontSize: 14,
              }}
            >
              <code style={{ fontFamily: "var(--sp-font-mono, monospace)" }}>
                ?ref={l.code}
              </code>
              <span style={{ color: "var(--sp-fg-secondary)" }}>
                클릭 {l.clicks.toLocaleString("ko-KR")}
              </span>
              <Button
                size="sm"
                variant="ghost"
                color="secondary"
                onClick={() => copy(l.code)}
              >
                링크 복사하기
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        <label htmlFor={field} style={{ fontSize: 13, fontWeight: 600 }}>
          새 링크 이름
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <TextInput
            id={field}
            value={code}
            maxLength={12}
            placeholder="예: insta01"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${field}-error` : `${field}-hint`}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            style={{ width: 200 }}
          />
          <Button
            type="submit"
            variant="outline"
            color="secondary"
            disabled={busy || !code}
          >
            링크 만들기
          </Button>
        </div>
        {error ? (
          <span
            id={`${field}-error`}
            role="alert"
            style={{ fontSize: 13, color: "var(--sp-fg-danger)" }}
          >
            {error}
          </span>
        ) : (
          <span id={`${field}-hint`} style={hint}>
            영문 소문자·숫자로 6~12자예요.
          </span>
        )}
      </form>
    </section>
  );
}
