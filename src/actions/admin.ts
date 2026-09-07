"use server";

import { and, eq, sql } from "drizzle-orm";
import { safeHttpUrl, safeWebsite } from "@/lib/safe-url";
import { revalidatePath } from "next/cache";
import { invalidateListingCaches } from "@/lib/listing-cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/access";
import { enqueueAllSyncs, enqueueSourceSync } from "@/lib/jobs";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-templates";
import { absoluteUrl } from "@/lib/seo";
import { slugify } from "@/lib/slug";
import { insertWithUniqueSlug } from "@/lib/queries/slug";
import { encryptSecret } from "@/lib/secrets";
import { mergeListings, withdrawSources } from "@/worker/sync";
import { adapterForKind, sniffSourceKind } from "@/lib/source-test";
import { LISTING_TRACKED_ADMIN, diffTracked } from "@/lib/queries/revisions";
import type { Locale } from "@/i18n/routing";
import { OK, fail, invalid, type ActionResult } from "@/lib/action-result";

const { source, landlord, landlordApplication, landlordApplicationEvent, landlordMember, landlordMunicipality, duplicateCandidate, listing, staffUser, user } = schema;

function revalidateAdmin() {
  revalidatePath("/[locale]/(admin)", "layout");
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function runSourceSync(locale: Locale, sourceId: string): Promise<ActionResult> {
  await requireStaff(locale, "support");
  await enqueueSourceSync(sourceId, true, true);
  revalidateAdmin();
  return OK;
}

export async function runAllSyncs(locale: Locale): Promise<ActionResult<{ count: number }>> {
  await requireStaff(locale, "support");
  const rows = await db.select({ id: source.id }).from(source).where(and(sql`${source.status} <> 'disabled'`, sql`${source.kind} <> 'manual'`));
  const count = await enqueueAllSyncs(rows.map((r) => r.id));
  revalidateAdmin();
  return { ok: true, count };
}

export async function setSourceStatus(locale: Locale, sourceId: string, status: "active" | "disabled"): Promise<ActionResult> {
  await requireStaff(locale, "lead");
  const parsed = z.enum(["active", "disabled"]).safeParse(status);
  if (!parsed.success) return fail("invalid");
  const rows = await db
    .update(source)
    .set({ status: parsed.data, consecutiveFailures: 0, nextRunAt: parsed.data === "active" ? new Date() : null })
    .where(eq(source.id, sourceId))
    .returning({ id: source.id });
  if (!rows.length) return fail("missing");
  revalidateAdmin();
  return OK;
}

export async function markSourceReviewed(locale: Locale, sourceId: string): Promise<ActionResult> {
  await requireStaff(locale, "support");
  const rows = await db
    .update(source)
    .set({ status: "active", nextRunAt: new Date() })
    .where(and(eq(source.id, sourceId), eq(source.status, "needs_review")))
    .returning({ id: source.id });
  if (!rows.length) return fail("noChange");
  revalidateAdmin();
  return OK;
}

const sourceInput = z.object({
  landlordId: z.string().min(1),
  kind: z.enum(["feed", "api", "html"]),
  url: z.string().trim().url(),
  adapter: z.enum(["generic-xml", "generic-json", "html-list"]).optional(),
  fetchIntervalMinutes: z.coerce.number().int().min(15).max(1440).default(60),
  techContactEmail: z.string().trim().email().optional().or(z.literal("")),
  queueDefault: z.enum(["none", "queue", "points", "unknown", ""]).optional(),
  listSelector: z.string().trim().max(200).optional().or(z.literal("")),
  apiKey: z.string().trim().max(500).optional().or(z.literal("")),
  consent: z.enum(["unknown", "consented", "objected", "silent"]).default("unknown"),
});

export async function createSource(locale: Locale, formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireStaff(locale, "lead");
  const parsed = sourceInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error.issues);
  const d = parsed.data;
  const config: Record<string, unknown> = { fields: {} };
  if (d.listSelector) config.listSelector = d.listSelector;
  if (d.apiKey) config.apiKey = encryptSecret(d.apiKey);
  const [row] = await db
    .insert(source)
    .values({
      landlordId: d.landlordId,
      kind: d.kind,
      adapter: d.adapter ?? adapterForKind(d.kind, /json/i.test(d.url) ? "json" : "xml"),
      url: d.url,
      config,
      fetchIntervalMinutes: d.fetchIntervalMinutes,
      techContactEmail: d.techContactEmail || null,
      queueDefault: d.queueDefault ? d.queueDefault : null,
      consent: d.consent,
      status: "pending",
      nextRunAt: new Date(),
    })
    .returning({ id: source.id });
  await db.update(landlord).set({ isMonitored: true }).where(eq(landlord.id, d.landlordId));
  await enqueueSourceSync(row.id, true);
  revalidateAdmin();
  return { ok: true, id: row.id };
}

