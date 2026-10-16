import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { Button, EmptyState } from "@/components/ds";
import { UploadGuest, UploadWizard } from "@/components/upload/UploadWizard";
import { getReferenceData } from "@/data/catalog";
import { getMyWaitlist, getRecipeForEdit } from "@/data/seller";
import { getMyDraft } from "@/data/upload";
import { getViewer } from "@/lib/auth/account";

export const metadata: Metadata = {
  title: "레시피 올리기 · SAMEPLZ",
  robots: { index: false },
};

function BackToSeller({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <EmptyState
      icon="InfoCircleOutlineIcon"
      title={title}
      description={description}
      actions={
        <Link href="/my/seller" style={{ textDecoration: "none" }}>
          <Button>내 레시피로 가기</Button>
        </Link>
      }
    />
  );
}

async function Upload({
  searchParams,
}: {
  searchParams: PageProps<"/my/seller/upload">["searchParams"];
}) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer) return <UploadGuest />;
  // ?recipe=<id>: 「고쳐서 다시 제출」 / 「새 버전 올리기」 for the viewer's own recipe (UP-08, F5-6, F5-7).
  const recipeParam = z.guid().safeParse(sp.recipe);
  const recipeId = recipeParam.success ? recipeParam.data : null;
  const [edit, draft, ref, waitlist] = await Promise.all([
    recipeId ? getRecipeForEdit(recipeId) : Promise.resolve(null),
    getMyDraft(recipeId),
    getReferenceData(),
    getMyWaitlist(),
  ]);
  if (recipeId && !edit)
    return (
      <BackToSeller
        title="레시피를 찾지 못했어요"
        description="내가 올린 레시피만 고칠 수 있어요."
      />
    );
  // Rendered inside the wizard so a submit (which re-renders this page) keeps its done screen.
  const blocked =
    edit?.status === "taken_down"
      ? {
          title: "게시가 중단된 레시피예요",
          description:
            "운영 정책에 따라 게시가 중단된 레시피는 새 버전을 올릴 수 없어요. 이의는 고객센터로 알려 주세요.",
        }
      : edit?.status === "stopped"
        ? {
            title: "판매가 멈춘 레시피예요",
            description: "판매가 멈춘 레시피는 새 버전을 올릴 수 없어요.",
          }
        : edit?.reviewPending
          ? {
              title: "사람이 확인하고 있는 버전이 있어요",
              description: "1~2일 안에 확인이 끝나면 새 버전을 올릴 수 있어요.",
            }
          : null;
  return (
    <UploadWizard
      key={recipeId ?? "new"}
      blocked={blocked}
      draft={draft}
      edit={
        edit
          ? { form: edit.form, versionNo: edit.versionNo, reject: edit.reject }
          : null
      }
      waitlist={waitlist}
      options={{ jobs: ref.jobList, tools: ref.toolList }}
    />
  );
}

function UploadSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 420,
        borderRadius: 16,
        background: "var(--sp-bg-secondary)",
      }}
    />
  );
}

export default function UploadPage(props: PageProps<"/my/seller/upload">) {
  return (
    <main
      data-screen-label="Upload"
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "32px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        color: "var(--sp-fg-normal)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
          레시피 올리기
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          카테고리 → 내용 → 결과물 → 공개 범위 → 검사 순서로 올려요. 검사를
          통과하면 바로 공개되고, 에이전트는 1~2일 안에 사람이 확인해요. 지금은
          무료로만 올릴 수 있어요.
        </p>
      </header>
      <Suspense fallback={<UploadSkeleton />}>
        <Upload searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
