import "server-only";
import { createHash } from "node:crypto";

// Naver Login is OAuth2 only (no ID token) and nests the profile under `response`, so neither
// signInWithIdToken nor Supabase custom OAuth attribute mapping can use it (D4 spike).
// Flow: our route exchanges the code, reads the profile, then signs the user in through the
// Auth Admin API with a deterministic placeholder email on the reserved `.invalid` TLD.
export const NAVER_STATE_COOKIE = "sp_naver_state";
export const NAVER_NEXT_COOKIE = "sp_naver_next";

/** Mail is never sent to this domain (RFC 2606 `.invalid`). Treat it as "no email" in the app. */
export const NAVER_PLACEHOLDER_DOMAIN = "naver.users.sameplz.invalid";

export function naverConfig() {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET missing");
  return { clientId, clientSecret };
}

export const placeholderEmail = (naverId: string) =>
  `n_${createHash("sha256").update(`naver:${naverId}`).digest("hex").slice(0, 32)}@${NAVER_PLACEHOLDER_DOMAIN}`;

export function naverAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://nid.naver.com/oauth2.0/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("state", opts.state);
  return url.toString();
}

export async function exchangeNaverCode(opts: {
  clientId: string;
  clientSecret: string;
  code: string;
  state: string;
}): Promise<{ accessToken: string } | { error: string }> {
  const res = await fetch("https://nid.naver.com/oauth2.0/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      code: opts.code,
      state: opts.state,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
  };
  if (!res.ok || !body.access_token)
    return { error: body.error ?? `token_${res.status}` };
  return { accessToken: body.access_token };
}

export interface NaverProfile {
  id: string;
  nickname?: string;
  profile_image?: string;
}

export async function fetchNaverProfile(
  accessToken: string,
): Promise<NaverProfile | null> {
  const res = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    resultcode?: string;
    response?: NaverProfile;
  } | null;
  if (!res.ok || body?.resultcode !== "00" || !body.response?.id) return null;
  return body.response;
}
