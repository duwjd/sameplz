"use server";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";

const Handle = z.string().regex(/^[a-z0-9_]{3,15}$/);

export type FollowResult =
  | { ok: true; following: boolean }
  | {
      ok: false;
      reason:
        | "LOGIN_REQUIRED"
        | "SIGNUP_INCOMPLETE"
        | "NOT_FOUND"
        | "SELF"
        | "FAILED";
    };

/** HOME-05 follow / unfollow. zod → claims → target lookup → RLS-guarded write → updateTag. */
export async function toggleFollow(input: {
  handle: string;
  follow: boolean;
}): Promise<FollowResult> {
  const parsed = z
    .object({ handle: Handle, follow: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "NOT_FOUND" };

  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "LOGIN_REQUIRED" };
  if (!viewer.signupComplete) return { ok: false, reason: "SIGNUP_INCOMPLETE" };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", parsed.data.handle)
    .maybeSingle();
  if (!target) return { ok: false, reason: "NOT_FOUND" };
  if (target.id === viewer.id) return { ok: false, reason: "SELF" };

  const result = parsed.data.follow
    ? await supabase
        .from("follows")
        .upsert(
          { follower_id: viewer.id, followee_id: target.id },
          { ignoreDuplicates: true },
        )
    : await supabase
        .from("follows")
        .delete()
        .eq("follower_id", viewer.id)
        .eq("followee_id", target.id);
  if (result.error) return { ok: false, reason: "FAILED" };

  updateTag("rankings"); // follower counts on HOME-05
  return { ok: true, following: parsed.data.follow };
}

/** Handles the signed-in viewer follows (home is publicly cached, so this is fetched separately). */
export async function getMyFollowing(): Promise<string[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("profiles!follows_followee_id_fkey(handle)")
    .eq("follower_id", viewer.id);
  return (data ?? []).flatMap((row) => {
    const p = row.profiles as { handle: string } | null;
    return p ? [p.handle] : [];
  });
}
