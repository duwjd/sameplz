import type { NextRequest, NextResponse } from "next/server";
import {
  NAVER_NEXT_COOKIE,
  NAVER_STATE_COOKIE,
  exchangeNaverCode,
  fetchNaverProfile,
  naverConfig,
  placeholderEmail,
} from "@/lib/auth/naver";
import { safeNext } from "@/lib/auth/next-path";
import {
  clearFlowCookies,
  loginFailed,
  loginSucceeded,
} from "@/lib/auth/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const COOKIES = [NAVER_STATE_COOKIE, NAVER_NEXT_COOKIE];

// Naver callback (D4-B): state → token → profile → find-or-create the Supabase user (placeholder
// email, naver_id in app_metadata) → session via a magic-link token hash. The Admin API (secret key)
// runs only after the state check passes.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(request.cookies.get(NAVER_NEXT_COOKIE)?.value);
  const done = (res: NextResponse) =>
    clearFlowCookies(res, COOKIES, "/auth/naver");

  const naverError = searchParams.get("error");
  if (naverError)
    return done(
      loginFailed(
        request,
        next,
        naverError === "access_denied" ? "access_denied" : "provider_error",
      ),
    );

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = request.cookies.get(NAVER_STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected)
    return done(loginFailed(request, next, "invalid_state"));

  let config: ReturnType<typeof naverConfig>;
  try {
    config = naverConfig();
  } catch {
    return done(loginFailed(request, next, "provider_unavailable"));
  }
  const token = await exchangeNaverCode({ ...config, code, state });
  if ("error" in token) return done(loginFailed(request, next, "server_error"));
  const profile = await fetchNaverProfile(token.accessToken);
  if (!profile) return done(loginFailed(request, next, "server_error"));

  const email = placeholderEmail(profile.id);
  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: {
      provider: "naver",
      providers: ["naver"],
      naver_id: profile.id,
    },
    user_metadata: {
      name: profile.nickname ?? null,
      avatar_url: profile.profile_image ?? null,
      email_placeholder: true,
    },
  });
  if (created.error && created.error.code !== "email_exists")
    return done(loginFailed(request, next, "server_error"));

  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash)
    return done(loginFailed(request, next, "server_error"));

  // Identity is the Naver id, not the email string: refuse an account that owns this placeholder
  // email but was not created by this Naver login (pre-registration takeover, security review).
  if (link.data.user?.app_metadata?.naver_id !== profile.id)
    return done(loginFailed(request, next, "server_error"));

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (error) return done(loginFailed(request, next, "server_error"));

  return done(await loginSucceeded(request, next));
}
