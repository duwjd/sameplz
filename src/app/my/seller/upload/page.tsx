import type { Metadata } from "next";
import { Suspense } from "react";
import { UploadGuest, UploadWizard } from "@/components/upload/UploadWizard";
import { getReferenceData } from "@/data/catalog";
import { getMyDraft } from "@/data/upload";
import { getViewer } from "@/lib/auth/account";

export const metadata: Metadata = {
  title: "레시피 올리기 · SAMEPLZ",
  robots: { index: false },
};

async function Upload() {
  const viewer = await getViewer();
  if (!viewer) return <UploadGuest />;
  const [draft, ref] = await Promise.all([getMyDraft(), getReferenceData()]);
  return (
    <UploadWizard
      key={draft?.updatedAt ?? "new"}
      draft={draft}
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

export default function UploadPage() {
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
          카테고리 → 내용 → 결과물 → 공개 범위 → 검사 순서로 5분이면 올려요.
          지금은 무료로만 올릴 수 있어요.
        </p>
      </header>
      <Suspense fallback={<UploadSkeleton />}>
        <Upload />
      </Suspense>
    </main>
  );
}
