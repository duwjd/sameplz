"use client";
// PLAY-05 / PLAY-06: run history (one row per run, one cell per output) and pinned compare. Every
// result carries 「AI 생성」 as text (F4-9). Unsaved results are deleted 30 days after they were made (D19).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { draftFromRun } from "@/actions/gallery";
import { saveResult } from "@/actions/play";
import { SameUpDialog, type PlayResultRef } from "@/components/gallery/SameUpDialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, EmptyState, Spinner, Tabs } from "@/components/ds";
import type { PlayCellDTO, PlayRunDTO } from "@/data/playground";
import {
  cellErrorCopy,
  isTerminal,
  kstDateTime,
  kstMonthDay,
} from "@/lib/play/copy";

export function RunList({
  runs,
  onSaved,
}: {
  runs: PlayRunDTO[];
  onSaved: (cellId: string, saved: boolean) => void;
}) {
  const [tab, setTab] = useState("runs");
  const [pinned, setPinned] = useState<string[]>([]);
  const cells = runs.flatMap((r) => r.cells);
  const pinnedCells = pinned
    .map((id) => cells.find((c) => c.id === id))
    .filter((c): c is PlayCellDTO => Boolean(c));
  const togglePin = (id: string) =>
    setPinned((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-6),
    );

  return (
    <section
      aria-label="결과"
      style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
    >
      <Tabs
        idPrefix="play-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { value: "runs", label: `실행 기록 ${runs.length}` },
          { value: "pins", label: `비교 고정 ${pinnedCells.length}` },
        ]}
      />
      <div
        role="tabpanel"
        id={`play-tabs-${tab}`}
        aria-labelledby={`play-tabs-tab-${tab}`}
      >
        {tab === "runs" ? (
          runs.length === 0 ? (
            <EmptyState
              icon="MagicWandIcon"
              title="아직 만든 게 없어요"
              description="모델을 고르고 「만들기」를 눌러 보세요. 모델을 2~3개 고르면 나란히 비교돼요."
            />
          ) : (
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {runs.map((r, i) => (
                <RunCard
                  key={r.id}
                  run={r}
                  index={runs.length - i}
                  pinned={pinned}
                  onPin={togglePin}
                  onSaved={onSaved}
                />
              ))}
            </ol>
          )
        ) : pinnedCells.length === 0 ? (
          <EmptyState
            icon="MagicWandIcon"
            title="고정한 결과가 없어요"
            description="결과의 「비교에 고정」을 누르면 여기서 나란히 볼 수 있어요."
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {pinnedCells.map((c) => (
              <Cell
                key={c.id}
                cell={c}
                pinned
                onPin={togglePin}
                onSaved={onSaved}
              />
            ))}
          </div>
        )}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--sp-fg-hint)",
          lineHeight: 1.5,
        }}
      >
        결과는 저장하거나 비교에 고정할 수 있어요. 저장하지 않은 결과는 만든 지
        30일 뒤 지워져요.
      </p>
    </section>
  );
}

function RunCard({
  run,
  index,
  pinned,
  onPin,
  onSaved,
}: {
  run: PlayRunDTO;
  index: number;
  pinned: string[];
  onPin: (id: string) => void;
  onSaved: (cellId: string, saved: boolean) => void;
}) {
  const charged = run.cells
    .filter((c) => c.status === "succeeded")
    .reduce((n, c) => n + c.credits, 0);
  const pending = run.cells.some((c) => !isTerminal(c.status));
  const models = [...new Set(run.cells.map((c) => c.modelLabel))];
  const router = useRouter();
  const { notify } = useAuth();
  const [same, setSame] = useState<PlayResultRef | null>(null);
  const [drafting, setDrafting] = useState(false);
  const toDraft = async () => {
    setDrafting(true);
    const r = await draftFromRun({ runId: run.id });
    setDrafting(false);
    if (r.ok) return router.push("/my/seller/upload");
    notify(
      r.reason === "DRAFT_EXISTS"
        ? "쓰던 새 레시피 초안이 있어요. 올리기 화면에서 이어 쓰거나 「새로 시작」한 뒤 다시 눌러 주세요."
        : "초안을 만들지 못했어요. 다시 해 주세요.",
    );
  };
  return (
    <li
      aria-label={`실행 ${index}`}
      style={{
        border: "1px solid var(--sp-line-normal)",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
        }}
      >
        <b>#{index}</b>
        <span style={{ color: "var(--sp-fg-secondary)" }}>
          {kstDateTime(run.createdAt)} · {run.recipeTitle ?? "빈 프롬프트"} ·{" "}
          {models.join(" vs ")}
        </span>
        <span style={{ marginLeft: "auto" }} aria-live="polite">
          {pending ? "만드는 중…" : `-${charged}C`}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        {run.cells.map((c) => (
          <Cell
            key={c.id}
            cell={c}
            pinned={pinned.includes(c.id)}
            onPin={onPin}
            onSaved={onSaved}
            onSame={
              run.mode === "free" && run.recipeId && c.status === "succeeded" && c.url
                ? () => setSame({ cellId: c.id, url: c.url!, kind: c.kind })
                : undefined
            }
          />
        ))}
      </div>
      {run.mode === "blank" &&
        run.cells.some((c) => c.status === "succeeded") && (
          <Button
            size="sm"
            variant="ghost"
            color="secondary"
            disabled={drafting}
            onClick={() => void toDraft()}
            style={{ alignSelf: "flex-start" }}
          >
            이 프롬프트로 레시피 올리기
          </Button>
        )}
      {same && run.recipeId && (
        <SameUpDialog open onClose={() => setSame(null)} targets={[]} recipeId={run.recipeId} playResult={same} />
      )}
    </li>
  );
}

