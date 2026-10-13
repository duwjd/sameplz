import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WelcomeForm } from "@/components/auth/WelcomeForm";
import { getViewer } from "@/lib/auth/account";
import { safeNext } from "@/lib/auth/next-path";

export const metadata = {
  title: "가입 마무리 · SAMEPLZ",
  robots: { index: false },
};

async function Welcome({
  searchParams,
}: {
  searchParams: PageProps<"/welcome">["searchParams"];
}) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : "/");
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (viewer.signupComplete) redirect(next);
  return (
    <>
      <p style={{ margin: 0, fontSize: 15, color: "var(--sp-fg-secondary)" }}>
        <b>{viewer.nickname}</b>님, 처음 오셨네요. 아래 내용에 동의하면 바로
        시작할 수 있어요.
      </p>
      <WelcomeForm nickname={viewer.nickname} next={next} />
    </>
  );
}

export default function WelcomePage(props: PageProps<"/welcome">) {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "48px 24px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.6px",
        }}
      >
        가입을 마무리해 주세요
      </h1>
      <Suspense
        fallback={
          <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-hint)" }}>
            잠시만요
          </p>
        }
      >
        <Welcome searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
