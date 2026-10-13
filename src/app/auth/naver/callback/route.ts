import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/kakao";
import {
  NAVER_NEXT_COOKIE,
  NAVER_STATE_COOKIE,
  exchangeNaverCode,
  fetchNaverProfile,
  naverConfig,
  placeholderEmail,
} from "@/lib/auth/naver";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Naver callback: state → token → profile → find-or-create Supabase user → session via magic-link hash.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const next = safeNext(request.cookies.get(NAVER_NEXT_COOKIE)?.value);
  const done = (path: string) => {
    const res = NextResponse.redirect(`${origin}${path}`);
    for (const c of [NAVER_STATE_COOKIE, NAVER_NEXT_COOKIE])
      res.cookies.delete({ name: c, path: "/auth/naver" });
    return res;
  };
  const fail = (code: string) =>
    done(`${next}?auth_error=${encodeURIComponent(code)}`);

  const naverError = searchParams.get("error");
  if (naverError) return fail(naverError); // e.g. access_denied

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = request.cookies.get(NAVER_STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected)
    return fail("invalid_state");

  const { clientId, clientSecret } = naverConfig();
  const token = await exchangeNaverCode({
    clientId,
    clientSecret,
    code,
    state,
  });
  if ("error" in token) return fail(token.error);

  const profile = await fetchNaverProfile(token.accessToken);
  if (!profile) return fail("naver_profile_failed");

  const email = placeholderEmail(profile.id);
  const admin = createAdminClient();

  // First login creates the user; later logins hit email_exists and reuse it.
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
    return fail(created.error.code ?? "create_failed");

  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash) return fail(link.error?.code ?? "link_failed");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (error) return fail(error.code ?? "verify_failed");

  return done(next);
}
