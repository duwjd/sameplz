import { strToU8, zipSync, type Zippable } from "fflate";
import { describe, expect, it } from "vitest";
import { inspectSkillMd, inspectSkillZip } from "./skill-zip";

const SKILL_MD = `---
name: tax-checklist
description: 종합소득세 신고 전에 빠진 서류를 점검해요.
---

# 세금 점검표

1. 홈택스에서 지급명세서를 내려받아요.
`;

const zip = (files: Zippable) => zipSync(files, { level: 1 });
const base = (extra: Zippable = {}) =>
  zip({ "tax-checklist/SKILL.md": strToU8(SKILL_MD), ...extra });

/** Unix symlink entry: mode 0o120777 in the high 16 bits of external attributes. */
const symlink = (target: string): Zippable[string] => [
  strToU8(target),
  { os: 3, attrs: (0o120777 << 16) >>> 0 },
];

/** Sets the "encrypted" bit (general purpose flag bit 0) on every header. */
function markEncrypted(bytes: Uint8Array) {
  const out = bytes.slice();
  const view = new DataView(out.buffer);
  for (let i = 0; i + 4 <= out.length; i++) {
    const sig = view.getUint32(i, true);
    if (sig === 0x04034b50) out[i + 6] |= 1;
    if (sig === 0x02014b50) out[i + 8] |= 1;
  }
  return out;
}

describe("F5-5 skill zip", () => {
  it("accepts one top-level folder named like the skill", async () => {
    const r = await inspectSkillZip(
      base({ "tax-checklist/reference/forms.md": strToU8("# 서식") }),
    );
    expect(r).toMatchObject({
      ok: true,
      name: "tax-checklist",
      description: "종합소득세 신고 전에 빠진 서류를 점검해요.",
      hasScripts: false,
    });
    if (!r.ok) throw new Error();
    expect(r.skillMd).toBe(SKILL_MD);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.texts.map((t) => t.path)).toEqual([
      "tax-checklist/SKILL.md",
      "tax-checklist/reference/forms.md",
    ]);
  });

  it("content_sha256 is stable for the same bytes", async () => {
    const bytes = base();
    const [a, b] = await Promise.all([
      inspectSkillZip(bytes),
      inspectSkillZip(bytes),
    ]);
    expect(a.ok && b.ok && a.sha256 === b.sha256).toBe(true);
  });

  it.each([
    ["no top folder", zip({ "SKILL.md": strToU8(SKILL_MD) }), "ZIP_LAYOUT"],
    [
      "two top folders",
      zip({
        "tax-checklist/SKILL.md": strToU8(SKILL_MD),
        "other/a.md": strToU8("x"),
      }),
      "ZIP_LAYOUT",
    ],
    [
      "folder ≠ name",
      zip({ "tax/SKILL.md": strToU8(SKILL_MD) }),
      "NAME_MISMATCH",
    ],
    [
      "missing SKILL.md",
      zip({ "tax-checklist/README.md": strToU8("x") }),
      "SKILL_MD_MISSING",
    ],
    [
      "nested zip by extension",
      base({ "tax-checklist/inner.zip": strToU8("not really") }),
      "ZIP_NESTED",
    ],
    [
      "nested zip by magic bytes",
      base({ "tax-checklist/data.bin.txt": zip({ "a.txt": strToU8("a") }) }),
      "ZIP_NESTED",
    ],
    [
      "executable by extension",
      base({ "tax-checklist/tool.exe": strToU8("x") }),
      "EXECUTABLE",
    ],
    [
      "executable by ELF magic",
      base({
        "tax-checklist/tool": new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]),
      }),
      "EXECUTABLE",
    ],
    [
      "symlink out of the root",
      base({ "tax-checklist/link": symlink("../../etc/passwd") }),
      "SYMLINK_OUTSIDE",
    ],
    [
      "absolute symlink",
      base({ "tax-checklist/link": symlink("/etc/passwd") }),
      "SYMLINK_OUTSIDE",
    ],
    ["encrypted", markEncrypted(base()), "ZIP_ENCRYPTED"],
    ["not a zip", strToU8("hello"), "ZIP_INVALID"],
  ])("rejects %s", async (_label, bytes, code) => {
    const r = await inspectSkillZip(bytes as Uint8Array);
    expect(r).toMatchObject({ ok: false, code });
  });

  it("allows a symlink that stays inside the root", async () => {
    const r = await inspectSkillZip(
      base({
        "tax-checklist/ref/forms.md": strToU8("x"),
        "tax-checklist/link": symlink("ref/forms.md"),
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("rejects path traversal entries", async () => {
    const r = await inspectSkillZip(
      base({ "tax-checklist/../evil.md": strToU8("x") }),
    );
    expect(r).toMatchObject({ ok: false, code: "ZIP_LAYOUT" });
  });

  it("flags scripts/ and script files for human review", async () => {
    const a = await inspectSkillZip(
      base({ "tax-checklist/scripts/run.py": strToU8("print(1)") }),
    );
    const b = await inspectSkillZip(
      base({ "tax-checklist/tools/fix.sh": strToU8("echo 1") }),
    );
    expect(a).toMatchObject({ ok: true, hasScripts: true });
    expect(b).toMatchObject({ ok: true, hasScripts: true });
  });

  it("rejects too many entries", async () => {
    const files: Zippable = { "tax-checklist/SKILL.md": strToU8(SKILL_MD) };
    for (let i = 0; i < 200; i++)
      files[`tax-checklist/f${i}.md`] = strToU8("x");
    expect(await inspectSkillZip(zip(files))).toMatchObject({
      ok: false,
      code: "ZIP_TOO_LARGE",
    });
  });

  it("rejects a zip whose contents inflate past the limit", async () => {
    const big = new Uint8Array(21 * 1024 * 1024);
    expect(
      await inspectSkillZip(base({ "tax-checklist/big.md": big })),
    ).toMatchObject({
      ok: false,
      code: "ZIP_TOO_LARGE",
    });
  });
});

describe("F5-5 SKILL.md frontmatter", () => {
  it("parses name and description", async () => {
    expect(await inspectSkillMd(SKILL_MD)).toMatchObject({
      ok: true,
      name: "tax-checklist",
      hasScripts: false,
    });
  });

  it.each([
    ["no frontmatter", "# 제목만"],
    ["upper-case name", SKILL_MD.replace("tax-checklist", "Tax-Checklist")],
    ["name over 64 chars", SKILL_MD.replace("tax-checklist", "a".repeat(65))],
    ["double hyphen", SKILL_MD.replace("tax-checklist", "tax--checklist")],
    ["empty description", SKILL_MD.replace(/description: .*/, "description: ")],
    [
      "description over 1,024 chars",
      SKILL_MD.replace(/description: .*/, `description: ${"가".repeat(1025)}`),
    ],
  ])("rejects %s", async (_label, md) => {
    expect(await inspectSkillMd(md)).toMatchObject({
      ok: false,
      code: "FRONTMATTER_INVALID",
    });
  });

  it.each([
    "```bash\nnpm install\n```",
    "```sh\nls\n```",
    "$ pip install requests",
    "터미널에서 `chmod +x run` 을 실행해요",
  ])("treats shell commands in prose as scripts: %s", async (snippet) => {
    expect(await inspectSkillMd(`${SKILL_MD}\n${snippet}\n`)).toMatchObject({
      ok: true,
      hasScripts: true,
    });
  });
});
