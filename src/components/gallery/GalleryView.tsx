"use client";
// GAL-01~04: mixed feed of originals and SAME 인증 (「여기서 생성」 badge), 「같은 걸로」 → recipe,
// 「이걸로 만들기」 → fork draft (only where forks are allowed), likes, report, 「내 결과 올리기」.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { forkRecipe, loadGalleryPage, togglePostLike } from "@/actions/gallery";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  EmptyState,
  GalleryTile,
  SegmentedControl,
} from "@/components/ds";
import type {
  GalleryPage,
  GalleryPostDTO,
  SameTargetDTO,
} from "@/data/gallery";
import { ReportDialog } from "./ReportDialog";
import { SameUpDialog } from "./SameUpDialog";

type Filter = "all" | "same";

export function GalleryView({
  initial,
  targets,
  signedIn,
}: {
  initial: GalleryPage;
  targets: SameTargetDTO[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const { requireLogin, notify } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const [posts, setPosts] = useState<GalleryPostDTO[]>(initial.posts);
  const [cursor, setCursor] = useState(initial.cursor);
  const [loading, setLoading] = useState(false);
  const [sameOpen, setSameOpen] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [forkAsk, setForkAsk] = useState<string | null>(null);

  const reload = async (next: Filter) => {
    setFilter(next);
    setLoading(true);
    const page = await loadGalleryPage({
      kind: next === "same" ? "same_cert" : null,
      cursor: null,
    });
    setPosts(page.posts);
    setCursor(page.cursor);
    setLoading(false);
  };
  const more = async () => {
    if (!cursor) return;
    setLoading(true);
    const page = await loadGalleryPage({
      kind: filter === "same" ? "same_cert" : null,
      cursor,
    });
    setPosts((cur) => [
      ...cur,
      ...page.posts.filter((p) => !cur.some((c) => c.id === p.id)),
    ]);
    setCursor(page.cursor);
    setLoading(false);
  };

  const like = async (p: GalleryPostDTO) => {
    if (!signedIn) return requireLogin({ next: "/gallery" });
    const r = await togglePostLike({ postId: p.id });
    if (!r.ok) {
      if (r.reason) requireLogin({ next: "/gallery" });
      return;
    }
    setPosts((cur) =>
      cur.map((x) =>
        x.id === p.id
          ? {
              ...x,
              liked: Boolean(r.liked),
              likes: x.likes + (r.liked ? 1 : -1),
            }
          : x,
      ),
    );
  };

  const fork = async (publicId: string, replace = false) => {
    if (!signedIn) return requireLogin({ next: "/gallery" });
    const r = await forkRecipe({ publicId, replace });
    if (r.ok) return router.push("/my/seller/upload");
    if (r.reason === "DRAFT_EXISTS") return setForkAsk(publicId);
    notify(
      r.reason === "OWN_RECIPE"
        ? "내 레시피는 「새 버전 올리기」로 고쳐 주세요."
        : r.reason === "FORK_BLOCKED"
          ? "이 레시피는 포크를 막아 두었어요."
          : "초안을 만들지 못했어요. 다시 해 주세요.",
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
        }}
      >
        <SegmentedControl
          aria-label="보기"
          items={[
            { value: "all", label: "전체" },
            { value: "same", label: "SAME 인증만" },
          ]}
          value={filter}
          onChange={(v) => void reload(v as Filter)}
        />
        <Button
          style={{ marginLeft: "auto" }}
          color="primary"
          onClick={() =>
            signedIn ? setSameOpen(true) : requireLogin({ next: "/gallery" })
          }
        >
          내 결과 올리기
        </Button>
      </div>

      {posts.length === 0 && !loading ? (
        <EmptyState
          icon="MagicWandIcon"
          title={
            filter === "same"
              ? "아직 올라온 SAME 인증이 없어요"
              : "아직 올라온 결과가 없어요"
          }
          description="받은 레시피로 만든 결과를 첫 번째로 올려 보세요."
        />
      ) : (
        <ul
          aria-label="갤러리"
          aria-busy={loading}
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {posts.map((p) => (
            <li
              key={p.id}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <GalleryTile
                title={p.title}
                creator={p.author}
                likes={p.likes}
                liked={p.liked}
                type={p.type}
                madeHere={p.madeHere}
                media={p.media ?? undefined}
                alt={p.alt ?? `${p.recipe} 결과: ${p.title}`}
                ratio={p.ratio}
                kind={p.kind === "video" ? "영상" : undefined}
                recipe={p.recipe}
                canFork={p.canFork}
                onSame={() => router.push(p.recipeHref)}
                onRecipe={() => router.push(p.recipeHref)}
                onFork={() => void fork(p.recipePublicId)}
                onLike={() => void like(p)}
              />
              <button
                type="button"
                onClick={() =>
                  signedIn
                    ? setReport(p.id)
                    : requireLogin({ next: "/gallery" })
                }
                style={{
                  all: "unset",
                  cursor: "pointer",
                  alignSelf: "flex-end",
                  fontSize: 12,
                  color: "var(--sp-fg-hint)",
                  minHeight: 24,
                  minWidth: 32,
                  padding: "2px 6px",
                  textAlign: "center",
                }}
              >
                신고
              </button>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <Button
          variant="outline"
          color="secondary"
          disabled={loading}
          onClick={() => void more()}
          style={{ alignSelf: "center" }}
        >
          {loading ? "불러오는 중…" : "더 보기"}
        </Button>
      )}

      {sameOpen && (
        <SameUpDialog
          open
          onClose={() => setSameOpen(false)}
          targets={targets}
          onPosted={(status) => status === "visible" && void reload(filter)}
        />
      )}
      {report && (
        <ReportDialog
          open
          onClose={() => setReport(null)}
          targetType="post"
          targetId={report}
        />
      )}
      <Dialog
        open={Boolean(forkAsk)}
        onClose={() => setForkAsk(null)}
        size="sm"
      >
        <DialogHeader
          title="쓰던 초안이 있어요"
          onClose={() => setForkAsk(null)}
        />
        <DialogBody>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            새 레시피 초안은 하나만 둘 수 있어요. 이 레시피로 새로 시작하면 쓰던
            초안은 지워져요.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            color="secondary"
            onClick={() => setForkAsk(null)}
          >
            쓰던 초안 두기
          </Button>
          <Button
            color="primary"
            onClick={() => {
              const id = forkAsk!;
              setForkAsk(null);
              void fork(id, true);
            }}
          >
            새로 시작하기
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
