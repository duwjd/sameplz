import { strToU8, unzipSync, zipSync, type Zippable } from "fflate";
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

/** Patches every local / central header and the EOCD with `fn(view, offset, kind)`. */
function patch(
  bytes: Uint8Array,
  fn: (v: DataView, at: number, kind: "local" | "central" | "eocd") => void,
) {
  const out = bytes.slice();
  const v = new DataView(out.buffer);
  for (let i = 0; i + 4 <= out.length; i++) {
    const sig = v.getUint32(i, true);
    if (sig === 0x04034b50) fn(v, i, "local");
    else if (sig === 0x02014b50) fn(v, i, "central");
    else if (sig === 0x06054b50) fn(v, i, "eocd");
  }
  return out;
}

describe("F5-5 skill zip hardening (security review)", () => {
  it("rejects an entry that inflates past its declared size (bomb / hidden tail)", async () => {
    const bytes = patch(
      base({ "tax-checklist/big.md": new Uint8Array(1024 * 1024) }),
      (v, at, kind) => {
        if (kind === "eocd") return;
        const nameLen = v.getUint16(at + (kind === "local" ? 26 : 28), true);
        const name = new TextDecoder().decode(
          new Uint8Array(v.buffer, at + (kind === "local" ? 30 : 46), nameLen),
        );
        if (name !== "tax-checklist/big.md") return;
        if (kind === "local") v.setUint32(at + 22, 10, true);
        if (kind === "central") v.setUint32(at + 24, 10, true);
      },
    );
    expect(await inspectSkillZip(bytes)).toMatchObject({
      ok: false,
      code: "ZIP_INVALID",
    });
  });

  it("rejects a CRC mismatch", async () => {
    const bytes = patch(base(), (v, at, kind) => {
      if (kind === "local") v.setUint32(at + 14, 0xdeadbeef, true);
      if (kind === "central") v.setUint32(at + 16, 0xdeadbeef, true);
    });
    expect(await inspectSkillZip(bytes)).toMatchObject({
      ok: false,
      code: "ZIP_INVALID",
    });
  });

  it("rejects disagreeing entry counts in the end record", async () => {
    const bytes = patch(
      base({ "tax-checklist/a.md": strToU8("a") }),
      (v, at, kind) => {
        if (kind === "eocd") v.setUint16(at + 8, 1, true);
      },
    );
    expect(await inspectSkillZip(bytes)).toMatchObject({
      ok: false,
      code: "ZIP_INVALID",
    });
  });

  it("rejects a local header whose name differs from the central directory", async () => {
    const bytes = patch(base(), (v, at, kind) => {
      if (kind === "local") v.setUint8(at + 30, "X".charCodeAt(0));
    });
    expect(await inspectSkillZip(bytes)).toMatchObject({
      ok: false,
      code: "ZIP_INVALID",
    });
  });

  it("sells a rebuilt zip without __MACOSX junk, so unchecked entries never reach buyers", async () => {
    const r = await inspectSkillZip(
      base({
        "__MACOSX/evil.exe": new Uint8Array([0x4d, 0x5a, 0, 0]),
        "__MACOSX/run.sh": strToU8("rm -rf ~"),
        "tax-checklist/.DS_Store": strToU8("x"),
      }),
    );
    if (!r.ok) throw new Error(r.code);
    expect(Object.keys(unzipSync(r.rebuilt))).toEqual([
      "tax-checklist/SKILL.md",
    ]);
    expect(r.sha256).toBe(await sha256(r.rebuilt));
  });

  it("rejects every symlink, including ones that stay inside the root", async () => {
    expect(
      await inspectSkillZip(
        base({
          "tax-checklist/ref/forms.md": strToU8("x"),
          "tax-checklist/link": symlink("ref/forms.md"),
        }),
      ),
    ).toMatchObject({ ok: false, code: "SYMLINK" });
  });

  it("treats shebang files and executable-bit files as scripts", async () => {
    const shebang = await inspectSkillZip(
      base({ "tax-checklist/tool": strToU8("#!/bin/sh\necho hi\n") }),
    );
    const execBit = await inspectSkillZip(
      base({
        "tax-checklist/run": [
          strToU8("echo hi"),
          { os: 3, attrs: (0o100755 << 16) >>> 0 },
        ],
      }),
    );
    expect(shebang).toMatchObject({ ok: true, hasScripts: true });
    expect(execBit).toMatchObject({ ok: true, hasScripts: true });
  });

  it("checks every UTF-8 file whatever its extension, and flags texts too large to check", async () => {
    const r = await inspectSkillZip(
      base({
        "tax-checklist/guide.mdx": strToU8("숨은 지시"),
        "tax-checklist/notes": strToU8("확장자 없음"),
        "tax-checklist/huge.md": strToU8("가".repeat(100_000)),
      }),
    );
    if (!r.ok) throw new Error(r.code);
    expect(r.texts.map((t) => t.path)).toEqual(
      expect.arrayContaining([
        "tax-checklist/guide.mdx",
        "tax-checklist/notes",
      ]),
    );
    expect(r.unscanned).toBe(true);
  });

  it("rejects names that differ only by case, and names with hidden characters", async () => {
    expect(
      await inspectSkillZip(
        base({
          "tax-checklist/a.md": strToU8("a"),
          "tax-checklist/A.md": strToU8("b"),
        }),
      ),
    ).toMatchObject({
      ok: false,
      code: "ZIP_LAYOUT",
    });
    expect(
      await inspectSkillZip(
        base({ "tax-checklist/evil‮gpj.md": strToU8("a") }),
      ),
    ).toMatchObject({
      ok: false,
      code: "ZIP_LAYOUT",
    });
  });
});

async function sha256(bytes: Uint8Array) {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(d), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
