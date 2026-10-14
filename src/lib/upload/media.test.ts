import { describe, expect, it } from "vitest";
import { isOwnMediaPath, mediaUrl, nearestRatio, sniffMatches } from "./media";

const OWNER = "00000000-0000-0000-0000-000000000001";
const FILE = "0f0e0d0c-0b0a-4908-8706-050403020100";
const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? Array.from(x, (c) => c.charCodeAt(0)) : [x])));

describe("UP-05 media paths", () => {
  it("accepts only server-minted paths under the owner's folder", () => {
    expect(isOwnMediaPath(`${OWNER}/${FILE}.png`, OWNER)).toBe(true);
    expect(isOwnMediaPath(`${OWNER}/${FILE}.png`, FILE)).toBe(false);
    expect(isOwnMediaPath(`${OWNER}/../${FILE}.png`, OWNER)).toBe(false);
    expect(isOwnMediaPath(`${OWNER}/${FILE}.svg`, OWNER)).toBe(false);
    expect(isOwnMediaPath(`seed/linkedin.png`, OWNER)).toBe(false);
  });

  it("mediaUrl builds the public URL and ignores seed placeholders", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321/";
    expect(mediaUrl(`${OWNER}/${FILE}.png`)).toBe(
      `http://127.0.0.1:54321/storage/v1/object/public/recipe-media/${OWNER}/${FILE}.png`,
    );
    expect(mediaUrl("seed/linkedin.png")).toBeNull();
    expect(mediaUrl(null)).toBeNull();
  });

  it("nearestRatio snaps to the allowed ratios", () => {
    expect(nearestRatio(1080, 1920)).toBe("9/16");
    expect(nearestRatio(1024, 1024)).toBe("1/1");
    expect(nearestRatio(1200, 900)).toBe("4/3");
    expect(nearestRatio(0, 0)).toBe("1/1");
  });

  it("sniffMatches checks magic bytes against the declared type", () => {
    expect(sniffMatches("image/png", bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toBe(true);
    expect(sniffMatches("image/png", bytes("<html>"))).toBe(false);
    expect(sniffMatches("image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(sniffMatches("image/webp", bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe(true);
    expect(sniffMatches("video/mp4", bytes(0, 0, 0, 0x18, "ftypisom"))).toBe(true);
    expect(sniffMatches("video/webm", bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe(true);
    expect(sniffMatches("image/gif", bytes("GIF89a"))).toBe(true);
  });
});
