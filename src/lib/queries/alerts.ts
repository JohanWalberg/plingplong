import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Locale } from "@/i18n/routing";

const { searchAlert, municipality, area } = schema;

/** Alerts one address may hold; enough for a few towns and a few budgets, not a scraper's worth. */
export const MAX_ALERTS_PER_EMAIL = 10;
/** An alert nobody confirmed is dropped after this many days. */
export const UNCONFIRMED_ALERT_DAYS = 7;

export const hashAlertToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newAlertToken = () => randomBytes(24).toString("base64url");

export type AlertInput = {
  email: string;
  locale: Locale;
  label: string;
  municipalityId?: string;
  areaId?: string;
  query: Record<string, string>;
};

/**
 * Creates the alert and returns the token to put in the confirmation mail.
 * The same address asking for the same search twice gets the existing row
 * and a fresh token, so a lost confirmation mail can simply be requested
 * again. Returns null when the address is at its limit.
 */
export async function createAlert(input: AlertInput): Promise<{ token: string; confirmed: boolean } | null> {
  const email = input.email.trim().toLowerCase();
  const token = newAlertToken();
  const existing = await db.query.searchAlert.findFirst({
    where: and(
      eq(searchAlert.email, email),
      input.municipalityId ? eq(searchAlert.municipalityId, input.municipalityId) : isNull(searchAlert.municipalityId),
      input.areaId ? eq(searchAlert.areaId, input.areaId) : isNull(searchAlert.areaId),
      sql`${searchAlert.query} = ${JSON.stringify(input.query)}::jsonb`,
    ),
  });
  if (existing) {
    await db.update(searchAlert).set({ tokenHash: hashAlertToken(token), label: input.label, locale: input.locale }).where(eq(searchAlert.id, existing.id));
    return { token, confirmed: !!existing.confirmedAt };
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(searchAlert).where(eq(searchAlert.email, email));
  if (n >= MAX_ALERTS_PER_EMAIL) return null;
  await db.insert(searchAlert).values({
    email,
    locale: input.locale,
    label: input.label,
    municipalityId: input.municipalityId ?? null,
    areaId: input.areaId ?? null,
    query: input.query,
    tokenHash: hashAlertToken(token),
  });
  return { token, confirmed: false };
}

/** The alert behind a link, with the place it is scoped to, for the manage page. */
export async function findAlert(token: string) {
  const [row] = await db
    .select({
      id: searchAlert.id,
      email: searchAlert.email,
      locale: searchAlert.locale,
      label: searchAlert.label,
      query: searchAlert.query,
      confirmedAt: searchAlert.confirmedAt,
      municipality: { id: municipality.id, nameSv: municipality.nameSv, nameEn: municipality.nameEn, slugSv: municipality.slugSv, slugEn: municipality.slugEn },
      area: { id: area.id, name: area.name, slug: area.slug },
    })
    .from(searchAlert)
    .leftJoin(municipality, eq(searchAlert.municipalityId, municipality.id))
    .leftJoin(area, eq(searchAlert.areaId, area.id))
    .where(eq(searchAlert.tokenHash, hashAlertToken(token)))
    .limit(1);
  if (!row) return null;
  return { ...row, municipality: row.municipality?.id ? row.municipality : null, area: row.area?.id ? row.area : null };
}

/** Confirms the alert; new homes count from this moment, not from when the form was filled. */
export async function confirmAlert(token: string): Promise<boolean> {
  const rows = await db
    .update(searchAlert)
    .set({ confirmedAt: new Date(), seenThrough: new Date() })
    .where(and(eq(searchAlert.tokenHash, hashAlertToken(token)), isNull(searchAlert.confirmedAt)))
    .returning({ id: searchAlert.id });
  return rows.length > 0;
}

export async function deleteAlert(token: string): Promise<boolean> {
  const rows = await db.delete(searchAlert).where(eq(searchAlert.tokenHash, hashAlertToken(token))).returning({ id: searchAlert.id });
  return rows.length > 0;
}

/** Drops alerts that were never confirmed within the window. */
export async function purgeUnconfirmedAlerts(now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - UNCONFIRMED_ALERT_DAYS * 86_400_000);
  const rows = await db
    .delete(searchAlert)
    .where(and(isNull(searchAlert.confirmedAt), lt(searchAlert.createdAt, before)))
    .returning({ id: searchAlert.id });
  return rows.length;
}
