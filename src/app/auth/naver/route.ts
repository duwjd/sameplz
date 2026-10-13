import { NextResponse, type NextRequest } from "next/server";
import {
  NAVER_NEXT_COOKIE,
  NAVER_STATE_COOKIE,
  naverAuthorizeUrl,
  naverConfig,
} from "@/lib/auth/naver";
import { safeNext } from "@/lib/auth/next-path";
import { flowCookieOptions, loginFailed, randomToken } from "@/lib/auth/oauth";

// Start Naver login (D4-B): state cookie, then Naver's authorize page.
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  let clientId: string;
  try {
    clientId = naverConfig().clientId;
  } catch {
    return loginFailed(request, next, "provider_unavailable");
  }
  const state = randomToken();
  const res = NextResponse.redirect(
    naverAuthorizeUrl({
      clientId,
      redirectUri: `${request.nextUrl.origin}/auth/naver/callback`,
      state,
    }),
  );
  const opts = flowCookieOptions(request, "/auth/naver");
  res.cookies.set(NAVER_STATE_COOKIE, state, opts);
  res.cookies.set(NAVER_NEXT_COOKIE, next, opts);
  return res;
}
