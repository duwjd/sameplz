import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  KAKAO_NEXT_COOKIE,
  KAKAO_NONCE_COOKIE,
  KAKAO_STATE_COOKIE,
  exchangeKakaoCode,
  kakaoConfig,
  safeNext,
} from "@/lib/auth/kakao";

// Kakao OIDC callback: check state, exchange code → ID token, sign in to Supabase with it.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const next = safeNext(request.cookies.get(KAKAO_NEXT_COOKIE)?.value);
  const fail = (code: string) => {
    const res = NextResponse.redirect(
      `${origin}${next}?auth_error=${encodeURIComponent(code)}`,
    );
    for (const c of [KAKAO_STATE_COOKIE, KAKAO_NONCE_COOKIE, KAKAO_NEXT_COOKIE])
      res.cookies.delete({ name: c, path: "/auth/kakao" });
    return res;
  };

  const kakaoError = searchParams.get("error");
  if (kakaoError) return fail(searchParams.get("error_code") ?? kakaoError); // e.g. access_denied, KOE…

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(KAKAO_STATE_COOKIE)?.value;
  const rawNonce = request.cookies.get(KAKAO_NONCE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState || !rawNonce)
    return fail("invalid_state");

  const { clientId, clientSecret } = kakaoConfig();
  const exchanged = await exchangeKakaoCode({
    clientId,
    clientSecret,
    redirectUri: `${origin}/auth/kakao/callback`,
    code,
  });
  if ("error" in exchanged) return fail(exchanged.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "kakao",
    token: exchanged.idToken,
    nonce: rawNonce,
  });
  if (error) return fail(error.code ?? "id_token_rejected");

  const res = NextResponse.redirect(`${origin}${next}`);
  for (const c of [KAKAO_STATE_COOKIE, KAKAO_NONCE_COOKIE, KAKAO_NEXT_COOKIE])
    res.cookies.delete({ name: c, path: "/auth/kakao" });
  return res;
}
