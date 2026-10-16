import "server-only";
import { hasSupabaseEnv } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export interface LibraryRowDTO {
  entitlementId: string;
  publicId: string;
  title: string;
  category: "prompt" | "agent" | "skill";
  promptKind: "image" | "video" | "text" | null;
  status: string;
  creatorNickname: string;
  versionId: string;
  versionNo: number;
  latestVersionNo: number | null;
  latestChangelog: string | null;
  updateAvailable: boolean;
  openedAt: string | null;
  claimedAt: string;
  files: { id: string; name: string; size: number }[];
}

/** LIB: the viewer's received recipes (dynamic, per user — never "use cache"). */
export async function getMyLibrary(): Promise<LibraryRowDTO[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_library");
  if (error) {
    console.error("[library] my_library failed", error.code);
    return [];
  }
  return data.map((r) => ({
    entitlementId: r.entitlement_id,
    publicId: r.public_id,
    title: r.title,
    category: r.category as LibraryRowDTO["category"],
    promptKind: (r.prompt_kind ?? null) as LibraryRowDTO["promptKind"],
    status: r.status,
    creatorNickname: r.creator_nickname,
    versionId: r.version_id,
    versionNo: r.version_no,
    latestVersionNo: r.latest_version_no ?? null,
    latestChangelog: r.latest_changelog ?? null,
    updateAvailable: r.update_available,
    openedAt: r.opened_at ?? null,
    claimedAt: r.claimed_at,
    // F8-3: a taken-down recipe's files are not offered (the download is refused anyway).
    files:
      r.status !== "taken_down" && Array.isArray(r.files)
        ? (r.files as { id: string; name: string; size: number }[])
        : [],
  }));
}
