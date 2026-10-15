import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { markAiGenerated } from "./mark";

const plain = (w: number, h: number, format: "png" | "jpeg" | "webp") =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } })
    [format]()
    .toBuffer();

async function pixel(buf: Uint8Array, x: number, y: number) {
  const { data, info } = await sharp(buf)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

describe("F4-9 visible mark on face-reference results", () => {
  it("F4-9 keeps size and format and darkens the bottom-right corner only", async () => {
    const src = await plain(512, 512, "png");
    const out = await markAiGenerated(src, "image/png");
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([512, 512, "png"]);
    const corner = await pixel(out, 512 - 12, 512 - 12);
    expect(corner[0]).toBeLessThan(200); // inside the dark box
    expect(await pixel(out, 10, 10)).toEqual([255, 255, 255]); // untouched elsewhere
  });

  it("F4-9 JPEG and WEBP stay in their format", async () => {
    for (const f of ["jpeg", "webp"] as const) {
      const out = await markAiGenerated(
        await plain(300, 200, f),
        f === "jpeg" ? "image/jpeg" : "image/webp",
      );
      expect((await sharp(out).metadata()).format).toBe(f);
    }
  });

  it("F4-9 undecodable bytes throw (the cell fails instead of keeping an unmarked file)", async () => {
    await expect(
      markAiGenerated(new Uint8Array([1, 2, 3]), "image/png"),
    ).rejects.toThrow();
  });
});
