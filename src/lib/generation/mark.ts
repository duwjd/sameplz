// F4-9: visible mark on results made from face references. Drawn with plain shapes (a pixel "AI"
// in a dark box, bottom-right), so it renders the same on servers without fonts. Other results keep
// the provider bytes untouched (C2PA / SynthID survive).
import "server-only";
import sharp from "sharp";

const GLYPHS: Record<"A" | "I", string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
};

function markSvg(width: number, height: number): Buffer {
  const s = Math.max(2, Math.round(Math.min(width, height) / 120)); // pixel size
  const pad = 2 * s;
  const glyphW = (GLYPHS.A[0].length + 1 + GLYPHS.I[0].length) * s;
  const boxW = glyphW + 2 * pad;
  const boxH = 7 * s + 2 * pad;
  const x0 = Math.max(0, width - boxW - 2 * s);
  const y0 = Math.max(0, height - boxH - 2 * s);
  const rects: string[] = [];
  let gx = x0 + pad;
  for (const letter of ["A", "I"] as const) {
    GLYPHS[letter].forEach((row, r) =>
      [...row].forEach((c, col) => {
        if (c === "#")
          rects.push(
            `<rect x="${gx + col * s}" y="${y0 + pad + r * s}" width="${s}" height="${s}" fill="#fff"/>`,
          );
      }),
    );
    gx += (GLYPHS[letter][0].length + 1) * s;
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect x="${x0}" y="${y0}" width="${boxW}" height="${boxH}" rx="${s}" fill="#000" fill-opacity="0.62"/>` +
      rects.join("") +
      `</svg>`,
  );
}

export type MarkableMime = "image/png" | "image/jpeg" | "image/webp";
export const isMarkable = (m: string): m is MarkableMime =>
  m === "image/png" || m === "image/jpeg" || m === "image/webp";

/** Same size and format, with the mark composited. Throws on undecodable input (caller fails the cell). */
export async function markAiGenerated(
  bytes: Uint8Array,
  mime: MarkableMime,
): Promise<Uint8Array> {
  const img = sharp(bytes, { failOn: "error" });
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error("mark: no size");
  const out = img.composite([
    { input: markSvg(meta.width, meta.height), top: 0, left: 0 },
  ]);
  const encoded =
    mime === "image/png"
      ? out.png()
      : mime === "image/jpeg"
        ? out.jpeg({ quality: 92 })
        : out.webp({ quality: 92 });
  return new Uint8Array(await encoded.toBuffer());
}
