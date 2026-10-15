import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sweep } from "@/data/play";

const digest = (v: string) => createHash("sha256").update(v).digest();

/** Bearer CRON_SECRET, compared in constant time. No secret configured = closed. */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}

/**
 * Scheduled jobs. `play-sweeper` is called each minute by pg_cron + pg_net (Supabase Vault holds
 * the URL and secret). Every cell is finished / resubmitted / polled in its own call.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/cron/[job]">,
) {
  const { job } = await ctx.params;
  if (!authorized(request))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (job !== "play-sweeper")
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const report = await sweep();
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[cron] play-sweeper failed", e instanceof Error ? e.name : "error");
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
