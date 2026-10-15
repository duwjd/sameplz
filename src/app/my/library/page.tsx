import type { Metadata } from "next";
import { Suspense } from "react";
import { MyShell } from "@/components/my/MyShell";
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
    <MyShell
      active="library"
      title="라이브러리"
      description="받은 레시피는 받은 버전 그대로 남아요. 새 버전은 골라서 업데이트해요."
    >
      <Suspense fallback={<LibrarySkeleton />}>
        <Library searchParams={props.searchParams} />
      </Suspense>
    </MyShell>
  );
}
