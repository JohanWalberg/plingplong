import { and, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { listingSlug, slugify } from "@/lib/slug";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-templates";
import { getAdapter, AdapterError, sniffFeedAdapter, type AdapterResult } from "./adapters";
import { politeFetch } from "./fetch";
import { normalise, type NormalisedListing } from "./normalise";
import { isAnomalousDrop } from "./anomaly";
import { blockKey, decide, scorePair, type DedupSubject } from "./dedup";

const { source, sourceRun, listing, listingSource, listingRevision, municipality, area, landlord, landlordMunicipality, duplicateCandidate } = schema;

const TRACKED_FIELDS = ["rent_monthly", "rooms", "size_sqm", "application_deadline", "move_in_date", "address", "queue_requirement"] as const;

type SyncOutcome = { ok: boolean; found: number; created: number; updated: number; gone: number; anomaly: boolean; error?: string };

/**
 * One crawl of one source. Rules (see brief §2–3):
 * - last_checked_at is set for every listing we saw or looked for on success.
 * - Absent on a successful run → removed (unless the anomaly guard fires).
 * - Failed run → nothing removed, source degraded/failed, contact emailed at 3.
 */
export async function syncSource(sourceId: string, opts: { manual?: boolean } = {}): Promise<SyncOutcome> {
  const src = await db.query.source.findFirst({ where: eq(source.id, sourceId), with: { landlord: { with: { municipalities: true } } } });
  if (!src) throw new Error(`source ${sourceId} not found`);
  if (src.status === "disabled" && !opts.manual) return { ok: false, found: 0, created: 0, updated: 0, gone: 0, anomaly: false, error: "disabled" };
  if (src.kind === "manual" || !src.url) return { ok: true, found: 0, created: 0, updated: 0, gone: 0, anomaly: false };

  const [run] = await db.insert(sourceRun).values({ sourceId }).returning({ id: sourceRun.id });
  const now = new Date();

  let result: AdapterResult;
  try {
    const config = (src.config ?? {}) as Parameters<typeof getAdapter>[0] extends string ? import("./adapters").SourceConfig : never;
    if (src.kind === "feed" || src.kind === "api") {
      // Feeds sniff JSON vs XML from the payload so a mislabelled adapter still works.
      const res = await politeFetch.fetchText(src.url, { headers: { ...(config.headers ?? {}), ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}) } });
      if (res.status >= 400) throw new AdapterError(res.status === 401 || res.status === 403 ? "auth" : "http_error", `HTTP ${res.status}`, res.status);
      const adapter = src.adapter === "generic-json" || src.adapter === "generic-xml" ? sniffFeedAdapter(res.text, res.contentType) : getAdapter(src.adapter);
      result = adapter.parse(res.text, config);
    } else {
      result = await getAdapter(src.adapter).fetch(src.url, config, politeFetch);
    }
  } catch (e) {
    return await recordFailure(src, run.id, e, now);
  }

  const found = result.listings.length;

  // Anomaly guard against the trailing median of the last five successful runs.
  const previous = await db
    .select({ found: sourceRun.listingsFound })
    .from(sourceRun)
    .where(and(eq(sourceRun.sourceId, src.id), eq(sourceRun.ok, true), sql`${sourceRun.id} <> ${run.id}`))
    .orderBy(desc(sourceRun.startedAt))
    .limit(5);
  const { anomaly } = isAnomalousDrop(found, previous.map((p) => p.found ?? 0));

  // Resolve municipalities for this landlord's listings.
  const munis = await db.query.municipality.findMany({ columns: { id: true, nameSv: true, nameEn: true, slugSv: true, code: true } });
  const muniByName = new Map<string, string>();
  for (const m of munis) {
    muniByName.set(m.nameSv.toLowerCase(), m.id);
    muniByName.set(m.nameEn.toLowerCase(), m.id);
    muniByName.set(m.slugSv, m.id);
  }
  const fallbackMuni = src.landlord.municipalities.length === 1 ? src.landlord.municipalities[0].municipalityId : null;
  const areas = await db.query.area.findMany({ columns: { id: true, municipalityId: true, name: true, slug: true }, extras: { lat: sql<number | null>`ST_Y(${area.centroid})`.as("lat"), lon: sql<number | null>`ST_X(${area.centroid})`.as("lon") } });

  const existing = await db
    .select({ ls: listingSource, l: listing })
    .from(listingSource)
    .innerJoin(listing, eq(listing.id, listingSource.listingId))
    .where(eq(listingSource.sourceId, src.id));
  const byExternalId = new Map(existing.map((e) => [e.ls.externalId, e]));

  let created = 0;
  let updated = 0;
  const seen = new Set<string>();
  const newListingIds: string[] = [];

  for (const raw of result.listings) {
    const n = normalise(raw, now, src.url ?? undefined);
    if (seen.has(n.externalId)) continue;
    seen.add(n.externalId);
    const queueRequirement = n.queueRequirement === "unknown" && src.queueDefault ? src.queueDefault : n.queueRequirement;
    const municipalityId = (n.municipalityName && (muniByName.get(n.municipalityName.toLowerCase()) ?? muniByName.get(slugify(n.municipalityName)))) || fallbackMuni;
    if (!municipalityId) continue; // cannot place the listing; counted in found but not stored
    const matchedArea = n.areaName ? areas.find((a) => a.municipalityId === municipalityId && (a.name.toLowerCase() === n.areaName!.toLowerCase() || a.slug === slugify(n.areaName!))) : undefined;
    const lat = n.lat ?? matchedArea?.lat ?? null;
    const lon = n.lon ?? matchedArea?.lon ?? null;

    const found = byExternalId.get(n.externalId);
    if (found) {
      const changes = diffFields(found.l, { ...n, queueRequirement });
      const wasGone = found.l.status === "removed";
      await db
        .update(listing)
        .set({
          address: n.address,
          areaName: n.areaName,
          areaId: matchedArea?.id ?? found.l.areaId,
          postcode: n.postcode ?? found.l.postcode,
          rentMonthly: n.rentMonthly,
          rooms: n.rooms,
          sizeSqm: n.sizeSqm,
          floor: n.floor ?? found.l.floor,
          moveInDate: n.moveInDate,
          applicationDeadline: n.applicationDeadline,
          queueRequirement,
          segment: n.segment,
          contractType: n.contractType,
          description: n.description ?? found.l.description,
          imageUrl: n.imageUrl,
          applicationUrl: n.sourceUrl ?? found.l.applicationUrl,
          location: lat !== null && lon !== null ? { x: lon, y: lat } : undefined,
          lastSeenAt: now,
          lastCheckedAt: now,
          status: wasGone ? "active" : found.l.status,
          removedAt: wasGone ? null : found.l.removedAt,
        })
        .where(eq(listing.id, found.l.id));
      await db
        .update(listingSource)
        .set({ lastSeenAt: now, lastCheckedAt: now, presentAtLastCheck: true, sourceUrl: n.sourceUrl, rawPayload: n.raw as object, rawPayloadAt: now })
        .where(and(eq(listingSource.listingId, found.l.id), eq(listingSource.sourceId, src.id)));
      if (wasGone) changes.push({ field: "status", oldValue: "removed", newValue: "active" });
      if (changes.length) {
        updated++;
        await db.insert(listingRevision).values(changes.map((c) => ({ listingId: found.l.id, ...c, origin: "crawl", changedAt: now })));
      }
      continue;
    }

    // New to this source: attach to an existing listing of the same landlord at the same address, else create.
    const sibling = await db.query.listing.findFirst({
      where: and(eq(listing.landlordId, src.landlordId), eq(listing.municipalityId, municipalityId), sql`lower(${listing.address}) = ${n.address.toLowerCase()}`, n.rooms === null ? sql`true` : eq(listing.rooms, n.rooms)),
      columns: { id: true, status: true },
    });
    let listingId: string;
    if (sibling) {
      listingId = sibling.id;
      if (sibling.status === "removed") {
        await db.update(listing).set({ status: "active", removedAt: null, lastSeenAt: now, lastCheckedAt: now }).where(eq(listing.id, listingId));
        await db.insert(listingRevision).values({ listingId, field: "status", oldValue: "removed", newValue: "active", origin: "crawl", changedAt: now });
      } else {
        await db.update(listing).set({ lastSeenAt: now, lastCheckedAt: now }).where(eq(listing.id, listingId));
      }
    } else {
      const muniName = munis.find((m) => m.id === municipalityId)!.nameSv;
      const base = listingSlug(n.address, muniName);
      const slug = await uniqueSlug(base);
      const [row] = await db
        .insert(listing)
        .values({
          slug,
          landlordId: src.landlordId,
          municipalityId,
          areaId: matchedArea?.id ?? null,
          address: n.address,
          postcode: n.postcode,
          areaName: n.areaName,
          location: lat !== null && lon !== null ? { x: lon, y: lat } : null,
          rentMonthly: n.rentMonthly,
          rooms: n.rooms,
          sizeSqm: n.sizeSqm,
          floor: n.floor,
          floorsTotal: n.floorsTotal,
          contractType: n.contractType,
          moveInDate: n.moveInDate,
          applicationDeadline: n.applicationDeadline,
          queueRequirement,
          segment: n.segment,
          applyRoute: "url",
          applicationUrl: n.sourceUrl,
          description: n.description,
          imageUrl: n.imageUrl,
          externalId: n.externalId,
          status: "active",
          publishedDirectly: false,
          firstSeenAt: now,
          lastSeenAt: now,
          lastCheckedAt: now,
        })
        .returning({ id: listing.id });
      listingId = row.id;
      created++;
      newListingIds.push(listingId);
    }
    await db
      .insert(listingSource)
      .values({ listingId, sourceId: src.id, externalId: n.externalId, sourceUrl: n.sourceUrl, firstSeenAt: now, lastSeenAt: now, lastCheckedAt: now, presentAtLastCheck: true, rawPayload: n.raw as object, rawPayloadAt: now })
      .onConflictDoNothing();
  }

  // Removals: present in DB for this source but absent from a successful run.
  let gone = 0;
  const absent = existing.filter((e) => !seen.has(e.ls.externalId) && e.ls.presentAtLastCheck);
  if (!anomaly) {
    for (const e of absent) {
      await db.update(listingSource).set({ presentAtLastCheck: false, lastCheckedAt: now }).where(and(eq(listingSource.listingId, e.l.id), eq(listingSource.sourceId, src.id)));
      const stillPresentElsewhere = await db.query.listingSource.findFirst({ where: and(eq(listingSource.listingId, e.l.id), eq(listingSource.presentAtLastCheck, true), sql`${listingSource.sourceId} <> ${src.id}`) });
      if (!stillPresentElsewhere && e.l.status === "active") {
        await db.update(listing).set({ status: "removed", removedAt: now, lastCheckedAt: now }).where(eq(listing.id, e.l.id));
        await db.insert(listingRevision).values({ listingId: e.l.id, field: "status", oldValue: "active", newValue: "removed", origin: "crawl", changedAt: now });
        gone++;
      } else {
        await db.update(listing).set({ lastCheckedAt: now }).where(eq(listing.id, e.l.id));
      }
    }
  } else {
    // Keep the rows untouched but record that we looked.
    if (absent.length) await db.update(listing).set({ lastCheckedAt: now }).where(inArray(listing.id, absent.map((a) => a.l.id)));
  }

  await db.update(sourceRun).set({ finishedAt: new Date(), ok: true, listingsFound: found, listingsNew: created, listingsUpdated: updated, listingsGone: gone, anomaly }).where(eq(sourceRun.id, run.id));
  await db
    .update(source)
    .set({
      status: anomaly ? "needs_review" : src.status === "needs_review" ? "needs_review" : "active",
      lastRunAt: now,
      lastSuccessAt: now,
      nextRunAt: new Date(now.getTime() + src.fetchIntervalMinutes * 60_000),
      consecutiveFailures: 0,
      lastError: null,
    })
    .where(eq(source.id, src.id));
  await db.update(landlord).set({ isMonitored: true }).where(eq(landlord.id, src.landlordId));

  if (newListingIds.length) await findDuplicates(newListingIds);

  return { ok: true, found, created, updated, gone, anomaly };
}

