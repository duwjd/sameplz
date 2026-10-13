import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_SECONDS = 60;
const Guid = z.guid();

function notFound() {
  // Same answer for "no such file" and "not yours": never reveal which (hidden-content rule 9).
  return NextResponse.json(
    { error: "not_found" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * F3-5 / LIB-03: attachment download. Checks the caller holds exactly this version (or owns the
 * recipe) via file_for_download, then 302s to a ~60s signed URL on the private bucket.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/files/[versionId]">,
) {
  const { versionId } = await ctx.params;
  const fileId = request.nextUrl.searchParams.get("file");
  if (!Guid.safeParse(versionId).success || !Guid.safeParse(fileId).success)
    return notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return notFound();

  const { data, error } = await supabase.rpc("file_for_download", {
    p_version_id: versionId,
    p_file_id: fileId!,
  });
  const file = data?.[0];
  if (error || !file) return notFound();

  const signed = await createAdminClient()
    .storage.from("recipe-files")
    .createSignedUrl(file.storage_path, SIGNED_URL_SECONDS, {
      download: file.filename.split("/").pop() ?? "file",
    });
  if (signed.error || !signed.data?.signedUrl) {
    console.error("[files] signed url failed", signed.error?.name);
    return notFound();
  }
  return NextResponse.redirect(signed.data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
