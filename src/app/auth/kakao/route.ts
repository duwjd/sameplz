import { NextResponse, type NextRequest } from "next/server";
import {
  KAKAO_NEXT_COOKIE,
  KAKAO_NONCE_COOKIE,
  KAKAO_STATE_COOKIE,
  hashNonce,
  kakaoAuthorizeUrl,
  kakaoConfig,
} from "@/lib/auth/kakao";
import { safeNext } from "@/lib/auth/next-path";
import { flowCookieOptions, loginFailed, randomToken } from "@/lib/auth/oauth";

// Start Kakao OIDC (openid + nickname + profile image only; no account_email, see W1 spike).
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  let clientId: string;
  try {
    clientId = kakaoConfig().clientId;
  } catch {
    return loginFailed(request, next, "provider_unavailable");
  }
  const state = randomToken();
  const rawNonce = randomToken();
  const res = NextResponse.redirect(
    kakaoAuthorizeUrl({
      clientId,
      redirectUri: `${request.nextUrl.origin}/auth/kakao/callback`,
      state,
      nonce: hashNonce(rawNonce),
    }),
  );
  const opts = flowCookieOptions(request, "/auth/kakao");
  res.cookies.set(KAKAO_STATE_COOKIE, state, opts);
  res.cookies.set(KAKAO_NONCE_COOKIE, rawNonce, opts);
  res.cookies.set(KAKAO_NEXT_COOKIE, next, opts);
  return res;
}
