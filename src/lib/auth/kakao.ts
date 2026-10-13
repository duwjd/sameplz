import "server-only";
import { createHash } from "node:crypto";

// Kakao personal app: no account_email consent, so we cannot use Supabase's built-in Kakao OAuth
// (it always requests account_email → KOE205). We run Kakao OIDC ourselves with the scopes we have,
// then hand the ID token to Supabase (signInWithIdToken, provider "kakao", email_optional = true).
export const KAKAO_SCOPES = "openid profile_nickname profile_image";
export const KAKAO_STATE_COOKIE = "sp_kakao_state";
export const KAKAO_NONCE_COOKIE = "sp_kakao_nonce";
export const KAKAO_NEXT_COOKIE = "sp_kakao_next";

export function kakaoConfig() {
  const clientId = process.env.KAKAO_REST_API_KEY;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("KAKAO_REST_API_KEY / KAKAO_CLIENT_SECRET missing");
  return { clientId, clientSecret };
}

/** Supabase compares sha256(raw nonce) (hex) with the ID token's nonce claim. */
export const hashNonce = (raw: string) =>
  createHash("sha256").update(raw).digest("hex");

export function kakaoAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
}) {
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("scope", KAKAO_SCOPES);
  url.searchParams.set("state", opts.state);
  url.searchParams.set("nonce", opts.nonce);
  return url.toString();
}

export async function exchangeKakaoCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ idToken: string } | { error: string }> {
  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      code: opts.code,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    id_token?: string;
    error_code?: string;
    error?: string;
  };
  if (!res.ok || !body.id_token)
    return { error: body.error_code ?? body.error ?? `token_${res.status}` };
  return { idToken: body.id_token };
}
