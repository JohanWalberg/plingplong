"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import sharp from "sharp";
import { db, schema } from "@/db";
import { requireLandlord } from "@/lib/access";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listingSlug } from "@/lib/slug";
import { insertWithUniqueSlug } from "@/lib/queries/slug";
import { LISTING_TRACKED, diffTracked } from "@/lib/queries/revisions";
import { invalidateListingCaches } from "@/lib/listing-cache";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, imageKey, storage } from "@/lib/storage";

const { listing, listingImage, listingRevision, municipality, area } = schema;

const formSchema = z.object({
  address: z.string().trim().min(3).max(160),
  postcode: z.string().trim().max(10).optional().or(z.literal("")),
  municipalityId: z.string().min(1),
  areaName: z.string().trim().max(80).optional().or(z.literal("")),
  rentMonthly: z.string().trim().optional().or(z.literal("")),
  rooms: z.string().trim().optional().or(z.literal("")),
  sizeSqm: z.string().trim().optional().or(z.literal("")),
  floor: z.string().trim().optional().or(z.literal("")),
  moveInDate: z.string().trim().optional().or(z.literal("")),
  applicationDeadline: z.string().trim().optional().or(z.literal("")),
  segment: z.enum(["none", "student", "youth", "senior", "accessible"]).default("none"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  queueRequirement: z.enum(["none", "queue", "points", "unknown"]).default("unknown"),
  applyRoute: z.enum(["url", "contact"]).default("url"),
  applicationUrl: z.string().trim().max(500).optional().or(z.literal("")),
  applicationContact: z.string().trim().max(200).optional().or(z.literal("")),
});

export type ListingFormErrors = Record<string, "required" | "invalidNumber" | "invalidUrl" | "invalidDate" | "invalidImage">;
export type ListingFormState = { ok: true; id: string; published: boolean } | { ok: false; errors: ListingFormErrors };

const num = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : NaN;
};
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function parseForm(fd: FormData, requireAll: boolean) {
  const raw = Object.fromEntries([...fd.entries()].filter(([k]) => k !== "images" && k !== "removeImages"));
  const parsed = formSchema.safeParse(raw);
  const errors: ListingFormErrors = {};
  if (!parsed.success) {
    for (const i of parsed.error.issues) errors[String(i.path[0])] = "required";
    return { errors };
  }
  const d = parsed.data;
  const rent = num(d.rentMonthly);
  const rooms = num(d.rooms);
  const size = num(d.sizeSqm);
  const floor = d.floor ? Number(d.floor) : null;
  if (Number.isNaN(rent)) errors.rentMonthly = "invalidNumber";
  if (Number.isNaN(rooms)) errors.rooms = "invalidNumber";
  if (Number.isNaN(size)) errors.sizeSqm = "invalidNumber";
  if (floor !== null && !Number.isInteger(floor)) errors.floor = "invalidNumber";
  if (d.moveInDate && !isoDate.test(d.moveInDate)) errors.moveInDate = "invalidDate";
  if (d.applicationDeadline && !isoDate.test(d.applicationDeadline)) errors.applicationDeadline = "invalidDate";
  if (d.applyRoute === "url" && d.applicationUrl && !/^https?:\/\//.test(d.applicationUrl)) errors.applicationUrl = "invalidUrl";
  if (requireAll) {
    if (!rent) errors.rentMonthly = errors.rentMonthly ?? "required";
    if (!rooms) errors.rooms = errors.rooms ?? "required";
    if (!size) errors.sizeSqm = errors.sizeSqm ?? "required";
    if (d.applyRoute === "url" && !d.applicationUrl) errors.applicationUrl = "required";
    if (d.applyRoute === "contact" && !d.applicationContact) errors.applicationContact = "required";
  }
  return {
    errors,
    values: {
      address: d.address,
      postcode: d.postcode ? d.postcode.replace(/\D/g, "").replace(/^(\d{3})(\d{2})$/, "$1 $2") : null,
      municipalityId: d.municipalityId,
      areaName: d.areaName || null,
      rentMonthly: rent && !Number.isNaN(rent) ? Math.round(rent) : null,
      rooms: rooms && !Number.isNaN(rooms) ? rooms : null,
      sizeSqm: size && !Number.isNaN(size) ? size : null,
      floor: floor !== null && Number.isInteger(floor) ? floor : null,
      moveInDate: d.moveInDate && isoDate.test(d.moveInDate) ? d.moveInDate : null,
      applicationDeadline: d.applicationDeadline && isoDate.test(d.applicationDeadline) ? d.applicationDeadline : null,
      segment: d.segment,
      description: d.description || null,
      queueRequirement: d.queueRequirement,
      applyRoute: d.applyRoute,
      applicationUrl: d.applyRoute === "url" ? d.applicationUrl || null : null,
      applicationContact: d.applyRoute === "contact" ? d.applicationContact || null : null,
    },
  };
}

/**
 * A manually entered home has no coordinates, so the point is the middle of the
 * area or, failing that, the municipality. The precision travels with it: drawn
 * as the address it would be a lie about where someone would be living.
 */
async function resolveLocation(municipalityId: string, areaName: string | null) {
  if (areaName) {
    const [a] = await db
      .select({ id: area.id, lat: sql<number | null>`ST_Y(${area.centroid})`, lon: sql<number | null>`ST_X(${area.centroid})` })
      .from(area)
      .where(and(eq(area.municipalityId, municipalityId), sql`lower(${area.name}) = ${areaName.toLowerCase()}`))
      .limit(1);
    if (a) return { areaId: a.id, lat: a.lat, lon: a.lon, precision: "area" as const };
  }
  const [m] = await db
    .select({ lat: sql<number | null>`ST_Y(${municipality.centroid})`, lon: sql<number | null>`ST_X(${municipality.centroid})` })
    .from(municipality)
    .where(eq(municipality.id, municipalityId));
  return { areaId: null, lat: m?.lat ?? null, lon: m?.lon ?? null, precision: "municipality" as const };
}

const MAX_IMAGES_PER_LISTING = 12;
type PreparedImage = { data: Buffer; contentType: "image/jpeg" | "image/png" | "image/webp" };

/**
 * Decodes every uploaded file with sharp before anything is written: the
 * browser's MIME type is not trusted, non-images are refused, EXIF (including
 * GPS from a landlord's phone) is dropped, and orientation is applied.
 */
async function prepareImages(fd: FormData): Promise<{ ok: true; images: PreparedImage[] } | { ok: false }> {
  const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_IMAGES_PER_LISTING) return { ok: false };
  const images: PreparedImage[] = [];
  for (const f of files) {
    if (!ALLOWED_IMAGE_TYPES.has(f.type) || f.size > MAX_IMAGE_BYTES) return { ok: false };
    try {
      const input = sharp(Buffer.from(await f.arrayBuffer()), { limitInputPixels: 40_000_000 });
      const meta = await input.metadata();
      const format = meta.format === "jpeg" || meta.format === "png" || meta.format === "webp" ? meta.format : null;
      if (!format || !meta.width || !meta.height) return { ok: false };
      const data = await input.rotate().toFormat(format, format === "jpeg" ? { quality: 88 } : undefined).toBuffer();
      images.push({ data, contentType: `image/${format}` });
    } catch {
      return { ok: false };
    }
  }
  return { ok: true, images };
}