function Cell({
  cell,
  pinned,
  onPin,
  onSaved,
  onSame,
}: {
  cell: PlayCellDTO;
  pinned: boolean;
  onPin: (id: string) => void;
  onSaved: (cellId: string, saved: boolean) => void;
  /** Received-recipe results: post as SAME 인증 (F4-11). */
  onSame?: () => void;
}) {
  const { notify } = useAuth();
  const [busy, setBusy] = useState(false);
  const toggleSave = async () => {
    setBusy(true);
    const r = await saveResult({ cellId: cell.id, saved: !cell.saved });
    setBusy(false);
    if (!r.ok) {
      notify("저장하지 못했어요. 다시 눌러 주세요.");
      return;
    }
    onSaved(cell.id, !cell.saved);
    notify(
      cell.saved
        ? "저장을 풀었어요. 30일이 지나면 지워져요."
        : "저장했어요. 지우지 않고 계속 둘게요.",
    );
  };

  return (
    <figure
      aria-label={`${cell.modelLabel} 결과`}
      style={{
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: cell.kind === "video" ? "9/16" : "1/1",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--sp-bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {cell.status === "succeeded" && cell.url ? (
          cell.kind === "video" ? (
            <video
              src={cell.url}
              controls
              preload="metadata"
              aria-label={`${cell.modelLabel}로 만든 AI 생성 영상`}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cell.url}
              alt={`${cell.modelLabel}로 만든 AI 생성 이미지`}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          )
        ) : !isTerminal(cell.status) ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--sp-fg-secondary)",
            }}
          >
            <Spinner size="sm" /> 만드는 중…
          </span>
        ) : (
          <p
            role="status"
            style={{
              margin: 0,
              padding: 12,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--sp-fg-secondary)",
              textAlign: "center",
            }}
          >
            {cell.status === "succeeded"
              ? "저장 기간이 지나 지웠어요"
              : cellErrorCopy(cell.status, cell.errorCode, cell.credits)}
          </p>
        )}
        {cell.status === "succeeded" && (
          <span style={{ position: "absolute", top: 8, left: 8 }}>
            <Badge color="contrast" size="sm">
              AI 생성
            </Badge>
          </span>
        )}
      </div>
      <figcaption style={{ fontSize: 12, color: "var(--sp-fg-secondary)" }}>
        {cell.modelLabel} · {cell.credits}C
      </figcaption>
      {cell.status === "succeeded" && cell.url && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Button
            size="sm"
            variant="outline"
            color={cell.saved ? "primary" : "secondary"}
            aria-pressed={cell.saved}
            disabled={busy}
            onClick={() => void toggleSave()}
          >
            {cell.saved ? "저장됨" : "저장"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            color={pinned ? "primary" : "secondary"}
            aria-pressed={pinned}
            onClick={() => onPin(cell.id)}
          >
            {pinned ? "고정됨" : "비교에 고정"}
          </Button>
          {onSame && (
            <Button size="sm" color="primary" onClick={onSame}>
              SAME 인증 올리기
            </Button>
          )}
          <a
            href={cell.url}
            download
            style={{
              fontSize: 12,
              alignSelf: "center",
              color: "var(--sp-fg-accent)",
            }}
          >
            내려받기
          </a>
        </div>
      )}
      {cell.status === "succeeded" && !cell.saved && cell.deleteAfter && (
        <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
          저장하지 않으면 {kstMonthDay(cell.deleteAfter)}에 지워져요
        </span>
      )}
    </figure>
  );
}
