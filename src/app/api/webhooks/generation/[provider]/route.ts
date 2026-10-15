import { after, NextResponse, type NextRequest } from "next/server";
import { handleWebhook } from "@/data/play";

const MAX_BODY = 1024 * 1024;

/**
 * F4-4: provider callback. The raw body is verified before parsing (fal ED25519 / mock HMAC), then
 * the per-cell token from the URL. 2xx only after the cell state is stored.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/webhooks/generation/[provider]">,
) {
  const { provider } = await ctx.params;
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY)
    return NextResponse.json({ ok: false }, { status: 413 });
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 });
  const status = await handleWebhook({
    provider,
    cellId: request.nextUrl.searchParams.get("cell"),
    token: request.nextUrl.searchParams.get("t"),
    headers: request.headers,
    rawBody,
    later: (task) => after(task),
  });
  return NextResponse.json(
    { ok: status === 200 },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