async function saveImages(listingId: string, images: PreparedImage[], fd: FormData): Promise<"invalidImage" | null> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(listingImage).where(eq(listingImage.listingId, listingId));
  const remove = fd.getAll("removeImages").map(String).filter(Boolean);
  if (n - remove.length + images.length > MAX_IMAGES_PER_LISTING) return "invalidImage";
  let position = n;
  for (const img of images) {
    const key = imageKey(listingId, img.contentType);
    await storage.put(key, img.data, img.contentType);
    await db.insert(listingImage).values({ listingId, storageKey: key, position: position++ });
  }
  for (const id of remove) {
    const img = await db.query.listingImage.findFirst({ where: and(eq(listingImage.id, id), eq(listingImage.listingId, listingId)) });
    if (img) {
      await storage.delete(img.storageKey);
      await db.delete(listingImage).where(eq(listingImage.id, img.id));
    }
  }
  return null;
}

/** Create or update a listing. `publish` requires owner role and the core fields. */
export async function saveListing(locale: Locale, mode: "draft" | "publish", existingId: string | null, _prev: ListingFormState | null, fd: FormData): Promise<ListingFormState> {
  const me = await requireLandlord(locale, mode === "publish" ? "owner" : "editor");
  const { errors, values } = parseForm(fd, mode === "publish");
  if (!values || Object.keys(errors).length) return { ok: false, errors };
  // Photos are decoded before anything is written: a bad file must not leave a published listing behind.
  const prepared = await prepareImages(fd);
  if (!prepared.ok) return { ok: false, errors: { images: "invalidImage" } };
  const now = new Date();
  const loc = await resolveLocation(values.municipalityId, values.areaName);
  const muni = await db.query.municipality.findFirst({ where: eq(municipality.id, values.municipalityId), columns: { nameSv: true } });
  if (!muni) return { ok: false, errors: { municipalityId: "required" } };

  let id = existingId;
  if (existingId) {
    const before = await db.query.listing.findFirst({ where: and(eq(listing.id, existingId), eq(listing.landlordId, me.landlordId), eq(listing.publishedDirectly, true)) });
    if (!before) redirect({ href: "/portal/homes", locale });
    const publishNow = mode === "publish" && before!.status !== "active";
    await db
      .update(listing)
      .set({
        ...values,
        areaId: loc.areaId,
        location: loc.lat !== null && loc.lon !== null ? { x: loc.lon, y: loc.lat } : null,
        locationPrecision: loc.lat !== null && loc.lon !== null ? loc.precision : null,
        ...(publishNow ? { status: "active", publishedAt: now, unpublishedAt: null, firstSeenAt: before!.publishedAt ? before!.firstSeenAt : now, lastSeenAt: now, lastCheckedAt: now } : { lastCheckedAt: before!.status === "active" ? now : before!.lastCheckedAt }),
      })
      .where(eq(listing.id, existingId));
    const revisions = diffTracked(LISTING_TRACKED, before!, values).map((c) => ({ listingId: existingId, ...c, origin: "portal", changedBy: me.userId, changedAt: now }));
    if (publishNow) revisions.push({ listingId: existingId, field: "status", oldValue: before!.status, newValue: "active", origin: "portal", changedBy: me.userId, changedAt: now });
    if (revisions.length) await db.insert(listingRevision).values(revisions);
  } else {
    const [row] = await insertWithUniqueSlug(db, listing, listingSlug(values.address, muni.nameSv), (tx, slug) =>
      tx
        .insert(listing)
        .values({
          ...values,
          slug,
          landlordId: me.landlordId,
          areaId: loc.areaId,
          location: loc.lat !== null && loc.lon !== null ? { x: loc.lon, y: loc.lat } : null,
        locationPrecision: loc.lat !== null && loc.lon !== null ? loc.precision : null,
          contractType: "first_hand",
          status: mode === "publish" ? "active" : "draft",
          publishedDirectly: true,
          publishedAt: mode === "publish" ? now : null,
          firstSeenAt: now,
          lastSeenAt: now,
          lastCheckedAt: now,
          createdBy: me.userId,
        })
        .returning({ id: listing.id }),
    );
    id = row.id;
    await db.insert(listingRevision).values({ listingId: id, field: "status", oldValue: null, newValue: mode === "publish" ? "active" : "draft", origin: "portal", changedBy: me.userId, changedAt: now });
  }
  const imgErr = await saveImages(id!, prepared.images, fd);
  invalidateListingCaches();
  if (imgErr) return { ok: false, errors: { images: imgErr } };
  return { ok: true, id: id!, published: mode === "publish" };
}

