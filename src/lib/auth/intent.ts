// F7-1: what the user was doing when login was required. Saved before the OAuth redirect,
// replayed once after login, cleared on close (cancel). sessionStorage: per tab, gone on close.
import { safeNext } from "./next-path";

export type IntentAction =
  | { type: "follow"; handle: string }
  | { type: "claim"; recipeId: string; publicId: string };
export interface LoginIntent {
  next: string;
  action?: IntentAction;
}

const KEY = "sp_login_intent";
const MAX_AGE_MS = 30 * 60 * 1000;

interface Stored extends LoginIntent {
  savedAt: number;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveIntent(
  intent: LoginIntent,
  storage?: StorageLike,
  now = Date.now(),
) {
  const s = store(storage);
  if (!s) return;
  const value: Stored = {
    next: safeNext(intent.next),
    action: intent.action,
    savedAt: now,
  };
  s.setItem(KEY, JSON.stringify(value));
}

export function readIntent(
  storage?: StorageLike,
  now = Date.now(),
): LoginIntent | null {
  const s = store(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    if (
      typeof v.savedAt !== "number" ||
      now - v.savedAt > MAX_AGE_MS ||
      typeof v.next !== "string"
    ) {
      s.removeItem(KEY);
      return null;
    }
    return { next: safeNext(v.next), action: parseAction(v.action) };
  } catch {
    s.removeItem(KEY);
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Stored JSON is untrusted: keep only well-formed actions. */
function parseAction(a: unknown): IntentAction | undefined {
  if (!a || typeof a !== "object") return undefined;
  const v = a as Record<string, unknown>;
  if (
    v.type === "follow" &&
    typeof v.handle === "string" &&
    /^[a-z0-9_]{3,15}$/.test(v.handle)
  )
    return { type: "follow", handle: v.handle };
  if (
    v.type === "claim" &&
    typeof v.recipeId === "string" &&
    UUID.test(v.recipeId) &&
    typeof v.publicId === "string" &&
    /^[a-z0-9]{6,16}$/.test(v.publicId)
  )
    return { type: "claim", recipeId: v.recipeId, publicId: v.publicId };
  return undefined;
}

export function clearIntent(storage?: StorageLike) {
  store(storage)?.removeItem(KEY);
}
