import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth callback: exchange the code for a session, then go back to `next` (same-origin paths only).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}${next}?auth_error=${encodeURIComponent(error.code ?? "exchange_failed")}`,
    );
  }

  // Provider-side failure (e.g. Kakao KOE205) comes back as error / error_description.
  const err =
    searchParams.get("error_code") ?? searchParams.get("error") ?? "no_code";
  return NextResponse.redirect(
    `${origin}${next}?auth_error=${encodeURIComponent(err)}`,
  );
}
