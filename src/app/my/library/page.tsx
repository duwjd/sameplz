import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryGuest, LibraryView } from "@/components/library/LibraryView";
import { getViewer } from "@/lib/auth/account";
import { getMyLibrary } from "@/data/library";

export const metadata: Metadata = {
  title: "라이브러리 · SAMEPLZ",
  robots: { index: false },
};

async function Library({
  searchParams,
}: {
  searchParams: PageProps<"/my/library">["searchParams"];
}) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer) return <LibraryGuest />;
  const rows = await getMyLibrary();
  const open = typeof sp.open === "string" ? sp.open : null;
  return <LibraryView rows={rows} openId={open} />;
}

function LibrarySkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 240,
        borderRadius: 16,
        background: "var(--sp-bg-secondary)",
      }}
    />
  );
}

export default function LibraryPage(props: PageProps<"/my/library">) {
  return (
    <main
      data-screen-label="Library"
      style={{
        maxWidth: 960,
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
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>라이브러리</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          받은 레시피는 받은 버전 그대로 남아요. 새 버전은 골라서 업데이트해요.
        </p>
      </header>
      <Suspense fallback={<LibrarySkeleton />}>
        <Library searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
