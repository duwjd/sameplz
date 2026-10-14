// recipe-media paths and public URLs (shared by the wizard preview and the detail page).
import { RATIOS } from "@/lib/validation/upload";

export const MEDIA_BUCKET = "recipe-media";

export const MEDIA_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
} as const;
export type MediaMime = keyof typeof MEDIA_MIME;

export const isMediaMime = (m: unknown): m is MediaMime =>
  typeof m === "string" && Object.hasOwn(MEDIA_MIME, m);
export const mediaKindOf = (m: MediaMime) =>
  m.startsWith("video/") ? "video" : "image";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MEDIA_PATH = new RegExp(
  `^(${UUID})/${UUID}\\.(png|jpg|webp|gif|mp4|webm)$`,
);

/** `{owner}/{uuid}.{ext}` minted by the server for this owner. */
export function isOwnMediaPath(path: string, ownerId: string) {
  const m = MEDIA_PATH.exec(path);
  return Boolean(m && m[1] === ownerId);
}

/** The stored type matches the extension the server minted for this path. */
export function extMatchesMime(path: string, mime: MediaMime) {
  return path.endsWith(`.${MEDIA_MIME[mime]}`);
}

/** Public URL for a stored path; null for seed placeholders or paths we did not mint. */
export function mediaUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path || !MEDIA_PATH.test(path)) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** Closest allowed aspect ratio for an uploaded result. */
export function nearestRatio(
  width: number,
  height: number,
): (typeof RATIOS)[number] {
  if (!(width > 0 && height > 0)) return "1/1";
  const r = width / height;
  let best: (typeof RATIOS)[number] = "1/1";
  let diff = Infinity;
  for (const ratio of RATIOS) {
    const [w, h] = ratio.split("/").map(Number);
    const d = Math.abs(Math.log(r / (w / h)));
    if (d < diff) [best, diff] = [ratio, d];
  }
  return best;
}

/** True when the first bytes match the declared type (Storage only checks the declared MIME). */
export function sniffMatches(mime: MediaMime, head: Uint8Array): boolean {
  const at = (offset: number, sig: number[]) =>
    sig.every((b, i) => head[offset + i] === b);
  const ascii = (offset: number, s: string) =>
    at(
      offset,
      Array.from(s, (c) => c.charCodeAt(0)),
    );
  switch (mime) {
    case "image/png":
      return at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return at(0, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return ascii(0, "GIF87a") || ascii(0, "GIF89a");
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "video/mp4":
      return ascii(4, "ftyp");
    case "video/webm":
      return at(0, [0x1a, 0x45, 0xdf, 0xa3]);
  }
}
