// D4: Naver accounts carry a placeholder email on the reserved .invalid TLD (mail never delivers).
// Treat it as "no email" everywhere (display, notifications, exports, password reset).
export const NAVER_PLACEHOLDER_DOMAIN = "naver.users.sameplz.invalid";

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || email.toLowerCase().endsWith(".invalid");
}

/** The user's real email or null. */
export function realEmail(email: string | null | undefined): string | null {
  return isPlaceholderEmail(email) ? null : email!;
}