async function ownedDirect(locale: Locale, id: string, minRole: "owner" | "editor" = "owner") {
  const me = await requireLandlord(locale, minRole);
  const l = await db.query.listing.findFirst({ where: and(eq(listing.id, id), eq(listing.landlordId, me.landlordId), eq(listing.publishedDirectly, true)) });
  if (!l) redirect({ href: "/portal/homes", locale });
  return { me, l: l! };
}

export async function unpublishListing(locale: Locale, id: string) {
  const { me, l } = await ownedDirect(locale, id);
  const now = new Date();
  await db.update(listing).set({ status: "unpublished", unpublishedAt: now, lastCheckedAt: now }).where(eq(listing.id, id));
  invalidateListingCaches();
  await db.insert(listingRevision).values({ listingId: id, field: "status", oldValue: l.status, newValue: "unpublished", origin: "portal", changedBy: me.userId, changedAt: now });
}

export async function republishListing(locale: Locale, id: string) {
  const { me, l } = await ownedDirect(locale, id);
  const now = new Date();
  await db.update(listing).set({ status: "active", publishedAt: now, unpublishedAt: null, lastSeenAt: now, lastCheckedAt: now }).where(eq(listing.id, id));
  invalidateListingCaches();
  await db.insert(listingRevision).values({ listingId: id, field: "status", oldValue: l.status, newValue: "active", origin: "portal", changedBy: me.userId, changedAt: now });
}

export async function extendDeadline(locale: Locale, id: string, date: string) {
  z.string().date().parse(date);
  const { me, l } = await ownedDirect(locale, id);
  if (!isoDate.test(date)) return { ok: false as const };
  const now = new Date();
  await db.update(listing).set({ applicationDeadline: date, ...(l.status === "expired" ? { status: "active", publishedAt: now, unpublishedAt: null } : {}), lastCheckedAt: now }).where(eq(listing.id, id));
  invalidateListingCaches();
  await db.insert(listingRevision).values({ listingId: id, field: "application_deadline", oldValue: l.applicationDeadline, newValue: date, origin: "portal", changedBy: me.userId, changedAt: now });
  return { ok: true as const };
}

export async function deleteDraft(locale: Locale, id: string) {
  const { l } = await ownedDirect(locale, id, "editor");
  if (l.status !== "draft") return;
  const imgs = await db.query.listingImage.findMany({ where: eq(listingImage.listingId, id) });
  for (const i of imgs) await storage.delete(i.storageKey);
  await db.delete(listing).where(eq(listing.id, id));
  invalidateListingCaches();
  redirect({ href: "/portal/homes", locale });
}
