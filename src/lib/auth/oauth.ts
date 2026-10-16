import "server-only";
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { deviceHash, ipHash } from "@/lib/abuse/fingerprint";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeNext, withAuthError } from "./next-path";

export const randomToken = () => randomBytes(32).toString("base64url");

/** Short-lived, path-scoped, httpOnly cookies that carry state / nonce / next across the redirect. */
export function flowCookieOptions(request: NextRequest, path: string) {
  return {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path,
    maxAge: 600,
  };
}

export function clearFlowCookies(
  res: NextResponse,
  names: string[],
  path: string,
) {
  for (const name of names) res.cookies.delete({ name, path });
  return res;
}

/** Login failed or was cancelled: back to where the user was, with a code the popup understands. */
export function loginFailed(
  request: NextRequest,
  next: string,
  code: string,
  stage?: string,
  error?: unknown,
) {
  if (stage) {
    // Server log only (Vercel). Codes and messages, never tokens, secrets or profile data.
    const e = (error ?? {}) as {
      code?: unknown;
      status?: unknown;
      message?: unknown;
    };
    console.error(
      `[auth] ${request.nextUrl.pathname} failed at ${stage}`,
      JSON.stringify({
        code: e.code ?? error ?? null,
        status: e.status ?? null,
        message: e.message ?? null,
      }),
    );
  }
  return NextResponse.redirect(
    new URL(withAuthError(next, code), request.nextUrl.origin),
  );
}

/**
 * Session exists now: unfinished signups (no terms / 18+ yet, F7-9) go to /welcome first,
 * everyone else back to `next`.
 */
export async function loginSucceeded(request: NextRequest, next: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_account_status");
  // F8-4: a banned account does not get a session.
  if (data?.[0]?.sanction_level === "banned") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/blocked", request.nextUrl.origin));
  }
  // D13 linked accounts: record the device used to log in (hashes only), not only the signup one.
  const secret = process.env.SUPABASE_SECRET_KEY;
  const { data: claims } = await supabase.auth.getClaims();
  if (secret && claims?.claims.sub)
    await createAdminClient()
      .rpc("record_member_device", {
        p_user: claims.claims.sub,
        p_device_hash: await deviceHash(secret),
        p_ip_hash: (await ipHash(secret)) as string,
      })
      .then(
        () => null,
        () => null,
      );
  const complete = Boolean(data?.[0]?.signup_complete);
  const target = complete
    ? safeNext(next)
    : `/welcome?next=${encodeURIComponent(safeNext(next))}`;
  return NextResponse.redirect(new URL(target, request.nextUrl.origin));
}
