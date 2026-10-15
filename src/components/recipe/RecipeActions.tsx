"use client";
// PRM-06 / AGT-06 / SKL-07 (F2-1): one main button per viewer state, plus like, link copy and follow.
// The initial state comes from the server (Suspense hole); a login replay (F7-1) refreshes it.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ReportDialog } from "@/components/gallery/ReportDialog";
import { SameUpDialog } from "@/components/gallery/SameUpDialog";
import { getMyFollowing, toggleFollow } from "@/actions/follow";
import { claimFreeRecipe, toggleRecipeLike } from "@/actions/recipe";
import { useAuth } from "@/components/auth/AuthProvider";
import { BuyPanel, Button, type BuyPanelState } from "@/components/ds";
import type { RecipeViewerState } from "@/data/recipe";
import { libraryHref } from "@/lib/recipe/detail";
import { markOpenIntent } from "@/lib/library/open-intent";
import { readShareRef } from "@/lib/share-ref";

export interface RecipeActionsProps {
  recipe: {
    id: string;
    publicId: string;
    price: number;
    category: "prompt" | "agent" | "skill";
    creator: {
      handle: string;
      nickname: string;
      avatarUrl: string | null;
      note: string;
    };
    playDisabledReason: string;
  };
  state: RecipeViewerState;
}

const CLAIM_FAILED: Record<string, string> = {
  RECIPE_UNAVAILABLE:
    "지금은 받을 수 없는 레시피예요. 비슷한 레시피를 둘러봐 주세요.",
  OWN_RECIPE: "내 레시피라 받지 않아도 돼요.",
  NOT_FREE: "무료 레시피만 바로 받을 수 있어요.",
  FAILED: "받지 못했어요. 잠시 뒤 다시 눌러 주세요.",
};

