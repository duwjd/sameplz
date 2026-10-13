// F7-1: what the user was doing when login was required. Saved before the OAuth redirect,
// replayed once after login, cleared on close (cancel). sessionStorage: per tab, gone on close.
import { safeNext } from "./next-path";

export type IntentAction = { type: "follow"; handle: string };
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
    const action =
      v.action &&
      v.action.type === "follow" &&
      /^[a-z0-9_]{3,15}$/.test(v.action.handle ?? "")
        ? { type: "follow" as const, handle: v.action.handle }
        : undefined;
    return { next: safeNext(v.next), action };
  } catch {
    s.removeItem(KEY);
    return null;
  }
}

export function clearIntent(storage?: StorageLike) {
  store(storage)?.removeItem(KEY);
}