async function recordFailure(src: typeof source.$inferSelect & { landlord: { name: string } }, runId: string, e: unknown, now: Date): Promise<SyncOutcome> {
  const err = e instanceof AdapterError ? e : new AdapterError("unreachable", (e as Error).message);
  const failures = src.consecutiveFailures + 1;
  await db.update(sourceRun).set({ finishedAt: new Date(), ok: false, errorClass: err.errorClass, errorDetail: err.message }).where(eq(sourceRun.id, runId));
  await db
    .update(source)
    .set({
      status: src.status === "disabled" ? "disabled" : failures >= 3 ? "failed" : "degraded",
      lastRunAt: now,
      nextRunAt: new Date(now.getTime() + Math.min(src.fetchIntervalMinutes * 60_000 * 2 ** Math.min(failures, 4), 24 * 60 * 60_000)),
      consecutiveFailures: failures,
      lastError: `${err.errorClass}: ${err.message}`,
    })
    .where(eq(source.id, src.id));
  if (failures === 3 && src.techContactEmail) {
    try {
      const mail = await renderEmail("sv", "sourceFailed", { source: src.url ?? src.landlord.name, count: failures, error: err.message });
      await sendEmail({ to: src.techContactEmail, ...mail });
    } catch (mailErr) {
      console.error("could not email tech contact", mailErr);
    }
  }
  return { ok: false, found: 0, created: 0, updated: 0, gone: 0, anomaly: false, error: `${err.errorClass}: ${err.message}` };
}

