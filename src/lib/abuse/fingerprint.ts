// D13 request fingerprints: HMAC (server secret) of the client IP and of a first-party device cookie.
// Raw values are never stored. Loopback (local dev / e2e) has no IP key so rate limits stay usable.
import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";

const DEVICE_COOKIE = "sp_did";
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Client IP from the platform proxy headers. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  // Vercel sets x-vercel-forwarded-for / x-real-ip itself. A client-sent x-forwarded-for is trusted
  // only off Vercel (local dev / CI), where nothing else is available.
  const platform =
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    null;
  if (platform || process.env.VERCEL) return platform;
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

/** HMAC of the IP for a purpose ("share-visitor", "ip"); null on loopback or unknown. */
export async function ipHash(
  secret: string,
  purpose = "ip",
): Promise<string | null> {
  const ip = await clientIp();
  if (!ip || LOOPBACK.has(ip)) return null;
  return hmac(secret, `${purpose}:${ip}`);
}

/** HMAC of a long-lived first-party device id; mints the cookie on first use (server action / route only). */
export async function deviceHash(secret: string): Promise<string> {
  const jar = await cookies();
  let id = jar.get(DEVICE_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = randomUUID();
    jar.set(DEVICE_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
    });
  }
  return hmac(secret, `device:${id}`);
}
