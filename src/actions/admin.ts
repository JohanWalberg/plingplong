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
import { mergeListings } from "@/worker/sync";
import { adapterForKind } from "@/lib/source-test";
import type { Locale } from "@/i18n/routing";

const { source, landlord, landlordApplication, landlordApplicationEvent, landlordMember, landlordMunicipality, duplicateCandidate, listing, staffUser, user } = schema;

function revalidateAdmin() {
  revalidatePath("/[locale]/(admin)", "layout");
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function runSourceSync(locale: Locale, sourceId: string) {
  await requireStaff(locale, "support");
  await enqueueSourceSync(sourceId, true);
  revalidateAdmin();
}

export async function runAllSyncs(locale: Locale) {
  await requireStaff(locale, "support");
  const rows = await db.select({ id: source.id }).from(source).where(and(sql`${source.status} <> 'disabled'`, sql`${source.kind} <> 'manual'`));
  const n = await enqueueAllSyncs(rows.map((r) => r.id));
  revalidateAdmin();
  return n;
}

export async function setSourceStatus(locale: Locale, sourceId: string, status: "active" | "disabled") {
  await requireStaff(locale, "lead");
  await db.update(source).set({ status, consecutiveFailures: 0, nextRunAt: status === "active" ? new Date() : null }).where(eq(source.id, sourceId));
  revalidateAdmin();
}

export async function markSourceReviewed(locale: Locale, sourceId: string) {
  await requireStaff(locale, "support");
  await db.update(source).set({ status: "active", nextRunAt: new Date() }).where(and(eq(source.id, sourceId), eq(source.status, "needs_review")));
  revalidateAdmin();
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

export async function createSource(locale: Locale, formData: FormData): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireStaff(locale, "lead");
  const parsed = sourceInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ") };
  const d = parsed.data;
  const config: Record<string, unknown> = { fields: {} };
  if (d.listSelector) config.listSelector = d.listSelector;
  if (d.apiKey) config.apiKey = d.apiKey;
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

export async function updateSource(locale: Locale, sourceId: string, formData: FormData) {
  await requireStaff(locale, "lead");
  const parsed = sourceInput.partial({ landlordId: true, kind: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const d = parsed.data;
  const current = await db.query.source.findFirst({ where: eq(source.id, sourceId) });
  if (!current) return { ok: false as const, error: "missing" };
  const config = { ...(current.config as Record<string, unknown>) };
  if (d.listSelector !== undefined) config.listSelector = d.listSelector || undefined;
  if (d.apiKey) config.apiKey = d.apiKey;
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
  revalidateAdmin();
  return { ok: true as const };
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

export async function upsertLandlord(locale: Locale, landlordId: string | null, formData: FormData): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireStaff(locale, "lead");
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.municipalityIds = formData.getAll("municipalityIds");
  const parsed = landlordInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ") };
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
  if (id) await db.update(landlord).set(values).where(eq(landlord.id, id));
  else {
    let slug = slugify(d.name);
    const clash = await db.query.landlord.findFirst({ where: eq(landlord.slug, slug) });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;
    const [row] = await db.insert(landlord).values({ ...values, slug }).returning({ id: landlord.id });
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
export async function approveApplication(locale: Locale, applicationId: string) {
  const me = await requireStaff(locale, "lead");
  const app = await db.query.landlordApplication.findFirst({ where: eq(landlordApplication.id, applicationId) });
  if (!app || app.status === "approved") return;
  const now = new Date();

  let landlordId = app.landlordId;
  if (!landlordId) {
    const existing = await db.query.landlord.findFirst({ where: eq(landlord.orgNumber, app.orgNumber) });
    if (existing) {
      landlordId = existing.id;
      await db.update(landlord).set({ approvedAt: now, website: existing.website ?? app.website }).where(eq(landlord.id, landlordId));
    } else {
      let slug = slugify(app.companyName);
      const clash = await db.query.landlord.findFirst({ where: eq(landlord.slug, slug) });
      if (clash) slug = `${slug}-${app.orgNumber.replace(/\D/g, "").slice(-4)}`;
      const [row] = await db
        .insert(landlord)
        .values({ name: app.companyName, slug, orgNumber: app.orgNumber, website: app.website, type: app.orgNumber.startsWith("7696") ? "private" : "private", queueType: "unknown", approvedAt: now, isKnown: true, isMonitored: app.publishingRoute === "manual" })
        .returning({ id: landlord.id });
      landlordId = row.id;
    }
  }

  if (app.userId) {
    await db.insert(landlordMember).values({ userId: app.userId, landlordId, role: "owner" }).onConflictDoNothing();
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, app.userId));
  }

  if (app.publishingRoute === "source" && app.sourceUrl) {
    const feedCheck = app.automatedChecks.find((c) => c.key === "feed");
    const kind = /\.(xml|json|rss)(\?|$)/i.test(app.sourceUrl) || /feed|api/i.test(app.sourceUrl) ? "feed" : "html";
    const mapping = (feedCheck?.detail as { mapping?: Record<string, string> } | undefined)?.mapping ?? {};
    const [src] = await db
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
    await db.update(landlord).set({ isMonitored: true }).where(eq(landlord.id, landlordId));
    await enqueueSourceSync(src.id, true);
  }

  await db.update(landlordApplication).set({ status: "approved", landlordId, reviewedBy: me.userId, reviewedAt: now }).where(eq(landlordApplication.id, applicationId));
  await db.insert(landlordApplicationEvent).values({ applicationId, kind: "approved", actorId: me.userId });
  const mail = await renderEmail(app.locale as Locale, "approved", { name: app.contactName, organisation: app.companyName, url: absoluteUrl(app.locale as Locale, "/portal/sign-in") });
  await sendEmail({ to: app.contactEmail, ...mail });
  revalidateAdmin();
}

export async function requestMoreInfo(locale: Locale, applicationId: string, message: string) {
  const me = await requireStaff(locale, "lead");
  const app = await db.query.landlordApplication.findFirst({ where: eq(landlordApplication.id, applicationId) });
  if (!app) return;
  await db.update(landlordApplication).set({ status: "needs_info", reviewedBy: me.userId }).where(eq(landlordApplication.id, applicationId));
  await db.insert(landlordApplicationEvent).values({ applicationId, kind: "needs_info", actorId: me.userId, message });
  const mail = await renderEmail(app.locale as Locale, "needsInfo", { name: app.contactName, organisation: app.companyName, message });
  await sendEmail({ to: app.contactEmail, ...mail });
  revalidateAdmin();
}

export async function rejectApplication(locale: Locale, applicationId: string, reason: string) {
  const me = await requireStaff(locale, "lead");
  const app = await db.query.landlordApplication.findFirst({ where: eq(landlordApplication.id, applicationId) });
  if (!app) return;
  await db.update(landlordApplication).set({ status: "rejected", reviewedBy: me.userId, reviewedAt: new Date(), decisionNote: reason }).where(eq(landlordApplication.id, applicationId));
  await db.insert(landlordApplicationEvent).values({ applicationId, kind: "rejected", actorId: me.userId, message: reason });
  const mail = await renderEmail(app.locale as Locale, "rejected", { name: app.contactName, organisation: app.companyName, reason });
  await sendEmail({ to: app.contactEmail, ...mail });
  revalidateAdmin();
}

export async function reopenApplication(locale: Locale, applicationId: string) {
  const me = await requireStaff(locale, "lead");
  await db.update(landlordApplication).set({ status: "pending" }).where(eq(landlordApplication.id, applicationId));
  await db.insert(landlordApplicationEvent).values({ applicationId, kind: "reopened", actorId: me.userId });
  revalidateAdmin();
}

// ---------------------------------------------------------------------------
// Duplicates and listings
// ---------------------------------------------------------------------------

export async function decideDuplicate(locale: Locale, candidateId: string, decision: "merged" | "not_duplicate" | "ignored") {
  const me = await requireStaff(locale, decision === "merged" ? "lead" : "support");
  const c = await db.query.duplicateCandidate.findFirst({ where: eq(duplicateCandidate.id, candidateId) });
  if (!c || c.decision !== "pending") return;
  if (decision === "merged") await mergeListings(c.listingAId, c.listingBId, me.userId);
  await db.update(duplicateCandidate).set({ decision, decidedBy: me.userId, decidedAt: new Date() }).where(eq(duplicateCandidate.id, candidateId));
  revalidateAdmin();
  invalidateListingCaches();
}

export async function markListingReviewed(locale: Locale, listingId: string) {
  const me = await requireStaff(locale, "support");
  await db.update(listing).set({ reviewedAt: new Date(), reviewedBy: me.userId }).where(eq(listing.id, listingId));
  await db.insert(schema.listingRevision).values({ listingId, field: "reviewed", oldValue: null, newValue: me.name, origin: "admin", changedBy: me.userId });
  revalidateAdmin();
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function setStaffRole(locale: Locale, userId: string, role: "support" | "lead" | "engineer") {
  const me = await requireStaff(locale, "lead");
  if (userId === me.userId) return;
  await db.insert(staffUser).values({ userId, role }).onConflictDoUpdate({ target: staffUser.userId, set: { role } });
  revalidateAdmin();
}

export async function addStaffByEmail(locale: Locale, email: string, role: "support" | "lead" | "engineer"): Promise<{ ok: boolean; error?: string }> {
  await requireStaff(locale, "lead");
  const u = await db.query.user.findFirst({ where: eq(user.email, email.toLowerCase().trim()) });
  if (!u) return { ok: false, error: "no_user" };
  await db.insert(staffUser).values({ userId: u.id, role }).onConflictDoUpdate({ target: staffUser.userId, set: { role } });
  revalidateAdmin();
  return { ok: true };
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
export async function adminUpdateListing(locale: Locale, listingId: string, formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireStaff(locale, "support");
  const parsed = listingEdit.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ") };
  const d = parsed.data;
  const before = await db.query.listing.findFirst({ where: eq(listing.id, listingId), columns: { location: false } });
  if (!before) return { ok: false, error: "missing" };
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
  const tracked: Array<[keyof typeof values, string]> = [
    ["address", "address"], ["areaName", "area_name"], ["rentMonthly", "rent_monthly"], ["rooms", "rooms"], ["sizeSqm", "size_sqm"], ["floor", "floor"],
    ["moveInDate", "move_in_date"], ["applicationDeadline", "application_deadline"], ["queueRequirement", "queue_requirement"], ["segment", "segment"],
    ["applicationUrl", "application_url"], ["description", "description"],
  ];
  const now = new Date();
  const revisions = tracked
    .filter(([k]) => String(before[k] ?? "") !== String(values[k] ?? ""))
    .map(([k, field]) => ({ listingId, field, oldValue: before[k] === null || before[k] === undefined ? null : String(before[k]), newValue: values[k] === null ? null : String(values[k]), origin: "admin", changedBy: me.userId, changedAt: now }));
  await db.update(listing).set(values).where(eq(listing.id, listingId));
  if (revisions.length) await db.insert(schema.listingRevision).values(revisions);
  revalidateAdmin();
  invalidateListingCaches();
  return { ok: true };
}

/** Takedown: hide a listing from search with a reason kept in the history. */
export async function adminRemoveListing(locale: Locale, listingId: string, reason: string) {
  const me = await requireStaff(locale, "lead");
  const before = await db.query.listing.findFirst({ where: eq(listing.id, listingId), columns: { status: true } });
  if (!before || before.status === "removed") return;
  const now = new Date();
  await db.update(listing).set({ status: "removed", removedAt: now, lastCheckedAt: now }).where(eq(listing.id, listingId));
  await db.insert(schema.listingRevision).values([
    { listingId, field: "status", oldValue: before.status, newValue: "removed", origin: "admin", changedBy: me.userId, changedAt: now },
    { listingId, field: "takedown_reason", oldValue: null, newValue: reason, origin: "admin", changedBy: me.userId, changedAt: now },
  ]);
  revalidateAdmin();
  invalidateListingCaches();
}

export async function adminRestoreListing(locale: Locale, listingId: string) {
  const me = await requireStaff(locale, "lead");
  const before = await db.query.listing.findFirst({ where: eq(listing.id, listingId), columns: { status: true } });
  if (!before || before.status !== "removed") return;
  const now = new Date();
  await db.update(listing).set({ status: "active", removedAt: null, lastSeenAt: now, lastCheckedAt: now }).where(eq(listing.id, listingId));
  await db.insert(schema.listingRevision).values({ listingId, field: "status", oldValue: "removed", newValue: "active", origin: "admin", changedBy: me.userId, changedAt: now });
  revalidateAdmin();
  invalidateListingCaches();
}