export async function updateSource(locale: Locale, sourceId: string, formData: FormData): Promise<ActionResult> {
  const me = await requireStaff(locale, "lead");
  const parsed = sourceInput.partial({ landlordId: true, kind: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error.issues);
  const d = parsed.data;
  const current = await db.query.source.findFirst({ where: eq(source.id, sourceId) });
  if (!current) return fail("missing");
  const config = { ...(current.config as Record<string, unknown>) };
  if (d.listSelector !== undefined) config.listSelector = d.listSelector || undefined;
  if (d.apiKey) config.apiKey = encryptSecret(d.apiKey);
  const nowObjecting = d.consent === "objected" && current.consent !== "objected";
  await db
    .update(source)
    .set({
      url: d.url ?? current.url,
      adapter: d.adapter ?? current.adapter,
      fetchIntervalMinutes: d.fetchIntervalMinutes ?? current.fetchIntervalMinutes,
      techContactEmail: d.techContactEmail === undefined ? current.techContactEmail : d.techContactEmail || null,
      queueDefault: d.queueDefault === undefined ? current.queueDefault : d.queueDefault ? d.queueDefault : null,
      consent: d.consent ?? current.consent,
      config,
    })
    .where(eq(source.id, sourceId));
  // An objection is a takedown: stop crawling and clear what this source already put in search.
  if (nowObjecting) {
    await db.update(source).set({ status: "disabled", nextRunAt: null }).where(eq(source.id, sourceId));
    await withdrawSources([sourceId], me.userId);
    invalidateListingCaches();
  }
  revalidateAdmin();
  return OK;
}

// ---------------------------------------------------------------------------
// Landlords
// ---------------------------------------------------------------------------

const landlordInput = z.object({
  name: z.string().trim().min(2).max(160),
  orgNumber: z.string().trim().max(20).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  type: z.enum(["municipal", "private", "agency", "foundation"]),
  queueType: z.enum(["none", "queue", "points", "unknown"]),
  queueInfoUrl: z.string().trim().max(300).optional().or(z.literal("")),
  isKnown: z.string().optional(),
  municipalityIds: z.array(z.string()).default([]),
});

export async function upsertLandlord(locale: Locale, landlordId: string | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireStaff(locale, "lead");
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.municipalityIds = formData.getAll("municipalityIds");
  const parsed = landlordInput.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues);
  const d = parsed.data;
  const values = {
    name: d.name,
    orgNumber: d.orgNumber || null,
    website: safeWebsite(d.website),
    type: d.type,
    queueType: d.queueType,
    queueInfoUrl: safeHttpUrl(d.queueInfoUrl),
    isKnown: d.isKnown === "on",
  };
  let id = landlordId;
  if (id) {
    const rows = await db.update(landlord).set(values).where(eq(landlord.id, id)).returning({ id: landlord.id });
    if (!rows.length) return fail("missing");
  } else {
    const [row] = await insertWithUniqueSlug(db, landlord, slugify(d.name), (tx, slug) => tx.insert(landlord).values({ ...values, slug }).returning({ id: landlord.id }));
    id = row.id;
  }
  await db.delete(landlordMunicipality).where(eq(landlordMunicipality.landlordId, id));
  if (d.municipalityIds.length) await db.insert(landlordMunicipality).values(d.municipalityIds.map((m) => ({ landlordId: id!, municipalityId: m })));
  revalidateAdmin();
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// Approval queue
// ---------------------------------------------------------------------------

/** Approve: create/attach the landlord, membership for the applicant, source if a feed was given, email. */
export async function approveApplication(locale: Locale, applicationId: string): Promise<ActionResult> {
  const me = await requireStaff(locale, "lead");
  const app = await db.query.landlordApplication.findFirst({ where: eq(landlordApplication.id, applicationId) });
  if (!app) return fail("missing");
  if (app.status === "approved") return fail("noChange");
  const now = new Date();

  let sourceIdToSync: string | null = null;
  await db.transaction(async (tx) => {
    let landlordId = app.landlordId;
    if (!landlordId) {
      const existing = await tx.query.landlord.findFirst({ where: eq(landlord.orgNumber, app.orgNumber) });
      if (existing) {
        landlordId = existing.id;
        await tx.update(landlord).set({ approvedAt: now, termsAcceptedAt: app.termsAcceptedAt ?? now, website: existing.website ?? app.website }).where(eq(landlord.id, landlordId));
      } else {
        const [row] = await insertWithUniqueSlug(tx, landlord, slugify(app.companyName), (sp, slug) =>
          sp
            .insert(landlord)
            .values({ name: app.companyName, slug, orgNumber: app.orgNumber, website: app.website, type: "private", queueType: "unknown", approvedAt: now, termsAcceptedAt: app.termsAcceptedAt ?? now, isKnown: true, isMonitored: app.publishingRoute === "manual" })
            .returning({ id: landlord.id }),
        );
        landlordId = row.id;
      }
    }

    if (app.userId) {
      await tx.insert(landlordMember).values({ userId: app.userId, landlordId, role: "owner" }).onConflictDoNothing();
      await tx.update(user).set({ emailVerified: true }).where(eq(user.id, app.userId));
    }

    if (app.publishingRoute === "source" && app.sourceUrl) {
      const feedCheck = app.automatedChecks.find((c) => c.key === "feed");
      const kind = sniffSourceKind(app.sourceUrl);
      const mapping = (feedCheck?.detail as { mapping?: Record<string, string> } | undefined)?.mapping ?? {};
      const [src] = await tx
        .insert(source)
        .values({
          landlordId,
          kind,
          adapter: adapterForKind(kind, /json/i.test(app.sourceUrl) ? "json" : "xml"),
          url: app.sourceUrl,
          config: { fields: mapping },
          status: "pending",
          consent: "consented",
          techContactEmail: app.contactEmail,
          nextRunAt: now,
        })
        .returning({ id: source.id });
      await tx.update(landlord).set({ isMonitored: true }).where(eq(landlord.id, landlordId));
      await enqueueSourceSync(src.id, true);
    }

    await tx.update(landlordApplication).set({ status: "approved", landlordId, reviewedBy: me.userId, reviewedAt: now }).where(eq(landlordApplication.id, applicationId));
    await tx.insert(landlordApplicationEvent).values({ applicationId, kind: "approved", actorId: me.userId });
  });
  if (sourceIdToSync) await enqueueSourceSync(sourceIdToSync, true, true);
  const mail = await renderEmail(app.locale as Locale, "approved", { name: app.contactName, organisation: app.companyName, url: absoluteUrl(app.locale as Locale, "/portal/sign-in") });
  await sendEmail({ to: app.contactEmail, ...mail });
  revalidateAdmin();
  return OK;
}

const note = z.string().trim().min(1).max(2000);

export async function requestMoreInfo(locale: Locale, applicationId: string, message: string): Promise<ActionResult> {
  const me = await requireStaff(locale, "lead");
  const parsed = note.safeParse(message);
  if (!parsed.success) return fail("invalid");
  message = parsed.data;
  const app = await db.query.landlordApplication.findFirst({ where: eq(landlordApplication.id, applicationId) });
  if (!app) return fail("missing");
  await db.update(landlordApplication).set({ status: "needs_info", reviewedBy: me.userId }).where(eq(landlordApplication.id, applicationId));
  await db.insert(landlordApplicationEvent).values({ applicationId, kind: "needs_info", actorId: me.userId, message });
  const mail = await renderEmail(app.locale as Locale, "needsInfo", { name: app.contactName, organisation: app.companyName, message });
  await sendEmail({ to: app.contactEmail, ...mail });
  revalidateAdmin();
  return OK;
}

export async function rejectApplication(locale: Locale, applicationId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff(locale, "lead");
  const parsed = note.safeParse(reason);
  if (!parsed.success) return fail("invalid");
  reason = parsed.data;
  const app = await db.query.landlordApplication.findFirst({ where: eq(landlordApplication.id, applicationId) });
  if (!app) return fail("missing");
  await db.update(landlordApplication).set({ status: "rejected", reviewedBy: me.userId, reviewedAt: new Date(), decisionNote: reason }).where(eq(landlordApplication.id, applicationId));
  await db.insert(landlordApplicationEvent).values({ applicationId, kind: "rejected", actorId: me.userId, message: reason });
  const mail = await renderEmail(app.locale as Locale, "rejected", { name: app.contactName, organisation: app.companyName, reason });
  await sendEmail({ to: app.contactEmail, ...mail });
  revalidateAdmin();
  return OK;
}

export async function reopenApplication(locale: Locale, applicationId: string): Promise<ActionResult> {
  const me = await requireStaff(locale, "lead");
  const rows = await db.update(landlordApplication).set({ status: "pending" }).where(eq(landlordApplication.id, applicationId)).returning({ id: landlordApplication.id });
  if (!rows.length) return fail("missing");
  await db.insert(landlordApplicationEvent).values({ applicationId, kind: "reopened", actorId: me.userId });
  revalidateAdmin();
  return OK;
}

// ---------------------------------------------------------------------------
// Duplicates and listings
// ---------------------------------------------------------------------------

export async function decideDuplicate(locale: Locale, candidateId: string, decision: "merged" | "not_duplicate" | "ignored"): Promise<ActionResult> {
  const me = await requireStaff(locale, decision === "merged" ? "lead" : "support");
  if (!z.enum(["merged", "not_duplicate", "ignored"]).safeParse(decision).success) return fail("invalid");
  // The conditional update is the lock: whoever flips "pending" first (staff or the worker's auto-merge) wins, and the merge rides in the same transaction.
  const done = await db.transaction(async (tx) => {
    const [c] = await tx
      .update(duplicateCandidate)
      .set({ decision, decidedBy: me.userId, decidedAt: new Date() })
      .where(and(eq(duplicateCandidate.id, candidateId), eq(duplicateCandidate.decision, "pending")))
      .returning({ a: duplicateCandidate.listingAId, b: duplicateCandidate.listingBId });
    if (!c) return false;
    if (decision === "merged") await mergeListings(c.a, c.b, me.userId, tx);
    return true;
  });
  if (!done) return fail("noChange");
  revalidateAdmin();
  invalidateListingCaches();
  return OK;
}

export async function markListingReviewed(locale: Locale, listingId: string): Promise<ActionResult> {
  const me = await requireStaff(locale, "support");
  const rows = await db.update(listing).set({ reviewedAt: new Date(), reviewedBy: me.userId }).where(eq(listing.id, listingId)).returning({ id: listing.id });
  if (!rows.length) return fail("missing");
  await db.insert(schema.listingRevision).values({ listingId, field: "reviewed", oldValue: null, newValue: me.name, origin: "admin", changedBy: me.userId });
  revalidateAdmin();
  return OK;
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const staffRole = z.enum(["support", "lead", "engineer"]);

export async function setStaffRole(locale: Locale, userId: string, role: "support" | "lead" | "engineer"): Promise<ActionResult> {
  const me = await requireStaff(locale, "lead");
  if (!staffRole.safeParse(role).success) return fail("invalid");
  if (userId === me.userId) return fail("self");
  await db.insert(staffUser).values({ userId, role }).onConflictDoUpdate({ target: staffUser.userId, set: { role } });
  revalidateAdmin();
  return OK;
}

export async function removeStaff(locale: Locale, userId: string): Promise<ActionResult> {
  const me = await requireStaff(locale, "lead");
  if (userId === me.userId) return fail("self");
  const rows = await db.delete(staffUser).where(eq(staffUser.userId, userId)).returning({ userId: staffUser.userId });
  if (!rows.length) return fail("missing");
  revalidateAdmin();
  return OK;
}

export async function addStaffByEmail(locale: Locale, email: string, role: "support" | "lead" | "engineer"): Promise<ActionResult> {
  await requireStaff(locale, "lead");
  if (!staffRole.safeParse(role).success) return fail("invalid");
  const u = await db.query.user.findFirst({ where: eq(user.email, email.toLowerCase().trim()) });
  if (!u) return fail("noUser");
  await db.insert(staffUser).values({ userId: u.id, role }).onConflictDoUpdate({ target: staffUser.userId, set: { role } });
  revalidateAdmin();
  return OK;
}

// ---------------------------------------------------------------------------
// Listing edit and takedown (staff)
// ---------------------------------------------------------------------------

const listingEdit = z.object({
  address: z.string().trim().min(3).max(160),
  areaName: z.string().trim().max(80).optional().or(z.literal("")),
  rentMonthly: z.string().trim().optional().or(z.literal("")),
  rooms: z.string().trim().optional().or(z.literal("")),
  sizeSqm: z.string().trim().optional().or(z.literal("")),
  floor: z.string().trim().optional().or(z.literal("")),
  moveInDate: z.string().trim().optional().or(z.literal("")),
  applicationDeadline: z.string().trim().optional().or(z.literal("")),
  queueRequirement: z.enum(["none", "queue", "points", "unknown"]),
  segment: z.enum(["none", "student", "youth", "senior", "accessible"]),
  applicationUrl: z.string().trim().max(500).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

const numOrNull = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const dateOrNull = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Staff correction of factual fields. Every change is a revision with origin "admin". */
export async function adminUpdateListing(locale: Locale, listingId: string, formData: FormData): Promise<ActionResult> {
  const me = await requireStaff(locale, "support");
  const parsed = listingEdit.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error.issues);
  const d = parsed.data;
  const before = await db.query.listing.findFirst({ where: eq(listing.id, listingId), columns: { location: false } });
  if (!before) return fail("missing");
  const values = {
    address: d.address,
    areaName: d.areaName || null,
    rentMonthly: numOrNull(d.rentMonthly) === null ? null : Math.round(numOrNull(d.rentMonthly)!),
    rooms: numOrNull(d.rooms),
    sizeSqm: numOrNull(d.sizeSqm),
    floor: d.floor ? parseInt(d.floor, 10) || null : null,
    moveInDate: dateOrNull(d.moveInDate),
    applicationDeadline: dateOrNull(d.applicationDeadline),
    queueRequirement: d.queueRequirement,
    segment: d.segment,
    applicationUrl: safeHttpUrl(d.applicationUrl),
    description: d.description || null,
  };
  const now = new Date();
  const revisions = diffTracked(LISTING_TRACKED_ADMIN, before, values).map((c) => ({ listingId, ...c, origin: "admin", changedBy: me.userId, changedAt: now }));
  await db.update(listing).set(values).where(eq(listing.id, listingId));
  if (revisions.length) await db.insert(schema.listingRevision).values(revisions);
  revalidateAdmin();
  invalidateListingCaches();
  return OK;
}

/** Takedown: hide a listing from search with a reason kept in the history. */
export async function adminRemoveListing(locale: Locale, listingId: string, reason: string): Promise<ActionResult> {
  const me = await requireStaff(locale, "lead");
  const parsed = note.safeParse(reason);
  if (!parsed.success) return fail("invalid");
  reason = parsed.data;
  const before = await db.query.listing.findFirst({ where: eq(listing.id, listingId), columns: { status: true } });
  if (!before) return fail("missing");
  if (before.status === "removed") return fail("noChange");
  const now = new Date();
  await db.update(listing).set({ status: "removed", removedAt: now, lastCheckedAt: now }).where(eq(listing.id, listingId));
  await db.insert(schema.listingRevision).values([
    { listingId, field: "status", oldValue: before.status, newValue: "removed", origin: "admin", changedBy: me.userId, changedAt: now },
    { listingId, field: "takedown_reason", oldValue: null, newValue: reason, origin: "admin", changedBy: me.userId, changedAt: now },
  ]);
  revalidateAdmin();
  invalidateListingCaches();
  return OK;
}

export async function adminRestoreListing(locale: Locale, listingId: string): Promise<ActionResult> {
  const me = await requireStaff(locale, "lead");
  const before = await db.query.listing.findFirst({ where: eq(listing.id, listingId), columns: { status: true } });
  if (!before) return fail("missing");
  if (before.status !== "removed") return fail("noChange");
  const now = new Date();
  await db.update(listing).set({ status: "active", removedAt: null, lastSeenAt: now, lastCheckedAt: now }).where(eq(listing.id, listingId));
  await db.insert(schema.listingRevision).values({ listingId, field: "status", oldValue: "removed", newValue: "active", origin: "admin", changedBy: me.userId, changedAt: now });
  revalidateAdmin();
  invalidateListingCaches();
  return OK;
}
