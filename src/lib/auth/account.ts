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
  /** profiles.role (user · staff · admin), read through my_account_status. */
  role: string;
  /** F8-4: the heaviest sanction in force (warning has no effect on what they can do). */
  sanction: Sanction | null;
}

export type SanctionLevel =
  | "warning"
  | "seller_suspended"
  | "account_suspended"
  | "banned";
export interface Sanction {
  level: SanctionLevel;
  /** ISO time; null = until lifted. */
  endsAt: string | null;
}

const RANK: Record<SanctionLevel, number> = {
  warning: 1,
  seller_suspended: 2,
  account_suspended: 3,
  banned: 4,
};

/**
 * F8-4: the reason a sanctioned viewer cannot do this (the database refuses it too). `seller` covers
 * uploads (seller suspension and up), `account` every other member write.
 */
export function sanctionBlock(
  viewer: Pick<Viewer, "sanction">,
  scope: "seller" | "account",
): "ACCOUNT_SUSPENDED" | "SELLER_SUSPENDED" | null {
  const rank = viewer.sanction ? RANK[viewer.sanction.level] : 0;
  if (rank >= 3) return "ACCOUNT_SUSPENDED";
  if (rank === 2 && scope === "seller") return "SELLER_SUSPENDED";
  return null;
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
    role: status.data?.[0]?.role ?? "user",
    sanction: status.data?.[0]?.sanction_level
      ? {
          level: status.data[0].sanction_level as SanctionLevel,
          endsAt: status.data[0].sanction_ends_at,
        }
      : null,
  };
}
