/**
 * Where to go after login. Only same-site absolute paths: rejects "//evil", "/\evil",
 * schemes, control characters, and anything not starting with a single "/".
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || value.length > 512) return "/";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  )
    return "/";
  if (/[\u0000-\u001f\\]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://sameplz.invalid");
    if (url.origin !== "https://sameplz.invalid") return "/";
    // Re-check after normalization: "/..//evil" and "/./%2e%2e//evil" collapse to "//evil".
    if (url.pathname.startsWith("//") || url.pathname.startsWith("/\\"))
      return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

/** Append auth_error to a same-site path (keeps existing query). */
export function withAuthError(next: string, code: string): string {
  const url = new URL(safeNext(next), "https://sameplz.invalid");
  url.searchParams.set("auth_error", code.slice(0, 60));
  return url.pathname + url.search;
}
