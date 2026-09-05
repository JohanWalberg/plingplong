const MAP: Record<string, string> = { å: "a", ä: "a", ö: "o", é: "e", ü: "u", ø: "o", æ: "ae" };

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[åäöéüøæ]/g, (c) => MAP[c] ?? c)
    .replace(/[:'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listingSlug(address: string, municipalityName: string): string {
  return slugify(`${address} ${municipalityName}`);
}
