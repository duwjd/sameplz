"use client";
// LIB-01~03 (MVP): received recipes pinned to their version, 「원문 열기」 (no confirm step, D6),
// per-row update, attachments, and m:original with the recipient watermark.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { applyUpdate, openOriginal, type OpenResult } from "@/actions/library";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Button,
  CopyField,
  Dialog,
  DialogBody,
  DialogHeader,
  EmptyState,
  LibraryRow,
  type LibraryRowStatus,
  type MediaKind,
} from "@/components/ds";
import type { LibraryRowDTO } from "@/data/library";
import type { OriginalDTO } from "@/data/secrets";
import { takeOpenIntent } from "@/lib/library/open-intent";
import { formatFileSize } from "@/lib/recipe/detail";

const KIND: Record<string, MediaKind> = {
  image: "이미지",
  video: "영상",
  text: "텍스트",
};

function mediaKind(row: LibraryRowDTO): MediaKind {
  if (row.category === "prompt")
    return KIND[row.promptKind ?? "text"] ?? "텍스트";
  return row.category;
}

function kstDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** LIB-02 (MVP): 열기 전 / 열어 봄 / 판매 종료 — no refund wording (free launch). */
function statusOf(row: LibraryRowDTO): LibraryRowStatus {
  if (row.status === "stopped")
    return { label: "판매 종료 · 계속 사용", tone: "ended" };
  return row.openedAt
    ? { label: "열어 봄", tone: "viewed" }
    : { label: "열기 전", tone: "refundable" };
}

const linkStyle = {
  display: "inline-flex",
  alignItems: "center",
  height: 32,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid var(--sp-border-normal)",
  background: "var(--sp-bg-surface)",
  color: "var(--sp-fg-normal)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
} as const;

export function LibraryGuest() {
  const { requireLogin } = useAuth();
  return (
    <EmptyState
      icon="LockOutlineIcon"
      title="로그인하면 받은 레시피를 볼 수 있어요"
      description="받은 레시피는 계정에 남아요. 로그인하고 이어서 볼게요."
      actions={
        <Button onClick={() => requireLogin({ next: "/my/library" })}>
          로그인하기
        </Button>
      }
    />
  );
}

export function LibraryView({
  rows: initialRows,
  openId,
}: {
  rows: LibraryRowDTO[];
  openId: string | null;
}) {
  const router = useRouter();
  const { notify } = useAuth();
  const [rows, setRows] = useState(initialRows);
  const [seen, setSeen] = useState(initialRows);
  if (seen !== initialRows) {
    setSeen(initialRows);
    setRows(initialRows);
  }
  const [open, setOpen] = useState<{
    row: LibraryRowDTO;
    original: OriginalDTO;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const autoOpened = useRef(false);

  const showOriginal = (row: LibraryRowDTO, res: OpenResult) => {
    if (!res.ok) {
      notify("원문을 열지 못했어요. 잠시 뒤 다시 눌러 주세요.");
      return;
    }
    setRows((rs) =>
      rs.map((r) =>
        r.entitlementId === row.entitlementId && !r.openedAt
          ? { ...r, openedAt: new Date().toISOString() }
          : r,
      ),
    );
    setOpen({ row, original: res.original });
  };

  const onOpen = async (row: LibraryRowDTO) => {
    setBusy(row.entitlementId);
    const res = await openOriginal({ entitlementId: row.entitlementId });
    setBusy(null);
    showOriginal(row, res);
  };

  const onUpdate = async (row: LibraryRowDTO) => {
    setBusy(row.entitlementId);
    const res = await applyUpdate({ entitlementId: row.entitlementId });
    setBusy(null);
    if (!res.ok) {
      notify("업데이트하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
      return;
    }
    notify(`v${row.latestVersionNo ?? ""}로 업데이트했어요.`);
    router.refresh();
  };

  // ?open=<id>: open right away only after the 「라이브러리에서 열기」 click (one-shot marker) or
  // when it was already opened; a bare link just scrolls to the row (no first open recorded).
  useEffect(() => {
    if (autoOpened.current || !openId) return;
    const row = initialRows.find((r) => r.entitlementId === openId);
    if (!row) return;
    autoOpened.current = true;
    if (!row.openedAt && !takeOpenIntent(row.entitlementId)) {
      document
        .getElementById(`lib-${row.entitlementId}`)
        ?.scrollIntoView({ block: "center" });
      return;
    }
    openOriginal({ entitlementId: row.entitlementId }).then((res) =>
      showOriginal(row, res),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once for the ?open= row
  }, [openId, initialRows]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="BookOutlineIcon"
        title="아직 받은 게 없어요"
        description="다른 사람이 만든 결과물을 구경하다가 마음에 들면 「SAME 하기」로 받아 보세요."
        actions={
          <Link href="/#gallery" style={linkStyle}>
            갤러리 구경하기
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ul
        aria-label="받은 레시피"
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {rows.map((row) => (
          <li key={row.entitlementId} id={`lib-${row.entitlementId}`}>
            <LibraryRow
              title={row.title}
              kind={mediaKind(row)}
              meta={`${row.creatorNickname} · v${row.versionNo} · ${kstDate(row.claimedAt)} 받음`}
              status={statusOf(row)}
              newVersion={
                row.updateAvailable && row.latestVersionNo
                  ? `새 버전 v${row.latestVersionNo}${row.latestChangelog ? ` · ${row.latestChangelog}` : ""}`
                  : undefined
              }
              onTitle={() => router.push(`/r/${row.publicId}`)}
              actions={
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Button
                    size="sm"
                    onClick={() => onOpen(row)}
                    disabled={busy === row.entitlementId}
                    aria-label={`「${row.title}」 원문 열기`}
                  >
                    원문 열기
                  </Button>
                  {row.updateAvailable && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdate(row)}
                      disabled={busy === row.entitlementId}
                      aria-label={`「${row.title}」 v${row.latestVersionNo}로 업데이트하기`}
                    >
                      업데이트하기
                    </Button>
                  )}
                  {row.files.map((f) => (
                    <a
                      key={f.id}
                      href={`/api/files/${row.versionId}?file=${f.id}`}
                      style={linkStyle}
                      aria-label={`${f.name} 파일 받기 (${formatFileSize(f.size)})`}
                    >
                      {f.name}
                    </a>
                  ))}
                </div>
              }
            />
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onClose={() => setOpen(null)} size="lg">
        {open && (
          <>
            <DialogHeader
              title={`${open.row.title} · v${open.original.versionNo} 원문`}
              onClose={() => setOpen(null)}
            />
            <DialogBody>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {open.row.status === "stopped" && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--sp-fg-secondary)",
                    }}
                  >
                    판매가 멈췄지만 받은 버전은 계속 쓸 수 있어요.
                  </p>
                )}
                <CopyField multiline label="원문" value={open.original.text} />
                <p
                  data-testid="original-watermark"
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--sp-fg-hint)",
                  }}
                >
                  {open.original.watermark}
                </p>
                {open.row.category === "prompt" && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--sp-fg-secondary)",
                    }}
                  >
                    원문을 복사해 도구에 붙여 넣고 [대괄호] 부분만 바꿔 쓰세요.
                  </p>
                )}
              </div>
            </DialogBody>
          </>
        )}
      </Dialog>
    </>
  );
}
