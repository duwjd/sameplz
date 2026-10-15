"use client";
// ACTV-01~04 (F6-4): my SAME 인증 (「내리기」), following (「끊기」), reports (접수 → 답변 완료).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toggleFollow } from "@/actions/follow";
import { removeSameCert } from "@/actions/gallery";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  EmptyState,
  Tabs,
} from "@/components/ds";
import type { FollowingDTO, MyReportDTO, MySamePostDTO } from "@/data/account";
import { kstShortDate } from "@/lib/play/copy";

const REASON: Record<string, string> = {
  misleading: "설명과 달라요",
  malicious: "이상한 지시·악성 코드 의심",
  rights: "남의 결과물",
  prohibited: "금지된 내용",
};

export type ActivityTab = "same" | "following" | "reports";

export function ActivityView({
  tab: initialTab,
  posts,
  following,
  reports,
}: {
  tab: ActivityTab;
  posts: MySamePostDTO[];
  following: FollowingDTO[];
  reports: MyReportDTO[];
}) {
  const router = useRouter();
  const { notify } = useAuth();
  const [tab, setTab] = useState<ActivityTab>(initialTab);
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<
    | { kind: "remove"; id: string; title: string }
    | { kind: "unfollow"; handle: string; nickname: string }
    | null
  >(null);

  const changeTab = (v: ActivityTab) => {
    setTab(v);
    // Keep the tab in the address so back and reload land on the same list.
    router.replace(v === "same" ? "/my/activity" : `/my/activity?tab=${v}`, {
      scroll: false,
    });
  };

  const remove = async (id: string) => {
    setBusy(id);
    let ok = false;
    try {
      ok = (await removeSameCert({ postId: id })).ok;
    } catch {
      ok = false;
    } finally {
      setBusy(null);
    }
    notify(ok ? "SAME 인증을 내렸어요." : "내리지 못했어요. 다시 눌러 주세요.");
    if (ok) router.refresh();
  };
  const unfollow = async (handle: string) => {
    setBusy(handle);
    let ok = false;
    try {
      ok = (await toggleFollow({ handle, follow: false })).ok;
    } catch {
      ok = false;
    } finally {
      setBusy(null);
    }
    if (ok) router.refresh();
    else notify("팔로우를 끊지 못했어요. 다시 눌러 주세요.");
  };
  const confirmAsk = () => {
    const a = ask;
    setAsk(null);
    if (a?.kind === "remove") void remove(a.id);
    if (a?.kind === "unfollow") void unfollow(a.handle);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Tabs
        idPrefix="actv"
        value={tab}
        onChange={(v) => changeTab(v as ActivityTab)}
        items={[
          { value: "same", label: `SAME 인증 ${posts.length}` },
          { value: "following", label: `팔로잉 ${following.length}` },
          { value: "reports", label: `신고 ${reports.length}` },
        ]}
      />
      <div role="tabpanel" id="actv-panel" aria-labelledby={`actv-tab-${tab}`}>
        {tab === "same" &&
          (posts.length === 0 ? (
            <EmptyState
              icon="CheckCircleOutlineIcon"
              title="아직 올린 SAME 인증이 없어요"
              description="받은 레시피로 만든 결과를 올리면 크리에이터에게 힘이 돼요."
              actions={<Link href="/my/library">라이브러리 열기</Link>}
            />
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {posts.map((p) => (
                <li
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--sp-border-normal)",
                  }}
                >
                  {p.media ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.media}
                      alt={`${p.recipe} 결과: ${p.title}`}
                      width={56}
                      height={56}
                      style={{ objectFit: "cover", borderRadius: 8 }}
                    />
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <b style={{ fontSize: 14 }}>{p.title}</b>
                    <span
                      style={{ fontSize: 13, color: "var(--sp-fg-secondary)" }}
                    >
                      <Link href={p.recipeHref}>{p.recipe}</Link> ·{" "}
                      {kstShortDate(p.createdAt)}
                    </span>
                  </div>
                  {p.status !== "visible" && (
                    <Badge color="hint" size="sm">
                      사람 확인 중
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    color="danger"
                    disabled={busy === p.id}
                    onClick={() =>
                      setAsk({ kind: "remove", id: p.id, title: p.title })
                    }
                    aria-label={`「${p.title}」 내리기`}
                  >
                    내리기
                  </Button>
                </li>
              ))}
            </ul>
          ))}
        {tab === "following" &&
          (following.length === 0 ? (
            <EmptyState
              icon="HeartOutlineIcon"
              title="아직 팔로우한 크리에이터가 없어요"
              description="레시피 상세에서 크리에이터를 팔로우하면 새 레시피를 알려 드려요."
              actions={<Link href="/market">마켓 둘러보기</Link>}
            />
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {following.map((f) => (
                <li
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--sp-border-normal)",
                  }}
                >
                  <b style={{ fontSize: 14 }}>{f.nickname}</b>
                  <span
                    style={{ fontSize: 13, color: "var(--sp-fg-secondary)" }}
                  >
                    @{f.handle}
                  </span>
                  <Link
                    href={`/market?q=${encodeURIComponent(f.nickname)}`}
                    style={{
                      marginLeft: "auto",
                      fontSize: 13,
                      color: "var(--sp-fg-accent)",
                    }}
                  >
                    레시피 보기
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    color="secondary"
                    disabled={busy === f.handle}
                    onClick={() =>
                      setAsk({
                        kind: "unfollow",
                        handle: f.handle,
                        nickname: f.nickname,
                      })
                    }
                    aria-label={`${f.nickname} 팔로우 끊기`}
                  >
                    끊기
                  </Button>
                </li>
              ))}
            </ul>
          ))}
        {tab === "reports" &&
          (reports.length === 0 ? (
            <EmptyState
              icon="CheckCircleOutlineIcon"
              title="신고 내역이 없어요"
              description="문제가 있는 레시피나 결과를 신고하면 여기서 진행 상황을 봐요."
            />
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {reports.map((r) => (
                <li
                  key={r.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--sp-border-normal)",
                  }}
                >
                  <span style={{ fontSize: 14 }}>
                    <b>{REASON[r.reason] ?? r.reason}</b> ·{" "}
                    {r.targetType === "recipe" ? "레시피" : "갤러리 글"} ·{" "}
                    {kstShortDate(r.createdAt)} 접수
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color:
                        r.status === "resolved"
                          ? "var(--sp-fg-normal)"
                          : "var(--sp-fg-secondary)",
                    }}
                  >
                    {r.status === "resolved"
                      ? `답변 완료 · ${r.answer ?? "처리를 마쳤어요."}`
                      : "답변 대기 · 1영업일 안에 첫 답을 드려요"}
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </div>
      <Dialog open={ask !== null} onClose={() => setAsk(null)} size="sm">
        <DialogHeader
          title={
            ask?.kind === "remove" ? "SAME 인증을 내릴까요?" : "팔로우를 끊을까요?"
          }
          onClose={() => setAsk(null)}
        />
        <DialogBody>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            {ask?.kind === "remove"
              ? `「${ask.title}」 SAME 인증을 갤러리와 레시피 상세에서 내려요. 레시피의 SAME 숫자도 1 줄어요.`
              : ask?.kind === "unfollow"
                ? `${ask.nickname} 님의 새 레시피 알림을 더 받지 않아요. 언제든 다시 팔로우할 수 있어요.`
                : ""}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" color="secondary" onClick={() => setAsk(null)}>
            닫기
          </Button>
          <Button
            color={ask?.kind === "remove" ? "danger" : "primary"}
            onClick={confirmAsk}
          >
            {ask?.kind === "remove" ? "내리기" : "끊기"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
