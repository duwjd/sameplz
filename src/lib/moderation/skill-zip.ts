// F5-5 skill package checks. The zip is parsed here (central directory + local headers, cross-checked),
// every entry is inflated with a hard size bound and a CRC check, and buyers get a zip REBUILT from
// the entries that passed — never the uploaded bytes, so anything the checks skipped cannot ship.
import { Inflate, strFromU8, zipSync, type Zippable } from "fflate";
import { MAX_SKILL_ZIP_BYTES } from "@/lib/validation/upload";

export const SKILL_ERRORS = {
  ZIP_INVALID: "zip 파일을 열 수 없어요. 다시 압축해 주세요.",
  ZIP_TOO_LARGE:
    "zip이 너무 커요. 파일 200개, 풀었을 때 20MB까지 올릴 수 있어요.",
  ZIP_ENCRYPTED: "암호가 걸린 zip은 올릴 수 없어요.",
  ZIP_LAYOUT: "zip 안에는 스킬 이름과 같은 폴더 하나만 있어야 해요.",
  ZIP_NESTED: "zip 안에 다른 압축 파일을 넣을 수 없어요.",
  EXECUTABLE: "실행 파일은 넣을 수 없어요.",
  SYMLINK_OUTSIDE: "폴더 밖을 가리키는 링크는 넣을 수 없어요.",
  SYMLINK: "링크(심볼릭 링크)는 넣을 수 없어요. 실제 파일로 바꿔 주세요.",
  SKILL_MD_MISSING: "폴더 안에 SKILL.md가 없어요.",
  NAME_MISMATCH: "폴더 이름과 SKILL.md의 name이 같아야 해요.",
  FRONTMATTER_INVALID:
    "SKILL.md 맨 위에 name(소문자·숫자·하이픈 64자 이하)과 description(1,024자 이하)을 적어 주세요.",
} as const;
export type SkillError = keyof typeof SKILL_ERRORS;

export type SkillMdInspection =
  | { ok: false; code: SkillError; message: string }
  | {
      ok: true;
      name: string;
      description: string;
      hasScripts: boolean;
      sha256: string;
    };

export type SkillZipInspection =
  | { ok: false; code: SkillError; message: string }
  | {
      ok: true;
      name: string;
      description: string;
      skillMd: string;
      hasScripts: boolean;
      /** content_sha256 of `rebuilt`. */
      sha256: string;
      /** The zip buyers receive: only checked entries, no junk, no links. */
      rebuilt: Uint8Array;
      /** A text entry was too large to check → the version goes to human review. */
      unscanned: boolean;
      /** Text entries for the layer 1 / layer 2 checks. */
      texts: { path: string; text: string }[];
      files: { path: string; size: number }[];
    };

const MAX_ENTRIES = 200;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_BYTES = 256 * 1024;

const NESTED_EXT = /\.(zip|jar|war|apk|7z|rar|tar|gz|tgz|bz2|xz|zst)$/i;
const EXEC_EXT =
  /\.(exe|dll|so|dylib|bin|msi|com|scr|app|dmg|deb|rpm|class|o|elf|wasm)$/i;
const SCRIPT_EXT =
  /\.(sh|bash|zsh|fish|py|js|mjs|cjs|ts|ps1|psm1|rb|pl|php|bat|cmd|lua)$/i;

const fail = (code: SkillError) => ({
  ok: false as const,
  code,
  message: SKILL_ERRORS[code],
});

