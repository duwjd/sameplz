// One-shot marker: 「라이브러리에서 열기」 was clicked for this entitlement, so the library may open
// the original on arrival. A bare /my/library?open= link (shared, forwarded) never records a first
// open by itself (security review: opened_at gates refunds in the paid phase).
const KEY = "sp_open_original";
const MAX_AGE_MS = 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function markOpenIntent(
  entitlementId: string,
  storage?: StorageLike,
  now = Date.now(),
) {
  try {
    store(storage)?.setItem(
      KEY,
      JSON.stringify({ id: entitlementId, at: now }),
    );
  } catch {
    /* optional */
  }
}

/** True once if the marker matches and is fresh; always clears it. */
export function takeOpenIntent(
  entitlementId: string,
  storage?: StorageLike,
  now = Date.now(),
): boolean {
  const s = store(storage);
  try {
    const raw = s?.getItem(KEY);
    s?.removeItem(KEY);
    if (!raw) return false;
    const v = JSON.parse(raw) as { id?: unknown; at?: unknown };
    return (
      v.id === entitlementId &&
      typeof v.at === "number" &&
      now - v.at <= MAX_AGE_MS
    );
  } catch {
    return false;
  }
}
