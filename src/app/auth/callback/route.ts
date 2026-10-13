import type { NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/next-path";
import { loginFailed, loginSucceeded } from "@/lib/auth/oauth";
import { createClient } from "@/lib/supabase/server";

// Google (Supabase built-in OAuth, PKCE): exchange the code, then finish the login.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));

  const providerError = searchParams.get("error");
  if (providerError)
    return loginFailed(
      request,
      next,
      providerError === "access_denied" ? "access_denied" : "provider_error",
    );

  const code = searchParams.get("code");
  if (!code) return loginFailed(request, next, "no_code");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error)
    return loginFailed(
      request,
      next,
      "exchange_failed",
      "exchange_code",
      error,
    );
  return loginSucceeded(request, next);
}