function diffFields(before: typeof listing.$inferSelect, after: NormalisedListing & { queueRequirement: string }) {
  const map: Record<(typeof TRACKED_FIELDS)[number], [unknown, unknown]> = {
    rent_monthly: [before.rentMonthly, after.rentMonthly],
    rooms: [before.rooms, after.rooms],
    size_sqm: [before.sizeSqm, after.sizeSqm],
    application_deadline: [before.applicationDeadline, after.applicationDeadline],
    move_in_date: [before.moveInDate, after.moveInDate],
    address: [before.address, after.address],
    queue_requirement: [before.queueRequirement, after.queueRequirement],
  };
  const out: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
  for (const f of TRACKED_FIELDS) {
    const [a, b] = map[f];
    if ((a ?? null) !== (b ?? null)) out.push({ field: f, oldValue: a === null || a === undefined ? null : String(a), newValue: b === null || b === undefined ? null : String(b) });
  }
  return out;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const hit = await db.query.listing.findFirst({ where: eq(listing.slug, slug), columns: { id: true } });
    if (!hit) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

/** Score new listings against active listings in the same block; write candidates for staff. */
export async function findDuplicates(listingIds: string[]) {
  const subjects = await loadSubjects(listingIds);
  for (const s of subjects) {
    const rentLow = s.rentMonthly === null ? null : s.rentMonthly - 750;
    const rentHigh = s.rentMonthly === null ? null : s.rentMonthly + 750;
    const candidates = await db
      .select({ id: listing.id, landlordId: listing.landlordId, municipalityId: listing.municipalityId, address: listing.address, rentMonthly: listing.rentMonthly, rooms: listing.rooms, sizeSqm: listing.sizeSqm, lat: sql<number | null>`ST_Y(${listing.location})`, lon: sql<number | null>`ST_X(${listing.location})` })
      .from(listing)
      .where(
        and(
          eq(listing.municipalityId, s.municipalityId),
          eq(listing.status, "active"),
          sql`${listing.id} <> ${s.id}`,
          rentLow === null ? sql`true` : sql`(${listing.rentMonthly} is null or ${listing.rentMonthly} between ${rentLow} and ${rentHigh})`,
          s.rooms === null ? sql`true` : sql`(${listing.rooms} is null or floor(${listing.rooms}) = ${Math.floor(s.rooms)})`,
        ),
      )
      .limit(200);
    for (const c of candidates) {
      if (blockKey(c) !== blockKey(s) && s.rentMonthly !== null && c.rentMonthly !== null && Math.abs(s.rentMonthly - c.rentMonthly) > 500) continue;
      const score = scorePair(s, c);
      const verdict = decide(score, s.landlordId === c.landlordId);
      if (verdict === "ignore") continue;
      if (verdict === "merge") {
        await mergeListings(c.id, s.id, null);
        break;
      }
      const [a, b] = s.id < c.id ? [s.id, c.id] : [c.id, s.id];
      await db.insert(duplicateCandidate).values({ listingAId: a, listingBId: b, score: score.score.toFixed(3), features: score.features }).onConflictDoNothing();
    }
  }
}

async function loadSubjects(ids: string[]): Promise<DedupSubject[]> {
  if (!ids.length) return [];
  return db
    .select({ id: listing.id, landlordId: listing.landlordId, municipalityId: listing.municipalityId, address: listing.address, rentMonthly: listing.rentMonthly, rooms: listing.rooms, sizeSqm: listing.sizeSqm, lat: sql<number | null>`ST_Y(${listing.location})`, lon: sql<number | null>`ST_X(${listing.location})` })
    .from(listing)
    .where(inArray(listing.id, ids));
}

/** Merge `loserId` into `survivorId`: move sources, mark the loser removed and pointing at the survivor. */
export async function mergeListings(survivorId: string, loserId: string, actorId: string | null) {
  const now = new Date();
  const loserSources = await db.query.listingSource.findMany({ where: eq(listingSource.listingId, loserId) });
  for (const ls of loserSources) {
    await db.insert(listingSource).values({ ...ls, listingId: survivorId }).onConflictDoNothing();
  }
  await db.delete(listingSource).where(eq(listingSource.listingId, loserId));
  await db.update(listing).set({ status: "removed", removedAt: now, mergedIntoId: survivorId, lastCheckedAt: now }).where(eq(listing.id, loserId));
  await db.insert(listingRevision).values({ listingId: loserId, field: "status", oldValue: "active", newValue: "removed", origin: actorId ? "admin" : "system", changedBy: actorId, changedAt: now });
  await db.update(duplicateCandidate).set({ decision: "merged", decidedAt: now, decidedBy: actorId }).where(sql`(${duplicateCandidate.listingAId} = ${loserId} or ${duplicateCandidate.listingBId} = ${loserId}) and ${duplicateCandidate.decision} = 'pending'`);
}

/** Direct listings: seven days after the deadline they expire automatically. */
export async function expireDirectListings(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const rows = await db
    .update(listing)
    .set({ status: "expired", unpublishedAt: now, lastCheckedAt: now })
    .where(and(eq(listing.publishedDirectly, true), eq(listing.status, "active"), sql`${listing.applicationDeadline} < ${cutoff}`))
    .returning({ id: listing.id });
  if (rows.length) await db.insert(listingRevision).values(rows.map((r) => ({ listingId: r.id, field: "status", oldValue: "active", newValue: "expired", origin: "system", changedAt: now })));
  return rows.length;
}

/** Raw payload retention: 90 days. */
export async function pruneRawPayloads(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60_000);
  await db.update(listingSource).set({ rawPayload: null, rawPayloadAt: null }).where(lt(listingSource.rawPayloadAt, cutoff));
}

/** Sources due for a run (used by the scheduler). */
export async function dueSources(now: Date = new Date()) {
  return db
    .select({ id: source.id })
    .from(source)
    .where(and(inArray(source.status, ["pending", "active", "degraded", "failed", "needs_review"]), inArray(source.kind, ["feed", "api", "html"]), or(isNull(source.nextRunAt), lte(source.nextRunAt, now))));
}

void municipality;
void landlordMunicipality;
