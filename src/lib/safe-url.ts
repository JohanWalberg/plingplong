/**
 * URL values that reach an href or src. Only http(s) survives: a feed, a
 * staff form or a stored value can otherwise carry javascript: or data:
 * into a link. Relative values resolve against `base` when given.
 */
export function safeHttpUrl(value: string | null | undefined, base?: string, maxLength = 2000): string | null {
  const v = value?.trim();
  if (!v || v.length > maxLength) return null;
  try {
    const u = base ? new URL(v, base) : new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Websites are typed without a scheme ("foretaget.se"); add https before validating. */
export function safeWebsite(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  return safeHttpUrl(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
}
