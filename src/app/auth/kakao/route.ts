import { NextResponse, type NextRequest } from "next/server";
import {
  KAKAO_NEXT_COOKIE,
  KAKAO_NONCE_COOKIE,
  KAKAO_STATE_COOKIE,
  hashNonce,
  kakaoAuthorizeUrl,
  kakaoConfig,
  randomToken,
  safeNext,
} from "@/lib/auth/kakao";

// Start Kakao OIDC login: set state/nonce cookies, redirect to Kakao with our own scopes.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const { clientId } = kakaoConfig();
  const state = randomToken();
  const rawNonce = randomToken();

  const res = NextResponse.redirect(
    kakaoAuthorizeUrl({
      clientId,
      redirectUri: `${origin}/auth/kakao/callback`,
      state,
      nonce: hashNonce(rawNonce),
    }),
  );
  const cookie = {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/auth/kakao",
    maxAge: 600,
  };
  res.cookies.set(KAKAO_STATE_COOKIE, state, cookie);
  res.cookies.set(KAKAO_NONCE_COOKIE, rawNonce, cookie);
  res.cookies.set(
    KAKAO_NEXT_COOKIE,
    safeNext(searchParams.get("next")),
    cookie,
  );
  return res;
}
