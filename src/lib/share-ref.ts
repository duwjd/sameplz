// F2-3: the share code a visitor arrived with, kept for 30 minutes in this tab so a claim after
// login still carries it (record only in MVP). sessionStorage access can throw: always guarded.
const KEY = "sp_share_ref";
const MAX_AGE_MS = 30 * 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveShareRef(
  publicId: string,
  code: string,
  storage?: StorageLike,
  now = Date.now(),
) {
  try {
    store(storage)?.setItem(KEY, JSON.stringify({ publicId, code, at: now }));
  } catch {
    /* storage full or blocked: the ref is optional */
  }
}

/** The saved code if it was for this recipe and is fresh, else null. */
export function readShareRef(
  publicId: string,
  storage?: StorageLike,
  now = Date.now(),
): string | null {
  try {
    const raw = store(storage)?.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { publicId?: unknown; code?: unknown; at?: unknown };
    if (
      v.publicId !== publicId ||
      typeof v.code !== "string" ||
      !/^[a-z0-9]{6,12}$/.test(v.code) ||
      typeof v.at !== "number" ||
      now - v.at > MAX_AGE_MS
    )
      return null;
    return v.code;
  } catch {
    return null;
  }
}
