/** Swedish organisation number: ten digits, Luhn check on the last digit. */
export function normaliseOrgNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("16") ? digits.slice(2) : digits;
  if (ten.length !== 10) return null;
  return `${ten.slice(0, 6)}-${ten.slice(6)}`;
}

export function isValidOrgNumber(input: string): boolean {
  const n = normaliseOrgNumber(input);
  if (!n) return false;
  const digits = n.replace("-", "");
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = parseInt(digits[i], 10);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Brf (tenant-owner association) numbers start with 7696; foundations and associations with 8. */
export function orgNumberKind(n: string): "company" | "brf" | "association" | "other" {
  const d = n.replace(/\D/g, "");
  if (d.startsWith("7696")) return "brf";
  if (d.startsWith("5")) return "company";
  if (d.startsWith("8")) return "association";
  return "other";
}

export function emailDomain(email: string): string | null {
  const m = email.toLowerCase().match(/@([^@\s]+)$/);
  return m ? m[1] : null;
}

export function websiteDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Does the email domain belong to the stated website (same registrable domain)? */
export function domainMatches(email: string, website: string | null | undefined): boolean | null {
  const e = emailDomain(email);
  const w = websiteDomain(website);
  if (!e || !w) return null;
  const root = (d: string) => d.split(".").slice(-2).join(".");
  return e === w || e.endsWith(`.${w}`) || root(e) === root(w);
}
