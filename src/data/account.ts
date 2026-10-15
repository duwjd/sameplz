// MY · NOTI · PRF · ACC · ACTV read DAL (F7-2~6, F6-4). Viewer-scoped reads through RLS.
import "server-only";
import type { Viewer } from "@/lib/auth/account";
import { recipeHref } from "@/lib/catalog/card";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/upload/media";

export interface NotificationDTO {
  id: number;
  kind: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
}

export async function getMyNotifications(
  limit = 50,
): Promise<NotificationDTO[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href,
    read: Boolean(n.read_at),
    createdAt: n.created_at,
  }));
}

export interface NotificationSettingsDTO {
  versionUpdate: boolean;
  sameCert: boolean;
  follow: boolean;
}

export async function getNotificationSettings(): Promise<NotificationSettingsDTO> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_settings")
    .select("version_update, same_cert, follow")
    .maybeSingle();
  return {
    versionUpdate: data?.version_update ?? true,
    sameCert: data?.same_cert ?? true,
    follow: data?.follow ?? true,
  };
}

export interface ProfileDTO {
  nickname: string;
  handle: string;
  bio: string;
  jobCodes: string[];
  createdAt: string;
}

export async function getMyProfile(viewer: Viewer): Promise<ProfileDTO | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("nickname, handle, bio, job_codes, created_at")
    .eq("id", viewer.id)
    .maybeSingle();
  if (!data) return null;
  return {
    nickname: data.nickname,
    handle: data.handle,
    bio: data.bio ?? "",
    jobCodes: data.job_codes ?? [],
    createdAt: data.created_at,
  };
}

export interface LoginMethodDTO {
  provider: "google" | "kakao" | "naver" | "email" | string;
  email: string | null;
  /** Supabase identity id for unlinking (null for methods we track outside identities, e.g. Naver). */
  identityId: string | null;
}

/** ACC-01: how the viewer can log in (verified user from the auth server, never the cookie alone). */
export async function getMyLoginMethods(): Promise<LoginMethodDTO[]> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return [];
  const methods: LoginMethodDTO[] = (user.identities ?? []).map((i) => ({
    provider: i.provider === "custom:kakao" ? "kakao" : i.provider,
    email: (i.identity_data?.email as string | undefined) ?? null,
    identityId: i.identity_id ?? i.id ?? null,
  }));
  const meta = (user.app_metadata ?? {}) as { naver_id?: unknown };
  if (typeof meta.naver_id === "string") {
    // Naver signs in through a placeholder email identity (W1 spike): show Naver, not that address,
    // and never offer to unlink it.
    const rest = methods.filter((m) => m.provider !== "email");
    return [{ provider: "naver", email: null, identityId: null }, ...rest];
  }
  return methods;
}

export interface MySummaryDTO {
  received: number;
  likes: number;
  following: number;
  sameCerts: number;
  updates: number;
  unread: number;
  myRecipes: number;
}

/** MY-02 tiles and MY-07 badges. */
export async function getMySummary(viewer: Viewer): Promise<MySummaryDTO> {
  const supabase = await createClient();
  const count = (q: PromiseLike<{ count: number | null }>) =>
    q.then((r) => r.count ?? 0);
  const [received, likes, following, sameCerts, unread, myRecipes, library] =
    await Promise.all([
      count(
        supabase
          .from("entitlements")
          .select("id", { count: "exact", head: true })
          .eq("user_id", viewer.id)
          .is("revoked_at", null),
      ),
      count(
        supabase
          .from("recipe_likes")
          .select("recipe_id", { count: "exact", head: true })
          .eq("user_id", viewer.id),
      ),
      count(
        supabase
          .from("follows")
          .select("followee_id", { count: "exact", head: true })
          .eq("follower_id", viewer.id),
      ),
      count(
        supabase
          .from("gallery_posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", viewer.id)
          .eq("kind", "same_cert"),
      ),
      supabase
        .rpc("unread_notification_count")
        .then((r) => (typeof r.data === "number" ? r.data : 0)),
      count(
        supabase
          .from("recipes")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", viewer.id),
      ),
      supabase
        .rpc("my_library")
        .then((r) =>
          Array.isArray(r.data)
            ? (r.data as { update_available?: boolean }[])
            : [],
        ),
    ]);
  return {
    received,
    likes,
    following,
    sameCerts,
    unread,
    myRecipes,
    updates: library.filter((x) => x.update_available).length,
  };
}

// ---------------------------------------------------------------- ACTV (F6-4)

export interface MySamePostDTO {
  id: string;
  title: string;
  status: string;
  media: string | null;
  recipe: string;
  recipeHref: string;
  createdAt: string;
}

export interface FollowingDTO {
  id: string;
  nickname: string;
  handle: string;
}

export interface MyReportDTO {
  id: string;
  targetType: string;
  reason: string;
  status: string;
  answer: string | null;
  createdAt: string;
}

export async function getMyActivity(viewer: Viewer) {
  const supabase = await createClient();
  const [posts, follows, reports] = await Promise.all([
    supabase
      .from("gallery_posts")
      .select("id, title, status, created_at, recipe_id, media_id")
      .eq("author_id", viewer.id)
      .eq("kind", "same_cert")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", viewer.id)
      .limit(200),
    supabase
      .from("reports")
      .select("id, target_type, reason, status, answer, created_at")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);
  const recipeIds = [...new Set((posts.data ?? []).map((p) => p.recipe_id))];
  const mediaIds = (posts.data ?? [])
    .map((p) => p.media_id)
    .filter((m): m is string => Boolean(m));
  const followeeIds = (follows.data ?? []).map((f) => f.followee_id);
  const [recipes, media, people] = await Promise.all([
    recipeIds.length
      ? supabase
          .from("recipes")
          .select("id, title, public_id")
          .in("id", recipeIds)
      : Promise.resolve({
          data: [] as { id: string; title: string; public_id: string }[],
        }),
    mediaIds.length
      ? supabase
          .from("media_assets")
          .select("id, storage_path")
          .in("id", mediaIds)
      : Promise.resolve({ data: [] as { id: string; storage_path: string }[] }),
    followeeIds.length
      ? supabase
          .from("profiles")
          .select("id, nickname, handle")
          .in("id", followeeIds)
      : Promise.resolve({
          data: [] as { id: string; nickname: string; handle: string }[],
        }),
  ]);
  const recipeOf = new Map((recipes.data ?? []).map((r) => [r.id, r]));
  const pathOf = new Map((media.data ?? []).map((m) => [m.id, m.storage_path]));
  return {
    posts: (posts.data ?? []).map((p): MySamePostDTO => ({
      id: p.id,
      title: p.title,
      status: p.status,
      media:
        p.media_id && p.status === "visible"
          ? mediaUrl(pathOf.get(p.media_id))
          : null,
      recipe: recipeOf.get(p.recipe_id)?.title ?? "",
      recipeHref: recipeOf.get(p.recipe_id)
        ? recipeHref(recipeOf.get(p.recipe_id)!.public_id)
        : "/gallery",
      createdAt: p.created_at,
    })),
    following: (people.data ?? []).map((p): FollowingDTO => ({
      id: p.id,
      nickname: p.nickname,
      handle: p.handle,
    })),
    reports: (reports.data ?? []).map((r): MyReportDTO => ({
      id: r.id,
      targetType: r.target_type,
      reason: r.reason,
      status: r.status,
      answer: r.answer,
      createdAt: r.created_at,
    })),
  };
}
