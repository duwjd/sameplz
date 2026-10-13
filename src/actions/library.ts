"use server";
import { z } from "zod";
import { openOriginal as readOriginal, type OriginalDTO } from "@/data/secrets";
import { getViewer } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";

const EntitlementInput = z.object({ entitlementId: z.guid() });

export type OpenResult =
  | { ok: true; original: OriginalDTO }
  | { ok: false; reason: "LOGIN_REQUIRED" | "NOT_FOUND" };

/** LIB-03 「원문 열기」: zod → claims → open_original (ownership in SQL). Never cached or logged. */
export async function openOriginal(input: {
  entitlementId: string;
}): Promise<OpenResult> {
  const parsed = EntitlementInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "NOT_FOUND" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "LOGIN_REQUIRED" };
  const original = await readOriginal(viewer, parsed.data.entitlementId);
  return original ? { ok: true, original } : { ok: false, reason: "NOT_FOUND" };
}

export type UpdateResult =
  | { ok: true; updated: boolean }
  | { ok: false; reason: "LOGIN_REQUIRED" | "NOT_FOUND" };

/** LIB-01 / F3-8: move this one entitlement to the latest version (history kept in SQL). */
export async function applyUpdate(input: {
  entitlementId: string;
}): Promise<UpdateResult> {
  const parsed = EntitlementInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "NOT_FOUND" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "LOGIN_REQUIRED" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_update", {
    p_entitlement_id: parsed.data.entitlementId,
  });
  if (error) return { ok: false, reason: "NOT_FOUND" };
  return {
    ok: true,
    updated: Boolean((data as { updated?: boolean })?.updated),
  };
}
