import { NextResponse, type NextRequest } from "next/server";
import { randomToken, safeNext } from "@/lib/auth/kakao";
import {
  NAVER_NEXT_COOKIE,
  NAVER_STATE_COOKIE,
  naverAuthorizeUrl,
  naverConfig,
} from "@/lib/auth/naver";

// Start Naver login: state cookie, redirect to Naver.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const { clientId } = naverConfig();
  const state = randomToken();
  const res = NextResponse.redirect(
    naverAuthorizeUrl({
      clientId,
      redirectUri: `${origin}/auth/naver/callback`,
      state,
    }),
  );
  const cookie = {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/auth/naver",
    maxAge: 600,
  };
  res.cookies.set(NAVER_STATE_COOKIE, state, cookie);
  res.cookies.set(
    NAVER_NEXT_COOKIE,
    safeNext(searchParams.get("next")),
    cookie,
  );
  return res;
}
