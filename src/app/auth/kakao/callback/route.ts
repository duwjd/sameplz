import type { NextRequest, NextResponse } from "next/server";
import {
  KAKAO_NEXT_COOKIE,
  KAKAO_NONCE_COOKIE,
  KAKAO_STATE_COOKIE,
  exchangeKakaoCode,
  kakaoConfig,
} from "@/lib/auth/kakao";
import { safeNext } from "@/lib/auth/next-path";
import {
  clearFlowCookies,
  loginFailed,
  loginSucceeded,
} from "@/lib/auth/oauth";
import { createClient } from "@/lib/supabase/server";

const COOKIES = [KAKAO_STATE_COOKIE, KAKAO_NONCE_COOKIE, KAKAO_NEXT_COOKIE];

// Kakao callback: state check → code → ID token → Supabase session (signInWithIdToken).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(request.cookies.get(KAKAO_NEXT_COOKIE)?.value);
  const done = (res: NextResponse) =>
    clearFlowCookies(res, COOKIES, "/auth/kakao");

  const kakaoError = searchParams.get("error");
  if (kakaoError)
    return done(
      loginFailed(
        request,
        next,
        kakaoError === "access_denied" ? "access_denied" : "provider_error",
      ),
    );

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = request.cookies.get(KAKAO_STATE_COOKIE)?.value;
  const rawNonce = request.cookies.get(KAKAO_NONCE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected || !rawNonce)
    return done(loginFailed(request, next, "invalid_state"));

  let config: ReturnType<typeof kakaoConfig>;
  try {
    config = kakaoConfig();
  } catch {
    return done(loginFailed(request, next, "provider_unavailable"));
  }
  const exchanged = await exchangeKakaoCode({
    ...config,
    redirectUri: `${request.nextUrl.origin}/auth/kakao/callback`,
    code,
  });
  if ("error" in exchanged)
    return done(loginFailed(request, next, "server_error"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "kakao",
    token: exchanged.idToken,
    nonce: rawNonce,
  });
  if (error) return done(loginFailed(request, next, "server_error"));

  return done(await loginSucceeded(request, next));
}
