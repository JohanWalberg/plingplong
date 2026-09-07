import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { stockholmDate, formatDateShort } from "@/lib/format";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-templates";
import { absoluteUrl } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";
import { reportError } from "@/lib/observability";

const { listing, landlordMember, user } = schema;

/** Days before the application deadline that the reminder goes out. */
export const EXPIRY_NOTICE_DAYS = 3;

/**
 * Reminds owners about homes they published here whose deadline is close.
 *
 * Only the homes reaching exactly `EXPIRY_NOTICE_DAYS` left are included, so a
 * home appears in one day's reminder and no sent-flag column is needed. Nothing
 * dedupes beyond that: running this twice in a day sends the mail twice, which
 * the single daily schedule with no retry is what prevents. Crawled
 * homes are left out: their dates come from the landlord's own page and cannot
 * be changed here.
 */
export async function notifyExpiringListings(now: Date = new Date()): Promise<number> {
  const deadline = stockholmDate(new Date(now.getTime() + EXPIRY_NOTICE_DAYS * 86_400_000));
  const due = await db
    .select({ landlordId: listing.landlordId, address: listing.address, deadline: listing.applicationDeadline })
    .from(listing)
    .where(and(eq(listing.status, "active"), eq(listing.publishedDirectly, true), eq(listing.applicationDeadline, deadline)))
    .orderBy(listing.address);
  if (!due.length) return 0;

  const byLandlord = new Map<string, string[]>();
  for (const row of due) byLandlord.set(row.landlordId, [...(byLandlord.get(row.landlordId) ?? []), row.address]);

  let sent = 0;
  for (const [landlordId, addresses] of byLandlord) {
    const owners = await db
      .select({ email: user.email, locale: user.locale })
      .from(landlordMember)
      .innerJoin(user, eq(user.id, landlordMember.userId))
      .where(and(eq(landlordMember.landlordId, landlordId), eq(landlordMember.role, "owner")));
    for (const owner of owners) {
      const locale: Locale = owner.locale === "en" ? "en" : "sv";
      const homes = addresses.map((a) => `- ${a} (${formatDateShort(locale, deadline)})`).join("\n");
      try {
        const mail = await renderEmail(locale, "expiringSoon", { count: addresses.length, days: EXPIRY_NOTICE_DAYS, homes, url: absoluteUrl(locale, "/portal/homes") });
        await sendEmail({ to: owner.email, ...mail });
        sent++;
      } catch (e) {
        // One landlord's mail failing must not stop the others.
        reportError(e, { kind: "deadline reminder", landlordId });
      }
    }
  }
  return sent;
}
