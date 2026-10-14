// F4-7 playground moderation: run input text before the hold (omni-moderation + a Korean word list)
// and result images before they are shown. Unlike uploads there is no human queue, so an unavailable
// checker refuses the run (input) or the result (output) — never lets it through unchecked.
// Texts and provider responses are never logged.
import "server-only";
import { MODERATION_MODEL } from "./layer2";

export type PlayCheck = "pass" | "blocked" | "unavailable";

/** Obvious Korean terms omni-moderation may miss. Matched after removing spaces. */
const KO_BLOCKED = [
  "아동포르노",
  "아동음란",
  "미성년자누드",
  "미성년자나체",
  "초등학생노출",
  "중학생노출",
  "로리야동",
  "몰카유포",
  "딥페이크음란",
  "지인능욕",
];

export function koreanBlocked(text: string): boolean {
  const t = text.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  return KO_BLOCKED.some((w) => t.includes(w));
}

// Never in a production deployment: mock passes everything.
const mockMode = () =>
  process.env.MODERATION_PROVIDER === "mock" && process.env.VERCEL_ENV !== "production";

async function omni(input: unknown[]): Promise<boolean[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: MODERATION_MODEL, input }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { flagged?: unknown }[] };
    if (!Array.isArray(data.results)) return null;
    return data.results.map((r) => r?.flagged === true);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Variable values / blank prompt, before anything is held or sent. */
export async function checkRunText(texts: string[]): Promise<PlayCheck> {
  const input = texts.map((t) => t.trim()).filter(Boolean);
  if (input.length === 0) return "pass";
  if (input.some(koreanBlocked)) return "blocked";
  if (mockMode())
    return input.some((t) => t.includes("[[mock:block]]")) ? "blocked" : "pass";
  // One request; each value is capped at 500 chars (MAX_VARIABLE_CHARS) or 4,000 (blank prompt).
  const flagged = await omni(input);
  if (!flagged) return "unavailable";
  return flagged.some(Boolean) ? "blocked" : "pass";
}

/** One image (a short-lived signed URL of our stored copy). Videos rely on the provider's checks. */
export async function checkImage(signedUrl: string): Promise<PlayCheck> {
  if (mockMode()) return "pass";
  const flagged = await omni([
    { type: "image_url", image_url: { url: signedUrl } },
  ]);
  if (!flagged) return "unavailable";
  return flagged.some(Boolean) ? "blocked" : "pass";
}
