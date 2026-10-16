// ADM review (F8-1): line diff between the last approved original and the one under review.
// Plain LCS over lines; inputs are capped so a huge original cannot stall the page.

export type DiffLine = { op: "same" | "add" | "del"; text: string };

export const DIFF_MAX_LINES = 2000;

export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before === "" ? [] : before.split("\n").slice(0, DIFF_MAX_LINES);
  const b = after === "" ? [] : after.split("\n").slice(0, DIFF_MAX_LINES);
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs: Uint16Array[] = Array.from(
    { length: n + 1 },
    () => new Uint16Array(m + 1),
  );
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1])
      out.push({ op: "del", text: a[i++] });
    else out.push({ op: "add", text: b[j++] });
  }
  while (i < n) out.push({ op: "del", text: a[i++] });
  while (j < m) out.push({ op: "add", text: b[j++] });
  return out;
}

/** Changed lines only, with `context` unchanged lines around each change. */
export function changedHunks(
  lines: DiffLine[],
  context = 2,
): (DiffLine | null)[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((l, k) => {
    if (l.op === "same") return;
    for (
      let x = Math.max(0, k - context);
      x <= Math.min(lines.length - 1, k + context);
      x++
    )
      keep[x] = true;
  });
  const out: (DiffLine | null)[] = [];
  lines.forEach((l, k) => {
    if (keep[k]) out.push(l);
    else if (out.length && out[out.length - 1] !== null) out.push(null); // gap marker
  });
  if (out[out.length - 1] === null) out.pop();
  return out;
}
