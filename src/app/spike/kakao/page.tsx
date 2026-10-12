// SPIKE ONLY (spike/kakao-login branch): shows what Supabase stored after Kakao login.
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LoginButtons } from "./LoginButtons";

async function Result({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  await connection();
  const { auth_error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const summary = user && {
    id: user.id,
    email: user.email ?? null,
    providers: user.app_metadata.providers,
    identities: user.identities?.map((i) => ({
      provider: i.provider,
      email: i.identity_data?.email ?? null,
      name: i.identity_data?.name ?? i.identity_data?.full_name ?? null,
      avatar: Boolean(i.identity_data?.avatar_url),
    })),
    claims_sub: data?.claims.sub ?? null,
  };

  return (
    <>
      <LoginButtons signedIn={Boolean(user)} />
      {auth_error && (
        <p style={{ color: "var(--sp-fg-danger)" }}>auth_error: {auth_error}</p>
      )}
      <pre style={{ fontSize: 13 }}>
        {JSON.stringify(summary, null, 2) ?? "not signed in"}
      </pre>
    </>
  );
}

export default function KakaoSpikePage(props: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  return (
    <main
      style={{ padding: 32, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <h1 style={{ margin: 0, fontSize: 20 }}>Kakao login spike</h1>
      <Suspense fallback={<p>loading…</p>}>
        <Result searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
