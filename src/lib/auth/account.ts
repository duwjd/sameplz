import "server-only";
import { hasSupabaseEnv } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

/** Terms + privacy + 18+ wording version recorded in consent_events (D5, F7-9). */
export const TERMS_VERSION = "2026-10-v1";

export interface Viewer {
  id: string;
  nickname: string;
  handle: string;
  avatarUrl: string | null;
  signupComplete: boolean;
}

/** Signed-in viewer from verified claims (never getSession for authorization). */
export async function getViewer(): Promise<Viewer | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims.sub;
  if (!id) return null;

  const [profile, status] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname,handle,avatar_url")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("my_account_status"),
  ]);
  if (!profile.data) return null;
  return {
    id,
    nickname: profile.data.nickname,
    handle: profile.data.handle,
    avatarUrl: profile.data.avatar_url,
    signupComplete: Boolean(status.data?.[0]?.signup_complete),
  };
}
