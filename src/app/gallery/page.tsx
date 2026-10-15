import type { Metadata } from "next";
import { Suspense } from "react";
import { GalleryView } from "@/components/gallery/GalleryView";
import { getGalleryFeed, getMySameTargets } from "@/data/gallery";
import { getViewer } from "@/lib/auth/account";

export const metadata: Metadata = {
  title: "갤러리 · SAMEPLZ",
  description:
    "AI 레시피로 만든 결과물과, 받은 사람이 따라 만든 SAME 인증을 구경해요.",
};

async function Gallery() {
  const [viewer, initial] = await Promise.all([getViewer(), getGalleryFeed()]);
  const targets = viewer?.signupComplete ? await getMySameTargets(viewer) : [];
  return (
    <GalleryView
      initial={initial}
      targets={targets}
      signedIn={Boolean(viewer)}
    />
  );
}

export default function GalleryPage() {
  return (
    <main
      data-screen-label="Gallery"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        color: "var(--sp-fg-normal)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>갤러리</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          레시피로 만든 결과와 따라 만든 SAME 인증이 모여요. 마음에 들면 「같은
          걸로」를 눌러 보세요.
        </p>
      </header>
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            style={{
              height: 480,
              borderRadius: 16,
              background: "var(--sp-bg-secondary)",
            }}
          />
        }
      >
        <Gallery />
      </Suspense>
    </main>
  );
}