async function sha256Hex(data: Uint8Array | string) {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// ---------------------------------------------------------------- SKILL.md

function frontmatter(md: string): Record<string, string> | null {
  const m = md
    .replace(/^﻿/, "")
    .match(/^---\r?\n([\s\S]*?)\r?\n---\s*(\r?\n|$)/);
  if (!m) return null;
  const out: Record<string, string> = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value === "|" || value === ">" || value === "|-" || value === ">-") {
      const block: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1]))
        block.push(lines[++i].trim());
      value = block.join(value.startsWith("|") ? "\n" : " ");
    }
    out[kv[1]] = value.replace(/^(["'])([\s\S]*)\1$/, "$2");
  }
  return out;
}

const SHELL_IN_PROSE = [
  /```\s*(bash|sh|shell|zsh|console|terminal|powershell|ps1|cmd|bat)\b/i,
  /^\s*[$>]\s+\S/m,
  /`[^`\n]*\b(chmod|chown|sudo|rm\s+-|npm\s+(i|install|exec)|npx|pnpm\s+(add|install|dlx)|yarn\s+add|pip3?\s+install|brew\s+install|apt(-get)?\s+install|curl|wget|bash|zsh|python3?\s+\S|node\s+\S|powershell)\b[^`\n]*`/i,
];

export async function inspectSkillMd(md: string): Promise<SkillMdInspection> {
  const fm = frontmatter(md);
  const name = fm?.name?.trim() ?? "";
  const description = fm?.description?.trim() ?? "";
  if (
    !fm ||
    name.length < 1 ||
    name.length > 64 ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) ||
    description.length < 1 ||
    description.length > 1024
  )
    return fail("FRONTMATTER_INVALID");
  return {
    ok: true,
    name,
    description,
    hasScripts: SHELL_IN_PROSE.some((re) => re.test(md)),
    sha256: await sha256Hex(md),
  };
}

// ---------------------------------------------------------------- zip

interface CentralEntry {
  name: string;
  nameBytes: Uint8Array;
  flags: number;
  method: number;
  crc: number;
  compSize: number;
  size: number;
  localOffset: number;
  symlink: boolean;
  exec: boolean;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** Central directory entries, or null for anything ambiguous (zip64, multi-disk, count mismatch). */
function readCentralDirectory(bytes: Uint8Array): CentralEntry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  if (eocd >= 20 && view.getUint32(eocd - 20, true) === 0x07064b50) return null; // zip64 locator
  if (
    view.getUint16(eocd + 4, true) !== 0 ||
    view.getUint16(eocd + 6, true) !== 0
  )
    return null; // multi-disk
  const diskCount = view.getUint16(eocd + 8, true);
  const count = view.getUint16(eocd + 10, true);
  const offset = view.getUint32(eocd + 16, true);
  if (diskCount !== count || count === 0xffff || offset === 0xffffffff)
    return null;
  const entries: CentralEntry[] = [];
  let p = offset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > eocd || view.getUint32(p, true) !== 0x02014b50) return null;
    const madeByOs = view.getUint16(p + 4, true) >> 8;
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const attrs = view.getUint32(p + 38, true);
    if (p + 46 + nameLen > eocd) return null;
    const nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
    const mode = attrs >>> 16;
    entries.push({
      name: strFromU8(nameBytes),
      nameBytes,
      flags: view.getUint16(p + 8, true),
      method: view.getUint16(p + 10, true),
      crc: view.getUint32(p + 16, true),
      compSize: view.getUint32(p + 20, true),
      size: view.getUint32(p + 24, true),
      localOffset: view.getUint32(p + 42, true),
      symlink: madeByOs === 3 && (mode & 0o170000) === 0o120000,
      exec:
        madeByOs === 3 &&
        (mode & 0o170000) === 0o100000 &&
        (mode & 0o111) !== 0,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** One entry's bytes: local header must agree with the central one; inflate stops past the declared size. */
function extract(bytes: Uint8Array, e: CentralEntry): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lo = e.localOffset;
  if (lo + 30 > bytes.length || view.getUint32(lo, true) !== 0x04034b50)
    return null;
  if (
    (view.getUint16(lo + 6, true) & 1) !== (e.flags & 1) ||
    view.getUint16(lo + 8, true) !== e.method
  )
    return null;
  const nameLen = view.getUint16(lo + 26, true);
  const extraLen = view.getUint16(lo + 28, true);
  if (!sameBytes(bytes.subarray(lo + 30, lo + 30 + nameLen), e.nameBytes))
    return null;
  const start = lo + 30 + nameLen + extraLen;
  if (start + e.compSize > bytes.length) return null;
  const comp = bytes.subarray(start, start + e.compSize);

  let data: Uint8Array;
  if (e.method === 0) {
    if (e.compSize !== e.size) return null;
    data = comp;
  } else if (e.method === 8) {
    const out = new Uint8Array(e.size);
    let total = 0;
    try {
      const inf = new Inflate((chunk) => {
        if (total + chunk.length > e.size) throw new Error("over");
        out.set(chunk, total);
        total += chunk.length;
      });
      const STEP = 16 * 1024;
      if (comp.length === 0) inf.push(comp, true);
      for (let i = 0; i < comp.length; i += STEP)
        inf.push(comp.subarray(i, i + STEP), i + STEP >= comp.length);
    } catch {
      return null;
    }
    if (total !== e.size) return null;
    data = out;
  } else return null;
  return crc32(data) === e.crc ? data : null;
}

const isJunk = (name: string) =>
  name.startsWith("__MACOSX/") || /(^|\/)\.DS_Store$/.test(name);

function startsWith(data: Uint8Array, sig: number[]) {
  return sig.every((b, i) => data[i] === b);
}
const EXEC_MAGIC = [
  [0x4d, 0x5a], // PE "MZ"
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0xfe, 0xed, 0xfa, 0xce],
  [0xfe, 0xed, 0xfa, 0xcf],
  [0xce, 0xfa, 0xed, 0xfe],
  [0xcf, 0xfa, 0xed, 0xfe],
  [0xca, 0xfe, 0xba, 0xbe], // Mach-O / fat
  [0x00, 0x61, 0x73, 0x6d], // wasm
];

/** Symlink target stays inside `root/` once resolved from the link's own folder. */
function insideRoot(linkPath: string, target: string) {
  if (
    target.startsWith("/") ||
    target.includes("\\") ||
    /^[A-Za-z]:/.test(target)
  )
    return false;
  const parts = linkPath.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      parts.pop();
      if (parts.length < 1) return false;
    } else parts.push(seg);
  }
  return parts.length >= 1;
}

const utf8 = new TextDecoder("utf-8", { fatal: true });
function asText(data: Uint8Array): string | null {
  try {
    return utf8.decode(data);
  } catch {
    return null;
  }
}

export async function inspectSkillZip(
  bytes: Uint8Array,
): Promise<SkillZipInspection> {
  if (bytes.byteLength > MAX_SKILL_ZIP_BYTES) return fail("ZIP_TOO_LARGE");
  const central = readCentralDirectory(bytes);
  if (!central || central.length === 0) return fail("ZIP_INVALID");
  if (central.some((e) => e.flags & 1)) return fail("ZIP_ENCRYPTED");
  // Junk is dropped outright: never inflated, never checked, never rebuilt into the sold zip.
  const entries = central.filter((e) => !isJunk(e.name));
  if (entries.length > MAX_ENTRIES) return fail("ZIP_TOO_LARGE");
  if (entries.reduce((s, e) => s + e.size, 0) > MAX_TOTAL_BYTES)
    return fail("ZIP_TOO_LARGE");

  // Layout: one top folder, no absolute / traversal / backslash / hidden-character / duplicate names.
  const roots = new Set<string>();
  const seen = new Set<string>();
  for (const e of entries) {
    const segs = e.name.replace(/\/$/, "").split("/");
    const key = e.name.replace(/\/$/, "").toLowerCase();
    if (
      e.name.startsWith("/") ||
      e.name.includes("\\") ||
      segs.some((s) => s === "" || s === "." || s === "..") ||
      /[\p{Cc}\p{Cf}]/u.test(e.name) ||
      seen.has(key)
    )
      return fail("ZIP_LAYOUT");
    seen.add(key);
    if (segs.length < 2 && !e.name.endsWith("/")) return fail("ZIP_LAYOUT");
    roots.add(segs[0]);
  }
  if (roots.size !== 1) return fail("ZIP_LAYOUT");
  const root = [...roots][0];

  let hasScripts = false;
  let unscanned = false;
  const kept: Zippable = {};
  const texts: { path: string; text: string }[] = [];
  const listed: { path: string; size: number }[] = [];
  for (const e of [...entries].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name.endsWith("/")) continue;
    const data = extract(bytes, e);
    if (!data) return fail("ZIP_INVALID");
    if (e.symlink)
      return fail(
        insideRoot(e.name, strFromU8(data)) ? "SYMLINK" : "SYMLINK_OUTSIDE",
      );
    if (NESTED_EXT.test(e.name) || startsWith(data, [0x50, 0x4b, 0x03, 0x04]))
      return fail("ZIP_NESTED");
    if (
      EXEC_EXT.test(e.name) ||
      EXEC_MAGIC.some((sig) => startsWith(data, sig))
    )
      return fail("EXECUTABLE");
    if (
      e.name.startsWith(`${root}/scripts/`) ||
      SCRIPT_EXT.test(e.name) ||
      e.exec ||
      startsWith(data, [0x23, 0x21]) // "#!"
    )
      hasScripts = true;
    // Every UTF-8 file is checked whatever its extension; too large to check → human review.
    const text = asText(data);
    if (text !== null) {
      if (data.byteLength <= MAX_TEXT_BYTES) texts.push({ path: e.name, text });
      else unscanned = true;
    }
    kept[e.name] = data;
    listed.push({ path: e.name, size: data.byteLength });
  }

  const skillMdBytes = kept[`${root}/SKILL.md`] as Uint8Array | undefined;
  if (!skillMdBytes) return fail("SKILL_MD_MISSING");
  const skillMd = new TextDecoder().decode(skillMdBytes);
  const md = await inspectSkillMd(skillMd);
  if (!md.ok) return md;
  if (md.name !== root) return fail("NAME_MISMATCH");

  const rebuilt = zipSync(kept, {
    level: 6,
    mtime: new Date("2026-01-01T00:00:00Z"),
  });
  return {
    ok: true,
    name: md.name,
    description: md.description,
    skillMd,
    hasScripts: hasScripts || md.hasScripts,
    sha256: await sha256Hex(rebuilt),
    rebuilt,
    unscanned,
    texts,
    files: listed,
  };
}