export function RecipeActions({ recipe, state }: RecipeActionsProps) {
  const router = useRouter();
  const { viewer, requireLogin, replayVersion, notify } = useAuth();
  const [entitlementId, setEntitlementId] = useState(
    state.entitlement?.id ?? null,
  );
  const [liked, setLiked] = useState(state.liked);
  const [sameOpen, setSameOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Server state changed (login replay claimed it, or a refresh): adopt it.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setEntitlementId(state.entitlement?.id ?? null);
    setLiked(state.liked);
  }

  // A replayed claim/follow happened in AuthProvider → re-read the server state.
  useEffect(() => {
    if (replayVersion > 0) router.refresh();
  }, [replayVersion, router]);

  useEffect(() => {
    if (!viewer?.signupComplete) return;
    let alive = true;
    getMyFollowing().then((handles) => {
      if (alive) setFollowing(handles.includes(recipe.creator.handle));
    });
    return () => {
      alive = false;
    };
  }, [viewer, replayVersion, recipe.creator.handle]);

  const panelState: BuyPanelState = state.isOwner
    ? "mine"
    : entitlementId
      ? "owned"
      : "none";

  const onBuy = async () => {
    if (busy) return;
    if (!viewer) {
      requireLogin({
        action: {
          type: "claim",
          recipeId: recipe.id,
          publicId: recipe.publicId,
        },
      });
      return;
    }
    setBusy(true);
    const res = await claimFreeRecipe({
      recipeId: recipe.id,
      publicId: recipe.publicId,
      ref: readShareRef(recipe.publicId),
    });
    setBusy(false);
    if (res.ok) {
      setEntitlementId(res.entitlementId);
      notify(
        "라이브러리에 담았어요. 「라이브러리에서 열기」로 바로 쓸 수 있어요.",
      );
      router.refresh();
    } else if (res.reason === "LOGIN_REQUIRED") {
      requireLogin({
        action: {
          type: "claim",
          recipeId: recipe.id,
          publicId: recipe.publicId,
        },
      });
    } else if (res.reason !== "SIGNUP_INCOMPLETE") {
      notify(CLAIM_FAILED[res.reason] ?? CLAIM_FAILED.FAILED);
    }
  };

  const onLike = async () => {
    if (!viewer) {
      requireLogin();
      return;
    }
    const next = !liked;
    setLiked(next);
    const res = await toggleRecipeLike({
      recipeId: recipe.id,
      publicId: recipe.publicId,
      like: next,
    });
    if (!res.ok) {
      setLiked(!next);
      notify("좋아요를 바꾸지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    }
  };

  const onFollow = async () => {
    if (!viewer) {
      requireLogin({
        action: { type: "follow", handle: recipe.creator.handle },
      });
      return;
    }
    const next = !following;
    const res = await toggleFollow({
      handle: recipe.creator.handle,
      follow: next,
    });
    if (res.ok) setFollowing(res.following);
    else if (res.reason === "SELF") notify("내 계정은 팔로우할 수 없어요.");
    else notify("팔로우하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
  };

  const onShare = async () => {
    const url = `${window.location.origin}/r/${recipe.publicId}`;
    try {
      await navigator.clipboard.writeText(url);
      notify("링크를 복사했어요.");
    } catch {
      notify(`복사가 막혀 있어요. 주소를 직접 복사해 주세요: ${url}`);
    }
  };

  const openLibrary = () => {
    if (!entitlementId) return;
    markOpenIntent(entitlementId);
    router.push(libraryHref(entitlementId));
  };

  return (
    <>
      {/* The panel and its extra actions stick together, so nothing scrolls under the panel. */}
      <div
        style={{
          position: "sticky",
          top: 88,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <BuyPanel
          price={recipe.price}
          state={panelState}
          ownedNote={
            state.entitlement?.updateAvailable
              ? "새 버전이 나왔어요. 라이브러리에서 업데이트할 수 있어요."
              : undefined
          }
          play={recipe.category === "prompt"}
          playDisabledReason={recipe.playDisabledReason}
          onPlay={() => router.push(`/play?recipe=${recipe.publicId}`)}
          liked={liked}
          following={following}
          seller={{
            name: recipe.creator.nickname,
            avatar: recipe.creator.avatarUrl ?? undefined,
            note: recipe.creator.note,
          }}
          onBuy={onBuy}
          onOpen={openLibrary}
          onLike={onLike}
          onShare={onShare}
          onFollow={onFollow}
          onEdit={() => router.push(`/my/seller/upload?recipe=${recipe.id}`)}
          onSeller={() => router.push("/my/seller")}
        />
        {/* GAL-04 / F6-3: holders post a SAME 인증; members can report the recipe. */}
        {!state.isOwner && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {entitlementId && (
              <Button
                size="md"
                color="secondary"
                variant="outline"
                onClick={() => setSameOpen(true)}
              >
                SAME 인증 올리기
              </Button>
            )}
            <button
              type="button"
              onClick={() =>
                state.signedIn ? setReportOpen(true) : requireLogin()
              }
              style={{
                all: "unset",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--sp-fg-hint)",
                alignSelf: "center",
                minHeight: 24,
                minWidth: 32,
                padding: "2px 6px",
                textAlign: "center",
              }}
            >
              신고
            </button>
          </div>
        )}
      </div>
      {sameOpen && (
        <SameUpDialog
          open
          onClose={() => setSameOpen(false)}
          targets={[]}
          recipeId={recipe.id}
          onPosted={() => router.refresh()}
        />
      )}
      {reportOpen && (
        <ReportDialog
          open
          onClose={() => setReportOpen(false)}
          targetType="recipe"
          targetId={recipe.id}
        />
      )}
      {/* PRM: on mobile the main button stays reachable as a bottom bar (desktop: display none). */}
      {panelState !== "mine" && (
        <>
          <div aria-hidden="true" className="h-20 md:hidden" />
          <div
            className="md:hidden"
            role="region"
            aria-label="SAME 바"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 90,
              padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
              background: "var(--sp-bg-surface)",
              borderTop: "1px solid var(--sp-border-normal)",
            }}
          >
            <Button
              size="lg"
              stretch
              disabled={busy}
              onClick={panelState === "owned" ? openLibrary : onBuy}
            >
              {panelState === "owned"
                ? "라이브러리에서 열기"
                : "무료로 SAME 하기"}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
