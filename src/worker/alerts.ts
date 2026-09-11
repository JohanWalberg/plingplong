import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-templates";
import { absoluteUrl } from "@/lib/seo";
import { formatRent, formatRooms, formatSize } from "@/lib/format";
import { parseSearchParams } from "@/lib/search-params-parse";
import { searchListings } from "@/lib/queries/listings";
import { municipalitySlug } from "@/lib/queries/places";
import { reportError } from "@/lib/observability";
import type { Locale } from "@/i18n/routing";

const { searchAlert, municipality, area } = schema;

/** Homes listed in one digest; the mail links to the full search for the rest. */
export const DIGEST_LIMIT = 10;

/** The search URL an alert stands for, in its own locale. */
export function alertSearchHref(a: { query: Record<string, string>; municipality: { slugSv: string; slugEn: string } | null; area: { slug: string } | null }, locale: Locale) {
  const query = a.query;
  if (a.municipality && a.area) return { pathname: "/homes/[place]/[area]" as const, params: { place: municipalitySlug(a.municipality, locale), area: a.area.slug }, query };
  if (a.municipality) return { pathname: "/homes/[place]" as const, params: { place: municipalitySlug(a.municipality, locale) }, query };
  return { pathname: "/homes" as const, query };
}

/**
 * One mail per confirmed alert that has new homes since its last digest. The
 * watermark moves to the newest home in the mail, so a home is announced
 * once; a failed send leaves it in place and the home goes out next time.
 * Nothing else dedupes, which the single daily schedule with no retry covers.
 */
export async function sendAlertDigests(now: Date = new Date()): Promise<number> {
  const alerts = await db
    .select({
      id: searchAlert.id,
      email: searchAlert.email,
      locale: searchAlert.locale,
      label: searchAlert.label,
      query: searchAlert.query,
      seenThrough: searchAlert.seenThrough,
      tokenHash: searchAlert.tokenHash,
      municipalityId: searchAlert.municipalityId,
      areaId: searchAlert.areaId,
      municipality: { slugSv: municipality.slugSv, slugEn: municipality.slugEn },
      area: { slug: area.slug },
    })
    .from(searchAlert)
    .leftJoin(municipality, eq(searchAlert.municipalityId, municipality.id))
    .leftJoin(area, eq(searchAlert.areaId, area.id))
    .where(and(isNotNull(searchAlert.confirmedAt)));

  let sent = 0;
  for (const a of alerts) {
    const locale: Locale = a.locale === "en" ? "en" : "sv";
    try {
      const filters = parseSearchParams(a.query);
      const result = await searchListings(locale, { municipalityId: a.municipalityId ?? undefined, areaId: a.areaId ?? undefined, firstSeenAfter: a.seenThrough }, { ...filters, sort: "new", page: 1 }, DIGEST_LIMIT);
      if (!result.items.length) continue;
      // Postgres keeps microseconds and a Date keeps milliseconds, so the newest home's own
      // instant, read back and compared, would still count as "after" itself. One millisecond past it is not.
      const newest = new Date(result.items.reduce((m, l) => Math.max(m, l.firstSeenAt.getTime()), 0) + 1);
      const homes = result.items
        .map((l) => {
          const facts = [l.rentMonthly ? formatRent(locale, l.rentMonthly) : null, l.rooms ? formatRooms(locale, l.rooms) : null, l.sizeSqm ? formatSize(locale, l.sizeSqm) : null].filter(Boolean).join(" · ");
          return `- ${l.address}, ${l.municipalityName}${facts ? ` (${facts})` : ""}\n  ${absoluteUrl(locale, { pathname: "/home/[slug]", params: { slug: l.slug } })}`;
        })
        .join("\n");
      const scoped = { query: a.query, municipality: a.municipalityId ? a.municipality : null, area: a.areaId ? a.area : null };
      const mail = await renderEmail(locale, "alertDigest", {
        count: result.total,
        label: a.label,
        homes,
        searchUrl: absoluteUrl(locale, alertSearchHref(scoped, locale)),
        manageUrl: absoluteUrl(locale, { pathname: "/alerts/[token]", params: { token: "__TOKEN__" } }),
      });
      const token = await rotateToken(a.id);
      await sendEmail({ to: a.email, subject: mail.subject, text: mail.text.replace("__TOKEN__", token) });
      await db.update(searchAlert).set({ seenThrough: newest, lastSentAt: now }).where(eq(searchAlert.id, a.id));
      sent++;
    } catch (e) {
      // One address failing must not stop the others.
      reportError(e, { kind: "search alert digest", alertId: a.id });
    }
  }
  return sent;
}

/** Only the hash is stored, so each mail gets a new token and the previous link stops working. */
async function rotateToken(alertId: string): Promise<string> {
  const { newAlertToken, hashAlertToken } = await import("@/lib/queries/alerts");
  const token = newAlertToken();
  await db.update(searchAlert).set({ tokenHash: hashAlertToken(token) }).where(eq(searchAlert.id, alertId));
  return token;
}
