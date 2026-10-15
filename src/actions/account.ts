"use server";
// NOTI · PRF · ACC actions (F7-3~6). zod → verified claims → RPC (own rows only).
import { z } from "zod";
import { getViewer } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function member() {
  const viewer = await getViewer();
  return viewer?.signupComplete ? viewer : null;
}

// ---------------------------------------------------------------- notifications

/** NOTI-02: opening the list reads everything; the GNB count goes to 0. */
export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const viewer = await member();
  if (!viewer) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_all_notifications_read");
  return { ok: !error };
}

const SettingInput = z.object({
  kind: z.enum(["version_update", "same_cert", "follow"]),
  on: z.boolean(),
});

/** ACC-03: optional kinds only; required ones (사람 확인·판매 중지·신고 답변) always arrive. */
export async function setNotificationSetting(
  input: unknown,
): Promise<{ ok: boolean }> {
  const parsed = SettingInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const viewer = await member();
  if (!viewer) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_notification_setting", {
    p_kind: parsed.data.kind,
    p_on: parsed.data.on,
  });
  return { ok: !error && data === true };
}

// ---------------------------------------------------------------- profile (PRF, F7-4)

// `gone_…` belongs to withdrawn members (reserved in the database too).
const Handle = z
  .string()
  .regex(/^[a-z0-9_]{3,15}$/)
  .refine((h) => !h.startsWith("gone_"));
export type HandleCheck =
  "OK" | "TAKEN" | "INVALID" | "RATE_LIMITED" | "LOGIN_REQUIRED";

export async function checkHandle(input: unknown): Promise<HandleCheck> {
  const parsed = z.object({ handle: z.string().max(30) }).safeParse(input);
  if (!parsed.success) return "INVALID";
  const viewer = await member();
  if (!viewer) return "LOGIN_REQUIRED";
  const supabase = await createClient();
  const { data } = await supabase.rpc("check_handle", {
    p_handle: parsed.data.handle,
  });
  return (data as HandleCheck | null) ?? "INVALID";
}

const ProfileInput = z.object({
  nickname: z.string().trim().min(2).max(12),
  handle: Handle,
  bio: z.string().trim().max(60).default(""),
  jobCodes: z.array(z.string().max(20)).max(2).default([]),
});

export type ProfileResult =
  | { ok: true }
  | {
      ok: false;
      field?: "nickname" | "handle" | "bio" | "jobCodes";
      reason: string;
    };

/** Saved in one update (own row, column grants). The handle is checked again here (and by the unique index). */
export async function updateProfile(input: unknown): Promise<ProfileResult> {
  const parsed = ProfileInput.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] as
      "nickname" | "handle" | "bio" | "jobCodes" | undefined;
    return { ok: false, field, reason: "INVALID" };
  }
  const viewer = await member();
  if (!viewer) return { ok: false, reason: "LOGIN_REQUIRED" };
  const supabase = await createClient();
  const check = await checkHandle({ handle: parsed.data.handle });
  if (check === "TAKEN") return { ok: false, field: "handle", reason: "TAKEN" };
  if (check === "RATE_LIMITED")
    return { ok: false, field: "handle", reason: "RATE_LIMITED" };
  if (check !== "OK") return { ok: false, field: "handle", reason: "INVALID" };
  const { error } = await supabase
    .from("profiles")
    .update({
      nickname: parsed.data.nickname,
      handle: parsed.data.handle,
      bio: parsed.data.bio,
      job_codes: parsed.data.jobCodes,
    })
    .eq("id", viewer.id);
  if (error)
    return error.code === "23505"
      ? { ok: false, field: "handle", reason: "TAKEN" }
      : { ok: false, reason: "FAILED" };
  return { ok: true };
}

// ---------------------------------------------------------------- withdrawal (ACC-04, F7-6)

const WithdrawInput = z.object({
  confirm: z.literal(true),
  reason: z.string().max(200).default(""),
});

/**
 * Anonymize the profile (withdraw_account), then soft-delete the auth user so the same login starts a
 * new member, then sign out. Fails closed: nothing is deleted if the profile step refuses.
 */
export async function withdrawAccount(
  input: unknown,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parsed = WithdrawInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "CONFIRM_REQUIRED" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "LOGIN_REQUIRED" };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("withdraw_account", { p_user: viewer.id, p_reason: parsed.data.reason });
  const r = data as { ok?: boolean; reason?: string } | null;
  if (error) return { ok: false, reason: "FAILED" };
  if (!r?.ok) {
    // Retry after a failed auth step: the profile is already anonymized, finish the rest.
    const { data: p } = await admin.from("profiles").select("deleted_at").eq("id", viewer.id).maybeSingle();
    if (r?.reason !== "NOT_FOUND" || !p?.deleted_at) return { ok: false, reason: r?.reason ?? "FAILED" };
  }
  const removed = await admin.auth.admin.deleteUser(viewer.id, true);
  if (removed.error) {
    console.error("[account] auth soft delete failed", removed.error.name);
    return { ok: false, reason: "AUTH_DELETE_FAILED" };
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  // The client reloads to the guest home (every client-side session state is dropped).
  return { ok: true };
}
